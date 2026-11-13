/**
 * OmeLive Full-Stack Application Server
 * Serves Express REST APIs, WebRTC WebSocket Signaling, and Vite frontend middleware
 */
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { db } from './server/db';
import { getMatchmaking, syncBlock } from './server/matchmaking';
import { pingRedis, getRedisStatus, closeRedis, isRedisConfigured } from './server/redis';
import { setupSignaling } from './server/webrtc';
import { httpSignaling } from './server/httpSignaling';
import {
  resolveSessionUser,
  peekSessionUser,
  createSessionToken,
  extractSessionToken,
  hashAuditValue,
  requireAdmin,
} from './server/auth';
import { UserProfile, ReportCategory } from './server/types';
import { verifyGoogleIdToken } from './server/googleAuth';
import {
  distributedApiRateLimit,
  guestSessionRateLimit,
  adminLoginRateLimit,
  reportRateLimit,
} from './server/rateLimit';
import { requireTurnstile } from './server/turnstile';

const PORT = Number(process.env.PORT) || 3000;
const LEGAL_TERMS_VERSION = process.env.LEGAL_TERMS_VERSION || '2026-10-28';

/** Revokes the session token presented on this request (used when identity or role changes). */
function revokePresentedSession(req: Request): void {
  const token = extractSessionToken(req);
  if (!token) return;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.revokeSession(tokenHash);
}

const app = express();
// Enable reverse-proxy trust for Cloudflare / Nginx / Render / Railway reverse proxies
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              objectSrc: ["'none'"],
              scriptSrc: [
                "'self'",
                // Inline JSON-LD + Google Identity Services
                "'unsafe-inline'",
                'https://accounts.google.com',
                'https://www.gstatic.com',
              ],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
              mediaSrc: ["'self'", 'blob:'],
              frameSrc: ['https://accounts.google.com'],
              workerSrc: ["'self'", 'blob:'],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    // Google Identity Services opens its own popup and posts back to the opener
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use(compression());

// CORS for split deploys: static frontend on one origin (e.g. Vercel) calling
// this API from another. Same-origin requests are unaffected; only origins
// listed in CORS_ORIGINS (comma-separated) get cross-origin access.
const corsAllowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const isSameOrigin = Boolean(
    origin &&
      host &&
      (origin === `http://${host}` ||
        origin === `https://${host}` ||
        origin === `http://${host.replace(/:\d+$/, '')}` ||
        origin === `https://${host.replace(/:\d+$/, '')}`)
  );
  const isVercelOrigin = Boolean(
    origin && (origin.endsWith('.vercel.app') || origin === 'https://u-r-live.vercel.app')
  );
  const allowed =
    !origin ||
    isSameOrigin ||
    isVercelOrigin ||
    corsAllowedOrigins.length === 0 ||
    corsAllowedOrigins.includes('*') ||
    corsAllowedOrigins.includes(origin.replace(/\/+$/, ''));

  if (allowed) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,x-session-token,x-user-id'
    );
  }
  if (req.method === 'OPTIONS') {
    res.status(allowed ? 204 : 403).end();
    return;
  }
  if (origin && !allowed) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  next();
});

const server = http.createServer(app);

// Webhook raw-body preservation for HMAC signature checks
app.use(
  express.json({
    limit: '256kb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf-8');
    },
  })
);

// Global API rate limiting (cluster-wide when Redis is configured)
app.use('/api', distributedApiRateLimit);

// -------------------------------------------------------------
// Public runtime config & versioned legal consent
// -------------------------------------------------------------
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    termsVersion: LEGAL_TERMS_VERSION,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
    siteUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || null,
  });
});

app.get('/api/legal/status', (req: Request, res: Response) => {
  const user = peekSessionUser(req);
  res.json({
    currentVersion: LEGAL_TERMS_VERSION,
    acceptedVersion: user?.termsVersion ?? null,
    needsAcceptance: user?.termsVersion !== LEGAL_TERMS_VERSION,
  });
});

