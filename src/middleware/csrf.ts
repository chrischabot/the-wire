/**
 * CSRF Protection Middleware for The Wire
 * Validates Origin header for state-changing requests
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/env';

/**
 * List of allowed origins
 * In production, this should be configured via environment variables
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8787',
  'http://localhost:8080',
  'http://127.0.0.1:8787',
  'http://127.0.0.1:8080',
];

/**
 * Methods that require CSRF protection
 */
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Paths that are exempt from CSRF protection (e.g., public API endpoints)
 */
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/health',
];

/**
 * Extract origin from request
 */
function getOrigin(c: any): string | null {
  return c.req.header('Origin') || null;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigins: string[], env: Env): boolean {
  // Parse allowed origins from environment if available
  const envOrigins = env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || [];
  const allAllowed = [...allowedOrigins, ...envOrigins];

  // Also allow the worker's own URL
  const workerUrl = env.WORKER_URL;
  if (workerUrl) {
    allAllowed.push(workerUrl);
  }

  return allAllowed.some((allowed) => {
    // Exact match
    if (origin === allowed) return true;
    
    // Wildcard subdomain match (e.g., *.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      const originUrl = new URL(origin);
      return originUrl.hostname.endsWith(domain);
    }
    
    return false;
  });
}

/**
 * Check if path is exempt from CSRF protection
 */
function isPathExempt(path: string, exemptPaths: string[]): boolean {
  return exemptPaths.some((exempt) => path.startsWith(exempt));
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(options: {
  allowedOrigins?: string[];
  exemptPaths?: string[];
} = {}) {
  const allowedOrigins = options.allowedOrigins || DEFAULT_ALLOWED_ORIGINS;
  const exemptPaths = options.exemptPaths || EXEMPT_PATHS;

  return createMiddleware<{ Bindings: Env }>(async (c, next): Promise<Response | void> => {
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;

    // Skip CSRF check for safe methods
    if (!PROTECTED_METHODS.includes(method)) {
      await next();
      return;
    }

    // Skip CSRF check for exempt paths
    if (isPathExempt(path, exemptPaths)) {
      await next();
      return;
    }

    // Get origin header
    const origin = getOrigin(c);

    // If no origin header, check Referer as fallback
    if (!origin) {
      const referer = c.req.header('Referer');
      if (referer) {
        try {
          const refererOrigin = new URL(referer).origin;
          if (isOriginAllowed(refererOrigin, allowedOrigins, c.env)) {
            await next();
            return;
          }
        } catch {
          // Invalid referer URL
        }
      }

      // For API requests without Origin/Referer, check for valid auth token
      // This allows legitimate API clients while blocking browser-based attacks
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        await next();
        return;
      }

      // Reject request if no valid authentication
      return c.json(
        {
          success: false,
          error: 'CSRF validation failed: Missing Origin header',
        },
        403
      );
    }

    // Validate origin
    if (!isOriginAllowed(origin, allowedOrigins, c.env)) {
      console.warn(`CSRF: Blocked request from origin ${origin}`);
      return c.json(
        {
          success: false,
          error: 'CSRF validation failed: Invalid origin',
        },
        403
      );
    }

    await next();
  });
}

/**
 * Strict same-origin policy middleware
 * Only allows requests from the exact same origin
 */
export function sameOriginOnly() {
  return createMiddleware<{ Bindings: Env }>(async (c, next): Promise<Response | void> => {
    const method = c.req.method;
    
    // Skip for safe methods
    if (!PROTECTED_METHODS.includes(method)) {
      await next();
      return;
    }

    const origin = getOrigin(c);
    const requestUrl = new URL(c.req.url);
    const expectedOrigin = `${requestUrl.protocol}//${requestUrl.host}`;

    if (origin && origin !== expectedOrigin) {
      return c.json(
        {
          success: false,
          error: 'Cross-origin requests not allowed',
        },
        403
      );
    }

    await next();
  });
}