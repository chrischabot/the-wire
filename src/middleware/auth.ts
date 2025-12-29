import { createMiddleware } from "hono/factory";
import { getAuth } from "@hono/clerk-auth";
import type { Env } from "../types/env";
import { verifyToken, extractToken } from "../utils/jwt";
import type { AuthUser } from "../types/user";
import { logger } from "../utils/logger";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    userHandle: string;
    authMethod: "clerk" | "legacy";
  }
}

/**
 * Get JWT secret from environment.
 * Throws an error if JWT_SECRET is not configured.
 */
export function getJwtSecret(env: Env): string {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }
  return env.JWT_SECRET;
}

export const requireAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<Response | void> => {
    let userId: string | undefined;
    let userEmail: string | undefined;
    let userHandle: string | undefined;
    let authMethod: "clerk" | "legacy" = "legacy";

    const clerkAuth = getAuth(c);

    if (clerkAuth?.userId) {
      const internalUserId = await c.env.USERS_KV.get(
        `clerk:${clerkAuth.userId}`,
      );
      if (internalUserId) {
        const userData = await c.env.USERS_KV.get(`user:${internalUserId}`);
        if (userData) {
          const authUser: AuthUser = JSON.parse(userData);
          userId = authUser.id;
          userEmail = authUser.email;
          userHandle = authUser.handle;
          authMethod = "clerk";
        } else {
          logger.error("User data not found for internal ID", undefined, {
            internalUserId,
          });
          return c.json({ success: false, error: "User data not found" }, 500);
        }
      } else {
        return c.json(
          {
            success: false,
            error: "Account setup incomplete. Please complete onboarding.",
            code: "NEEDS_HANDLE",
          },
          403,
        );
      }
    } else {
      const authHeader = c.req.header("Authorization");
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return c.json({ success: false, error: "Authorization required" }, 401);
      }

      let secret: string;
      try {
        secret = getJwtSecret(c.env);
      } catch {
        logger.error("JWT_SECRET not configured");
        return c.json(
          { success: false, error: "Server configuration error" },
          500,
        );
      }

      const payload = await verifyToken(token, secret);

      if (!payload) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      const userData = await c.env.USERS_KV.get(`user:${payload.sub}`);
      if (userData) {
        const authUser: AuthUser = JSON.parse(userData);
        if (
          authUser.passwordChangedAt &&
          payload.iat &&
          payload.iat * 1000 < authUser.passwordChangedAt
        ) {
          return c.json(
            { success: false, error: "Token invalidated by password change" },
            401,
          );
        }
      }

      userId = payload.sub;
      userEmail = payload.email;
      userHandle = payload.handle;
      authMethod = "legacy";
    }

    if (!userId || !userEmail || !userHandle) {
      return c.json({ success: false, error: "Authentication failed" }, 401);
    }

    c.set("userId", userId);
    c.set("userEmail", userEmail);
    c.set("userHandle", userHandle);
    c.set("authMethod", authMethod);

    const banCacheKey = `ban-status:${userId}`;
    try {
      const cachedBanStatus = await c.env.SESSIONS_KV.get(banCacheKey);

      if (cachedBanStatus !== null) {
        if (cachedBanStatus === "banned") {
          return c.json(
            {
              success: false,
              error: "Account has been banned",
            },
            403,
          );
        }
      } else {
        const doId = c.env.USER_DO.idFromName(userId);
        const stub = c.env.USER_DO.get(doId);
        const bannedResp = await stub.fetch("https://do.internal/is-banned");
        const bannedData = (await bannedResp.json()) as { isBanned: boolean };

        // Cache for 60 seconds (minimum KV TTL, so bans take effect quickly)
        await c.env.SESSIONS_KV.put(
          banCacheKey,
          bannedData.isBanned ? "banned" : "active",
          { expirationTtl: 60 },
        );

        if (bannedData.isBanned) {
          return c.json(
            {
              success: false,
              error: "Account has been banned",
            },
            403,
          );
        }
      }
    } catch (error) {
      logger.error("Ban check failed", error, { userId });
      // Fail closed - if we can't verify ban status, deny access
      return c.json(
        { success: false, error: "Unable to verify account status" },
        503,
      );
    }

    await next();
  },
);

/**
 * Optional authentication middleware - validates JWT if present but doesn't require it
 * Supports both Clerk and legacy JWT authentication
 */
