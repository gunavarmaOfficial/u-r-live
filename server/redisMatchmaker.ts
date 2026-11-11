/**
 * Redis-backed matchmaking for multi-instance deployments (Cloud Run).
 *
 * State layout:
 *   url:queue               ZSET  socketId -> joinedAt (matching order)
 *   url:queue:alive         ZSET  socketId -> lastSeen (staleness sweep)
 *   url:qentry:{socketId}   STRING JSON QueueEntry (TTL 5 min)
 *   url:match:{matchId}     STRING JSON match + owning instances (TTL 1 h)
 *   url:blocks              SET   "userA|userB" pairs
 *   url:matchmaker:lock     STRING leader lock (PX 2.5 s)
 *   url:instance:{id}       PUB/SUB channel for targeted socket delivery
 *
 * Only the lock holder runs a matching pass (leader election), which keeps the
 * compatibility rules in TypeScript instead of duplicating them in Lua. The
 * final pair claim is a Lua ZREM transaction so two instances can never match
 * the same socket twice under a race.
 */
import crypto from 'crypto';
import type Redis from 'ioredis';
import { ActiveMatch, MatchPreferences, QueueEntry, SignalingMessage, UserGender } from './types';
import { db } from './db';
import { buildQueueEntry, areEntriesCompatible } from './matchmaker';
import { getRedis, getRedisSubscriber } from './redis';

const QUEUE_KEY = 'url:queue';
const ALIVE_KEY = 'url:queue:alive';
const ENTRY_PREFIX = 'url:qentry:';
const MATCH_PREFIX = 'url:match:';
const BLOCKS_KEY = 'url:blocks';
const LOCK_KEY = 'url:matchmaker:lock';
const CHANNEL_PREFIX = 'url:instance:';

const ENTRY_TTL_MS = 5 * 60 * 1000;
const MATCH_TTL_SECONDS = 60 * 60;
const STALE_AFTER_MS = 60 * 1000;
const MATCH_PASS_BATCH = 200;
const MATCH_TTL_LOCAL_MS = 2 * 60 * 60 * 1000;

const CLAIM_PAIR_LUA = `
local removedA = redis.call('ZREM', KEYS[1], ARGV[1])
local removedB = redis.call('ZREM', KEYS[1], ARGV[2])
if removedA == 1 and removedB == 1 then
  redis.call('ZREM', KEYS[2], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[2])
  return 2
end
if removedA == 1 then redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1]) end
if removedB == 1 then redis.call('ZADD', KEYS[1], ARGV[4], ARGV[2]) end
return removedA + removedB
`;

export interface MatchSink {
  deliver: (socketId: string, message: SignalingMessage) => void;
  isLocal: (socketId: string) => boolean;
}

interface RedisQueueEntry extends QueueEntry {
  instanceId: string;
  displayName?: string;
}

interface LocalMatchRecord {
  match: ActiveMatch;
  instances: { u1: string; u2: string };
  registeredAt: number;
}

interface MatchEnvelope {
  targetSocketId: string;
  message: SignalingMessage;
  match?: { match: ActiveMatch; instances: { u1: string; u2: string } };
  clearMatchId?: string;
}

function entryKey(socketId: string) {
  return `${ENTRY_PREFIX}${socketId}`;
}

function matchKey(matchId: string) {
  return `${MATCH_PREFIX}${matchId}`;
}

function channelName(instanceId: string) {
  return `${CHANNEL_PREFIX}${instanceId}`;
}

function blockPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function matchFoundPayload(match: ActiveMatch, isInitiator: boolean, peer: QueueEntry): SignalingMessage {
  return {
    type: 'match_found',
    matchId: match.matchId,
    payload: {
      isInitiator,
      peerUserId: peer.userId,
      peerName: peer.displayName || 'Anonymous User',
      peerCountry: peer.country || 'GLOBAL',
      sharedInterests: match.sharedInterests || [],
      sharedLanguages: match.sharedLanguages || [],
      mode: match.mode || 'video',
    },
  };
}

export class RedisMatchmaker {
  public readonly selfDelivering = true;
  private readonly instanceId = 'inst_' + crypto.randomBytes(6).toString('hex');
  private readonly localMatches = new Map<string, LocalMatchRecord>();
  private readonly userToMatch = new Map<string, string>();
  private readonly localQueue = new Map<string, QueueEntry>();
  private sink: MatchSink | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;

