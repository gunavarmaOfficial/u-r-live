/**
 * HTTP-based Signaling & Matchmaking for Serverless Environments (Vercel)
 * Enables real WebRTC peer-to-peer audio, video, and text chat without requiring persistent WebSockets.
 */
import { areEntriesCompatible, buildQueueEntry } from './matchmaker';
import { MatchPreferences, UserGender } from './types';

interface HttpQueueUser {
  userId: string;
  country: string;
  gender: UserGender;
  preferences: MatchPreferences;
  joinedAt: number;
  lastPoll: number;
}

interface HttpMatch {
  matchId: string;
  initiatorId: string;
  responderId: string;
  initiatorCountry: string;
  responderCountry: string;
  initiatorInterests: string[];
  responderInterests: string[];
  createdAt: number;
  lastActivity: number;
  messagesForInitiator: any[];
  messagesForResponder: any[];
}

class HttpSignalingManager {
  private queue = new Map<string, HttpQueueUser>();
  private matches = new Map<string, HttpMatch>();
  private userToMatch = new Map<string, string>();

  /**
   * Prune stale entries (users who stopped polling > 20s ago, matches idle > 60s)
   */
  private pruneStale() {
    const now = Date.now();
    for (const [userId, user] of this.queue.entries()) {
      if (now - user.lastPoll > 20000) {
        this.queue.delete(userId);
      }
    }

    for (const [matchId, match] of this.matches.entries()) {
      if (now - match.lastActivity > 60000) {
        this.userToMatch.delete(match.initiatorId);
        this.userToMatch.delete(match.responderId);
        this.matches.delete(matchId);
      }
    }
  }

  public joinQueue(
    userId: string,
    country: string = 'GLOBAL',
    gender: UserGender = 'unspecified',
    preferences: MatchPreferences
  ): {
    status: 'matched' | 'waiting';
    matchId?: string;
    isInitiator?: boolean;
    peerUserId?: string;
    peerCountry?: string;
    sharedInterests?: string[];
  } {
    this.pruneStale();

    // Leave any existing match or queue position
    this.leave(userId);

    const candidateEntry = buildQueueEntry(
      'http_' + userId,
      userId,
      gender,
      country,
      preferences
    );

    // Look for a compatible peer in the waiting queue
    for (const [otherId, other] of this.queue.entries()) {
      if (otherId === userId) continue;

      const otherEntry = buildQueueEntry(
        'http_' + other.userId,
        other.userId,
        other.gender,
        other.country,
        other.preferences
      );

      if (areEntriesCompatible(candidateEntry, otherEntry)) {
        // Match found!
        this.queue.delete(otherId);

        const matchId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const candInterests = candidateEntry.interests || [];
        const othInterests = otherEntry.interests || [];
        const sharedInterests = candInterests.filter((i) =>
          othInterests.includes(i)
        );

        const match: HttpMatch = {
          matchId,
          initiatorId: other.userId, // older waiting user initiates WebRTC offer
          responderId: userId,
          initiatorCountry: other.country,
          responderCountry: country,
          initiatorInterests: othInterests,
          responderInterests: candInterests,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messagesForInitiator: [],
          messagesForResponder: [],
        };

        this.matches.set(matchId, match);
        this.userToMatch.set(other.userId, matchId);
        this.userToMatch.set(userId, matchId);

        return {
          status: 'matched',
          matchId,
          isInitiator: false,
          peerUserId: other.userId,
          peerCountry: other.country,
          sharedInterests,
        };
      }
    }

    // No compatible peer found yet -> enqueue
    this.queue.set(userId, {
      userId,
      country,
      gender,
      preferences,
      joinedAt: Date.now(),
      lastPoll: Date.now(),
    });

    return { status: 'waiting' };
  }

  public poll(userId: string): {
    status: 'matched' | 'in_match' | 'waiting' | 'idle';
    matchId?: string;
    isInitiator?: boolean;
    peerUserId?: string;
    peerCountry?: string;
    sharedInterests?: string[];
    messages?: any[];
  } {
    this.pruneStale();

    const matchId = this.userToMatch.get(userId);
    if (matchId) {
      const match = this.matches.get(matchId);
      if (match) {
        match.lastActivity = Date.now();
        const isInitiator = match.initiatorId === userId;
        const msgQueue = isInitiator
          ? match.messagesForInitiator
          : match.messagesForResponder;

        const messages = [...msgQueue];
        msgQueue.length = 0; // drain

        const peerUserId = isInitiator ? match.responderId : match.initiatorId;
        const peerCountry = isInitiator ? match.responderCountry : match.initiatorCountry;
        const sharedInterests = match.initiatorInterests.filter((i) =>
          match.responderInterests.includes(i)
        );

        return {
          status: 'in_match',
          matchId,
          isInitiator,
          peerUserId,
          peerCountry,
          sharedInterests,
          messages,
        };
      }
    }

    const queueUser = this.queue.get(userId);
    if (queueUser) {
      queueUser.lastPoll = Date.now();
      return { status: 'waiting' };
    }

    return { status: 'idle' };
  }

  public sendSignal(matchId: string, senderId: string, message: any): boolean {
    const match = this.matches.get(matchId);
    if (!match) return false;

    match.lastActivity = Date.now();
    const isSenderInitiator = match.initiatorId === senderId;
    const targetQueue = isSenderInitiator
      ? match.messagesForResponder
      : match.messagesForInitiator;

    targetQueue.push(message);
    return true;
  }

  public leave(userId: string): void {
    this.queue.delete(userId);

    const matchId = this.userToMatch.get(userId);
    if (matchId) {
      this.userToMatch.delete(userId);
      const match = this.matches.get(matchId);
      if (match) {
        const isInitiator = match.initiatorId === userId;
        const otherId = isInitiator ? match.responderId : match.initiatorId;
        this.userToMatch.delete(otherId);

        // Notify partner that peer disconnected
        const otherQueue = isInitiator
          ? match.messagesForResponder
          : match.messagesForInitiator;
        otherQueue.push({ type: 'peer_disconnected', reason: 'Stranger disconnected.' });

        // Keep match briefly so the final message can be drained
        setTimeout(() => {
          this.matches.delete(matchId);
        }, 5000);
      }
    }
  }
}

export const httpSignaling = new HttpSignalingManager();
