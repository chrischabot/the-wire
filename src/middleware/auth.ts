/**
 * Authentication middleware for The Wire
 * Validates JWT tokens and adds user info to context
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/env';
import { verifyToken, extractToken } from '../utils/jwt';

// Extend Hono context with user info
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    userHandle: string;
  }
}

/**
 * Get JWT secret from environment.
 * Throws an error if JWT_SECRET is not configured.
 */
export function getJwtSecret(env: Env): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  return env.JWT_SECRET;
}

/**
 * Authentication middleware - requires valid JWT
 * OPTIMIZED: Uses KV cache for ban status (60s TTL) to avoid DO call on every request
 */
export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next): Promise<Response | void> => {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader ?? null);

  if (!token) {
    return c.json({ success: false, error: 'Authorization required' }, 401);
  }

  let secret: string;
  try {
    secret = getJwtSecret(c.env);
  } catch {
    console.error('JWT_SECRET not configured');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  const payload = await verifyToken(token, secret);

  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  // Set user info in context
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userHandle', payload.handle);

  // OPTIMIZED: Check ban status from KV cache first (avoids DO call on every request)
  const banCacheKey = `ban-status:${payload.sub}`;
  try {
    const cachedBanStatus = await c.env.SESSIONS_KV.get(banCacheKey);

    if (cachedBanStatus !== null) {
      // Cache hit - use cached value
      if (cachedBanStatus === 'banned') {
        return c.json({
          success: false,
          error: 'Account has been banned'
        }, 403);
      }
      // cachedBanStatus === 'active' - proceed
    } else {
      // Cache miss - fetch from DO and cache result
      const doId = c.env.USER_DO.idFromName(payload.sub);
      const stub = c.env.USER_DO.get(doId);
      const bannedResp = await stub.fetch('https://do.internal/is-banned');
      const bannedData = await bannedResp.json() as { isBanned: boolean };

      // Cache for 60 seconds (short TTL so bans take effect quickly)
      await c.env.SESSIONS_KV.put(
        banCacheKey,
        bannedData.isBanned ? 'banned' : 'active',
        { expirationTtl: 60 }
      );

      if (bannedData.isBanned) {
        return c.json({
          success: false,
          error: 'Account has been banned'
        }, 403);
      }
    }
  } catch (error) {
    console.error('Ban check failed:', error);
    // Fail closed - if we can't verify ban status, deny access
    return c.json({ success: false, error: 'Unable to verify account status' }, 503);
  }

  await next();
});

/**
 * Optional authentication middleware - validates JWT if present but doesn't require it
 */
export const optionalAuth = createMiddleware<{ Bindings: Env }>(async (c, next): Promise<void> => {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader ?? null);

  if (token) {
    try {
      const secret = getJwtSecret(c.env);
      const payload = await verifyToken(token, secret);
      if (payload) {
        c.set('userId', payload.sub);
        c.set('userEmail', payload.email);
        c.set('userHandle', payload.handle);
      }
    } catch {
      // JWT_SECRET not configured - silently skip auth
    }
  }

  await next();
});

/**
 * Admin authentication middleware - requires valid JWT and admin privileges
 */
export const requireAdmin = createMiddleware<{ Bindings: Env }>(async (c, next): Promise<Response | void> => {
  // First, require authentication
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader ?? null);

  if (!token) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  let secret: string;
  try {
    secret = getJwtSecret(c.env);
  } catch {
    console.error('JWT_SECRET not configured');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  const payload = await verifyToken(token, secret);

  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  // Set user info in context
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userHandle', payload.handle);

  // Check if user is admin
  const userDoId = c.env.USER_DO.idFromName(payload.sub);
  const userStub = c.env.USER_DO.get(userDoId);

  try {
    const profileResp = await userStub.fetch('https://do.internal/profile');
    if (!profileResp.ok) {
      return c.json({ success: false, error: 'Failed to verify admin status' }, 500);
    }

    const profile = await profileResp.json() as { isAdmin?: boolean };
    if (!profile.isAdmin) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return c.json({ success: false, error: 'Failed to verify admin status' }, 500);
  }

  await next();
});