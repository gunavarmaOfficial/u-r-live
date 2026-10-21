/**
 * Authentication & Session Security for U-R-LIVE
 * Implements cryptographically signed session tokens (HMAC-SHA256)
 * to prevent user impersonation and admin privilege escalation.
 */
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { UserProfile } from './types';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('SESSION_SECRET environment variable is required in production');
      })()
    : 'dev_session_secret_u_r_live_secure_key_2026');

export interface SessionPayload {
  userId: string;
  role: 'user' | 'admin';
  createdAt: number;
  expiresAt: number;
  nonce: string;
}

const DEFAULT_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Creates a cryptographically signed session token:
 * format: <base64url(payload)>.<hmacSha256Signature>
 */
export function createSessionToken(
  userId: string,
  role: 'user' | 'admin' = 'user',
  durationMs = DEFAULT_SESSION_DURATION_MS
): string {
  const payload: SessionPayload = {
    userId,
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMs,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a session token's cryptographic signature and expiration.
 * Returns the decoded payload if valid, or null if tampered/expired.
 */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    );

    if (!payload.userId || !payload.role || !payload.expiresAt) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts a session token from request headers (Authorization: Bearer <token> or x-session-token).
 */
export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  return null;
}

export interface ResolvedSession {
  user: UserProfile;
  sessionToken: string;
  isNew: boolean;
}

/**
 * Resolves an authenticated user session from the request token.
 * Never trusts raw, unauthenticated 'x-user-id' headers.
 * If no valid token is provided, creates a new guest user and issues a signed token.
 */
export function resolveSessionUser(req: Request): ResolvedSession {
  const token = extractSessionToken(req);

  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const existing = db.getUser(payload.userId);
      if (existing) {
        // Enforce that token role matches user's current role in database
        if (existing.role === payload.role) {
          existing.lastActiveAt = Date.now();
          db.saveUser(existing);
          return { user: existing, sessionToken: token, isNew: false };
        }
      }
    }
  }

  // Generate a fresh authenticated guest session
  const guestId = 'guest_' + crypto.randomBytes(6).toString('hex');
  const guestUser: UserProfile = {
    id: guestId,
    displayName: 'Stranger ' + Math.floor(1000 + Math.random() * 9000),
    gender: 'unspecified',
    country: 'GLOBAL',
    isAdultVerified: false,
    role: 'user',
    status: 'active',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  db.saveUser(guestUser);
  const sessionToken = createSessionToken(guestUser.id, 'user');
  return { user: guestUser, sessionToken, isNew: true };
}

/**
 * Middleware: Requires a valid session with 'admin' role.
 * Fails closed if token is missing, invalid, or role is not admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Missing session token.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
    return;
  }

  const user = db.getUser(payload.userId);
  if (!user || user.role !== 'admin' || user.status !== 'active') {
    res.status(403).json({ error: 'Unauthorized. Active admin account required.' });
    return;
  }

  // Attach verified user to request for downstream handlers
  (req as any).user = user;
  next();
}
