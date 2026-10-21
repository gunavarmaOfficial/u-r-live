/**
 * WebSocket signaling server for WebRTC matchmaking & peer connection
 */
import { WebSocket, WebSocketServer } from 'ws';
import { matchmaker } from './matchmaker';
import { db } from './db';
import { SignalingMessage } from './types';
import { verifySessionToken } from './auth';

interface ClientSocket extends WebSocket {
  id: string;
  userId?: string;
  isAlive: boolean;
}

export function setupSignaling(wss: WebSocketServer) {
  const clients = new Map<string, ClientSocket>();

  function sendToSocket(socketId: string, message: SignalingMessage) {
    const client = clients.get(socketId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

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
  });

  wss.on('connection', (ws: WebSocket) => {
    const client = ws as ClientSocket;
    client.id = 'sock_' + Math.random().toString(36).substring(2, 10);
    client.isAlive = true;
    clients.set(client.id, client);

    client.on('pong', () => {
      client.isAlive = true;
    });

    client.on('message', (data) => {
      try {
        const rawString = data.toString();
        const msg: SignalingMessage = JSON.parse(rawString);

        switch (msg.type) {
          case 'ping':
            client.send(JSON.stringify({ type: 'pong' }));
            break;

          case 'join_queue': {
            const { userId, sessionToken, gender, country, preferences } = msg.payload || {};
            if (!userId) {
              client.send(
                JSON.stringify({
                  type: 'error',
                  payload: { message: 'userId is required to join matchmaking queue' },
                })
              );
              return;
            }

            if (sessionToken) {
              const verified = verifySessionToken(sessionToken);
              if (!verified || verified.userId !== userId) {
                client.send(
                  JSON.stringify({
                    type: 'error',
                    payload: { message: 'Authentication failed: Invalid session token' },
                  })
                );
                return;
              }
            }

            client.userId = userId;
            const res = matchmaker.enqueue(
              client.id,
              userId,
              gender || 'unspecified',
              country || 'GLOBAL',
              preferences || {}
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
                payload: { status: 'waiting', queueLength: matchmaker.getQueueLength() },
              })
            );

            // Attempt matchmaking pass
            const newMatches = matchmaker.processMatches();
            for (const match of newMatches) {
              const u1Profile = db.getUser(match.user1.userId);
              const u2Profile = db.getUser(match.user2.userId);

              // user1 will be WebRTC caller (initiator = true)
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

              // user2 will be WebRTC answerer (initiator = false)
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
            break;
          }

          case 'leave_queue': {
            matchmaker.dequeue(client.id);
            client.send(
              JSON.stringify({
                type: 'queue_status',
                payload: { status: 'idle' },
              })
            );
            break;
          }

          case 'offer': {
            // Relayed ONLY to verified match peer
            const peerSocketId = matchmaker.getPeerSocket(client.id);
            const currentMatch = matchmaker.getMatchBySocket(client.id);
            if (peerSocketId && currentMatch && currentMatch.matchId === msg.matchId) {
              sendToSocket(peerSocketId, {
                type: 'offer',
                matchId: msg.matchId,
                payload: msg.payload, // SDP offer
              });
            }
            break;
          }

          case 'answer': {
            // Relayed ONLY to verified match peer
            const peerSocketId = matchmaker.getPeerSocket(client.id);
            const currentMatch = matchmaker.getMatchBySocket(client.id);
            if (peerSocketId && currentMatch && currentMatch.matchId === msg.matchId) {
              sendToSocket(peerSocketId, {
                type: 'answer',
                matchId: msg.matchId,
                payload: msg.payload, // SDP answer
              });
            }
            break;
          }

          case 'ice_candidate': {
            // Relayed ONLY to verified match peer
            const peerSocketId = matchmaker.getPeerSocket(client.id);
            const currentMatch = matchmaker.getMatchBySocket(client.id);
            if (peerSocketId && currentMatch && currentMatch.matchId === msg.matchId) {
              sendToSocket(peerSocketId, {
                type: 'ice_candidate',
                matchId: msg.matchId,
                payload: msg.payload, // RTCIceCandidate
              });
            }
            break;
          }

          case 'chat_message': {
            const peerSocketId = matchmaker.getPeerSocket(client.id);
            const currentMatch = matchmaker.getMatchBySocket(client.id);
            if (peerSocketId && currentMatch && currentMatch.matchId === msg.matchId) {
              sendToSocket(peerSocketId, {
                type: 'chat_message',
                matchId: msg.matchId,
                payload: {
                  senderId: client.userId,
                  text: String(msg.payload?.text || '').slice(0, 500),
                  timestamp: Date.now(),
                },
              });
            }
            break;
          }

          case 'skip_match': {
            // User clicked Next: end active match, notify peer, re-enqueue caller if requested
            const peerSocketId = matchmaker.getPeerSocket(client.id);
            const endedMatch = matchmaker.endMatchBySocket(client.id);

            if (peerSocketId && endedMatch) {
              sendToSocket(peerSocketId, {
                type: 'peer_disconnected',
                matchId: endedMatch.matchId,
                payload: { reason: 'skipped_by_peer' },
              });
            }

            client.send(
              JSON.stringify({
                type: 'match_ended',
                payload: { reason: 'skipped' },
              })
            );

            // If auto-find next is requested
            if (msg.payload?.findNext && client.userId) {
              const u = db.getUser(client.userId);
              matchmaker.enqueue(
                client.id,
                client.userId,
                u?.gender || 'unspecified',
                u?.country || 'GLOBAL',
                msg.payload?.preferences || {}
              );

              client.send(
                JSON.stringify({
                  type: 'queue_status',
                  payload: { status: 'waiting', queueLength: matchmaker.getQueueLength() },
                })
              );

              const newMatches = matchmaker.processMatches();
              for (const match of newMatches) {
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

    client.on('close', () => {
      const peerSocketId = matchmaker.getPeerSocket(client.id);
      const { endedMatch } = matchmaker.handleDisconnect(client.id);
      clients.delete(client.id);

      if (peerSocketId && endedMatch) {
        sendToSocket(peerSocketId, {
          type: 'peer_disconnected',
          matchId: endedMatch.matchId,
          payload: { reason: 'peer_closed_browser' },
        });
      }
    });

    client.on('error', (err) => {
      console.warn(`WebSocket client ${client.id} error:`, err);
    });
  });
}
