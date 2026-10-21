/**
 * Server-authoritative matchmaking queue for OmeLive
 */
import { QueueEntry, ActiveMatch, MatchPreferences, UserGender } from './types';
import { db } from './db';

const STALE_QUEUE_TIMEOUT_MS = 60 * 1000; // 60s without ping = stale

export class Matchmaker {
  private queue: Map<string, QueueEntry> = new Map(); // socketId -> QueueEntry
  private activeMatches: Map<string, ActiveMatch> = new Map(); // matchId -> ActiveMatch
  private userToMatch: Map<string, string> = new Map(); // socketId -> matchId
  private isProcessing = false;

  constructor() {
    // Periodic sweep for stale queue entries
    setInterval(() => this.cleanupStaleEntries(), 15000);
  }

  /**
   * Enqueue a user into the matchmaking system.
   * If the user is Free, server enforces random matching by overriding any custom preferences.
   */
  public enqueue(
    socketId: string,
    userId: string,
    gender: UserGender,
    country: string,
    rawPreferences: MatchPreferences
  ): { success: boolean; error?: string } {
    // Check if user is suspended or banned
    const user = db.getUser(userId);
    if (user && (user.status === 'banned' || user.status === 'suspended')) {
      return { success: false, error: `Account is ${user.status}. You cannot enter video chat.` };
    }

    // Leave any existing match or queue
    this.dequeue(socketId);
    this.endMatchBySocket(socketId);

    // Enforce preferences with Pro priority
    const isPro = db.isUserPro(userId);
    const mode = rawPreferences?.mode === 'text' ? 'text' : 'video';
    const interests = Array.isArray(rawPreferences?.interests) ? rawPreferences.interests : [];
    const languages = Array.isArray(rawPreferences?.languages) ? rawPreferences.languages : [];
    const preferredCountry = rawPreferences?.preferredCountry || 'GLOBAL';

    const preferences: MatchPreferences = {
      mode,
      preferredGender: isPro ? (rawPreferences?.preferredGender || 'any') : 'any',
      preferredCountry,
      interests,
      languages,
      primaryLanguage: rawPreferences?.primaryLanguage || (languages[0] || 'en'),
      interestMatchingEnabled: interests.length > 0,
      priorityQueue: isPro,
    };

    const entry: QueueEntry = {
      userId,
      socketId,
      gender,
      country,
      isPro,
      mode,
      interests,
      languages,
      preferences,
      joinedAt: Date.now(),
    };

    this.queue.set(socketId, entry);
    return { success: true };
  }

  public dequeue(socketId: string): boolean {
    return this.queue.delete(socketId);
  }

  public getQueueLength(): number {
    return this.queue.size;
  }

  public getActiveMatchesCount(): number {
    return this.activeMatches.size;
  }

  public getQueueEntry(socketId: string): QueueEntry | undefined {
    return this.queue.get(socketId);
  }

  public getMatchBySocket(socketId: string): ActiveMatch | undefined {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return undefined;
    return this.activeMatches.get(matchId);
  }

  public getPeerSocket(socketId: string): string | undefined {
    const match = this.getMatchBySocket(socketId);
    if (!match) return undefined;
    if (match.user1.socketId === socketId) return match.user2.socketId;
    if (match.user2.socketId === socketId) return match.user1.socketId;
    return undefined;
  }

  /**
   * Check if two queue entries are compatible for matching.
   */
  public isCompatible(a: QueueEntry, b: QueueEntry): boolean {
    // Cannot match with oneself (same socket or same user account)
    if (a.socketId === b.socketId || a.userId === b.userId) {
      return false;
    }

    // Cannot match if blocked
    if (db.isBlocked(a.userId, b.userId)) {
      return false;
    }

    // Chat mode matching: Video with Video, Text with Text
    const modeA = a.mode || a.preferences?.mode || 'video';
    const modeB = b.mode || b.preferences?.mode || 'video';
    if (modeA !== modeB) {
      return false;
    }

    // Preference matching:
    // Check A's preferences regarding B
    if (a.preferences.preferredGender && a.preferences.preferredGender !== 'any') {
      if (a.preferences.preferredGender !== b.gender) {
        return false;
      }
    }
    if (
      a.preferences.preferredCountry &&
      a.preferences.preferredCountry !== 'GLOBAL' &&
      a.preferences.preferredCountry !== 'any'
    ) {
      if (a.preferences.preferredCountry !== b.country && b.preferences.preferredCountry !== a.preferences.preferredCountry) {
        return false;
      }
    }

    // Check B's preferences regarding A
    if (b.preferences.preferredGender && b.preferences.preferredGender !== 'any') {
      if (b.preferences.preferredGender !== a.gender) {
        return false;
      }
    }
    if (
      b.preferences.preferredCountry &&
      b.preferences.preferredCountry !== 'GLOBAL' &&
      b.preferences.preferredCountry !== 'any'
    ) {
      if (b.preferences.preferredCountry !== a.country && a.preferences.preferredCountry !== b.preferences.preferredCountry) {
        return false;
      }
    }

    return true;
  }

