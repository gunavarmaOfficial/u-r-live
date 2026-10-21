import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { Matchmaker } from '../matchmaker';
import {
  verifyCashfreePaymentSignature,
  verifyCashfreeWebhookSignature,
  processCashfreeWebhook,
  PRO_PLAN_PRICE_INR,
  activateProSubscription,
} from '../payments';
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
    // Reset subscription with future period
    activateProSubscription(testUserId, 'sub_test_renew');
    const cancelled = db.cancelSubscription(testUserId);

    expect(cancelled?.cancelAtPeriodEnd).toBe(true);
    expect(db.isUserPro(testUserId)).toBe(true); // Still active until period end
  });
});

describe('2. Matchmaking Preference Compatibility & Concurrency', () => {
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

  it('atomic matchmaking pass removes both matched sockets from queue', () => {
    // Clean queue
    matchmaker.enqueue('sock_x', 'user_x', 'male', 'GLOBAL', {});
    matchmaker.enqueue('sock_y', 'user_y', 'female', 'GLOBAL', {});

    expect(matchmaker.getQueueLength()).toBe(2);

    const matches = matchmaker.processMatches();
    expect(matches.length).toBe(1);
    expect(matchmaker.getQueueLength()).toBe(0);

    const activeMatch = matchmaker.getMatchBySocket('sock_x');
    expect(activeMatch).toBeDefined();
    expect(activeMatch?.matchId).toBe(matches[0].matchId);
  });
});

describe('3. Cashfree Payment Webhook HMAC Verification & Idempotency', () => {
  const secret = 'test_webhook_secret_key';

  it('verifies HMAC-SHA256 signature accurately and rejects altered bodies', () => {
    const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_100' });
    const crypto = require('crypto');
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyCashfreeWebhookSignature(payload, validSignature, undefined, secret)).toBe(true);

    const tamperedPayload = JSON.stringify({ event: 'payment.captured', id: 'evt_999' });
    expect(verifyCashfreeWebhookSignature(tamperedPayload, validSignature, undefined, secret)).toBe(false);
  });

  it('idempotently processes webhooks without duplicate execution', () => {
    const eventId = 'evt_test_unique_' + Date.now();
    const eventPayload = {
      event: 'subscription.charged',
      event_id: eventId,
      subscription: { id: 'sub_wh_001', notes: { userId: 'user_target' } },
    };

    // First attempt
    const res1 = processCashfreeWebhook(eventId, 'subscription.charged', eventPayload);
    expect(res1.processed).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Second attempt with same eventId
    const res2 = processCashfreeWebhook(eventId, 'subscription.charged', eventPayload);
    expect(res2.processed).toBe(true);
    expect(res2.duplicate).toBe(true);
  });
});

describe('4. Safety & Report System', () => {
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

describe('5. Google User Authentication & Profile Linking', () => {
  it('correctly finds user by email or googleId', () => {
    const testEmail = 'tester_google@example.com';
    const testGId = 'gid_998877';

    db.saveUser({
      id: 'usr_g_test',
      displayName: 'Google Tester',
      email: testEmail,
      googleId: testGId,
      authProvider: 'google',
      gender: 'unspecified',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    const byEmail = db.findUserByEmail(testEmail);
    expect(byEmail).toBeDefined();
    expect(byEmail?.id).toBe('usr_g_test');

    const byGId = db.findUserByGoogleId(testGId);
    expect(byGId).toBeDefined();
    expect(byGId?.displayName).toBe('Google Tester');
  });
});

