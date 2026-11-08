import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { Matchmaker } from '../matchmaker';
import { activateProSubscription } from '../payments';

describe('Phase 4: Country Filter, Language Filter & Matchmaking Integrity', () => {
  let testMatchmaker: Matchmaker;
  const freeUserA = 'u_free_a_' + Math.random().toString(36).substring(2, 7);
  const freeUserB = 'u_free_b_' + Math.random().toString(36).substring(2, 7);
  const proUserA = 'u_pro_a_' + Math.random().toString(36).substring(2, 7);
  const proUserB = 'u_pro_b_' + Math.random().toString(36).substring(2, 7);

  beforeEach(() => {
    testMatchmaker = new Matchmaker();

    // Free User A from United States
    db.saveUser({
      id: freeUserA,
      displayName: 'Free User A',
      gender: 'male',
      country: 'US',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Free User B from India
    db.saveUser({
      id: freeUserB,
      displayName: 'Free User B',
      gender: 'female',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Pro User A from United States
    db.saveUser({
      id: proUserA,
      displayName: 'Pro User A',
      gender: 'male',
      country: 'US',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    activateProSubscription(proUserA, 'sub_pro_a');

    // Pro User B from India
    db.saveUser({
      id: proUserB,
      displayName: 'Pro User B',
      gender: 'female',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    activateProSubscription(proUserB, 'sub_pro_b');
  });

  describe('1. Server-Side Entitlement & Sanitization for Non-Pro Users', () => {
    it('free user cannot bypass country filter via WebSocket queue join payload', () => {
      // Free user maliciously sending custom country preference into queue
      testMatchmaker.enqueue('sock_free_1', freeUserA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
        isMultipleCountries: true,
      });

      const entry = testMatchmaker.getQueueEntry('sock_free_1')!;
      expect(entry.isPro).toBe(false);
      // Server must forcibly neutralize to GLOBAL
      expect(entry.preferences.preferredCountry).toBe('GLOBAL');
      expect(entry.preferences.preferredCountries).toEqual(['GLOBAL']);
      expect(entry.preferences.isMultipleCountries).toBe(false);
    });

    it('free user cannot bypass language filter via WebSocket queue join payload', () => {
      testMatchmaker.enqueue('sock_free_2', freeUserA, 'male', 'US', {
        languages: ['ja', 'es'],
        preferredLanguages: ['ja', 'es'],
      });

      const entry = testMatchmaker.getQueueEntry('sock_free_2')!;
      expect(entry.isPro).toBe(false);
      // Languages must be forced empty for Free random matching
      expect(entry.preferences.languages).toEqual([]);
      expect(entry.preferences.preferredLanguages).toEqual([]);
    });

    it('pro user retains specified single country filter', () => {
      testMatchmaker.enqueue('sock_pro_1', proUserA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      const entry = testMatchmaker.getQueueEntry('sock_pro_1')!;
      expect(entry.isPro).toBe(true);
      expect(entry.preferences.preferredCountry).toBe('IN');
      expect(entry.preferences.preferredCountries).toEqual(['IN']);
    });

    it('pro user retains multiple countries selection filter', () => {
      testMatchmaker.enqueue('sock_pro_2', proUserA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN', 'CA', 'GB'],
        isMultipleCountries: true,
      });

      const entry = testMatchmaker.getQueueEntry('sock_pro_2')!;
      expect(entry.isPro).toBe(true);
      expect(entry.preferences.preferredCountries).toEqual(['IN', 'CA', 'GB']);
      expect(entry.preferences.isMultipleCountries).toBe(true);
    });
  });

  describe('2. Matchmaking Compatibility & Filter Enforcement', () => {
    it('matches Pro user with compatible Free user from preferred country', () => {
      // Pro User A (from US) filters for partners in India (IN)
      testMatchmaker.enqueue('sock_p1', proUserA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      // Free User B is from India (IN) and has no restrictions
      testMatchmaker.enqueue('sock_f1', freeUserB, 'female', 'IN', {});

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
      expect(matches[0].user1.userId).toBe(proUserA);
      expect(matches[0].user2.userId).toBe(freeUserB);
    });

    it('does NOT match Pro user with user from incompatible country', () => {
      // Pro User A (from US) filters strictly for Japan (JP)
      testMatchmaker.enqueue('sock_p1', proUserA, 'male', 'US', {
        preferredCountry: 'JP',
        preferredCountries: ['JP'],
      });

      // User B is from India (IN)
      testMatchmaker.enqueue('sock_f1', freeUserB, 'female', 'IN', {});

      const matches = testMatchmaker.processMatches();
      // Must NOT match!
      expect(matches.length).toBe(0);
      // Both must remain waiting in queue (no fake matches)
      expect(testMatchmaker.getQueueLength()).toBe(2);
    });

    it('matches Pro user with any country in their multiple countries filter', () => {
      // Pro User A filters for [Germany, India, Singapore]
      testMatchmaker.enqueue('sock_p1', proUserA, 'male', 'US', {
        preferredCountries: ['DE', 'IN', 'SG'],
        isMultipleCountries: true,
      });

      // User B is from India (IN)
      testMatchmaker.enqueue('sock_f1', freeUserB, 'female', 'IN', {});

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
      expect(matches[0].user2.userId).toBe(freeUserB);
    });

    it('enforces reciprocal matching when BOTH users are Pro with filters', () => {
      // Pro User A is from US, wants someone from IN
      testMatchmaker.enqueue('sock_pa', proUserA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      // Case 1: Pro User B is from IN, wants someone from US
      testMatchmaker.enqueue('sock_pb', proUserB, 'female', 'IN', {
        preferredCountry: 'US',
        preferredCountries: ['US'],
      });

      // Reciprocal match should succeed
      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
    });

    it('rejects match if reciprocal Pro country filter is unsatisfied', () => {
      // Pro User A is from US, wants someone from IN
      testMatchmaker.enqueue('sock_pa', proUserA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      // Pro User B is from IN, but strictly wants someone from Canada (CA)
      testMatchmaker.enqueue('sock_pb', proUserB, 'female', 'IN', {
        preferredCountry: 'CA',
        preferredCountries: ['CA'],
      });

      // B does NOT want someone from US, so they must NOT match!
      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(0);
      expect(testMatchmaker.getQueueLength()).toBe(2);
    });

    it('matches users with compatible language filters', () => {
      // Pro User A wants Spanish (es)
      testMatchmaker.enqueue('sock_pa', proUserA, 'male', 'US', {
        languages: ['es'],
        preferredLanguages: ['es'],
      });

      // Pro User B speaks Spanish and English
      testMatchmaker.enqueue('sock_pb', proUserB, 'female', 'IN', {
        languages: ['es', 'en'],
        preferredLanguages: ['es', 'en'],
      });

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
    });

    it('rejects match when language filter is unsatisfied', () => {
      // Pro User A wants Japanese (ja)
      testMatchmaker.enqueue('sock_pa', proUserA, 'male', 'US', {
        languages: ['ja'],
        preferredLanguages: ['ja'],
      });

      // Pro User B only speaks English and Hindi
      testMatchmaker.enqueue('sock_pb', proUserB, 'female', 'IN', {
        languages: ['en', 'hi'],
        preferredLanguages: ['en', 'hi'],
      });

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(0);
      expect(testMatchmaker.getQueueLength()).toBe(2);
    });
  });

  describe('3. Database Persistence & Reset Behavior', () => {
    it('saves and retrieves user preferences in database', () => {
      const saved = db.saveUserPreferences(proUserA, {
        preferredCountry: 'FR',
        preferredCountries: ['FR', 'DE'],
        isMultipleCountries: true,
        languages: ['fr'],
        preferredLanguages: ['fr'],
      });

      expect(saved.preferredCountry).toBe('FR');
      expect(saved.preferredCountries).toEqual(['FR', 'DE']);
      expect(saved.isMultipleCountries).toBe(true);

      const retrieved = db.getUserPreferences(proUserA)!;
      expect(retrieved.preferredCountry).toBe('FR');
      expect(retrieved.preferredCountries).toEqual(['FR', 'DE']);
    });

    it('reset restores preferences to Global defaults', () => {
      db.saveUserPreferences(proUserA, {
        preferredCountry: 'JP',
        preferredCountries: ['JP'],
        isMultipleCountries: true,
        languages: ['ja'],
      });

      const reset = db.saveUserPreferences(proUserA, {
        preferredCountry: 'GLOBAL',
        preferredCountries: ['GLOBAL'],
        isMultipleCountries: false,
        languages: ['en'],
        preferredLanguages: ['en'],
        preferredGender: 'any',
      });

      expect(reset.preferredCountry).toBe('GLOBAL');
      expect(reset.preferredCountries).toEqual(['GLOBAL']);
      expect(reset.isMultipleCountries).toBe(false);
      expect(reset.languages).toEqual(['en']);
    });
  });
});
