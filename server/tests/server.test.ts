import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { Matchmaker } from '../matchmaker';
import {
  createSessionToken,
  verifySessionToken,
  resolveSessionUser,
  extractSessionToken,
} from '../auth';
import { QueueEntry } from '../types';

describe('1. Authentication Security & Role Authorization', () => {
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

describe('2. Matchmaking Preference Compatibility & Disconnect Handling', () => {
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
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };
    const entrySelf: QueueEntry = {
      userId: 'user_alpha',
      socketId: 'sock_2',
      gender: 'female',
      country: 'IN',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(entryA, entrySelf)).toBe(false);
  });

  it('matches two compatible users randomly', () => {
    const userA: QueueEntry = {
      userId: 'user_a',
      socketId: 'sock_a',
      gender: 'male',
      country: 'US',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };
    const userB: QueueEntry = {
      userId: 'user_b',
      socketId: 'sock_b',
      gender: 'female',
      country: 'GB',
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
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };
    const spammer: QueueEntry = {
      userId: 'user_spammer',
      socketId: 'sock_spammer',
      gender: 'female',
      country: 'US',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(blocker, spammer)).toBe(false);
    expect(matchmaker.isCompatible(spammer, blocker)).toBe(false);
  });

  it('honors gender filter: fails if candidate does not match preferred gender', () => {
    const userSeekingFemale: QueueEntry = {
      userId: 'user_male',
      socketId: 'sock_filter',
      gender: 'male',
      country: 'IN',
      preferences: { preferredGender: 'female', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    const maleCandidate: QueueEntry = {
      userId: 'candidate_male',
      socketId: 'sock_male_candidate',
      gender: 'male',
      country: 'IN',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    const femaleCandidate: QueueEntry = {
      userId: 'candidate_female',
      socketId: 'sock_female_candidate',
      gender: 'female',
      country: 'IN',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(userSeekingFemale, maleCandidate)).toBe(false);
    expect(matchmaker.isCompatible(userSeekingFemale, femaleCandidate)).toBe(true);
  });

  it('honors country filter: fails if candidate country is not in preferred list', () => {
    const userSeekingIndia: QueueEntry = {
      userId: 'user_in',
      socketId: 'sock_country_filter',
      gender: 'male',
      country: 'IN',
      preferences: { preferredGender: 'any', preferredCountry: 'IN', preferredCountries: ['IN'] },
      joinedAt: Date.now(),
    };

    const usCandidate: QueueEntry = {
      userId: 'candidate_us',
      socketId: 'sock_us_candidate',
      gender: 'female',
      country: 'US',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    const inCandidate: QueueEntry = {
      userId: 'candidate_in',
      socketId: 'sock_in_candidate',
      gender: 'female',
      country: 'IN',
      preferences: { preferredGender: 'any', preferredCountry: 'GLOBAL' },
      joinedAt: Date.now(),
    };

    expect(matchmaker.isCompatible(userSeekingIndia, usCandidate)).toBe(false);
    expect(matchmaker.isCompatible(userSeekingIndia, inCandidate)).toBe(true);
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

describe('3. Safety & Report System', () => {
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
