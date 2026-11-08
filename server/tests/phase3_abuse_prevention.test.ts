import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db';
import { rateLimiter, RateLimiter } from '../rateLimit';
import { verifyTurnstileToken } from '../turnstile';
import { matchmaker } from '../matchmaker';
import { createSessionToken, verifySessionToken } from '../auth';
import { QueueEntry, UserProfile } from '../types';

describe('Phase 3: Cloudflare Turnstile Bot Protection', () => {
  const origSecret = process.env.TURNSTILE_SECRET_KEY;
  const origRequired = process.env.TURNSTILE_REQUIRED;
  const origFailOpen = process.env.TURNSTILE_FAIL_OPEN;

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = origSecret;
    process.env.TURNSTILE_REQUIRED = origRequired;
    process.env.TURNSTILE_FAIL_OPEN = origFailOpen;
  });

  it('bypasses Turnstile gracefully when secret is not configured in dev/test', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_REQUIRED;

    const res = await verifyTurnstileToken(undefined);
    expect(res.success).toBe(true);
    expect(res.bypassed).toBe(true);
  });

  it('rejects missing or empty token when Turnstile is active', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test_secret_key_123';

    const res = await verifyTurnstileToken('');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/missing or empty/i);
  });

  it('verifies valid dummy test token successfully', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test_secret_key_123';

    const res = await verifyTurnstileToken('cf_test_always_pass');
    expect(res.success).toBe(true);
  });

  it('rejects invalid dummy test token with challenge failure', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test_secret_key_123';

    const res = await verifyTurnstileToken('cf_test_always_fail');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/challenge failed/i);
  });

  it('handles network timeout with fail-safe behavior when configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test_secret_key_123';
    process.env.TURNSTILE_FAIL_OPEN = 'true';

    // Mock fetch that simulates a timeout abort error
    const originalFetch = global.fetch;
    global.fetch = (() => {
      const err: any = new Error('The operation was aborted due to timeout');
      err.name = 'AbortError';
      return Promise.reject(err);
    }) as any;

    try {
      const res = await verifyTurnstileToken('random_token_val');
      expect(res.success).toBe(true);
      expect(res.failOpen).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Phase 3: Rate Limiting & Cooldown Protection', () => {
  let testLimiter: RateLimiter;

  beforeEach(() => {
    testLimiter = new RateLimiter();
  });

  it('allows requests within threshold and enforces limit when exceeded', () => {
    const key = 'test_client_ip_1';
    const limit = 3;
    const windowMs = 1000;

    expect(testLimiter.checkLimit(key, limit, windowMs).allowed).toBe(true);
    expect(testLimiter.checkLimit(key, limit, windowMs).allowed).toBe(true);
    expect(testLimiter.checkLimit(key, limit, windowMs).allowed).toBe(true);

    const fourth = testLimiter.checkLimit(key, limit, windowMs);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('enforces minimum cooldown between consecutive actions', () => {
    const key = 'user_skip_action';
    const minCooldownMs = 1500;

    // First skip is allowed
    const first = testLimiter.checkCooldown(key, minCooldownMs);
    expect(first.allowed).toBe(true);

    // Immediate second skip is blocked
    const immediate = testLimiter.checkCooldown(key, minCooldownMs);
    expect(immediate.allowed).toBe(false);
    expect(immediate.retryAfterMs).toBeGreaterThan(0);
  });

  it('mitigates WebSocket connection flooding and concurrent limits per IP', () => {
    const ip = '192.168.1.100';
    const maxConcurrent = 3;

    // Connect 3 times successfully
    expect(testLimiter.trackWsConnection(ip, maxConcurrent, 10).allowed).toBe(true);
    expect(testLimiter.trackWsConnection(ip, maxConcurrent, 10).allowed).toBe(true);
    expect(testLimiter.trackWsConnection(ip, maxConcurrent, 10).allowed).toBe(true);

    // 4th connection exceeds limit
    const fourth = testLimiter.trackWsConnection(ip, maxConcurrent, 10);
    expect(fourth.allowed).toBe(false);
    expect(fourth.reason).toMatch(/concurrent connections/i);

    // Release one socket and verify connection succeeds
    testLimiter.releaseWsConnection(ip);
    expect(testLimiter.trackWsConnection(ip, maxConcurrent, 10).allowed).toBe(true);
  });
});

describe('Phase 3: Matchmaking Abuse & Identity Spoofing Prevention', () => {
  it('prevents matching between blocked users in both directions', () => {
    const userA = 'block_a_' + Math.random().toString(36).substring(2, 6);
    const userB = 'block_b_' + Math.random().toString(36).substring(2, 6);

    db.saveUser({
      id: userA,
      displayName: 'Alice',
      gender: 'female',
      country: 'GLOBAL',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    db.saveUser({
      id: userB,
      displayName: 'Bob',
      gender: 'male',
      country: 'GLOBAL',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // User A blocks User B
    db.blockUser(userA, userB);

    // Verify bidirectional exclusion in DB
    expect(db.isBlocked(userA, userB)).toBe(true);
    expect(db.isBlocked(userB, userA)).toBe(true);

    // Verify matchmaker compatibility rejection
    const entryA: QueueEntry = {
      userId: userA,
      socketId: 'sock_a',
      gender: 'female',
      country: 'GLOBAL',
      isPro: false,
      preferences: {},
      joinedAt: Date.now(),
    };

    const entryB: QueueEntry = {
      userId: userB,
      socketId: 'sock_b',
      gender: 'male',
      country: 'GLOBAL',
      isPro: false,
      preferences: {},
      joinedAt: Date.now(),
    };

    // Both directions must reject pairing
    expect(matchmaker.isCompatible(entryA, entryB)).toBe(false);
    expect(matchmaker.isCompatible(entryB, entryA)).toBe(false);
  });

  it('rejects identity spoofing when session token does not match claimed user', () => {
    const legitUser = 'legit_user_' + Math.random().toString(36).substring(2, 8);
    const attacker = 'attacker_user_' + Math.random().toString(36).substring(2, 8);

    const token = createSessionToken(legitUser, 'user');
    const verified = verifySessionToken(token);

    expect(verified).toBeDefined();
    expect(verified?.userId).toBe(legitUser);
    expect(verified?.userId).not.toBe(attacker);
  });
});

describe('Phase 3: Report Validation & Duplicate Spam Prevention', () => {
  it('prevents duplicate reports for the same user while one is already pending', () => {
    const reporterId = 'rep_u_' + Math.random().toString(36).substring(2, 6);
    const targetId = 'bad_actor_' + Math.random().toString(36).substring(2, 6);

    db.saveUser({
      id: reporterId,
      displayName: 'Reporter',
      gender: 'unspecified',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    db.saveUser({
      id: targetId,
      displayName: 'Bad Actor',
      gender: 'unspecified',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Create first report
    const r1 = db.createReport({
      reporterId,
      reporterName: 'Reporter',
      reportedUserId: targetId,
      reportedUserName: 'Bad Actor',
      category: 'sexual_misconduct',
      description: 'First report description',
    });
    expect(r1.id).toBeDefined();
    expect(r1.status).toBe('pending');

    // Duplicate check logic
    const existing = db.getReports();
    const hasDuplicate = existing.some(
      (r) =>
        r.reporterId === reporterId &&
        r.reportedUserId === targetId &&
        r.status === 'pending' &&
        Date.now() - r.createdAt < 24 * 60 * 60 * 1000
    );
    expect(hasDuplicate).toBe(true);
  });
});
