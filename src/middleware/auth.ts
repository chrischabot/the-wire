import { createMiddleware } from "hono/factory";
import { getAuth } from "@hono/clerk-auth";
import type { Env } from "../types/env";
import { verifyToken, extractToken } from "../utils/jwt";
import type { AuthUser } from "../types/user";

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
        }
      }
    }

    if (!userId) {
      const authHeader = c.req.header("Authorization");
      const token = extractToken(authHeader ?? null);

      if (!token) {
        return c.json({ success: false, error: "Authorization required" }, 401);
      }

      let secret: string;
      try {
        secret = getJwtSecret(c.env);
      } catch {
        console.error("JWT_SECRET not configured");
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

      userId = payload.sub;
      userEmail = payload.email;
      userHandle = payload.handle;
      authMethod = "legacy";
    }

    c.set("userId", userId);
    c.set("userEmail", userEmail!);
    c.set("userHandle", userHandle!);
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

        // Cache for 60 seconds (short TTL so bans take effect quickly)
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
      console.error("Ban check failed:", error);
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
 */
export const optionalAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<void> => {
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
        }
      } catch {
        // JWT_SECRET not configured - silently skip auth
      }
    }

    await next();
  },
);

/**
 * Admin authentication middleware - requires valid JWT and admin privileges
 */
export const requireAdmin = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<Response | void> => {
    // First, require authentication
    const authHeader = c.req.header("Authorization");
    const token = extractToken(authHeader ?? null);

    if (!token) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    let secret: string;
    try {
      secret = getJwtSecret(c.env);
    } catch {
      console.error("JWT_SECRET not configured");
      return c.json(
        { success: false, error: "Server configuration error" },
        500,
      );
    }

    const payload = await verifyToken(token, secret);

    if (!payload) {
      return c.json({ success: false, error: "Invalid or expired token" }, 401);
    }

    // Set user info in context
    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
    c.set("userHandle", payload.handle);

    // Check if user is admin
    const userDoId = c.env.USER_DO.idFromName(payload.sub);
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
      console.error("Error checking admin status:", error);
      return c.json(
        { success: false, error: "Failed to verify admin status" },
        500,
      );
    }

    await next();
  },
);