app.post('/api/legal/accept', async (req: Request, res: Response) => {
  const schema = z.object({
    termsVersion: z.string().min(1).max(32),
    ageConfirmed: z.boolean(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid consent payload' });
    return;
  }

  if (!parsed.data.ageConfirmed) {
    res.status(400).json({ error: 'You must confirm you are at least 18 years old.', code: 'AGE_NOT_CONFIRMED' });
    return;
  }

  if (parsed.data.termsVersion !== LEGAL_TERMS_VERSION) {
    res.status(409).json({
      error: 'Our Terms have been updated. Reload the page to review and accept the current version.',
      code: 'TERMS_VERSION_MISMATCH',
      currentVersion: LEGAL_TERMS_VERSION,
    });
    return;
  }

  const session = resolveSessionUser(req);
  try {
    const updated = await db.acceptLegalConsent(session.user.id, LEGAL_TERMS_VERSION, {
      ipHash: hashAuditValue(req.ip),
      userAgentHash: hashAuditValue(req.get('user-agent')),
    });

    if (!updated) {
      res.status(404).json({ error: 'Session not found. Please reload the page.' });
      return;
    }

    res.json({
      user: updated,
      sessionToken: session.sessionToken,
      acceptedAt: updated.termsAcceptedAt,
    });
  } catch (err: any) {
    console.error('[Legal] Failed to record consent:', err.message);
    res.status(503).json({ error: 'Could not record your consent. Please try again.' });
  }
});

// -------------------------------------------------------------
// Authentication & User Profile APIs
// -------------------------------------------------------------
app.get('/api/auth/session', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);

  res.json({
    user: session.user,
    sessionToken: session.sessionToken,
  });
});

app.post('/api/auth/login', guestSessionRateLimit, (req: Request, res: Response) => {
  const schema = z.object({
    displayName: z.string().min(2).max(30).optional(),
    gender: z.enum(['unspecified', 'male', 'female', 'non-binary']).optional(),
    country: z.string().optional(),
    isAdultVerified: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' });
    return;
  }

  const { displayName, gender, country, isAdultVerified } = parsed.data;
  const session = resolveSessionUser(req);
  const current = session.user;

  const updated = db.saveUser({
    ...current,
    displayName: displayName || current.displayName,
    gender: gender || current.gender,
    country: country || current.country,
    isAdultVerified: isAdultVerified ?? current.isAdultVerified,
  });

  res.json({
    user: updated,
    sessionToken: session.sessionToken,
  });
});

// -------------------------------------------------------------
// User Preferences & Filter APIs
// -------------------------------------------------------------
app.get('/api/user/preferences', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const preferences = db.getUserPreferences(session.user.id);

  res.json({
    preferences: preferences || null,
  });
});

app.post('/api/user/preferences', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);

  const schema = z.object({
    preferredCountry: z.string().optional(),
    preferredCountries: z.array(z.string()).optional(),
    isMultipleCountries: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
    preferredLanguages: z.array(z.string()).optional(),
    preferredGender: z.enum(['any', 'male', 'female']).optional(),
    chatMode: z.enum(['video', 'text']).optional(),
    interests: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' });
    return;
  }

  const data = parsed.data;

  const updated = db.saveUserPreferences(session.user.id, {
    chatMode: data.chatMode || 'video',
    preferredGender: data.preferredGender || 'any',
    preferredCountry: data.preferredCountry || 'GLOBAL',
    preferredCountries: data.preferredCountries || ['GLOBAL'],
    isMultipleCountries: Boolean(data.isMultipleCountries),
    languages: data.languages || data.preferredLanguages || [],
    preferredLanguages: data.preferredLanguages || data.languages || [],
    interests: data.interests || [],
  });

  res.json({
    success: true,
    preferences: updated,
  });
});

app.post('/api/user/preferences/reset', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const reset = db.saveUserPreferences(session.user.id, {
    preferredCountry: 'GLOBAL',
    preferredCountries: ['GLOBAL'],
    isMultipleCountries: false,
    languages: ['en'],
    preferredLanguages: ['en'],
    preferredGender: 'any',
    interests: [],
    interestMatchingEnabled: false,
  });

  res.json({
    success: true,
    preferences: reset,
  });
});

