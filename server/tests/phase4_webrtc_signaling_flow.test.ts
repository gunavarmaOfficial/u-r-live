import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { setupSignaling } from '../webrtc';
import { matchmaker } from '../matchmaker';
import { db } from '../db';
import { createSessionToken } from '../auth';

describe('Phase 4: Full WebRTC Signaling & Peer-to-Peer Relay Integration', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let port: number;
  let wsUrl: string;

  const testUser1Id = 'u_sig_alice_' + Math.random().toString(36).substring(2, 7);
  const testUser2Id = 'u_sig_bob_' + Math.random().toString(36).substring(2, 7);
  let token1: string;
  let token2: string;

  beforeEach(async () => {
    db.saveUser({
      id: testUser1Id,
      displayName: 'Alice Signaling',
      gender: 'female',
      country: 'GLOBAL',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    db.saveUser({
      id: testUser2Id,
      displayName: 'Bob Signaling',
      gender: 'male',
      country: 'GLOBAL',
      isAdultVerified: true,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    token1 = createSessionToken(testUser1Id);
    token2 = createSessionToken(testUser2Id);

    const app = express();
    server = http.createServer(app);
    wss = new WebSocketServer({ server });
    setupSignaling(wss);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        wsUrl = `ws://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => resolve());
      });
    });
  });

  function connectClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  it('orchestrates complete offer, answer, ice_candidate, and chat exchange between matched peers', async () => {
    const ws1 = await connectClient();
    const ws2 = await connectClient();

    const messages1: any[] = [];
    const messages2: any[] = [];

    ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
    ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

    // Peer 1 joins queue
    ws1.send(
      JSON.stringify({
        type: 'join_queue',
        payload: {
          userId: testUser1Id,
          sessionToken: token1,
          gender: 'female',
          country: 'GLOBAL',
          preferences: { mode: 'video' },
        },
      })
    );

    // Peer 2 joins queue
    ws2.send(
      JSON.stringify({
        type: 'join_queue',
        payload: {
          userId: testUser2Id,
          sessionToken: token2,
          gender: 'male',
          country: 'GLOBAL',
          preferences: { mode: 'video' },
        },
      })
    );

    // Wait for match_found event on both peers
    await new Promise((r) => setTimeout(r, 100));

    const match1 = messages1.find((m) => m.type === 'match_found');
    const match2 = messages2.find((m) => m.type === 'match_found');

    expect(match1).toBeDefined();
    expect(match2).toBeDefined();
    expect(match1.matchId).toBe(match2.matchId);
    expect(match1.payload.isInitiator).toBe(true);
    expect(match2.payload.isInitiator).toBe(false);

    const matchId = match1.matchId;

    // Caller sends offer with valid matchId
    const dummyOffer = { type: 'offer', sdp: 'v=0 dummy sdp offer' };
    ws1.send(
      JSON.stringify({
        type: 'offer',
        matchId,
        payload: dummyOffer,
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    const receivedOffer = messages2.find((m) => m.type === 'offer');
    expect(receivedOffer).toBeDefined();
    expect(receivedOffer.matchId).toBe(matchId);
    expect(receivedOffer.payload.sdp).toBe(dummyOffer.sdp);

    // Answerer sends answer with valid matchId
    const dummyAnswer = { type: 'answer', sdp: 'v=0 dummy sdp answer' };
    ws2.send(
      JSON.stringify({
        type: 'answer',
        matchId,
        payload: dummyAnswer,
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    const receivedAnswer = messages1.find((m) => m.type === 'answer');
    expect(receivedAnswer).toBeDefined();
    expect(receivedAnswer.matchId).toBe(matchId);
    expect(receivedAnswer.payload.sdp).toBe(dummyAnswer.sdp);

    // ICE Candidate exchange
    const dummyCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0' };
    ws1.send(
      JSON.stringify({
        type: 'ice_candidate',
        matchId,
        payload: dummyCandidate,
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    const receivedCandidate = messages2.find((m) => m.type === 'ice_candidate');
    expect(receivedCandidate).toBeDefined();
    expect(receivedCandidate.payload.candidate).toContain('typ host');

    // Chat Message exchange
    ws2.send(
      JSON.stringify({
        type: 'chat_message',
        matchId,
        payload: { text: 'Hello from peer 2!' },
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    const receivedChat = messages1.find((m) => m.type === 'chat_message');
    expect(receivedChat).toBeDefined();
    expect(receivedChat.payload.text).toBe('Hello from peer 2!');

    ws1.close();
    ws2.close();
  });

  it('rejects relaying offers with mismatched matchId to prevent unauthorized SDP tampering', async () => {
    const ws1 = await connectClient();
    const ws2 = await connectClient();

    const messages2: any[] = [];
    ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

    ws1.send(
      JSON.stringify({
        type: 'join_queue',
        payload: {
          userId: testUser1Id,
          sessionToken: token1,
          gender: 'female',
          country: 'GLOBAL',
          preferences: { mode: 'video' },
        },
      })
    );

    ws2.send(
      JSON.stringify({
        type: 'join_queue',
        payload: {
          userId: testUser2Id,
          sessionToken: token2,
          gender: 'male',
          country: 'GLOBAL',
          preferences: { mode: 'video' },
        },
      })
    );

    await new Promise((r) => setTimeout(r, 100));

    // Offer sent with wrong/null matchId
    ws1.send(
      JSON.stringify({
        type: 'offer',
        matchId: 'wrong_match_id',
        payload: { type: 'offer', sdp: 'fake sdp' },
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    const receivedOffer = messages2.find((m) => m.type === 'offer');
    expect(receivedOffer).toBeUndefined();

    ws1.close();
    ws2.close();
  });
});
