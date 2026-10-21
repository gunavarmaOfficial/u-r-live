/**
 * OmeLive Full-Stack Application Server
 * Serves Express REST APIs, WebRTC WebSocket Signaling, and Vite frontend middleware
 */
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import dotenv from 'dotenv';
import { db } from './server/db';
import { matchmaker } from './server/matchmaker';
import { setupSignaling } from './server/webrtc';
import {
  PRO_PLAN_PRICE_INR,
  createSubscriptionOrder,
  verifyCashfreeOrderStatus,
  verifyCashfreeWebhookSignature,
  activateProSubscription,
  processCashfreeWebhook,
} from './server/payments';
import {
  resolveSessionUser,
  createSessionToken,
  requireAdmin,
} from './server/auth';
import { UserProfile, ReportCategory } from './server/types';

dotenv.config();

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Webhook raw-body preservation for HMAC signature checks
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf-8');
    },
  })
);

// -------------------------------------------------------------
// Authentication & User Profile APIs
// -------------------------------------------------------------
app.get('/api/auth/session', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;
  const isPro = db.isUserPro(user.id);
  const subscription = db.getSubscription(user.id);

  res.json({
    user,
    sessionToken: session.sessionToken,
    isPro,
    subscription: subscription || null,
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
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
    isPro: db.isUserPro(updated.id),
    subscription: db.getSubscription(updated.id) || null,
  });
});

app.post('/api/auth/admin-login', (req: Request, res: Response) => {
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

  const sessionToken = createSessionToken(adminUser.id, 'admin');
  res.json({
    user: adminUser,
    sessionToken,
    isPro: true,
    subscription: null,
  });
});

app.post('/api/auth/google', (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    avatarUrl: z.string().url().optional(),
    googleId: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Google profile payload' });
    return;
  }

  const { email, name, avatarUrl, googleId } = parsed.data;
  const gId = googleId || 'g_' + Buffer.from(email).toString('base64url');

  let user = db.findUserByGoogleId(gId) || db.findUserByEmail(email);

  if (user) {
    user = db.saveUser({
      ...user,
      displayName: user.displayName || name,
      avatarUrl: avatarUrl || user.avatarUrl,
      googleId: gId,
      email,
      authProvider: 'google',
      lastActiveAt: Date.now(),
    });
  } else {
    const session = resolveSessionUser(req);
    const current = session.user;
    const newUserId = current.id.startsWith('guest_')
      ? 'usr_g_' + Math.random().toString(36).substring(2, 10)
      : current.id;

    user = db.saveUser({
      ...current,
      id: newUserId,
      displayName: name,
      email,
      avatarUrl,
      googleId: gId,
      authProvider: 'google',
      isAdultVerified: true,
      role: 'user',
      lastActiveAt: Date.now(),
    });
  }

  const sessionToken = createSessionToken(user.id, user.role);

  res.json({
    user,
    sessionToken,
    isPro: db.isUserPro(user.id),
    subscription: db.getSubscription(user.id) || null,
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
    isPro: db.isUserPro(updated.id),
    subscription: db.getSubscription(updated.id) || null,
  });
});

// -------------------------------------------------------------
// Subscription & Payment APIs (Cashfree Payments ₹299/month)
// -------------------------------------------------------------
app.get('/api/subscription/plans', (_req: Request, res: Response) => {
  res.json({
    plans: [
      {
        code: 'free',
        name: 'Free',
        priceInr: 0,
        billingCycle: 'free',
        features: [
          'Random one-to-one video chat',
          'Camera and microphone support',
          'Next and disconnect controls',
          'Standard matchmaking queue',
          'Abuse reporting & blocking',
          'Community safety access',
        ],
        restrictions: ['Cannot choose preferred gender', 'Cannot filter by country'],
      },
      {
        code: 'pro_monthly_299',
        name: 'Pro',
        priceInr: PRO_PLAN_PRICE_INR,
        billingCycle: 'month',
        gateway: 'cashfree',
        features: [
          'All Free features included',
          'Preferred gender matching (Female / Male filter)',
          'Country location filter',
          'Priority queue placement',
          '100% Ad-free experience',
          'Instant next match priority',
        ],
        restrictions: [],
      },
    ],
  });
});

app.post('/api/subscription/create-order', async (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;

  try {
    const orderData = await createSubscriptionOrder(user.id);
    res.json(orderData);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not initialize Cashfree order' });
  }
});