app.post('/api/auth/admin-login', adminLoginRateLimit, (req: Request, res: Response) => {
  const schema = z.object({
    adminKey: z.string().min(1, 'Admin key is required'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Admin key is required' });
    return;
  }

  const configuredKey = process.env.ADMIN_SECRET_KEY;
  if (!configuredKey) {
    res.status(503).json({
      error: 'Admin access is disabled. ADMIN_SECRET_KEY is not configured in the server environment.',
    });
    return;
  }

  const providedKey = parsed.data.adminKey;
  let isMatch = false;
  try {
    isMatch =
      providedKey.length === configuredKey.length &&
      crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(configuredKey));
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  let adminUser = db.getUser('admin-root-001');
  if (!adminUser) {
    adminUser = db.saveUser({
      id: 'admin-root-001',
      displayName: 'Safety Admin',
      gender: 'unspecified',
      country: 'IN',
      isAdultVerified: true,
      role: 'admin',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  }

  // Admin login always replaces the presented token (privilege escalation rotation)
  revokePresentedSession(req);

  const sessionToken = createSessionToken(adminUser.id, 'admin');
  res.json({
    user: adminUser,
    sessionToken,
  });
});

app.post('/api/auth/google', async (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({
      error: 'Google sign-in is not enabled on this server.',
      code: 'GOOGLE_NOT_CONFIGURED',
    });
    return;
  }

  const schema = z.object({
    credential: z.string().min(40).max(8192),
    termsVersion: z.string().min(1).max(32),
    ageConfirmed: z.boolean(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Google sign-in payload' });
    return;
  }

  if (!parsed.data.ageConfirmed) {
    res.status(400).json({ error: 'You must confirm you are at least 18 years old.', code: 'AGE_NOT_CONFIRMED' });
    return;
  }

  if (parsed.data.termsVersion !== LEGAL_TERMS_VERSION) {
    res.status(409).json({
      error: 'Our Terms have been updated. Reload the page to review and accept the current version.',
      code: 'TERMS_VERSION_MISMATCH',
      currentVersion: LEGAL_TERMS_VERSION,
    });
    return;
  }

  let claims;
  try {
    claims = await verifyGoogleIdToken(parsed.data.credential, clientId);
  } catch (err: any) {
    res.status(401).json({ error: 'Google sign-in could not be verified. Please try again.', code: 'GOOGLE_TOKEN_INVALID' });
    return;
  }

  let user = db.findUserByGoogleId(claims.sub) || db.findUserByEmail(claims.email);

  if (user) {
    if (user.status !== 'active') {
      res.status(403).json({ error: 'This account is not available. Contact support.' });
      return;
    }
    user = await db.saveUserAwait({
      ...user,
      displayName: user.displayName || claims.name,
      avatarUrl: claims.picture || user.avatarUrl,
      googleId: claims.sub,
      email: claims.email,
      authProvider: 'google',
      lastActiveAt: Date.now(),
    });
  } else {
    const now = Date.now();
    user = await db.saveUserAwait({
      id: 'usr_g_' + crypto.randomBytes(8).toString('hex'),
      displayName: claims.name.slice(0, 100),
      email: claims.email,
      avatarUrl: claims.picture,
      googleId: claims.sub,
      authProvider: 'google',
      gender: 'unspecified',
      country: 'GLOBAL',
      isAdultVerified: false,
      role: 'user',
      status: 'active',
      createdAt: now,
      lastActiveAt: now,
    });
  }

  try {
    const consented = await db.acceptLegalConsent(user.id, LEGAL_TERMS_VERSION, {
      ipHash: hashAuditValue(req.ip),
      userAgentHash: hashAuditValue(req.get('user-agent')),
    });
    if (consented) user = consented;
  } catch (err: any) {
    console.error('[Auth] Failed to record Google consent:', err.message);
    res.status(503).json({ error: 'Could not record your consent. Please try again.' });
    return;
  }

  // Rotate the token when identity/privilege changes (guest -> Google account)
  revokePresentedSession(req);

  const sessionToken = createSessionToken(user.id, user.role);

  res.json({
    user,
    sessionToken,
  });
});

app.post('/api/profile/update', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;

  const schema = z.object({
    displayName: z.string().min(2).max(30).optional(),
    gender: z.enum(['unspecified', 'male', 'female', 'non-binary']).optional(),
    country: z.string().min(2).max(40).optional(),
    isAdultVerified: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' });
    return;
  }

  const updated = db.saveUser({
    ...user,
    displayName: parsed.data.displayName || user.displayName,
    gender: parsed.data.gender || user.gender,
    country: parsed.data.country || user.country,
    isAdultVerified: parsed.data.isAdultVerified ?? user.isAdultVerified,
  });

  res.json({
    user: updated,
    sessionToken: session.sessionToken,
  });
});

// -------------------------------------------------------------
// Safety & Moderation APIs
// -------------------------------------------------------------
const reportHandler = async (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const reporter = session.user;

  const schema = z.object({
    reportedUserId: z.string().min(1, 'reportedUserId is required'),
    reportedUserName: z.string().optional(),
    category: z.enum([
      'harassment',
      'suspected_underage',
      'sexual_misconduct',
      'threats_abuse',
      'scam_spam',
      'non_consensual',
      'other',
    ]),
    description: z.string().max(1000).default(''),
    sessionId: z.string().optional(),
    turnstileToken: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report fields' });
    return;
  }

  const { reportedUserId, reportedUserName, category, description, sessionId } = parsed.data;

  // Cannot report oneself
  if (reporter.id === reportedUserId) {
    res.status(400).json({ error: 'You cannot report yourself' });
    return;
  }

  // Validate reported user exists
  const targetUser = db.getUser(reportedUserId);
  if (!targetUser) {
    res.status(404).json({ error: 'Reported user does not exist or has been deleted' });
    return;
  }

  // Prevent duplicate reports for the same user while one is already pending
  const existingReports = db.getReports();
  const hasDuplicate = existingReports.some(
    (r) =>
      r.reporterId === reporter.id &&
      r.reportedUserId === reportedUserId &&
      r.status === 'pending' &&
      Date.now() - r.createdAt < 24 * 60 * 60 * 1000
  );

  if (hasDuplicate) {
    res.status(409).json({
      error: 'You have already submitted a report for this user that is currently under review.',
      code: 'DUPLICATE_REPORT',
    });
    return;
  }

  const report = db.createReport({
    reporterId: reporter.id,
    reporterName: reporter.displayName,
    reportedUserId,
    reportedUserName: targetUser.displayName || reportedUserName || 'Anonymous User',
    category: category as ReportCategory,
    description,
    sessionId,
  });

  // Automatically block reported user from future matchmaking
  db.blockUser(reporter.id, reportedUserId);
  syncBlock(reporter.id, reportedUserId, true);

  // Moderation audit trail
  db.addAuditLog({
    adminUserId: 'system',
    action: 'report_created',
    targetType: 'report',
    targetId: report.id,
    details: {
      reporterId: reporter.id,
      reportedUserId,
      category,
    },
  });

  res.json({
    success: true,
    message: 'Report submitted successfully. Thank you for keeping our community safe.',
    reportId: report.id,
  });
};

app.post('/api/safety/report', reportRateLimit, requireTurnstile(), reportHandler);
app.post('/api/reports', reportRateLimit, requireTurnstile(), reportHandler);

app.post('/api/safety/block', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const blocker = session.user;

  const schema = z.object({
    blockedUserId: z.string().min(1, 'blockedUserId is required'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'blockedUserId is required' });
    return;
  }

  if (blocker.id === parsed.data.blockedUserId) {
    res.status(400).json({ error: 'You cannot block yourself' });
    return;
  }

  const target = db.getUser(parsed.data.blockedUserId);
  if (!target) {
    res.status(404).json({ error: 'User to block not found' });
    return;
  }

  const block = db.blockUser(blocker.id, parsed.data.blockedUserId);
  syncBlock(blocker.id, parsed.data.blockedUserId, true);
  db.addAuditLog({
    adminUserId: blocker.id,
    action: 'user_blocked',
    targetType: 'user',
    targetId: parsed.data.blockedUserId,
    details: { blockerId: blocker.id },
  });

  res.json({ success: true, block });
});

app.post('/api/safety/unblock', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const blocker = session.user;

  const schema = z.object({
    blockedUserId: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'blockedUserId is required' });
    return;
  }

  const unblocked = db.unblockUser(blocker.id, parsed.data.blockedUserId);
  if (unblocked) syncBlock(blocker.id, parsed.data.blockedUserId, false);
  res.json({ success: unblocked });
});

app.get('/api/safety/blocks', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;
  const blockedIds = db.getBlockedUsers(user.id);
  res.json({ blockedUserIds: blockedIds });
});

app.post('/api/blocks', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const blocker = session.user;
  const { blockedUserId } = req.body || {};
  if (!blockedUserId) {
    res.status(400).json({ error: 'blockedUserId is required' });
    return;
  }
  if (blocker.id === blockedUserId) {
    res.status(400).json({ error: 'You cannot block yourself' });
    return;
  }
  const block = db.blockUser(blocker.id, blockedUserId);
  syncBlock(blocker.id, blockedUserId, true);
  res.json({ success: true, block });
});

app.get('/api/blocks', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  res.json({ blockedUserIds: db.getBlockedUsers(session.user.id) });
});

