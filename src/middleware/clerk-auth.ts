import { createMiddleware } from "hono/factory";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { Env } from "../types/env";

declare module "hono" {
  interface ContextVariableMap {
    clerkUserId: string;
    clerkEmail: string;
  }
}

export const clerkAuthMiddleware = clerkMiddleware();

export const requireClerkAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<Response | void> => {
    const auth = getAuth(c);

    if (!auth?.userId) {
      return c.json(
        { success: false, error: "Clerk authentication required" },
        401,
      );
    }

    c.set("clerkUserId", auth.userId);

    await next();
  },
);

export const optionalClerkAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next): Promise<void> => {
    const auth = getAuth(c);

    if (auth?.userId) {
      c.set("clerkUserId", auth.userId);
    }

    await next();
  },
);
