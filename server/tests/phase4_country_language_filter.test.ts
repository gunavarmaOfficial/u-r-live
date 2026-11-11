import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { Matchmaker } from '../matchmaker';

describe('Phase 4: Country Filter, Language Filter & Matchmaking Integrity', () => {
  let testMatchmaker: Matchmaker;
  const userA = 'u_a_' + Math.random().toString(36).substring(2, 7);
  const userB = 'u_b_' + Math.random().toString(36).substring(2, 7);

  beforeEach(() => {
    testMatchmaker = new Matchmaker();

    // User A from United States
    db.saveUser({
      id: userA,
      displayName: 'User A',
      gender: 'male',
      country: 'US',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // User B from India
    db.saveUser({
      id: userB,
      displayName: 'User B',
      gender: 'female',
      country: 'IN',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  });

  describe('1. Server-Side Preference Application for All Users', () => {
    it('applies country filter sent via WebSocket queue join payload', () => {
      testMatchmaker.enqueue('sock_1', userA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
        isMultipleCountries: true,
      });

      const entry = testMatchmaker.getQueueEntry('sock_1')!;
      expect(entry.preferences.preferredCountry).toBe('IN');
      expect(entry.preferences.preferredCountries).toEqual(['IN']);
      expect(entry.preferences.isMultipleCountries).toBe(true);
    });

    it('applies language filter sent via WebSocket queue join payload', () => {
      testMatchmaker.enqueue('sock_2', userA, 'male', 'US', {
        languages: ['ja', 'es'],
        preferredLanguages: ['ja', 'es'],
      });

      const entry = testMatchmaker.getQueueEntry('sock_2')!;
      expect(entry.preferences.languages).toEqual(['ja', 'es']);
      expect(entry.preferences.preferredLanguages).toEqual(['ja', 'es']);
    });

    it('retains specified single country filter', () => {
      testMatchmaker.enqueue('sock_3', userA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      const entry = testMatchmaker.getQueueEntry('sock_3')!;
      expect(entry.preferences.preferredCountry).toBe('IN');
      expect(entry.preferences.preferredCountries).toEqual(['IN']);
    });

    it('retains multiple countries selection filter', () => {
      testMatchmaker.enqueue('sock_4', userA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN', 'CA', 'GB'],
        isMultipleCountries: true,
      });

      const entry = testMatchmaker.getQueueEntry('sock_4')!;
      expect(entry.preferences.preferredCountries).toEqual(['IN', 'CA', 'GB']);
      expect(entry.preferences.isMultipleCountries).toBe(true);
    });
  });

  describe('2. Matchmaking Compatibility & Filter Enforcement', () => {
    it('matches user with compatible partner from preferred country', () => {
      // User A (from US) filters for partners in India (IN)
      testMatchmaker.enqueue('sock_p1', userA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      // User B is from India (IN) and has no restrictions
      testMatchmaker.enqueue('sock_f1', userB, 'female', 'IN', {});

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
      expect(matches[0].user1.userId).toBe(userA);
      expect(matches[0].user2.userId).toBe(userB);
    });

    it('does NOT match user with partner from incompatible country', () => {
      // User A (from US) filters strictly for Japan (JP)
      testMatchmaker.enqueue('sock_p1', userA, 'male', 'US', {
        preferredCountry: 'JP',
        preferredCountries: ['JP'],
      });

      // User B is from India (IN)
      testMatchmaker.enqueue('sock_f1', userB, 'female', 'IN', {});

      const matches = testMatchmaker.processMatches();
      // Must NOT match!
      expect(matches.length).toBe(0);
      // Both must remain waiting in queue (no fake matches)
      expect(testMatchmaker.getQueueLength()).toBe(2);
    });

    it('matches user with any country in their multiple countries filter', () => {
      // User A filters for [Germany, India, Singapore]
      testMatchmaker.enqueue('sock_p1', userA, 'male', 'US', {
        preferredCountries: ['DE', 'IN', 'SG'],
        isMultipleCountries: true,
      });

      // User B is from India (IN)
      testMatchmaker.enqueue('sock_f1', userB, 'female', 'IN', {});

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
      expect(matches[0].user2.userId).toBe(userB);
    });

    it('enforces reciprocal matching when BOTH users have filters', () => {
      // User A is from US, wants someone from IN
      testMatchmaker.enqueue('sock_pa', userA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      // Case 1: User B is from IN, wants someone from US
      testMatchmaker.enqueue('sock_pb', userB, 'female', 'IN', {
        preferredCountry: 'US',
        preferredCountries: ['US'],
      });

      // Reciprocal match should succeed
      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
    });

    it('rejects match if reciprocal country filter is unsatisfied', () => {
      // User A is from US, wants someone from IN
      testMatchmaker.enqueue('sock_pa', userA, 'male', 'US', {
        preferredCountry: 'IN',
        preferredCountries: ['IN'],
      });

      // User B is from IN, but strictly wants someone from Canada (CA)
      testMatchmaker.enqueue('sock_pb', userB, 'female', 'IN', {
        preferredCountry: 'CA',
        preferredCountries: ['CA'],
      });

      // B does NOT want someone from US, so they must NOT match!
      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(0);
      expect(testMatchmaker.getQueueLength()).toBe(2);
    });

    it('matches users with compatible language filters', () => {
      // User A wants Spanish (es)
      testMatchmaker.enqueue('sock_pa', userA, 'male', 'US', {
        languages: ['es'],
        preferredLanguages: ['es'],
      });

      // User B speaks Spanish and English
      testMatchmaker.enqueue('sock_pb', userB, 'female', 'IN', {
        languages: ['es', 'en'],
        preferredLanguages: ['es', 'en'],
      });

      const matches = testMatchmaker.processMatches();
      expect(matches.length).toBe(1);
    });

    it('rejects match when language filter is unsatisfied', () => {
      // User A wants Japanese (ja)
      testMatchmaker.enqueue('sock_pa', userA, 'male', 'US', {
        languages: ['ja'],
        preferredLanguages: ['ja'],
      });

      // User B only speaks English and Hindi
      testMatchmaker.enqueue('sock_pb', userB, 'female', 'IN', {
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
      const saved = db.saveUserPreferences(userA, {
        preferredCountry: 'FR',
        preferredCountries: ['FR', 'DE'],
        isMultipleCountries: true,
        languages: ['fr'],
        preferredLanguages: ['fr'],
      });

      expect(saved.preferredCountry).toBe('FR');
      expect(saved.preferredCountries).toEqual(['FR', 'DE']);
      expect(saved.isMultipleCountries).toBe(true);

      const retrieved = db.getUserPreferences(userA)!;
      expect(retrieved.preferredCountry).toBe('FR');
      expect(retrieved.preferredCountries).toEqual(['FR', 'DE']);
    });

    it('reset restores preferences to Global defaults', () => {
      db.saveUserPreferences(userA, {
        preferredCountry: 'JP',
        preferredCountries: ['JP'],
        isMultipleCountries: true,
        languages: ['ja'],
      });

      const reset = db.saveUserPreferences(userA, {
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