// -------------------------------------------------------------
// Admin APIs (Protected by requireAdmin middleware)
// -------------------------------------------------------------
app.get('/api/admin/overview', requireAdmin, (_req: Request, res: Response) => {
  const users = db.getAllUsers();
  const reports = db.getReports();
  const queueLength = getMatchmaking().getQueueLength();
  const activeMatches = getMatchmaking().getActiveMatchesCount();

  res.json({
    totalUsers: users.length,
    activeQueueLength: queueLength,
    activeMatchesCount: activeMatches,
    pendingReportsCount: reports.filter((r) => r.status === 'pending').length,
    totalReportsCount: reports.length,
  });
});

app.get('/api/admin/reports', requireAdmin, (_req: Request, res: Response) => {
  const reports = db.getReports();
  res.json({ reports });
});

app.post('/api/admin/reports/:reportId/action', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user;
  const { reportId } = req.params;
  const schema = z.object({
    status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed', 'escalated']),
    actionTaken: z.enum(['none', 'warned', 'suspended', 'banned']).optional(),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid action parameters' });
    return;
  }

  const updated = db.updateReportStatus(
    reportId,
    parsed.data.status,
    parsed.data.actionTaken,
    parsed.data.notes
  );

  if (!updated) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  // If banned or suspended, update the user account status
  if (parsed.data.actionTaken === 'banned') {
    db.updateUserStatus(updated.reportedUserId, 'banned');
  } else if (parsed.data.actionTaken === 'suspended') {
    db.updateUserStatus(updated.reportedUserId, 'suspended');
  }

  db.addAuditLog({
    adminUserId: admin.id,
    action: `report_${parsed.data.status}`,
    targetType: 'report',
    targetId: reportId,
    details: { actionTaken: parsed.data.actionTaken, targetUser: updated.reportedUserId },
  });

  res.json({ success: true, report: updated });
});