  /**
   * Run atomic matchmaking pass to find and create matches.
   * Returns newly established matches.
   */
  public processMatches(): ActiveMatch[] {
    if (this.isProcessing) return [];
    this.isProcessing = true;

    const newMatches: ActiveMatch[] = [];

    try {
      // Sort candidates: Pro users get priority queue placement, then by join time (FIFO)
      const candidates = Array.from(this.queue.values()).sort((a, b) => {
        if (a.isPro && !b.isPro) return -1;
        if (!a.isPro && b.isPro) return 1;
        return a.joinedAt - b.joinedAt;
      });

      const matchedSockets = new Set<string>();

      for (let i = 0; i < candidates.length; i++) {
        const candidateA = candidates[i];
        if (matchedSockets.has(candidateA.socketId)) continue;

        // Find best compatible candidate for candidateA
        let bestCandidateB: QueueEntry | null = null;
        let bestScore = -1;

        for (let j = i + 1; j < candidates.length; j++) {
          const candidateB = candidates[j];
          if (matchedSockets.has(candidateB.socketId)) continue;

          if (this.isCompatible(candidateA, candidateB)) {
            // Calculate similarity score based on shared interests & languages
            const aInterests = candidateA.interests || candidateA.preferences?.interests || [];
            const bInterests = candidateB.interests || candidateB.preferences?.interests || [];
            const sharedInterests = aInterests.filter((x) => bInterests.includes(x));

            const aLangs = candidateA.languages || candidateA.preferences?.languages || [];
            const bLangs = candidateB.languages || candidateB.preferences?.languages || [];
            const sharedLanguages = aLangs.filter((x) => bLangs.includes(x));

            const score = sharedInterests.length * 3 + sharedLanguages.length * 2;
            if (score > bestScore) {
              bestScore = score;
              bestCandidateB = candidateB;
              // If high score found, take it directly
              if (score >= 3) break;
            }
          }
        }

        if (bestCandidateB) {
          const candidateB = bestCandidateB;
          // Reserve both atomically
          matchedSockets.add(candidateA.socketId);
          matchedSockets.add(candidateB.socketId);

          // Remove from queue
          this.queue.delete(candidateA.socketId);
          this.queue.delete(candidateB.socketId);

          const aInterests = candidateA.interests || candidateA.preferences?.interests || [];
          const bInterests = candidateB.interests || candidateB.preferences?.interests || [];
          const sharedInterests = aInterests.filter((x) => bInterests.includes(x));

          const aLangs = candidateA.languages || candidateA.preferences?.languages || [];
          const bLangs = candidateB.languages || candidateB.preferences?.languages || [];
          const sharedLanguages = aLangs.filter((x) => bLangs.includes(x));

          const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
          const match: ActiveMatch = {
            matchId,
            mode: candidateA.mode || 'video',
            user1: { userId: candidateA.userId, socketId: candidateA.socketId },
            user2: { userId: candidateB.userId, socketId: candidateB.socketId },
            sharedInterests,
            sharedLanguages,
            createdAt: Date.now(),
          };

          this.activeMatches.set(matchId, match);
          this.userToMatch.set(candidateA.socketId, matchId);
          this.userToMatch.set(candidateB.socketId, matchId);

          newMatches.push(match);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return newMatches;
  }

  /**
   * End an active match involving a socket.
   */
  public endMatchBySocket(socketId: string): ActiveMatch | undefined {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return undefined;

    const match = this.activeMatches.get(matchId);
    if (match) {
      this.userToMatch.delete(match.user1.socketId);
      this.userToMatch.delete(match.user2.socketId);
      this.activeMatches.delete(matchId);
    }

    return match;
  }

  public endMatchById(matchId: string): ActiveMatch | undefined {
    const match = this.activeMatches.get(matchId);
    if (match) {
      this.userToMatch.delete(match.user1.socketId);
      this.userToMatch.delete(match.user2.socketId);
      this.activeMatches.delete(matchId);
    }
    return match;
  }

  /**
   * Clean up disconnected socket completely.
   */
  public handleDisconnect(socketId: string): { endedMatch?: ActiveMatch; wasQueued: boolean } {
    const wasQueued = this.dequeue(socketId);
    const endedMatch = this.endMatchBySocket(socketId);
    return { endedMatch, wasQueued };
  }

  private cleanupStaleEntries() {
    const now = Date.now();
    for (const [socketId, entry] of this.queue.entries()) {
      if (now - entry.joinedAt > STALE_QUEUE_TIMEOUT_MS) {
        this.queue.delete(socketId);
      }
    }
  }
}

export const matchmaker = new Matchmaker();
