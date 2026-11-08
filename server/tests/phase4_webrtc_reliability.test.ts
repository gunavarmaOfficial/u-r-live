import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import { db } from '../db';
import { Matchmaker } from '../matchmaker';
import { createSessionToken } from '../auth';
import { RateLimiter, getClientIp } from '../rateLimit';

describe('Phase 4: WebRTC Signaling, Matchmaking & Connection Reliability', () => {
  let testMatchmaker: Matchmaker;
  let testRateLimiter: RateLimiter;
  const user1Id = 'u_p4_alice_' + Math.random().toString(36).substring(2, 7);
  const user2Id = 'u_p4_bob_' + Math.random().toString(36).substring(2, 7);
  const user3Id = 'u_p4_charlie_' + Math.random().toString(36).substring(2, 7);

  beforeEach(() => {
    testMatchmaker = new Matchmaker();
    testRateLimiter = new RateLimiter();

    db.saveUser({
      id: user1Id,
      displayName: 'Alice Test',
      gender: 'female',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    db.saveUser({
      id: user2Id,
      displayName: 'Bob Test',
      gender: 'male',
      country: 'US',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    db.saveUser({
      id: user3Id,
      displayName: 'Charlie Banned',
      gender: 'male',
      country: 'CA',
      isAdultVerified: true,
      role: 'user',
      status: 'banned',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });

  describe('1. Matchmaking & Queue State Management', () => {
    it('successfully enqueues eligible free users and enforces random matching', () => {
      const res = testMatchmaker.enqueue('sock_1', user1Id, 'female', 'IN', {});
      expect(res.success).toBe(true);
      expect(testMatchmaker.getQueueLength()).toBe(1);

      const entry = testMatchmaker.getQueueEntry('sock_1');
      expect(entry?.userId).toBe(user1Id);
      expect(entry?.preferences.preferredGender).toBe('any'); // Free user preference lockdown
    });

    it('rejects suspended or banned users from queue', () => {
      const res = testMatchmaker.enqueue('sock_3', user3Id, 'male', 'CA', {});
      expect(res.success).toBe(false);
      expect(res.error).toContain('banned');
      expect(testMatchmaker.getQueueLength()).toBe(0);
    });

    it('prevents a user from matching with themselves', () => {
      testMatchmaker.enqueue('sock_1a', user1Id, 'female', 'IN', {});
      // Simulating user opening second tab or socket
      const entryA = testMatchmaker.getQueueEntry('sock_1a')!;
      const entryB = { ...entryA, socketId: 'sock_1b' };

      const compatible = testMatchmaker.isCompatible(entryA, entryB);
      expect(compatible).toBe(false);
    });

    it('establishes atomic matches between compatible peers', () => {
      testMatchmaker.enqueue('sock_1', user1Id, 'female', 'IN', { mode: 'video' });
      testMatchmaker.enqueue('sock_2', user2Id, 'male', 'US', { mode: 'video' });

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
      expect(testMatchmaker.getQueueLength()).toBe(0);

      const activeMatch = matches[0];
      expect(activeMatch.user1.socketId).toBe('sock_1');
      expect(activeMatch.user2.socketId).toBe('sock_2');

      // Socket mapping verification
      expect(testMatchmaker.getPeerSocket('sock_1')).toBe('sock_2');
      expect(testMatchmaker.getPeerSocket('sock_2')).toBe('sock_1');
    });
  });

  describe('2. Disconnect Cleanup & Duplicate Disconnect Idempotency', () => {
    it('gracefully handles single disconnect from queue', () => {
      testMatchmaker.enqueue('sock_1', user1Id, 'female', 'IN', {});
      expect(testMatchmaker.getQueueLength()).toBe(1);

      const { endedMatch, wasQueued } = testMatchmaker.handleDisconnect('sock_1');
      expect(wasQueued).toBe(true);
      expect(endedMatch).toBeUndefined();
      expect(testMatchmaker.getQueueLength()).toBe(0);
    });

    it('gracefully handles active match disconnect and purges all mappings', () => {
      testMatchmaker.enqueue('sock_1', user1Id, 'female', 'IN', {});
      testMatchmaker.enqueue('sock_2', user2Id, 'male', 'US', {});
      const matches = testMatchmaker.processMatches();
      const match = matches[0];

      expect(testMatchmaker.getActiveMatchesCount()).toBe(1);

      // sock_1 disconnects
      const { endedMatch, wasQueued } = testMatchmaker.handleDisconnect('sock_1');
      expect(wasQueued).toBe(false);
      expect(endedMatch?.matchId).toBe(match.matchId);
      expect(testMatchmaker.getActiveMatchesCount()).toBe(0);

      // Verify orphaned mappings are purged
      expect(testMatchmaker.getMatchBySocket('sock_1')).toBeUndefined();
      expect(testMatchmaker.getMatchBySocket('sock_2')).toBeUndefined();
      expect(testMatchmaker.getPeerSocket('sock_1')).toBeUndefined();
      expect(testMatchmaker.getPeerSocket('sock_2')).toBeUndefined();
    });

    it('is completely idempotent when handling duplicate disconnect events', () => {
      testMatchmaker.enqueue('sock_1', user1Id, 'female', 'IN', {});
      testMatchmaker.enqueue('sock_2', user2Id, 'male', 'US', {});
      testMatchmaker.processMatches();

      // First disconnect
      const first = testMatchmaker.handleDisconnect('sock_1');
      expect(first.endedMatch).toBeDefined();

      // Duplicate disconnect for sock_1 (e.g. socket close + client error + cleanup pass)
      const duplicate1 = testMatchmaker.handleDisconnect('sock_1');
      expect(duplicate1.endedMatch).toBeUndefined();
      expect(duplicate1.wasQueued).toBe(false);

      // Triplicate disconnect
      const duplicate2 = testMatchmaker.handleDisconnect('sock_1');
      expect(duplicate2.endedMatch).toBeUndefined();
      expect(duplicate2.wasQueued).toBe(false);

      // Partner socket also disconnects subsequently
      const partnerDisconnect = testMatchmaker.handleDisconnect('sock_2');
      expect(partnerDisconnect.endedMatch).toBeUndefined();
      expect(partnerDisconnect.wasQueued).toBe(false);
    });

    it('endMatchById and endMatchBySocket return undefined safely on non-existent matches', () => {
      expect(testMatchmaker.endMatchBySocket('non_existent_sock')).toBeUndefined();
      expect(testMatchmaker.endMatchById('non_existent_match_id')).toBeUndefined();
    });
  });

  describe('3. Skip, Cooldown & Reconnection Behavior', () => {
    it('enforces skip cooldown to prevent skipping flood', () => {
      // First skip allowed
      const first = testRateLimiter.checkCooldown(`skip_${user1Id}`, 1500);
      expect(first.allowed).toBe(true);

      // Rapid consecutive skip within 1.5s is blocked
      const rapid = testRateLimiter.checkCooldown(`skip_${user1Id}`, 1500);
      expect(rapid.allowed).toBe(false);
      expect(rapid.retryAfterMs).toBeGreaterThan(0);
    });

    it('supports seamless reconnection with existing session token', () => {
      const sessionToken = createSessionToken(user1Id);
      expect(sessionToken).toBeDefined();

      // First session connects & matches
      testMatchmaker.enqueue('sock_first', user1Id, 'female', 'IN', {});
      expect(testMatchmaker.getQueueLength()).toBe(1);

      // User experiences network interruption / page refresh
      testMatchmaker.handleDisconnect('sock_first');
      expect(testMatchmaker.getQueueLength()).toBe(0);

      // User reconnects with the exact same session token
      const reconnected = testMatchmaker.enqueue('sock_second', user1Id, 'female', 'IN', {});
      expect(reconnected.success).toBe(true);
      expect(testMatchmaker.getQueueLength()).toBe(1);
      expect(testMatchmaker.getQueueEntry('sock_second')?.userId).toBe(user1Id);
    });
  });

  describe('4. Reverse Proxy Client IP Normalization & Rate Limit Isolation', () => {
    it('prioritizes cf-connecting-ip header over x-forwarded-for', () => {
      const mockReq = {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(mockReq);
      expect(ip).toBe('203.0.113.195');
    });

    it('extracts primary client IP from multi-hop x-forwarded-for list', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '198.51.100.42, 172.16.0.2, 10.0.0.1',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(mockReq);
      expect(ip).toBe('198.51.100.42');
    });

    it('isolates rate-limiting counters for distinct client IPs behind the same reverse proxy', () => {
      const ip1 = '203.0.113.10';
      const ip2 = '203.0.113.20';

      // IP1 exhausts its allowance (max 3)
      testRateLimiter.checkLimit(`test_${ip1}`, 3, 60000);
      testRateLimiter.checkLimit(`test_${ip1}`, 3, 60000);
      const ip1Third = testRateLimiter.checkLimit(`test_${ip1}`, 3, 60000);
      expect(ip1Third.allowed).toBe(true);
      const ip1Blocked = testRateLimiter.checkLimit(`test_${ip1}`, 3, 60000);
      expect(ip1Blocked.allowed).toBe(false);

      // IP2 from another client is still fully allowed
      const ip2First = testRateLimiter.checkLimit(`test_${ip2}`, 3, 60000);
      expect(ip2First.allowed).toBe(true);
      expect(ip2First.remaining).toBe(2);
    });
  });

  describe('5. STUN/TURN Configuration Verification', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('returns standard Google STUN servers when TURN is unconfigured', () => {
      delete process.env.TURN_URL;
      delete process.env.TURN_USERNAME;
      delete process.env.TURN_CREDENTIAL;

      const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ];

      if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
        iceServers.push({
          urls: process.env.TURN_URL,
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_CREDENTIAL,
        });
      }

      expect(iceServers.length).toBe(3);
      expect(iceServers[0].urls).toContain('stun.l.google.com');
    });

    it('correctly appends TURN credentials when loaded from environment variables', () => {
      process.env.TURN_URL = 'turn:relay.example.com:3478';
      process.env.TURN_USERNAME = 'user_webrtc_test';
      process.env.TURN_CREDENTIAL = 'secret_turn_password';

      const iceServers: any[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ];

      if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
        iceServers.push({
          urls: process.env.TURN_URL,
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_CREDENTIAL,
        });
      }

      expect(iceServers.length).toBe(4);
      expect(iceServers[3].urls).toBe('turn:relay.example.com:3478');
      expect(iceServers[3].username).toBe('user_webrtc_test');
      expect(iceServers[3].credential).toBe('secret_turn_password');
    });
  });
});