  /** Subscribes to this instance's delivery channel and starts local housekeeping. */
  public init(sink: MatchSink): this {
    this.sink = sink;
    void this.subscribe();

    this.sweepTimer = setInterval(() => {
      const cutoff = Date.now() - MATCH_TTL_LOCAL_MS;
      for (const [matchId, record] of this.localMatches.entries()) {
        if (record.registeredAt < cutoff) this.clearLocalMatch(matchId);
      }
    }, 5 * 60 * 1000);
    if (this.sweepTimer.unref) this.sweepTimer.unref();

    return this;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  private async subscribe(): Promise<void> {
    const subscriber = getRedisSubscriber();
    if (!subscriber) return;

    try {
      await subscriber.subscribe(channelName(this.instanceId));
      subscriber.on('message', (_channel, raw) => {
        try {
          this.applyEnvelope(JSON.parse(raw) as MatchEnvelope);
        } catch (err: any) {
          console.error('[RedisMatchmaker] Dropped malformed relay message:', err.message);
        }
      });
    } catch (err: any) {
      console.error('[RedisMatchmaker] Could not subscribe to instance channel:', err.message);
    }
  }

  private applyEnvelope(envelope: MatchEnvelope): void {
    if (envelope.clearMatchId) this.clearLocalMatch(envelope.clearMatchId);
    if (envelope.match) {
      this.registerMatch(envelope.match.match, envelope.match.instances);
    }
    if (this.sink) this.sink.deliver(envelope.targetSocketId, envelope.message);
  }

  private registerMatch(match: ActiveMatch, instances: { u1: string; u2: string }): void {
    if (!this.sink) return;
    if (!this.sink.isLocal(match.user1.socketId) && !this.sink.isLocal(match.user2.socketId)) {
      return;
    }
    this.localMatches.set(match.matchId, { match, instances, registeredAt: Date.now() });
    this.userToMatch.set(match.user1.socketId, match.matchId);
    this.userToMatch.set(match.user2.socketId, match.matchId);
  }

  private clearLocalMatch(matchId: string): void {
    const record = this.localMatches.get(matchId);
    if (!record) return;
    this.userToMatch.delete(record.match.user1.socketId);
    this.userToMatch.delete(record.match.user2.socketId);
    this.localMatches.delete(matchId);
  }

  private async dispatch(envelope: MatchEnvelope, instanceId: string): Promise<void> {
    if (instanceId === this.instanceId) {
      this.applyEnvelope(envelope);
      return;
    }
    const client = getRedis();
    if (!client) {
      // No Redis: the peer must be local, otherwise the client will reconnect
      this.applyEnvelope(envelope);
      return;
    }
    try {
      await client.publish(channelName(instanceId), JSON.stringify(envelope));
    } catch (err: any) {
      console.error('[RedisMatchmaker] Delivery publish failed:', err.message);
    }
  }

  // --- Queue operations ---

  public async enqueue(
    socketId: string,
    userId: string,
    gender: UserGender,
    country: string,
    rawPreferences: MatchPreferences,
    displayName?: string
  ): Promise<{ success: boolean; error?: string; endedMatch?: ActiveMatch }> {
    const user = await db.ensureUser(userId);
    if (user && (user.status === 'banned' || user.status === 'suspended')) {
      return { success: false, error: `Account is ${user.status}. You cannot enter video chat.` };
    }

    await this.dequeue(socketId);
    const endedMatch = await this.endMatchBySocket(socketId);

    const entry: RedisQueueEntry = {
      ...buildQueueEntry(socketId, userId, gender, country, rawPreferences),
      instanceId: this.instanceId,
      displayName: displayName || user?.displayName,
    };

    const client = getRedis();
    if (!client) return { success: false, error: 'Distributed matchmaking unavailable' };

    try {
      const pipeline = client.pipeline();
      pipeline.set(entryKey(socketId), JSON.stringify(entry), 'PX', ENTRY_TTL_MS);
      pipeline.zadd(QUEUE_KEY, entry.joinedAt, socketId);
      pipeline.zadd(ALIVE_KEY, Date.now(), socketId);
      await pipeline.exec();
    } catch (err: any) {
      console.error('[RedisMatchmaker] Enqueue failed:', err.message);
      return { success: false, error: 'Could not join the queue. Please retry.' };
    }

    this.localQueue.set(socketId, entry);
    return { success: true, endedMatch };
  }

  public async dequeue(socketId: string): Promise<boolean> {
    const wasQueued = this.localQueue.delete(socketId);
    const client = getRedis();
    if (!client) return wasQueued;

    try {
      await client
        .multi()
        .zrem(QUEUE_KEY, socketId)
        .zrem(ALIVE_KEY, socketId)
        .del(entryKey(socketId))
        .exec();
    } catch (err: any) {
      console.error('[RedisMatchmaker] Dequeue failed:', err.message);
    }
    return wasQueued;
  }

  /** Keeps a queued socket from being swept while it sits in the waiting room. */
  public async touch(socketId: string): Promise<void> {
    if (!this.localQueue.has(socketId)) return;
    const client = getRedis();
    if (!client) return;
    try {
      await client
        .multi()
        .zadd(ALIVE_KEY, Date.now(), socketId)
        .pexpire(entryKey(socketId), ENTRY_TTL_MS)
        .exec();
    } catch {
      // A missed heartbeat only risks an earlier sweep; retried on next ping
    }
  }

  // --- Matching ---

  public async processMatches(): Promise<ActiveMatch[]> {
    const client = getRedis();
    if (!client) return [];

    let isLeader = false;
    try {
      const result = await client.set(LOCK_KEY, this.instanceId, 'PX', 2500, 'NX');
      isLeader = result === 'OK';
    } catch (err: any) {
      console.error('[RedisMatchmaker] Leader election failed:', err.message);
      return [];
    }
    if (!isLeader) return [];

    try {
      const staleCutoff = Date.now() - STALE_AFTER_MS;
      const stale = await client.zrangebyscore(ALIVE_KEY, '-inf', staleCutoff);
      if (stale.length > 0) {
        const cleanup = client.pipeline();
        for (const socketId of stale) {
          cleanup.zrem(QUEUE_KEY, socketId);
          cleanup.zrem(ALIVE_KEY, socketId);
          cleanup.del(entryKey(socketId));
        }
        await cleanup.exec();
      }

      const socketIds = await client.zrange(QUEUE_KEY, 0, MATCH_PASS_BATCH - 1);
      if (socketIds.length < 2) return [];

      const entriesRaw = await client.mget(socketIds.map(entryKey));
      const entries: RedisQueueEntry[] = [];
      for (let i = 0; i < entriesRaw.length; i++) {
        if (!entriesRaw[i]) {
          // Entry expired between reads; drop the orphaned queue member
          void client.zrem(QUEUE_KEY, socketIds[i]).catch(() => {});
          continue;
        }
        try {
          entries.push(JSON.parse(entriesRaw[i] as string) as RedisQueueEntry);
        } catch {
          void client.zrem(QUEUE_KEY, socketIds[i]).catch(() => {});
        }
      }
      if (entries.length < 2) return [];

      const blockedPairs = new Set(await client.smembers(BLOCKS_KEY));
      const isBlocked = (a: string, b: string) => blockedPairs.has(blockPairKey(a, b));

      const candidates = entries.sort((a, b) => a.joinedAt - b.joinedAt);

      const matched = new Set<string>();
      const newMatches: ActiveMatch[] = [];

      for (let i = 0; i < candidates.length; i++) {
        const candidateA = candidates[i];
        if (matched.has(candidateA.socketId)) continue;

        let bestB: RedisQueueEntry | null = null;
        let bestScore = -1;

        for (let j = i + 1; j < candidates.length; j++) {
          const candidateB = candidates[j];
          if (matched.has(candidateB.socketId)) continue;
          if (!areEntriesCompatible(candidateA, candidateB, isBlocked)) continue;

          const sharedInterests = (candidateA.interests || []).filter((x) =>
            (candidateB.interests || []).includes(x)
          );
          const sharedLanguages = (candidateA.languages || []).filter((x) =>
            (candidateB.languages || []).includes(x)
          );
          const score = sharedInterests.length * 3 + sharedLanguages.length * 2;
          if (score > bestScore) {
            bestScore = score;
            bestB = candidateB;
            if (score >= 3) break;
          }
        }

        if (!bestB) continue;

        // Atomic claim: removes both members or neither
        let claimed = 0;
        try {
          claimed = Number(
            await client.eval(
              CLAIM_PAIR_LUA,
              2,
              QUEUE_KEY,
              ALIVE_KEY,
              candidateA.socketId,
              bestB.socketId,
              String(candidateA.joinedAt),
              String(bestB.joinedAt)
            )
          );
        } catch (err: any) {
          console.error('[RedisMatchmaker] Atomic pair claim failed:', err.message);
          continue;
        }
        if (claimed !== 2) continue;

        matched.add(candidateA.socketId);
        matched.add(bestB.socketId);

        const match = this.createMatch(candidateA, bestB);
        const instances = { u1: candidateA.instanceId, u2: bestB.instanceId };

        const cleanup = client.pipeline();
        cleanup.del(entryKey(candidateA.socketId));
        cleanup.del(entryKey(bestB.socketId));
        cleanup.set(
          matchKey(match.matchId),
          JSON.stringify({ ...match, instances }),
          'EX',
          MATCH_TTL_SECONDS
        );
        await cleanup.exec().catch(() => {});

        this.localQueue.delete(candidateA.socketId);
        this.localQueue.delete(bestB.socketId);

        await this.dispatch(
          {
            targetSocketId: candidateA.socketId,
            message: matchFoundPayload(match, true, bestB),
            match: { match, instances },
          },
          candidateA.instanceId
        );
        await this.dispatch(
          {
            targetSocketId: bestB.socketId,
            message: matchFoundPayload(match, false, candidateA),
            match: { match, instances },
          },
          bestB.instanceId
        );

        newMatches.push(match);
      }

      return newMatches;
    } catch (err: any) {
      console.error('[RedisMatchmaker] Matching pass failed:', err.message);
      return [];
    }
  }

  private createMatch(a: RedisQueueEntry, b: RedisQueueEntry): ActiveMatch {
    const sharedInterests = (a.interests || []).filter((x) => (b.interests || []).includes(x));
    const sharedLanguages = (a.languages || []).filter((x) => (b.languages || []).includes(x));

    return {
      matchId: 'match_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      mode: a.mode || 'video',
      user1: { userId: a.userId, socketId: a.socketId },
      user2: { userId: b.userId, socketId: b.socketId },
      sharedInterests,
      sharedLanguages,
      createdAt: Date.now(),
    };
  }

  // --- Local views (each instance only owns matches involving its sockets) ---

  public getMatchBySocket(socketId: string): ActiveMatch | undefined {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return undefined;
    return this.localMatches.get(matchId)?.match;
  }

  public getPeerSocket(socketId: string): string | undefined {
    const match = this.getMatchBySocket(socketId);
    if (!match) return undefined;
    if (match.user1.socketId === socketId) return match.user2.socketId;
    if (match.user2.socketId === socketId) return match.user1.socketId;
    return undefined;
  }

  public getActiveMatches(): ActiveMatch[] {
    return Array.from(this.localMatches.values()).map((record) => record.match);
  }

  public getActiveMatchesCount(): number {
    return this.localMatches.size;
  }

  public getQueueLength(): number {
    return this.localQueue.size;
  }

  public async queueLength(): Promise<number> {
    const client = getRedis();
    if (!client) return this.localQueue.size;
    try {
      return await client.zcard(QUEUE_KEY);
    } catch {
      return this.localQueue.size;
    }
  }

  /** Relays a message to the peer of an active match, across instances. */
  public async sendToMatchPeer(
    match: ActiveMatch,
    fromSocketId: string,
    message: SignalingMessage
  ): Promise<void> {
    const peer = match.user1.socketId === fromSocketId ? match.user2 : match.user1;
    const record = this.localMatches.get(match.matchId);
    const peerInstance = record
      ? record.match.user1.socketId === peer.socketId
        ? record.instances.u1
        : record.instances.u2
      : this.instanceId;

    await this.dispatch(
      {
        targetSocketId: peer.socketId,
        message,
        clearMatchId: message.type === 'peer_disconnected' ? match.matchId : undefined,
      },
      peerInstance
    );
  }

  public async endMatchBySocket(socketId: string): Promise<ActiveMatch | undefined> {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return undefined;
    return this.endMatchById(matchId);
  }

  public async endMatchById(matchId: string): Promise<ActiveMatch | undefined> {
    const record = this.localMatches.get(matchId);
    this.clearLocalMatch(matchId);
    const client = getRedis();
    if (client) {
      await client.del(matchKey(matchId)).catch(() => {});
    }
    return record?.match;
  }

  public async handleDisconnect(
    socketId: string
  ): Promise<{ endedMatch?: ActiveMatch; wasQueued: boolean }> {
    const wasQueued = await this.dequeue(socketId);
    const endedMatch = await this.endMatchBySocket(socketId);
    return { endedMatch, wasQueued };
  }

  /** Records a block so every instance excludes the pair from matching. */
  public async recordBlock(userA: string, userB: string): Promise<void> {
    const client = getRedis();
    if (!client) return;
    await client.sadd(BLOCKS_KEY, blockPairKey(userA, userB)).catch(() => {});
  }

  public async removeBlock(userA: string, userB: string): Promise<void> {
    const client = getRedis();
    if (!client) return;
    await client.srem(BLOCKS_KEY, blockPairKey(userA, userB)).catch(() => {});
  }

  public async close(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    const subscriber = getRedisSubscriber();
    if (subscriber) {
      await subscriber.unsubscribe(channelName(this.instanceId)).catch(() => {});
    }
  }
}
