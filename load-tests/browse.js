// Browse profile: public, prerendered HTML pages through the CDN path.
// Run:  k6 run load-tests/browse.js
// With: BASE_URL=https://staging.example.com k6 run load-tests/browse.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, vuIp } from './common.js';

const PAGES = ['/', '/safety', '/terms', '/privacy', '/cookies', '/community-rules'];

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{expected_response:true}': ['p(95)<800', 'p(99)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const path = PAGES[Math.floor(Math.random() * PAGES.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { 'X-Forwarded-For': vuIp(), Accept: 'text/html' },
    tags: { name: path },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has title': (r) => typeof r.body === 'string' && r.body.includes('<title>'),
    'has canonical': (r) => typeof r.body === 'string' && r.body.includes('rel="canonical"'),
  });

  sleep(1 + Math.random() * 2);
}