export const optionalAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<void> => {
    // First, try Clerk authentication
    const clerkAuth = getAuth(c);

    if (clerkAuth?.userId) {
      try {
        const internalUserId = await c.env.USERS_KV.get(
          `clerk:${clerkAuth.userId}`,
        );
        if (internalUserId) {
          const userData = await c.env.USERS_KV.get(`user:${internalUserId}`);
          if (userData) {
            const authUser: AuthUser = JSON.parse(userData);
            c.set("userId", authUser.id);
            c.set("userEmail", authUser.email);
            c.set("userHandle", authUser.handle);
            c.set("authMethod", "clerk");
            await next();
            return;
          }
        }
      } catch (error) {
        // Clerk auth failed - continue to try legacy JWT
        logger.error("optionalAuth: Clerk auth lookup failed", error);
      }
    }

    // Fall back to legacy JWT authentication
    const authHeader = c.req.header("Authorization");
    const token = extractToken(authHeader ?? null);

    if (token) {
      try {
        const secret = getJwtSecret(c.env);
        const payload = await verifyToken(token, secret);
        if (payload) {
          c.set("userId", payload.sub);
          c.set("userEmail", payload.email);
          c.set("userHandle", payload.handle);
          c.set("authMethod", "legacy");
        }
      } catch (error) {
        // JWT_SECRET not configured or token invalid - log and continue without auth
        // This is expected in Clerk-only deployments
        if (error instanceof Error && error.message.includes("JWT_SECRET")) {
          // Only log once per request, not for every optionalAuth call
        } else {
          logger.error("optionalAuth: Legacy JWT verification failed", error);
        }
      }
    }

    await next();
  },
);

/**
 * Admin authentication middleware - requires valid JWT and admin privileges
 * Supports: ADMIN_SECRET header bypass, Clerk tokens, and legacy JWT tokens
 */
export const requireAdmin = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<Response | void> => {
    // Check for ADMIN_SECRET bypass first (for scripts/cron/debug)
    const adminSecret = c.req.header("X-Admin-Secret");
    if (
      adminSecret &&
      c.env.ADMIN_SECRET &&
      adminSecret === c.env.ADMIN_SECRET
    ) {
      // Secret matches - skip all other auth checks
      c.set("userId", "admin-bypass");
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    const token = extractToken(authHeader ?? null);

    if (!token) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    let userId: string | null = null;

    // Try Clerk token verification first (RS256)
    if (c.env.CLERK_SECRET_KEY) {
      try {
        // Clerk tokens are RS256, verify with Clerk's public key
        const { verifyToken: verifyClerkToken } =
          await import("@clerk/backend");
        const verifiedToken = await verifyClerkToken(token, {
          secretKey: c.env.CLERK_SECRET_KEY,
        });
        if (verifiedToken?.sub) {
          // Clerk userId format: user_xxx - need to look up internal userId
          const internalUserId = await c.env.USERS_KV.get(
            `clerk:${verifiedToken.sub}`,
          );
          if (internalUserId) {
            userId = internalUserId;
          }
        }
      } catch {
        // Clerk verification failed, will try legacy JWT below
      }
    }

    // Fallback to legacy JWT verification
    if (!userId) {
      try {
        const secret = getJwtSecret(c.env);
        const payload = await verifyToken(token, secret);
        if (payload?.sub) {
          userId = payload.sub;
          c.set("userEmail", payload.email);
          c.set("userHandle", payload.handle);
        }
      } catch {
        // Legacy JWT verification also failed
      }
    }

    if (!userId) {
      return c.json({ success: false, error: "Invalid or expired token" }, 401);
    }

    // Set user info in context
    c.set("userId", userId);

    // Check if user is admin
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);

    try {
      const profileResp = await userStub.fetch("https://do.internal/profile");
      if (!profileResp.ok) {
        return c.json(
          { success: false, error: "Failed to verify admin status" },
          500,
        );
      }

      const profile = (await profileResp.json()) as { isAdmin?: boolean };
      if (!profile.isAdmin) {
        return c.json({ success: false, error: "Admin access required" }, 403);
      }
    } catch (error) {
      logger.error("Error checking admin status", error, { userId });
      return c.json(
        { success: false, error: "Failed to verify admin status" },
        500,
      );
    }

    await next();
  },
);
