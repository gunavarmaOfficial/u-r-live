/**
 * Matchmaking facade. Picks the Redis-backed engine when REDIS_URL is set so
 * multiple Cloud Run instances share one queue, and falls back to the
 * in-process matchmaker for development and tests.
 */
import { matchmaker } from './matchmaker';
import { RedisMatchmaker, MatchSink } from './redisMatchmaker';
import { isRedisConfigured } from './redis';
import { ActiveMatch, MatchPreferences, SignalingMessage, UserGender } from './types';

export interface MatchmakingEngine {
  /** True when the engine delivers match_found / peer messages itself. */
  readonly selfDelivering: boolean;
  init(sink: MatchSink): MatchmakingEngine;
  enqueue(
    socketId: string,
    userId: string,
    gender: UserGender,
    country: string,
    preferences: MatchPreferences,
    displayName?: string
  ): Promise<{ success: boolean; error?: string; endedMatch?: ActiveMatch }>;
  dequeue(socketId: string): Promise<boolean>;
  touch(socketId: string): Promise<void>;
  processMatches(): Promise<ActiveMatch[]>;
  endMatchById(matchId: string): Promise<ActiveMatch | undefined>;
  endMatchBySocket(socketId: string): Promise<ActiveMatch | undefined>;
  handleDisconnect(socketId: string): Promise<{ endedMatch?: ActiveMatch; wasQueued: boolean }>;
  sendToMatchPeer(match: ActiveMatch, fromSocketId: string, message: SignalingMessage): Promise<void>;
  getMatchBySocket(socketId: string): ActiveMatch | undefined;
  getPeerSocket(socketId: string): string | undefined;
  getActiveMatches(): ActiveMatch[];
  getActiveMatchesCount(): number;
  getQueueLength(): number;
  queueLength(): Promise<number>;
  close(): Promise<void>;
}

class LocalEngine implements MatchmakingEngine {
  public readonly selfDelivering = false;
  private sink: MatchSink | null = null;

  init(sink: MatchSink): MatchmakingEngine {
    this.sink = sink;
    return this;
  }

  async enqueue(
    socketId: string,
    userId: string,
    gender: UserGender,
    country: string,
    preferences: MatchPreferences
  ) {
    return matchmaker.enqueue(socketId, userId, gender, country, preferences);
  }

  async dequeue(socketId: string): Promise<boolean> {
    return matchmaker.dequeue(socketId);
  }

  async touch(): Promise<void> {
    // In-process queue entries are swept by the matchmaker itself
  }

  async processMatches(): Promise<ActiveMatch[]> {
    return matchmaker.processMatches();
  }

  async endMatchById(matchId: string): Promise<ActiveMatch | undefined> {
    return matchmaker.endMatchById(matchId);
  }

  async endMatchBySocket(socketId: string): Promise<ActiveMatch | undefined> {
    return matchmaker.endMatchBySocket(socketId);
  }

  async handleDisconnect(
    socketId: string
  ): Promise<{ endedMatch?: ActiveMatch; wasQueued: boolean }> {
    return matchmaker.handleDisconnect(socketId);
  }

  async sendToMatchPeer(
    match: ActiveMatch,
    fromSocketId: string,
    message: SignalingMessage
  ): Promise<void> {
    const peer =
      match.user1.socketId === fromSocketId ? match.user2.socketId : match.user1.socketId;
    this.sink?.deliver(peer, message);
  }

  getMatchBySocket(socketId: string): ActiveMatch | undefined {
    return matchmaker.getMatchBySocket(socketId);
  }

  getPeerSocket(socketId: string): string | undefined {
    return matchmaker.getPeerSocket(socketId);
  }

  getActiveMatches(): ActiveMatch[] {
    return matchmaker.getActiveMatches();
  }

  getActiveMatchesCount(): number {
    return matchmaker.getActiveMatchesCount();
  }

  getQueueLength(): number {
    return matchmaker.getQueueLength();
  }

  async queueLength(): Promise<number> {
    return matchmaker.getQueueLength();
  }

  async close(): Promise<void> {
    // Nothing to release for the in-process engine
  }
}

let engine: MatchmakingEngine | null = null;

export function initMatchmaking(sink: MatchSink): MatchmakingEngine {
  if (!engine) {
    engine = isRedisConfigured() ? new RedisMatchmaker() : new LocalEngine();
  }
  return engine.init(sink);
}

export function getMatchmaking(): MatchmakingEngine {
  if (!engine) {
    engine = isRedisConfigured() ? new RedisMatchmaker() : new LocalEngine();
  }
  return engine;
}

export async function closeMatchmaking(): Promise<void> {
  if (engine) {
    await engine.close().catch(() => {});
    engine = null;
  }
}

/** Propagates block/unblock to the shared block set when Redis is in use. */
export function syncBlock(userA: string, userB: string, blocked: boolean): void {
  if (!(engine instanceof RedisMatchmaker)) return;
  const action = blocked ? engine.recordBlock(userA, userB) : engine.removeBlock(userA, userB);
  void action.catch(() => {});
}
