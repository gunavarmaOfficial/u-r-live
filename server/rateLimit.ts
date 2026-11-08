/**
 * U-R-LIVE Abuse Prevention & Rate Limiting Engine
 * Provides configurable rate limiting for HTTP endpoints and WebSocket events:
 * - Guest session generation abuse
 * - Login & Admin brute-force protection
 * - Matchmaking queue floods & rapid skip abuse
 * - Connection flood / reconnect loop mitigation
 * - Report spam throttling
 */
import { Request, Response, NextFunction } from 'express';
import { getRedis } from './redis';

export interface RateLimitRecord {
  count: number;
  windowStart: number;
  lastActionAt?: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private activeSocketsPerIp = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public cleanup(maxAgeMs = 15 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now - record.windowStart > maxAgeMs) {
        this.store.delete(key);
      }
    }
  }

  public reset(): void {
    this.store.clear();
    this.activeSocketsPerIp.clear();
  }

  /**
   * Generic sliding window rate limiter
   */
  public checkLimit(
    key: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now - record.windowStart > windowMs) {
      record = { count: 1, windowStart: now };
      this.store.set(key, record);
      return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.windowStart + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    record.count++;
    return {
      allowed: true,
      remaining: maxRequests - record.count,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Minimum interval cooldown check (e.g. minimum 1.5s between skips)
   */
  public checkCooldown(
    key: string,
    minIntervalMs: number
  ): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || !record.lastActionAt) {
      this.store.set(key, { count: 1, windowStart: now, lastActionAt: now });
      return { allowed: true, retryAfterMs: 0 };
    }

    const elapsed = now - record.lastActionAt;
    if (elapsed < minIntervalMs) {
      return { allowed: false, retryAfterMs: minIntervalMs - elapsed };
    }

    record.lastActionAt = now;
    return { allowed: true, retryAfterMs: 0 };
  }

  /**
   * WebSocket Connection Limiter per IP
   */
  public trackWsConnection(
    ip: string,
    maxConcurrent = 5,
    maxPerMinute = 20
  ): { allowed: boolean; reason?: string } {
    const now = Date.now();

    // 1. Check frequency (reconnect loop / connection flood protection)
    const freqKey = `ws_freq_${ip}`;
    const freq = this.checkLimit(freqKey, maxPerMinute, 60 * 1000);
    if (!freq.allowed) {
      return {
        allowed: false,
        reason: `Connection frequency limit exceeded. Please wait ${freq.retryAfterSeconds}s before reconnecting.`,
      };
    }

    // 2. Check active concurrent sockets
    const currentActive = this.activeSocketsPerIp.get(ip) || 0;
    if (currentActive >= maxConcurrent) {
      return {
        allowed: false,
        reason: `Too many concurrent connections from your network (maximum ${maxConcurrent}).`,
      };
    }

    this.activeSocketsPerIp.set(ip, currentActive + 1);
    return { allowed: true };
  }

  public releaseWsConnection(ip: string): void {
    const current = this.activeSocketsPerIp.get(ip) || 1;
    if (current <= 1) {
      this.activeSocketsPerIp.delete(ip);
    } else {
      this.activeSocketsPerIp.set(ip, current - 1);
    }
  }

  public getActiveWsCount(ip: string): number {
    return this.activeSocketsPerIp.get(ip) || 0;
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Extracts a normalized client IP address from an Express request
 */
export function getClientIp(req: Request): string {
  // Cloudflare CF-Connecting-IP takes highest precedence
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Express Middleware factory for HTTP endpoint rate limiting
 */
export function createRateLimitMiddleware(options: {
  max: number;
  windowMs: number;
  message?: string;
  prefix?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const {
    max,
    windowMs,
    message = 'Too many requests. Please slow down and try again.',
    prefix = 'rl',
    keyGenerator = (req) => `${prefix}_${getClientIp(req)}`,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const result = rateLimiter.checkLimit(key, max, windowMs);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds);
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

// Configured standard limits for U-R-LIVE
export const guestSessionRateLimit = createRateLimitMiddleware({
  max: 15, // Max 15 guest session creations
  windowMs: 5 * 60 * 1000, // per 5 minutes per IP
  prefix: 'guest_session',
  message: 'Too many guest sessions initiated from your network. Please wait a few minutes.',
});

export const reportRateLimit = createRateLimitMiddleware({
  max: 5, // Max 5 reports
  windowMs: 10 * 60 * 1000, // per 10 minutes per IP/user
  prefix: 'report_sub',
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const authHeader = req.headers.authorization || '';
    return `report_${ip}_${authHeader.slice(-16)}`;
  },
  message: 'You have submitted several reports recently. Please wait before reporting again.',
});

export const adminLoginRateLimit = createRateLimitMiddleware({
  max: 5, // Max 5 admin login attempts
  windowMs: 15 * 60 * 1000, // per 15 minutes
  prefix: 'admin_login',
  message: 'Too many admin authentication attempts. Please wait 15 minutes before trying again.',
});

export const standardApiRateLimit = createRateLimitMiddleware({
  max: 120, // Max 120 requests
  windowMs: 60 * 1000, // per 1 minute
  prefix: 'api_std',
  message: 'Rate limit exceeded. Please slow down your requests.',
});

/**
 * Cluster-wide fixed-window limiter. Falls back to the in-process limiter when
 * Redis is not configured or a Redis call fails, so traffic is never blocked by
 * a rate-limit dependency outage.
 */
export function createDistributedRateLimit(options: {
  max: number;
  windowMs: number;
  prefix: string;
  message?: string;
}) {
  const { max, windowMs, prefix, message = 'Too many requests. Please slow down and try again.' } =
    options;
  const fallback = createRateLimitMiddleware({ max, windowMs, prefix, message });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const client = getRedis();
    if (!client) {
      fallback(req, res, next);
      return;
    }

    const windowIndex = Math.floor(Date.now() / windowMs);
    const key = `url:rl:${prefix}:${getClientIp(req)}:${windowIndex}`;

    try {
      const count = await client.incr(key);
      if (count === 1) await client.pexpire(key, windowMs);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

      if (count > max) {
        const ttlMs = await client.pttl(key);
        res.setHeader('Retry-After', Math.max(1, Math.ceil(ttlMs / 1000)));
        res.status(429).json({
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)),
        });
        return;
      }

      next();
    } catch {
      // Redis hiccup: fall back to the process-local limiter
      fallback(req, res, next);
    }
  };
}

export const distributedApiRateLimit = createDistributedRateLimit({
  max: 120,
  windowMs: 60 * 1000,
  prefix: 'api_std',
  message: 'Rate limit exceeded. Please slow down your requests.',
});
