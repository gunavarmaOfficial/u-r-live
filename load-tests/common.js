// Shared helpers for k6 load profiles.
// Targets a staging Cloud Run service; never point the WS profile at production
// without coordinating with on-call (it creates real guest sessions).

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
export const WS_URL = (__ENV.WS_URL || BASE_URL.replace(/^http/, 'ws') + '/ws').replace(/\/$/, '');

// The server keys rate limits on the first X-Forwarded-For hop, so each virtual
// user gets its own synthetic client IP. Real users behind the load balancer are
// unaffected; this only works against a staging endpoint you control.
export function vuIp(offset = 0) {
  const n = (__VU * 977 + __ITER * 31 + offset) >>> 0;
  return `10.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function jsonHeaders(ip) {
  return {
    'Content-Type': 'application/json',
    'X-Forwarded-For': ip,
  };
}

export function authHeaders(ip, token) {
  return {
    'Content-Type': 'application/json',
    'X-Forwarded-For': ip,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