app.post('/api/subscription/verify', async (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;

  const schema = z.object({
    orderId: z.string().min(1, 'orderId is required'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Missing orderId' });
    return;
  }

  const { orderId } = parsed.data;

  // Strict server-to-server verification with Cashfree API
  const verification = await verifyCashfreeOrderStatus(orderId);
  if (!verification.success) {
    res.status(400).json({
      error:
        verification.error ||
        'Cashfree payment verification failed. Order is not paid or invalid.',
    });
    return;
  }

  const sub = activateProSubscription(
    user.id,
    'sub_cf_' + orderId,
    'cust_' + user.id
  );

  res.json({
    success: true,
    message: 'Pro subscription activated successfully via Cashfree',
    subscription: sub,
    isPro: true,
  });
});

app.post('/api/subscription/cancel', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;

  const sub = db.cancelSubscription(user.id);
  if (!sub) {
    res.status(404).json({ error: 'No active subscription found to cancel' });
    return;
  }

  db.addAuditLog({
    adminUserId: user.id,
    action: 'subscription_cancelled',
    targetType: 'subscription',
    targetId: sub.id,
    details: { userId: user.id, provider: 'cashfree' },
  });

  res.json({
    success: true,
    message: 'Subscription will not renew at the end of the billing period.',
    subscription: sub,
  });
});

// Cashfree Webhooks endpoint
app.post(['/api/subscription/webhook', '/api/webhooks/cashfree'], (req: any, res: Response) => {
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Server misconfiguration: CASHFREE_SECRET_KEY is not configured' });
    return;
  }

  const signature =
    (req.headers['x-webhook-signature'] as string) ||
    (req.headers['x-cashfree-signature'] as string) ||
    '';
  const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!signature) {
    res.status(400).json({ error: 'Missing x-webhook-signature header' });
    return;
  }

  if (!timestamp) {
    res.status(400).json({ error: 'Missing x-webhook-timestamp header' });
    return;
  }

  // Check timestamp freshness (5 minutes window to prevent replay attacks)
  const timestampNum = Number(timestamp);
  const tsMs = timestampNum > 1e11 ? timestampNum : timestampNum * 1000;
  if (isNaN(timestampNum) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    res.status(400).json({ error: 'Webhook timestamp expired or outside tolerance window' });
    return;
  }

  // Cryptographically verify HMAC-SHA256 signature
  const isValid = verifyCashfreeWebhookSignature(rawBody, signature, timestamp, secretKey);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid Cashfree webhook signature' });
    return;
  }

  const event = req.body;
  const eventId =
    event?.event_id ||
    event?.data?.order?.order_id ||
    event?.id;

  if (!eventId) {
    res.status(400).json({ error: 'Missing event ID in webhook payload' });
    return;
  }

  const eventType = event?.type || event?.event || 'ORDER_PAID';
  const result = processCashfreeWebhook(eventId, eventType, event?.payload || req.body);
  res.json(result);
});

// -------------------------------------------------------------
// Safety & Moderation APIs
// -------------------------------------------------------------
app.post('/api/safety/report', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const reporter = session.user;

  const schema = z.object({
    reportedUserId: z.string(),
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

  const report = db.createReport({
    reporterId: reporter.id,
    reporterName: reporter.displayName,
    reportedUserId,
    reportedUserName: reportedUserName || 'Anonymous User',
    category: category as ReportCategory,
    description,
    sessionId,
  });

  // Automatically block reported user from future matchmaking
  db.blockUser(reporter.id, reportedUserId);

  res.json({
    success: true,
    message: 'Report submitted successfully. Thank you for keeping our community safe.',
    reportId: report.id,
  });
});

app.post('/api/safety/block', (req: Request, res: Response) => {
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

  if (blocker.id === parsed.data.blockedUserId) {
    res.status(400).json({ error: 'You cannot block yourself' });
    return;
  }

  const block = db.blockUser(blocker.id, parsed.data.blockedUserId);
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
  res.json({ success: unblocked });
});

app.get('/api/safety/blocks', (req: Request, res: Response) => {
  const session = resolveSessionUser(req);
  const user = session.user;
  const blockedIds = db.getBlockedUsers(user.id);
  res.json({ blockedUserIds: blockedIds });
});

// -------------------------------------------------------------
// Admin APIs (Protected by requireAdmin middleware)
// -------------------------------------------------------------
app.get('/api/admin/overview', requireAdmin, (_req: Request, res: Response) => {
  const users = db.getAllUsers();
  const reports = db.getReports();
  const queueLength = matchmaker.getQueueLength();
  const activeMatches = matchmaker.getActiveMatchesCount();
  const paymentEvents = db.getAllPaymentEvents();

  const proCount = users.filter((u) => db.isUserPro(u.id)).length;
  const estimatedRevenue = proCount * PRO_PLAN_PRICE_INR;

  res.json({
    totalUsers: users.length,
    activeQueueLength: queueLength,
    activeMatchesCount: activeMatches,
    proSubscribers: proCount,
    monthlyRevenueInr: estimatedRevenue,
    pendingReportsCount: reports.filter((r) => r.status === 'pending').length,
    totalReportsCount: reports.length,
    paymentEventsCount: paymentEvents.length,
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
  const users = db.getAllUsers().map((u) => ({
    ...u,
    isPro: db.isUserPro(u.id),
    subscription: db.getSubscription(u.id) || null,
  }));
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

app.get('/api/system/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    queueLength: matchmaker.getQueueLength(),
    activeMatches: matchmaker.getActiveMatchesCount(),
    turnConfigured: !!process.env.TURN_URL,
  });
});

// Setup WebSocket Signaling
const wss = new WebSocketServer({ server, path: '/ws' });
setupSignaling(wss);

// -------------------------------------------------------------
// Frontend Integration (Vite Middleware in dev / Static in prod)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OmeLive server running on port ${PORT}`);
  });
}

// Only start the HTTP listener when run directly, not when imported by test suites
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, server };