app.get('/api/admin/users', requireAdmin, (_req: Request, res: Response) => {
  const users = db.getAllUsers();
  res.json({ users });
});

app.post('/api/admin/users/:userId/status', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user;
  const { userId } = req.params;
  const schema = z.object({
    status: z.enum(['active', 'suspended', 'banned']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const updated = db.updateUserStatus(userId, parsed.data.status);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  db.addAuditLog({
    adminUserId: admin.id,
    action: `user_status_${parsed.data.status}`,
    targetType: 'user',
    targetId: userId,
  });

  res.json({ success: true, user: updated });
});

app.get('/api/admin/audit-logs', requireAdmin, (_req: Request, res: Response) => {
  res.json({ logs: db.getAuditLogs() });
});

// -------------------------------------------------------------
// WebRTC ICE & Health APIs
// -------------------------------------------------------------
app.get('/api/webrtc/ice-servers', (_req: Request, res: Response) => {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // Managed TURN credentials from env if set
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers });
});

app.get('/api/system/health', async (_req: Request, res: Response) => {
  // Short shared cache so polling clients and the CDN do not stampede the origin
  res.setHeader('Cache-Control', 'public, max-age=3, stale-while-revalidate=10');
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    queueLength: await getMatchmaking().queueLength(),
    activeMatches: getMatchmaking().getActiveMatchesCount(),
    turnConfigured: !!process.env.TURN_URL,
    presence: getRedisStatus(),
  });
});

// Liveness: the process is up and serving.
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

// Readiness: lightweight server ready without external database requirements.
app.get('/readyz', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    mode: 'in-memory-zero-storage',
  });
});

