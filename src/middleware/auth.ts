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
 */
export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

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

  await next();
});

/**
 * Optional authentication middleware - validates JWT if present but doesn't require it
 */
export const optionalAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

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