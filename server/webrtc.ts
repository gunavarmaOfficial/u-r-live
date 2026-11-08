/**
 * WebSocket signaling server for WebRTC matchmaking & peer connection.
 * Matchmaking state lives in the matchmaking engine (Redis-backed when
 * REDIS_URL is configured) so multiple instances share one queue. Signaling is
 * relayed to the instance that owns the peer socket via the engine.
 */
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { db } from './db';
import { ActiveMatch, SignalingMessage } from './types';
import { verifySessionToken } from './auth';
import { rateLimiter } from './rateLimit';
import { getMatchmaking, MatchmakingEngine } from './matchmaking';

interface ClientSocket extends WebSocket {
  id: string;
  userId?: string;
  clientIp?: string;
  isAlive: boolean;
}

const MATCH_CONNECT_TIMEOUT_MS = 45 * 1000;
const MAX_SIGNALING_MESSAGE_BYTES = 64 * 1024;
const MAX_MESSAGES_PER_10S = 200;
const MAX_CHAT_MESSAGES_PER_MINUTE = 20;

const languageListSchema = z.array(z.string().trim().min(1).max(24)).max(10);

const preferencesSchema = z.object({
  preferredGender: z.enum(['any', 'male', 'female']).optional(),
  preferredCountry: z.string().max(40).optional(),
  preferredCountries: z.array(z.string().max(40)).max(12).optional(),
  isMultipleCountries: z.boolean().optional(),
  languages: languageListSchema.optional(),
  preferredLanguages: languageListSchema.optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const matchIdSchema = z.string().min(1).max(64);

const sdpSchema = z.object({
  type: z.string().max(16).optional(),
  sdp: z.string().max(32768).optional(),
});

const iceCandidateSchema = z.object({
  candidate: z.string().max(4096).optional(),
  sdpMid: z.string().max(64).nullish(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullish(),
  usernameFragment: z.string().max(256).nullish(),
});

const signalingMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({
    type: z.literal('join_queue'),
    payload: z.object({
      sessionToken: z.string().min(10).max(2048),
      gender: z.enum(['unspecified', 'male', 'female', 'non-binary']).optional(),
      country: z.string().max(40).optional(),
      preferences: preferencesSchema.optional(),
    }),
  }),
  z.object({ type: z.literal('leave_queue') }),
  z.object({ type: z.literal('offer'), matchId: matchIdSchema, payload: sdpSchema }),
  z.object({ type: z.literal('answer'), matchId: matchIdSchema, payload: sdpSchema }),
  z.object({ type: z.literal('ice_candidate'), matchId: matchIdSchema, payload: iceCandidateSchema }),
  z.object({
    type: z.literal('chat_message'),
    matchId: matchIdSchema,
    payload: z.object({
      text: z.string().trim().min(1).max(500),
      senderId: z.string().max(64).optional(),
    }),
  }),
  z.object({
    type: z.literal('typing'),
    matchId: matchIdSchema,
    payload: z.object({ isTyping: z.boolean() }),
  }),
  z.object({
    type: z.literal('media_state'),
    matchId: matchIdSchema,
    payload: z.object({ connected: z.boolean() }),
  }),
  z.object({
    type: z.literal('skip_match'),
    payload: z
      .object({
        findNext: z.boolean().optional(),
        preferences: preferencesSchema.optional(),
      })
      .optional(),
  }),
]);

export function setupSignaling(wss: WebSocketServer) {
  const clients = new Map<string, ClientSocket>();
  // Matches that have confirmed an active WebRTC media connection
  const connectedMatches = new Set<string>();

  function sendToSocket(socketId: string, message: SignalingMessage) {
    const client = clients.get(socketId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  const engine: MatchmakingEngine = getMatchmaking().init({
    deliver: sendToSocket,
    isLocal: (socketId) => clients.has(socketId),
  });

  /** Tells the opposite side that this user is gone. Must run before ending the match. */
  async function notifyMatchPeer(match: ActiveMatch, fromSocketId: string, reason: string) {
    connectedMatches.delete(match.matchId);
    await engine.sendToMatchPeer(match, fromSocketId, {
      type: 'peer_disconnected',
      matchId: match.matchId,
      payload: { reason },
    });
  }

  function broadcastMatch(match: ActiveMatch) {
    const u1Profile = db.getUser(match.user1.userId);
    const u2Profile = db.getUser(match.user2.userId);

    sendToSocket(match.user1.socketId, {
      type: 'match_found',
      matchId: match.matchId,
      payload: {
        isInitiator: true,
        peerUserId: match.user2.userId,
        peerName: u2Profile?.displayName || 'Anonymous User',
        peerCountry: u2Profile?.country || 'GLOBAL',
        sharedInterests: match.sharedInterests || [],
        sharedLanguages: match.sharedLanguages || [],
        mode: match.mode || 'video',
      },
    });

    sendToSocket(match.user2.socketId, {
      type: 'match_found',
      matchId: match.matchId,
      payload: {
        isInitiator: false,
        peerUserId: match.user1.userId,
        peerName: u1Profile?.displayName || 'Anonymous User',
        peerCountry: u1Profile?.country || 'GLOBAL',
        sharedInterests: match.sharedInterests || [],
        sharedLanguages: match.sharedLanguages || [],
        mode: match.mode || 'video',
      },
    });
  }

  async function runMatchingPass() {
    const newMatches = await engine.processMatches();
    // The distributed engine delivers match_found itself across instances
    if (!engine.selfDelivering) {
      for (const match of newMatches) broadcastMatch(match);
    }
    return newMatches;
  }

  // Periodic matchmaking sweep: picks up compatible users even if a join event
  // was dropped or preferences changed while waiting. Only the elected leader
  // actually matches when Redis is configured.
  const matchInterval = setInterval(() => {
    void runMatchingPass().catch((err) => {
      console.error('Periodic matchmaking error:', err);
    });
  }, 2500);

  // Connection watchdog: if a match never establishes media, release both users
  const watchdogInterval = setInterval(() => {
    void (async () => {
      const now = Date.now();
      for (const match of engine.getActiveMatches()) {
        if (now - match.createdAt < MATCH_CONNECT_TIMEOUT_MS) continue;
        if (connectedMatches.has(match.matchId)) continue;

        const timeoutMessage: SignalingMessage = {
          type: 'peer_disconnected',
          matchId: match.matchId,
          payload: { reason: 'connection_timeout' },
        };

        // Notify both sides (possibly on other instances) before dropping state
        await engine
          .sendToMatchPeer(match, match.user1.socketId, timeoutMessage)
          .catch(() => {});
        await engine
          .sendToMatchPeer(match, match.user2.socketId, timeoutMessage)
          .catch(() => {});

        const ended = await engine.endMatchById(match.matchId);
        if (!ended) continue;
        connectedMatches.delete(ended.matchId);
      }
    })().catch((err) => {
      console.error('Match watchdog error:', err);
    });
  }, 10000);

  // Heartbeat ping interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as ClientSocket;
      if (!client.isAlive) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
    clearInterval(matchInterval);
    clearInterval(watchdogInterval);
    void engine.close().catch(() => {});
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    const client = ws as ClientSocket;
    client.id = 'sock_' + Math.random().toString(36).substring(2, 10);
    client.isAlive = true;

    const forwarded = req?.headers?.['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';
    client.clientIp = clientIp;

    // Track connection per IP and mitigate reconnect loops
    const connCheck = rateLimiter.trackWsConnection(clientIp, 5, 20);
    if (!connCheck.allowed) {
      client.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'RATE_LIMIT_EXCEEDED', message: connCheck.reason || 'Too Many Requests' },
        })
      );
      client.close(4429, 'Rate limit exceeded');
      return;
    }

    clients.set(client.id, client);

    client.on('pong', () => {
      client.isAlive = true;
    });

    client.on('message', async (data) => {
      try {
        const rawString = typeof data === 'string' ? data : data.toString();

        if (rawString.length > MAX_SIGNALING_MESSAGE_BYTES) {
          client.send(
            JSON.stringify({
              type: 'error',
              payload: { code: 'PAYLOAD_TOO_LARGE', message: 'Signaling message exceeds size limit' },
            })
          );
          return;
        }

        const messageRate = rateLimiter.checkLimit(
          `ws_msg_${client.id}`,
          MAX_MESSAGES_PER_10S,
          10 * 1000
        );
        if (!messageRate.allowed) {
          client.send(
            JSON.stringify({
              type: 'error',
              payload: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many signaling messages. Please slow down.',
              },
            })
          );
          return;
        }

        let json: unknown;
        try {
          json = JSON.parse(rawString);
        } catch {
          client.send(
            JSON.stringify({
              type: 'error',
              payload: { code: 'INVALID_JSON', message: 'Malformed signaling message' },
            })
          );
          return;
        }

        const parsed = signalingMessageSchema.safeParse(json);
        if (!parsed.success) {
          client.send(
            JSON.stringify({
              type: 'error',
              payload: { code: 'INVALID_MESSAGE', message: 'Unsupported or invalid signaling message' },
            })
          );
          return;
        }

        const msg = parsed.data as unknown as SignalingMessage;

        switch (msg.type) {
          case 'ping':
            client.send(JSON.stringify({ type: 'pong' }));
            void engine.touch(client.id);
            break;

          case 'join_queue': {
            const { sessionToken, gender, country, preferences } = msg.payload || {};

            // Session token is strictly mandatory to prevent identity spoofing
            if (!sessionToken) {
              client.send(
                JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication failed: Missing session token',
                  },
                })
              );
              return;
            }

            const verified = verifySessionToken(sessionToken);
            if (!verified) {
              client.send(
                JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'INVALID_TOKEN',
                    message: 'Authentication failed: Invalid or expired session token',
                  },
                })
              );
              return;
            }

            // Bind client strictly to verified token identity
            const verifiedUserId = verified.userId;
            client.userId = verifiedUserId;

            // Enforce suspension/banned status check (cache-through for cross-instance users)
            const userProfile = await db.ensureUser(verifiedUserId);
            if (userProfile && (userProfile.status === 'banned' || userProfile.status === 'suspended')) {
              client.send(
                JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'ACCOUNT_BANNED',
                    message: 'Your account has been suspended or banned for safety violations.',
                  },
                })
              );
              client.close(4403, 'Account suspended');
              return;
            }

            // Enforce join queue rate limit (Max 15 per minute per user)
            const joinCheck = rateLimiter.checkLimit(`ws_join_${verifiedUserId}`, 15, 60 * 1000);
            if (!joinCheck.allowed) {
              client.send(
                JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: `Queue join rate limit exceeded. Please wait ${joinCheck.retryAfterSeconds}s before searching again.`,
                  },
                })
              );
              return;
            }

            // Tell a previous peer before re-entering the queue
            const priorMatch = engine.getMatchBySocket(client.id);
            if (priorMatch) await notifyMatchPeer(priorMatch, client.id, 'peer_restarted');

            const res = await engine.enqueue(
              client.id,
              verifiedUserId,
              gender || userProfile?.gender || 'unspecified',
              country || userProfile?.country || 'GLOBAL',
              preferences || {},
              userProfile?.displayName
            );

            if (!res.success) {
              client.send(
                JSON.stringify({
                  type: 'error',
                  payload: { message: res.error || 'Failed to join queue' },
                })
              );
              return;
            }

            client.send(
              JSON.stringify({
                type: 'queue_status',
                payload: { status: 'waiting', queueLength: await engine.queueLength() },
              })
            );

            // Attempt matchmaking pass
            await runMatchingPass();
            break;
          }

          case 'leave_queue': {
            const match = engine.getMatchBySocket(client.id);
            if (match) await notifyMatchPeer(match, client.id, 'peer_left');

            await engine.endMatchBySocket(client.id);
            await engine.dequeue(client.id);

            client.send(
              JSON.stringify({
                type: 'queue_status',
                payload: { status: 'idle' },
              })
            );
            break;
          }

          case 'offer':
          case 'answer': {
            // Relayed ONLY to the verified match peer
            const currentMatch = engine.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine.sendToMatchPeer(currentMatch, client.id, {
                type: msg.type,
                matchId: msg.matchId,
                payload: msg.payload,
              });
            }
            break;
          }

          case 'ice_candidate': {
            // Relayed ONLY to the verified match peer
            const currentMatch = engine.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine.sendToMatchPeer(currentMatch, client.id, {
                type: 'ice_candidate',
                matchId: msg.matchId,
                payload: msg.payload,
              });
            }
            break;
          }

          case 'chat_message': {
            if (client.userId) {
              const chatRate = rateLimiter.checkLimit(
                `ws_chat_${client.userId}`,
                MAX_CHAT_MESSAGES_PER_MINUTE,
                60 * 1000
              );
              if (!chatRate.allowed) {
                client.send(
                  JSON.stringify({
                    type: 'error',
                    payload: {
                      code: 'RATE_LIMIT_EXCEEDED',
                      message: `You are sending messages too quickly. Wait ${chatRate.retryAfterSeconds}s.`,
                    },
                  })
                );
                break;
              }
            }

            const currentMatch = engine.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine.sendToMatchPeer(currentMatch, client.id, {
                type: 'chat_message',
                matchId: msg.matchId,
                payload: {
                  senderId: client.userId,
                  text: msg.payload?.text ?? '',
                  timestamp: Date.now(),
                },
              });
            }
            break;
          }

          case 'typing': {
            const currentMatch = engine.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine.sendToMatchPeer(currentMatch, client.id, {
                type: 'typing',
                matchId: msg.matchId,
                payload: { isTyping: Boolean(msg.payload?.isTyping) },
              });
            }
            break;
          }

          case 'media_state': {
            const currentMatch = engine.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId && msg.payload?.connected) {
              connectedMatches.add(currentMatch.matchId);
            }
            break;
          }

          case 'skip_match': {
            // Apply skip cooldown and abuse protection
            if (client.userId) {
              const cd = rateLimiter.checkCooldown(`ws_skip_cd_${client.userId}`, 1500);
              if (!cd.allowed) {
                client.send(
                  JSON.stringify({
                    type: 'error',
                    payload: {
                      code: 'COOLDOWN_ACTIVE',
                      message: 'You are skipping too quickly. Please wait a moment before skipping again.',
                    },
                  })
                );
                return;
              }

              const freq = rateLimiter.checkLimit(`ws_skip_freq_${client.userId}`, 15, 120 * 1000);
              if (!freq.allowed) {
                client.send(
                  JSON.stringify({
                    type: 'error',
                    payload: {
                      code: 'RATE_LIMIT_EXCEEDED',
                      message: `Skip rate limit exceeded. Please wait ${freq.retryAfterSeconds}s before finding another match.`,
                    },
                  })
                );
                return;
              }
            }

            // User clicked Next: end active match, notify peer, re-enqueue caller if requested
            const match = engine.getMatchBySocket(client.id);
            if (match) await notifyMatchPeer(match, client.id, 'skipped_by_peer');

            await engine.endMatchBySocket(client.id);
            await engine.dequeue(client.id);

            client.send(
              JSON.stringify({
                type: 'match_ended',
                payload: { reason: 'skipped' },
              })
            );

            // If auto-find next is requested
            if (msg.payload?.findNext && client.userId) {
              const u = await db.ensureUser(client.userId);
              await engine.enqueue(
                client.id,
                client.userId,
                u?.gender || 'unspecified',
                u?.country || 'GLOBAL',
                msg.payload?.preferences || {},
                u?.displayName
              );

              client.send(
                JSON.stringify({
                  type: 'queue_status',
                  payload: { status: 'waiting', queueLength: await engine.queueLength() },
                })
              );

              await runMatchingPass();
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    client.on('close', async () => {
      if (client.clientIp) {
        rateLimiter.releaseWsConnection(client.clientIp);
      }

      try {
        const match = engine.getMatchBySocket(client.id);
        if (match) await notifyMatchPeer(match, client.id, 'peer_closed_browser');

        const { endedMatch } = await engine.handleDisconnect(client.id);
        connectedMatches.delete(endedMatch?.matchId || '');
      } catch (err: any) {
        console.error('Error cleaning up closed socket:', err.message);
      } finally {
        clients.delete(client.id);
      }
    });

    client.on('error', (err) => {
      console.warn(`WebSocket client ${client.id} error:`, err);
    });
  });
}
