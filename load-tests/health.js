// Health profile: sustained polling of the public health endpoint (client polls it
// every 15s in production; this pushes 200 rps to prove headroom).
// Run:  k6 run load-tests/health.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, vuIp } from './common.js';

export const options = {
  scenarios: {
    health: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    'http_req_duration{name:health}': ['p(95)<150', 'p(99)<400'],
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
  },
};

export default function () {
  // Unique synthetic client per request so the distributed API limiter does not
  // throttle the probe itself (real clients poll ~4x/min).
  const res = http.get(`${BASE_URL}/api/system/health`, {
    headers: { 'X-Forwarded-For': vuIp(__ITER) },
    tags: { name: 'health' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'healthy': (r) => r.status === 200 && r.json('status') === 'healthy',
  });
}
