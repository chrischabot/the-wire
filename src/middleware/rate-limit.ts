/**
 * Rate Limiting Middleware for The Wire
 * Uses KV storage for distributed rate limiting across edge locations
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../types/env';

type HonoContext = Context<{ Bindings: Env }>;

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Key prefix for KV storage */
  keyPrefix: string;
  /** Whether to include user ID in key (requires auth) */
  perUser?: boolean;
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  /** Login attempts: 5 per minute per IP */
  login: { limit: 5, windowSeconds: 60, keyPrefix: 'rl:login' },
  /** Signup attempts: 10 per hour per IP */
  signup: { limit: 10, windowSeconds: 3600, keyPrefix: 'rl:signup' },
  /** General API: 100 per minute per user */
  api: { limit: 100, windowSeconds: 60, keyPrefix: 'rl:api', perUser: true },
  /** Post creation: 30 per hour per user */
  post: { limit: 30, windowSeconds: 3600, keyPrefix: 'rl:post', perUser: true },
  /** Follow actions: 50 per hour per user */
  follow: { limit: 50, windowSeconds: 3600, keyPrefix: 'rl:follow', perUser: true },
  /** Media uploads: 20 per hour per user */
  upload: { limit: 20, windowSeconds: 3600, keyPrefix: 'rl:upload', perUser: true },
} as const;

/**
 * Extract client IP from request headers
 */
function getClientIP(c: HonoContext): string {
  // Cloudflare provides the real client IP in CF-Connecting-IP
  const cfIP = c.req.header('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Fallback to X-Forwarded-For
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  // Fallback to X-Real-IP
  const realIP = c.req.header('X-Real-IP');
  if (realIP) return realIP;

  return 'unknown';
}

/**
 * Generate rate limit key
 */
function generateKey(config: RateLimitConfig, identifier: string): string {
  return `${config.keyPrefix}:${identifier}`;
}

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  return createMiddleware<{ Bindings: Env }>(async (c, next): Promise<Response | void> => {
    const ip = getClientIP(c);
    const userId = config.perUser ? c.get('userId') : null;
    
    // Use user ID if available and perUser is true, otherwise use IP
    const identifier = (config.perUser && userId) ? userId : ip;
    const key = generateKey(config, identifier);

    try {
      // Get current rate limit state from KV
      const stored = await c.env.SESSIONS_KV.get(key);
      const now = Date.now();
      
      let state: RateLimitState;
      
      if (stored) {
        state = JSON.parse(stored);
        
        // Check if window has expired
        if (now >= state.resetAt) {
          // Reset the window
          state = {
            count: 1,
            resetAt: now + (config.windowSeconds * 1000),
          };
        } else {
          // Increment count
          state.count++;
        }
      } else {
        // First request in window
        state = {
          count: 1,
          resetAt: now + (config.windowSeconds * 1000),
        };
      }

      // Check if limit exceeded
      if (state.count > config.limit) {
        const retryAfter = Math.ceil((state.resetAt - now) / 1000);
        
        return c.json(
          {
            success: false,
            error: 'Too many requests. Please try again later.',
            retryAfter,
          },
          429,
          {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(state.resetAt / 1000).toString(),
          }
        );
      }

      // Store updated state
      const ttl = Math.ceil((state.resetAt - now) / 1000);
      await c.env.SESSIONS_KV.put(key, JSON.stringify(state), {
        expirationTtl: Math.max(ttl, 60),
      });

      // Add rate limit headers to response
      c.header('X-RateLimit-Limit', config.limit.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, config.limit - state.count).toString());
      c.header('X-RateLimit-Reset', Math.ceil(state.resetAt / 1000).toString());

      await next();
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open for rate limiting (allow request if check fails)
      // But log for monitoring
      await next();
    }
  });
}

/**
 * Account lockout middleware
 * Tracks failed login attempts and locks account after threshold
 */
export function accountLockout(maxAttempts: number = 5, lockoutMinutes: number = 15) {
  return createMiddleware<{ Bindings: Env }>(async (c, next): Promise<Response | void> => {
    const ip = getClientIP(c);
    const body = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
    const email = body.email?.toLowerCase() || 'unknown';
    
    // Clone request body for handler
    c.req.raw = new Request(c.req.raw, {
      body: JSON.stringify(body),
    });

    const lockoutKey = `lockout:${email}`;
    const attemptsKey = `attempts:${email}:${ip}`;

    // Check if account is locked
    const lockout = await c.env.SESSIONS_KV.get(lockoutKey);
    if (lockout) {
      const lockoutData = JSON.parse(lockout);
      const remainingSeconds = Math.ceil((lockoutData.unlocksAt - Date.now()) / 1000);
      
      if (remainingSeconds > 0) {
        return c.json(
          {
            success: false,
            error: 'Account temporarily locked due to too many failed attempts.',
            retryAfter: remainingSeconds,
          },
          429,
          { 'Retry-After': remainingSeconds.toString() }
        );
      }
    }

    await next();

    // After handler, check if login failed (4xx response)
    const status = c.res.status;
    if (status >= 400 && status < 500) {
      // Track failed attempt
      const attempts = await c.env.SESSIONS_KV.get(attemptsKey);
      const attemptCount = attempts ? parseInt(attempts, 10) + 1 : 1;

      if (attemptCount >= maxAttempts) {
        // Lock the account
        const unlocksAt = Date.now() + (lockoutMinutes * 60 * 1000);
        await c.env.SESSIONS_KV.put(
          lockoutKey,
          JSON.stringify({ unlocksAt, attempts: attemptCount }),
          { expirationTtl: lockoutMinutes * 60 }
        );
        // Clear attempt counter
        await c.env.SESSIONS_KV.delete(attemptsKey);
      } else {
        // Increment attempt counter
        await c.env.SESSIONS_KV.put(
          attemptsKey,
          attemptCount.toString(),
          { expirationTtl: lockoutMinutes * 60 }
        );
      }
    } else if (status >= 200 && status < 300) {
      // Successful login - clear attempts
      await c.env.SESSIONS_KV.delete(attemptsKey);
    }
  });
}