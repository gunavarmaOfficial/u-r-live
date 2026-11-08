/**
 * Google Identity Services token verification.
 * Verifies the ID token (JWT) sent by the browser against Google's public
 * JWKS so the server never trusts client-supplied email/name claims.
 */
import crypto from 'crypto';

export interface GoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

interface CachedCerts {
  fetchedAt: number;
  keys: Array<{ kid: string; alg: string; pem: string }>;
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const CERT_TTL_MS = 60 * 60 * 1000;
const ALLOWED_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

let cache: CachedCerts | null = null;
let inFlight: Promise<CachedCerts> | null = null;

async function loadCerts(): Promise<CachedCerts> {
  if (cache && Date.now() - cache.fetchedAt < CERT_TTL_MS) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch(CERTS_URL);
    if (!res.ok) throw new Error(`Google JWKS request failed (${res.status})`);
    const body: any = await res.json();
    const keys = (body.keys || [])
      .filter((k: any) => k.kty === 'RSA' && k.kid && k.n && k.e)
      .map((k: any) => ({
        kid: k.kid,
        alg: k.alg || 'RS256',
        pem: crypto.createPublicKey({ key: { kty: k.kty, n: k.n, e: k.e }, format: 'jwk' })
          .export({ type: 'spki', format: 'pem' })
          .toString(),
      }));
    cache = { fetchedAt: Date.now(), keys };
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

function decodeJson(segment: string): any {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf-8'));
}

export async function verifyGoogleIdToken(
  credential: string,
  clientId: string | undefined
): Promise<GoogleClaims> {
  if (!clientId) throw new Error('Google sign-in is not configured');

  const parts = credential.split('.');
  if (parts.length !== 3) throw new Error('Malformed Google credential');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Google token algorithm');

  const certs = await loadCerts();
  const key = certs.keys.find((entry) => entry.kid === header.kid);
  if (!key) throw new Error('Unknown Google signing key');

  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    key.pem,
    Buffer.from(encodedSignature, 'base64url')
  );
  if (!valid) throw new Error('Invalid Google token signature');

  if (!ALLOWED_ISSUERS.has(payload.iss)) throw new Error('Invalid Google token issuer');
  if (payload.aud !== clientId) throw new Error('Google token audience mismatch');
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error('Google token expired');
  if (!payload.sub || !payload.email) throw new Error('Google token missing identity claims');
  if (payload.email_verified === false) throw new Error('Google email is not verified');

  return {
    sub: String(payload.sub),
    email: String(payload.email),
    emailVerified: payload.email_verified !== false,
    name: String(payload.name || payload.email.split('@')[0]),
    picture: payload.picture ? String(payload.picture) : undefined,
  };
}
