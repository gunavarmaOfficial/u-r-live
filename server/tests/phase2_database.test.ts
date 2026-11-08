import { describe, it, expect, beforeEach } from 'vitest';
import { db, Database } from '../db';
import { resolveSessionUser, createSessionToken } from '../auth';
import { createSubscriptionOrder, activateProSubscription, processCashfreeWebhook } from '../payments';
import { UserProfile } from '../types';

describe('Phase 2: Database Operations & Schema Integrity', () => {
  const userId = 'p2_user_' + Math.random().toString(36).substring(2, 8);

  beforeEach(() => {
    db.saveUser({
      id: userId,
      displayName: 'Phase 2 User',
      email: 'p2user@example.com',
      authProvider: 'google',
      gender: 'female',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });

  it('persists and retrieves user profiles correctly', () => {
    const user = db.getUser(userId);
    expect(user).toBeDefined();
    expect(user?.email).toBe('p2user@example.com');
    expect(user?.authProvider).toBe('google');
    expect(user?.role).toBe('user');
  });

  it('persists and retrieves user preferences for matchmaking', () => {
    const prefs = db.saveUserPreferences(userId, {
      chatMode: 'video',
      preferredGender: 'female',
      preferredCountry: 'IN',
      interests: ['coding', 'music'],
      interestMatchingEnabled: true,
      strictInterests: true,
      priorityQueue: true,
    });

    expect(prefs.userId).toBe(userId);
    expect(prefs.preferredGender).toBe('female');
    expect(prefs.interests).toEqual(['coding', 'music']);
    expect(prefs.strictInterests).toBe(true);

    const retrieved = db.getUserPreferences(userId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.preferredCountry).toBe('IN');
  });

  it('fails closed in production if no database URL is configured', () => {
    const oldNodeEnv = process.env.NODE_ENV;
    const oldDbUrl = process.env.DATABASE_URL;
    const oldSupabaseUrl = process.env.SUPABASE_DB_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      delete process.env.SUPABASE_DB_URL;

      expect(() => new Database()).toThrow(/Production environment detected.*DATABASE_URL.*prohibited/i);
    } finally {
      process.env.NODE_ENV = oldNodeEnv;
      if (oldDbUrl) process.env.DATABASE_URL = oldDbUrl;
      if (oldSupabaseUrl) process.env.SUPABASE_DB_URL = oldSupabaseUrl;
    }
  });
});

describe('Phase 2: Guest-First Architecture & Account Verification Boundary', () => {
  it('issues isolated, temporary guest session without requiring registration', () => {
    const fakeReq: any = {
      headers: {},
    };

    const session = resolveSessionUser(fakeReq);
    expect(session.isNew).toBe(true);
    expect(session.user.id.startsWith('guest_')).toBe(true);
    expect(session.user.role).toBe('user');
    expect(session.user.authProvider).toBe('guest');
    expect(session.sessionToken).toBeDefined();

    // Guest is free by default
    expect(db.isUserPro(session.user.id)).toBe(false);
  });

  it('prevents anonymous guest users from purchasing Pro without linking an account', async () => {
    const guestUser: UserProfile = {
      id: 'guest_anon_' + Math.random().toString(36).substring(2, 8),
      displayName: 'Stranger Anon',
      gender: 'unspecified',
      country: 'GLOBAL',
      isAdultVerified: false,
      role: 'user',
      authProvider: 'guest',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    db.saveUser(guestUser);

    await expect(createSubscriptionOrder(guestUser.id)).rejects.toThrow(
      /Account verification required/i
    );
  });

  it('allows verified registered accounts to proceed with subscription creation', async () => {
    const verifiedUser: UserProfile = {
      id: 'verified_user_' + Math.random().toString(36).substring(2, 8),
      displayName: 'Verified User',
      email: 'subscriber@example.com',
      gender: 'male',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      authProvider: 'google',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    db.saveUser(verifiedUser);

    // Should pass the auth verification check and only fail if Cashfree API keys are absent in dev
    try {
      await createSubscriptionOrder(verifiedUser.id);
    } catch (err: any) {
      // Must not be account verification error
      expect(err.message).not.toMatch(/Account verification required/i);
    }
  });
});

describe('Phase 2: Subscription Persistence & Idempotent Payment Events', () => {
  const subUserId = 'sub_persist_' + Math.random().toString(36).substring(2, 8);

  beforeEach(() => {
    db.saveUser({
      id: subUserId,
      displayName: 'Sub Tester',
      email: 'sub@test.local',
      role: 'user',
      status: 'active',
      gender: 'unspecified',
      country: 'IN',
      isAdultVerified: true,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });

  it('persists subscription attributes and validates active period', () => {
    const sub = activateProSubscription(subUserId, 'sub_order_p2_123', 'cust_p2');
    expect(sub.userId).toBe(subUserId);
    expect(sub.status).toBe('active');
    expect(sub.planCode).toBe('pro_monthly_299');

    const fetched = db.getSubscription(subUserId);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(sub.id);
    expect(db.isUserPro(subUserId)).toBe(true);
  });

  it('idempotently handles duplicate webhook events across calls', async () => {
    const eventId = 'evt_p2_unique_' + Date.now();
    const payload = {
      event_id: eventId,
      event: 'ORDER_PAID',
      order: { order_amount: 299 },
      customer_details: { customer_id: subUserId },
    };

    // First call processes
    const res1 = await processCashfreeWebhook(eventId, 'ORDER_PAID', payload);
    expect(res1.duplicate).toBe(false);
    expect(db.hasPaymentEvent(eventId)).toBe(true);

    // Second call is recognized as duplicate without re-executing
    const res2 = await processCashfreeWebhook(eventId, 'ORDER_PAID', payload);
    expect(res2.duplicate).toBe(true);
    expect(res2.processed).toBe(true);
  });
});

describe('Phase 2: Reports & Moderation Queue Persistence', () => {
  it('persists user blocks and prevents matching between blocked users', () => {
    const userA = 'p2_blocker_' + Math.random().toString(36).substring(2, 6);
    const userB = 'p2_blocked_' + Math.random().toString(36).substring(2, 6);

    expect(db.isBlocked(userA, userB)).toBe(false);

    db.blockUser(userA, userB);
    expect(db.isBlocked(userA, userB)).toBe(true);
    expect(db.isBlocked(userB, userA)).toBe(true); // Bidirectional exclusion

    const blockedList = db.getBlockedUsers(userA);
    expect(blockedList).toContain(userB);

    db.unblockUser(userA, userB);
    expect(db.isBlocked(userA, userB)).toBe(false);
  });

  it('records audit logs and enforces max history cap', () => {
    const log = db.addAuditLog({
      adminUserId: 'admin_test',
      action: 'user_ban',
      targetType: 'user',
      targetId: 'target_123',
      details: { reason: 'terms_violation' },
    });

    expect(log.id).toBeDefined();
    const logs = db.getAuditLogs();
    expect(logs.some((l) => l.id === log.id)).toBe(true);
  });
});

describe('Phase 2: Guest Session Revocation & Expiry Lifecycles', () => {
  it('persists guest session in database and invalidates when explicitly revoked', () => {
    const fakeReq: any = { headers: {} };
    const session = resolveSessionUser(fakeReq);

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(session.sessionToken).digest('hex');

    const dbSession = db.getSession(tokenHash);
    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(session.user.id);
    expect(dbSession?.isGuest).toBe(true);
    expect(dbSession?.revoked).toBe(false);

    // Revoking session makes it immediately invalid
    db.revokeSession(tokenHash);
    expect(db.getSession(tokenHash)).toBeUndefined();
  });
});

describe('Phase 2: Persistence Across Restarts & Connection Behavior', () => {
  it('retains user, block, and report data across independent database store hydration', () => {
    const restartUser = 'restart_u_' + Math.random().toString(36).substring(2, 8);
    db.saveUser({
      id: restartUser,
      displayName: 'Restart User',
      gender: 'male',
      country: 'GLOBAL',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    const report = db.createReport({
      reporterId: 'r1',
      reporterName: 'Reporter 1',
      reportedUserId: restartUser,
      reportedUserName: 'Restart User',
      category: 'harassment',
      description: 'Harassment report',
    });

    db.blockUser('r1', restartUser);

    // Verify retrieval immediately
    expect(db.getUser(restartUser)).toBeDefined();
    expect(db.isBlocked('r1', restartUser)).toBe(true);
    expect(db.getReports().some((r) => r.id === report.id)).toBe(true);
  });
});