// -------------------------------------------------------------
// HTTP WebRTC Signaling & Matchmaking Endpoints
// (Used in serverless environments like Vercel where WebSockets are unavailable)
// -------------------------------------------------------------
app.post('/api/match/join', (req: Request, res: Response) => {
  const { userId, country, gender, preferences } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const result = httpSignaling.joinQueue(userId, country, gender, preferences);
  res.json(result);
});

app.get('/api/match/poll', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const result = httpSignaling.poll(userId);
  res.json(result);
});

app.post('/api/match/signal', (req: Request, res: Response) => {
  const { matchId, senderId, message } = req.body || {};
  if (!matchId || !senderId || !message) {
    return res.status(400).json({ error: 'matchId, senderId and message are required' });
  }
  const ok = httpSignaling.sendSignal(matchId, senderId, message);
  res.json({ ok });
});

app.post('/api/match/leave', (req: Request, res: Response) => {
  const { userId } = req.body || {};
  if (userId) {
    httpSignaling.leave(userId);
  }
  res.json({ ok: true });
});

// Setup WebSocket Signaling (skipped in Vercel serverless functions)
const wss = new WebSocketServer(process.env.VERCEL ? { noServer: true } : { server, path: '/ws' });
if (!process.env.VERCEL) {
  setupSignaling(wss);
}

// Unknown API routes must return JSON, never the SPA HTML document —
// the client parses every /api response as JSON and a doctype page
// surfaces as a confusing "Unexpected token '<'" error.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// -------------------------------------------------------------
// Frontend Integration (Vite Middleware in dev / Static in prod)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/.data/**', '**/.git/**', '**/*.json', '**/server/tests/**', '**/*.log'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const sendHtml = (res: Response, file: string, status = 200) => {
      res.status(status).sendFile(file, {
        headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
      });
    };

    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      })
    );
    // `redirect: false` keeps /terms at 200 instead of 301-ing to /terms/, so the
    // served URL matches the canonical tag emitted during prerender.
    app.use(express.static(distPath, { index: false, maxAge: '1h', redirect: false }));

    app.get('*', (req: Request, res: Response) => {
      let pathname: string;
      try {
        pathname = decodeURIComponent(req.path);
      } catch {
        pathname = req.path;
      }

      // Collapse duplicate trailing-slash URLs onto the canonical path.
      if (pathname.length > 1 && pathname.endsWith('/')) {
        res.redirect(301, pathname.replace(/\/+$/, ''));
        return;
      }

      // Client-only SPA routes ship a static document with noindex metadata.
      if (pathname === '/live' || pathname === '/admin') {
        sendHtml(res, path.join(distPath, pathname.slice(1), 'index.html'));
        return;
      }

      const cleanPath = pathname.replace(/\/+$/, '') || '/';
      if (cleanPath.includes('..') || cleanPath.includes('\0')) {
        sendHtml(res, path.join(distPath, '404.html'), 404);
        return;
      }

      const prerendered =
        cleanPath === '/' ? path.join(distPath, 'index.html') : path.join(distPath, cleanPath, 'index.html');

      if (fs.existsSync(prerendered)) {
        sendHtml(res, prerendered);
        return;
      }

      sendHtml(res, path.join(distPath, '404.html'), 404);
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`U-R-LIVE server listening on port ${PORT}`);
  });
}

/** Drain in-flight work on SIGTERM so Cloud Run rolling deploys drop no one silently. */
async function shutdown(signal: string): Promise<void> {
  console.log(`[Server] ${signal} received. Draining connections...`);

  for (const client of wss.clients) {
    try {
      client.close(1001, 'Server restarting');
    } catch {
      // socket already gone
    }
  }

  wss.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRedis().catch(() => {});
  await db.close().catch(() => {});
  console.log('[Server] Shutdown complete.');
  process.exit(0);
}

// Only start the HTTP listener when run directly, not when imported by test suites or in Vercel serverless functions
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer();

  let shuttingDown = false;
  const handleSignal = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forcedExit = setTimeout(() => {
      console.error('[Server] Forced exit after shutdown timeout.');
      process.exit(1);
    }, 15_000);
    forcedExit.unref();

    shutdown(signal).catch((err) => {
      console.error('[Server] Shutdown failed:', err);
      process.exit(1);
    });
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}

export { app, server, wss };
export default app;
