import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '../db';
import { Matchmaker } from '../matchmaker';
import {
  verifyCashfreePaymentSignature,
  verifyCashfreeWebhookSignature,
  verifyCashfreeOrderStatus,
  processCashfreeWebhook,
  PRO_PLAN_PRICE_INR,
  activateProSubscription,
} from '../payments';
import {
  createSessionToken,
  verifySessionToken,
  resolveSessionUser,
  extractSessionToken,
} from '../auth';
import { QueueEntry } from '../types';

describe('1. Subscription Entitlement & Free vs Pro Permissions', () => {
  const testUserId = 'test_user_' + Math.random().toString(36).substring(2, 8);

  beforeEach(() => {
    db.saveUser({
      id: testUserId,
      displayName: 'Test User',
      gender: 'female',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });

  it('newly created user defaults to Free tier (isPro = false)', () => {
    expect(db.isUserPro(testUserId)).toBe(false);
  });

  it('pro membership costs exactly ₹299 INR', () => {
    expect(PRO_PLAN_PRICE_INR).toBe(299);
  });

  it('activating pro subscription grants active entitlement for 30 days', () => {
    const sub = activateProSubscription(testUserId, 'sub_test_123');
    expect(sub.status).toBe('active');
    expect(sub.currentPeriodEnd).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(db.isUserPro(testUserId)).toBe(true);
  });

  it('expired subscription automatically invalidates Pro access', () => {
    const sub = db.getSubscription(testUserId)!;
    sub.currentPeriodEnd = Date.now() - 1000; // Expired 1 second ago
    db.saveSubscription(sub);

    expect(db.isUserPro(testUserId)).toBe(false);
  });

  it('cancelling subscription keeps it active until end of period', () => {
    activateProSubscription(testUserId, 'sub_test_renew');
    const cancelled = db.cancelSubscription(testUserId);

    expect(cancelled?.cancelAtPeriodEnd).toBe(true);
    expect(db.isUserPro(testUserId)).toBe(true);
  });
});

describe('2. Payment Security & Bypass Prevention', () => {
  const secret = 'test_cf_secret_key_12345';

  it('rejects mock signatures starting with cf_sig_ or mock_sig_', () => {
    const orderId = 'order_test_999';
    const paymentId = 'pay_test_999';

    expect(verifyCashfreePaymentSignature(orderId, paymentId, 'cf_sig_fake_signature_abc', secret)).toBe(false);
    expect(verifyCashfreePaymentSignature(orderId, paymentId, 'mock_sig_fake_signature_xyz', secret)).toBe(false);
  });

  it('rejects empty, null, or missing payment verification parameters', () => {
    expect(verifyCashfreePaymentSignature('', 'pay_123', 'some_sig', secret)).toBe(false);
    expect(verifyCashfreePaymentSignature('ord_123', '', 'some_sig', secret)).toBe(false);
    expect(verifyCashfreePaymentSignature('ord_123', 'pay_123', '', secret)).toBe(false);
  });

  it('verifies genuine HMAC-SHA256 payment signature strictly', () => {
    const orderId = 'order_valid_001';
    const paymentId = 'pay_valid_001';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyCashfreePaymentSignature(orderId, paymentId, validSignature, secret)).toBe(true);

    const tamperedSignature = crypto.createHmac('sha256', 'wrong_secret').update(payload).digest('hex');
    expect(verifyCashfreePaymentSignature(orderId, paymentId, tamperedSignature, secret)).toBe(false);
  });

  it('verifyCashfreeOrderStatus fails closed if server credentials are not set', async () => {
    const originalAppId = process.env.CASHFREE_APP_ID;
    const originalSecret = process.env.CASHFREE_SECRET_KEY;

    try {
      delete process.env.CASHFREE_APP_ID;
      delete process.env.CASHFREE_CLIENT_ID;
      delete process.env.CASHFREE_SECRET_KEY;

      const result = await verifyCashfreeOrderStatus('order_test_unconfigured');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    } finally {
      if (originalAppId) process.env.CASHFREE_APP_ID = originalAppId;
      if (originalSecret) process.env.CASHFREE_SECRET_KEY = originalSecret;
    }
  });
});

describe('3. Cashfree Payment Webhook HMAC Verification & Idempotency', () => {
  const secret = 'test_webhook_secret_key';
  const timestamp = String(Date.now());

  it('verifies HMAC-SHA256 signature with timestamp accurately and rejects altered bodies', () => {
    const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_100' });
    const dataToSign = `${timestamp}${payload}`;
    const validSignature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

    expect(verifyCashfreeWebhookSignature(payload, validSignature, timestamp, secret)).toBe(true);

    const tamperedPayload = JSON.stringify({ event: 'payment.captured', id: 'evt_999' });
    expect(verifyCashfreeWebhookSignature(tamperedPayload, validSignature, timestamp, secret)).toBe(false);
  });

  it('rejects webhooks with missing timestamp or empty signature', () => {
    const payload = JSON.stringify({ event: 'payment.captured' });
    expect(verifyCashfreeWebhookSignature(payload, '', timestamp, secret)).toBe(false);
    expect(verifyCashfreeWebhookSignature(payload, 'some_sig', '', secret)).toBe(false);
  });

  it('idempotently processes webhooks without duplicate execution', async () => {
    const targetUserId = 'user_target_' + Date.now();
    db.saveUser({
      id: targetUserId,
      displayName: 'Webhook Target',
      gender: 'unspecified',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    const eventId = 'evt_test_unique_' + Date.now();
    const eventPayload = {
      event: 'subscription.charged',
      event_id: eventId,
      order: { order_amount: 299 },
      customer_details: { customer_id: targetUserId },
    };

    // First attempt
    const res1 = await processCashfreeWebhook(eventId, 'subscription.charged', eventPayload);
    expect(res1.processed).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Second attempt with identical eventId
    const res2 = await processCashfreeWebhook(eventId, 'subscription.charged', eventPayload);
    expect(res2.processed).toBe(true);
    expect(res2.duplicate).toBe(true);
    expect(res2.message).toContain('idempotent');
  });

  it('rejects webhook order activation if payment amount is less than ₹299', async () => {
    const underpaidEventId = 'evt_underpaid_' + Date.now();
    const underpaidPayload = {
      event: 'ORDER_PAID',
      event_id: underpaidEventId,
      order: { order_amount: 50 }, // Underpaid ₹50 instead of ₹299
      customer_details: { customer_id: 'user_cheap' },
    };

    const res = await processCashfreeWebhook(underpaidEventId, 'ORDER_PAID', underpaidPayload);
    expect(res.processed).toBe(false);
    expect(res.duplicate).toBe(false);
    expect(res.message).toContain('less than required');
    expect(db.isUserPro('user_cheap')).toBe(false);
  });
});

describe('4. Authentication Security & Role Authorization', () => {
  it('creates and verifies cryptographically signed session tokens', () => {
    const token = createSessionToken('user_test_token_1', 'user');
    expect(typeof token).toBe('string');
    expect(token.includes('.')).toBe(true);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('user_test_token_1');
    expect(verified?.role).toBe('user');
  });

  it('rejects forged or tampered session tokens', () => {
    const validToken = createSessionToken('user_test_token_2', 'user');
    const [payloadPart, sigPart] = validToken.split('.');

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: 'admin-root-001', role: 'admin', expiresAt: Date.now() + 100000 })
    ).toString('base64url');
    const forgedToken = `${tamperedPayload}.${sigPart}`;

    expect(verifySessionToken(forgedToken)).toBeNull();
  });

  it('rejects expired session tokens', () => {
    // 1ms duration (already expired)
    const expiredToken = createSessionToken('user_expired', 'user', -1000);
    expect(verifySessionToken(expiredToken)).toBeNull();
  });

  it('extracts session token from Bearer authorization header or x-session-token', () => {
    const reqBearer = {
      headers: { authorization: 'Bearer test_token_abc' },
    } as any;
    expect(extractSessionToken(reqBearer)).toBe('test_token_abc');

    const reqCustom = {
      headers: { 'x-session-token': 'test_token_xyz' },
    } as any;
    expect(extractSessionToken(reqCustom)).toBe('test_token_xyz');

    const reqEmpty = { headers: {} } as any;
    expect(extractSessionToken(reqEmpty)).toBeNull();
  });

  it('resolveSessionUser does not allow spoofing via raw x-user-id header', () => {
    const victimUser = db.saveUser({
      id: 'usr_victim_001',
      displayName: 'Victim User',
      gender: 'unspecified',
      country: 'GLOBAL',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Attacker tries to impersonate victim with just x-user-id header and no signed token
    const attackerReq = {
      headers: { 'x-user-id': victimUser.id },
    } as any;

    const resolved = resolveSessionUser(attackerReq);
    // Attacker must NOT be resolved as victimUser! A new guest user must be generated.
    expect(resolved.user.id).not.toBe(victimUser.id);
    expect(resolved.user.id.startsWith('guest_')).toBe(true);
    expect(resolved.sessionToken).toBeDefined();
  });
});

describe('5. Matchmaking Preference Compatibility & Disconnect Handling', () => {
  let matchmaker: Matchmaker;

  beforeEach(() => {
    matchmaker = new Matchmaker();
  });

  it('prevents a user from matching with themselves', () => {
    const entryA: QueueEntry = {
      userId: 'user_alpha',
      socketId: 'sock_1',
      gender: 'female',
      country: 'IN',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };
    const entrySelf: QueueEntry = {
      userId: 'user_alpha',
      socketId: 'sock_2',
      gender: 'female',
      country: 'IN',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(entryA, entrySelf)).toBe(false);
  });

  it('matches two compatible free users randomly', () => {
    const userA: QueueEntry = {
      userId: 'user_a',
      socketId: 'sock_a',
      gender: 'male',
      country: 'US',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };
    const userB: QueueEntry = {
      userId: 'user_b',
      socketId: 'sock_b',
      gender: 'female',
      country: 'GB',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(userA, userB)).toBe(true);
  });

  it('prevents matching between blocked users', () => {
    db.blockUser('user_blocker', 'user_spammer');

    const blocker: QueueEntry = {
      userId: 'user_blocker',
      socketId: 'sock_blocker',
      gender: 'male',
      country: 'US',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };
    const spammer: QueueEntry = {
      userId: 'user_spammer',
      socketId: 'sock_spammer',
      gender: 'female',
      country: 'US',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(blocker, spammer)).toBe(false);
    expect(matchmaker.isCompatible(spammer, blocker)).toBe(false);
  });

  it('honors Pro gender filter: fails if candidate does not match preferred gender', () => {
    const proMaleSeekingFemale: QueueEntry = {
      userId: 'pro_user_male',
      socketId: 'sock_pro',
      gender: 'male',
      country: 'IN',
      isPro: true,
      preferences: { preferredGender: 'female', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    const maleCandidate: QueueEntry = {
      userId: 'candidate_male',
      socketId: 'sock_male_candidate',
      gender: 'male',
      country: 'IN',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    const femaleCandidate: QueueEntry = {
      userId: 'candidate_female',
      socketId: 'sock_female_candidate',
      gender: 'female',
      country: 'IN',
      isPro: false,
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(proMaleSeekingFemale, maleCandidate)).toBe(false);
    expect(matchmaker.isCompatible(proMaleSeekingFemale, femaleCandidate)).toBe(true);
  });

  it('cleanly ends match and resolves peer socket on disconnect', () => {
    matchmaker.enqueue('sock_p1', 'user_p1', 'male', 'GLOBAL', {});
    matchmaker.enqueue('sock_p2', 'user_p2', 'female', 'GLOBAL', {});

    const matches = matchmaker.processMatches();
    expect(matches.length).toBe(1);

    expect(matchmaker.getPeerSocket('sock_p1')).toBe('sock_p2');
    expect(matchmaker.getPeerSocket('sock_p2')).toBe('sock_p1');

    // Peer 1 disconnects
    const { endedMatch } = matchmaker.handleDisconnect('sock_p1');
    expect(endedMatch).toBeDefined();
    expect(endedMatch?.matchId).toBe(matches[0].matchId);

    // After disconnect, peer mappings are cleared so neither hangs
    expect(matchmaker.getPeerSocket('sock_p1')).toBeUndefined();
    expect(matchmaker.getPeerSocket('sock_p2')).toBeUndefined();
    expect(matchmaker.getActiveMatchesCount()).toBe(0);
  });
});

describe('6. Safety & Report System', () => {
  it('creates reports and automatically records them in moderation queue', () => {
    const report = db.createReport({
      reporterId: 'user_rep_1',
      reporterName: 'Alice',
      reportedUserId: 'user_abuser',
      reportedUserName: 'Bob',
      category: 'sexual_misconduct',
      description: 'Inappropriate conduct on video',
    });

    expect(report.id).toBeDefined();
    expect(report.status).toBe('pending');

    const allReports = db.getReports();
    expect(allReports.some((r) => r.id === report.id)).toBe(true);
  });

  it('moderator action updates status and bans offending user', () => {
    const report = db.createReport({
      reporterId: 'u1',
      reporterName: 'U1',
      reportedUserId: 'abuser_target',
      reportedUserName: 'Bad Actor',
      category: 'suspected_underage',
      description: 'Minor declaration',
    });

    db.saveUser({
      id: 'abuser_target',
      displayName: 'Bad Actor',
      gender: 'unspecified',
      country: 'GLOBAL',
      isAdultVerified: false,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    const updated = db.updateReportStatus(report.id, 'resolved', 'banned', 'User confirmed underage');
    db.updateUserStatus('abuser_target', 'banned');

    expect(updated?.status).toBe('resolved');
    expect(updated?.actionTaken).toBe('banned');

    const user = db.getUser('abuser_target');
    expect(user?.status).toBe('banned');
  });
});
