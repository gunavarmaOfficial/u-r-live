// Matchmaking profile: 2,000 concurrent WebSocket clients that log in, join the
// queue, exchange fake SDP/ICE, chat, then skip and disconnect.
// Run:  k6 run load-tests/matchmaking.js
// With: BASE_URL=https://staging.example.com k6 run load-tests/matchmaking.js
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, WS_URL, jsonHeaders, vuIp } from './common.js';

const matchWait = new Trend('match_wait_ms', true);
const matchErrors = new Rate('match_errors');
const matchTimeouts = new Counter('match_timeouts');
const loginFailures = new Counter('login_failures');

export const options = {
  scenarios: {
    matchmaking: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 1000 },
        { duration: '2m', target: 2000 },
        { duration: '5m', target: 2000 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Join -> match_found latency budget for the signaling path.
    match_wait_ms: ['p(95)<400'],
    match_errors: ['rate<0.01'],
    ws_connecting: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const ip = vuIp();
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ displayName: `Load ${__VU}-${__ITER}`, gender: 'unspecified', country: 'IN' }),
    { headers: jsonHeaders(ip), tags: { name: 'login' } }
  );

  if (!check(login, { 'login ok': (r) => r.status === 200 })) {
    loginFailures.add(1);
    matchErrors.add(true);
    sleep(2);
    return;
  }

  const token = login.json('sessionToken');
  let joinedAt = 0;
  let matched = false;

  const res = ws.connect(
    WS_URL,
    { headers: { 'X-Forwarded-For': ip }, tags: { name: 'ws' } },
    (socket) => {
      socket.on('open', () => {
        socket.send(
          JSON.stringify({
            type: 'join_queue',
            payload: { sessionToken: token, gender: 'unspecified', country: 'IN' },
          })
        );
        joinedAt = Date.now();
        socket.setInterval(() => socket.send(JSON.stringify({ type: 'ping' })), 20000);
      });

      socket.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'match_found': {
            matched = true;
            if (joinedAt) matchWait.add(Date.now() - joinedAt);
            const matchId = msg.matchId;

            socket.send(
              JSON.stringify({
                type: 'offer',
                matchId,
                payload: { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' },
              })
            );
            socket.setTimeout(() => {
              socket.send(
                JSON.stringify({ type: 'chat_message', matchId, payload: { text: 'hello from k6' } })
              );
            }, 800);
            socket.setTimeout(() => {
              socket.send(JSON.stringify({ type: 'skip_match', payload: { findNext: false } }));
            }, 2500);
            socket.setTimeout(() => socket.close(), 4000);
            break;
          }
          case 'offer':
            socket.send(
              JSON.stringify({
                type: 'answer',
                matchId: msg.matchId,
                payload: { type: 'answer', sdp: 'v=0\r\n' },
              })
            );
            break;
          case 'answer':
            socket.send(
              JSON.stringify({
                type: 'ice_candidate',
                matchId: msg.matchId,
                payload: {
                  candidate: 'candidate:1 1 udp 1 127.0.0.1 5000 typ host',
                  sdpMid: '0',
                  sdpMLineIndex: 0,
                },
              })
            );
            break;
          case 'error':
            matchErrors.add(true);
            socket.close();
            break;
          default:
            break;
        }
      });

      socket.on('error', () => matchErrors.add(true));

      // Safety valve so a queue that never matches cannot pin a VU forever.
      socket.setTimeout(() => {
        if (!matched) matchTimeouts.add(1);
        socket.close();
      }, 45000);
    }
  );

  check(res, { 'ws 101': (r) => r && r.status === 101 });
}
