/**
 * The Wire - Main Worker Entry Point
 * A globally distributed social network on Cloudflare edge
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { Env } from "./types/env";
import authRoutes from "./handlers/auth";
import clerkAuthRoutes from "./handlers/clerk-auth";
import usersRoutes from "./handlers/users";
import postsRoutes from "./handlers/posts";
import mediaRoutes from "./handlers/media";
import feedRoutes from "./handlers/feed";
import moderationRoutes from "./handlers/moderation";
import adminRoutes from "./handlers/admin";
import notificationsRoutes from "./handlers/notifications";
import searchRoutes from "./handlers/search";
import seedRoutes from "./handlers/seed";
import newsSeedRoutes from "./handlers/news-seed";
import unfurlRoutes from "./handlers/unfurl";
import batchRoutes from "./handlers/batch";
import { rateLimit, RATE_LIMITS } from "./middleware/rate-limit";
import { csrfProtection } from "./middleware/csrf";
import { clerkAuthMiddleware } from "./middleware/clerk-auth";
import { handleScheduled } from "./handlers/scheduled";
import { getStyles } from "./styles";
import { getClientJS } from "./client-js";
import { getLandingPage } from "./pages/landing";
import { initLogger, logger } from "./utils/logger";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  initLogger(c.env.ENVIRONMENT);
  await next();
});

app.use("*", cors());
app.use("/api/*", clerkAuthMiddleware);

// Request body size limit (1MB for JSON, handled separately for multipart)
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 1024 * 1024, // 1MB
    onError: (c) => {
      return c.json(
        {
          success: false,
          error: "Request body too large",
        },
        413,
      );
    },
  }),
);

// CSRF protection for state-changing requests
app.use(
  "*",
  csrfProtection({
    allowedOrigins: [
      "http://localhost:8787",
      "http://localhost:8080",
      "http://127.0.0.1:8787",
      "http://127.0.0.1:8080",
      "https://the-wire.chabotc.workers.dev",
    ],
    exemptPaths: [
      "/api/auth/login",
      "/api/auth/signup",
      "/api/clerk/session",
      "/api/clerk/handles/check",
      "/api/clerk/onboarding/complete",
      "/health",
      "/debug/reset",
      "/debug/bootstrap-admin",
    ],
  }),
);

// General API rate limiting (100 req/min per IP)
app.use("/api/*", rateLimit({ ...RATE_LIMITS.api, perUser: false }));

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    success: true,
    data: {
      status: "healthy",
      service: "the-wire",
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT,
    },
  });
});

// Landing page (SSR - marketing/welcome page)
app.get("/", (c) => {
  return c.html(getLandingPage());
});

async function serveSPA(c: import("hono").Context<{ Bindings: Env }>) {
  const spaResponse = await c.env.ASSETS.fetch(
    new Request("https://assets/index.html"),
  );
  const html = await spaResponse.text();
  return c.html(html);
}

app.get("/signup", (c) => serveSPA(c));
app.get("/login", (c) => serveSPA(c));
app.get("/auth", (c) => serveSPA(c));
app.get("/auth/*", (c) => serveSPA(c));
app.get("/post-auth", (c) => serveSPA(c));
app.get("/onboarding", (c) => serveSPA(c));
app.get("/onboarding/*", (c) => serveSPA(c));
app.get("/home", (c) => serveSPA(c));
app.get("/search", (c) => serveSPA(c));
app.get("/explore", (c) => serveSPA(c));
app.get("/notifications", (c) => serveSPA(c));
app.get("/post/:id", (c) => serveSPA(c));
app.get("/settings", (c) => serveSPA(c));
app.get("/settings/muted", (c) => serveSPA(c));
app.get("/admin", (c) => serveSPA(c));
app.get("/u/:handle", (c) => serveSPA(c));
app.get("/u/:handle/followers", (c) => serveSPA(c));
app.get("/u/:handle/following", (c) => serveSPA(c));

// API version info
app.get("/api", (c) => {
  return c.json({
    success: true,
    data: {
      name: "The Wire API",
      version: "1.0.0",
      endpoints: {
        auth: "/api/auth/*",
        users: "/api/users/*",
        posts: "/api/posts/*",
        feed: "/api/feed/*",
        media: "/api/media/*",
        notifications: "/api/notifications/*",
        ws: "/api/ws (WebSocket)",
      },
    },
  });
});

/**
 * WebSocket endpoint - Upgrade to WebSocket connection
 * Query param: token (JWT for authentication)
 */
app.get("/api/ws", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json({ success: false, error: "Token required" }, 401);
  }

  // Verify JWT
  const { verifyToken } = await import("./utils/jwt");
  const { getJwtSecret } = await import("./middleware/auth");

  try {
    const secret = getJwtSecret(c.env);
    const payload = await verifyToken(token, secret);

    if (!payload) {
      return c.json({ success: false, error: "Invalid token" }, 401);
    }

    // Check if user is banned
    const userDoId = c.env.USER_DO.idFromName(payload.sub);
    const userStub = c.env.USER_DO.get(userDoId);
    const bannedResp = await userStub.fetch("https://do.internal/is-banned");
    const bannedData = (await bannedResp.json()) as { isBanned: boolean };

    if (bannedData.isBanned) {
      return c.json({ success: false, error: "Account banned" }, 403);
    }

    // Forward to user's WebSocketDO preserving upgrade semantics
    const wsDoId = c.env.WEBSOCKET_DO.idFromName(payload.sub);
    const wsStub = c.env.WEBSOCKET_DO.get(wsDoId);

    // Clone original request with /connect path
    const originalReq = c.req.raw;
    const url = new URL(originalReq.url);
    url.pathname = "/connect";
    const forwardedReq = new Request(url.toString(), originalReq);

    return await wsStub.fetch(forwardedReq);
  } catch (error) {
    logger.error("WebSocket auth error", error);
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
});

app.route("/api/auth", authRoutes);
app.route("/api/clerk", clerkAuthRoutes);

// Mount users routes
app.route("/api/users", usersRoutes);

// Mount posts routes
app.route("/api/posts", postsRoutes);

// Mount feed routes
app.route("/api/feed", feedRoutes);

// Mount search routes
app.route("/api/search", searchRoutes);

// Mount media routes
app.route("/api/media", mediaRoutes);

// Mount moderation routes (admin only)
app.route("/api/moderation", moderationRoutes);

// Mount admin dashboard routes (admin only)
app.route("/api/admin", adminRoutes);

// Mount notifications routes
app.route("/api/notifications", notificationsRoutes);

// Mount unfurl routes (URL metadata extraction)
app.route("/api/unfurl", unfurlRoutes);

app.route("/api/batch", batchRoutes);

// Mount seed routes (DEBUG ONLY - remove in production)
app.route("/debug", seedRoutes);

// Mount news seed routes (AI news aggregation and conversation generation)
app.route("/debug/news", newsSeedRoutes);

// Serve media files
app.route("/media", mediaRoutes);

app.get("/css/styles.css", (_c) => {
  return new Response(getStyles(), {
    headers: { "Content-Type": "text/css" },
  });
});

app.get("/js/api.js", (_c) => {
  return new Response(getClientJS(), {
    headers: { "Content-Type": "application/javascript" },
  });
});

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  const isApiRequest = path.startsWith("/api/");

  if (isApiRequest) {
    return c.json({ success: false, error: "Not found" }, 404);
  }

  const spaResponse = await c.env.ASSETS.fetch(
    new Request("https://assets/index.html"),
  );
  const html = await spaResponse.text();
  return c.html(html);
});

// Error handler with structured logging
app.onError((err, c) => {
  // Inline structured error logging for production debugging
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: "error",
    message: "Unhandled request error",
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    context: {
      path: c.req.path,
      method: c.req.method,
      url: c.req.url,
    },
  };
  logger.error("Unhandled error", errorLog);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

// Export Durable Objects
export { UserDO } from "./durable-objects/UserDO";
export { PostDO } from "./durable-objects/PostDO";
export { FeedDO } from "./durable-objects/FeedDO";
export { WebSocketDO } from "./durable-objects/WebSocketDO";

// OPTIMIZED: Helper to process followers in chunks with concurrency control
async function processFanoutChunk<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number = 5,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(processor));
  }
}

// Queue consumer handler for fan-out processing
// OPTIMIZED: Chunks followers, skips duplicate author add, limits concurrency
async function queueHandler(
  batch: MessageBatch<import("./types/feed").FanOutMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const msg = message.body;

      if (msg.type === "new_post") {
        // Add to author's own feed first
        const authorFeedId = env.FEED_DO.idFromName(msg.authorId);
        const authorFeedStub = env.FEED_DO.get(authorFeedId);
        await authorFeedStub.fetch("https://do.internal/add-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entry: {
              postId: msg.postId,
              authorId: msg.authorId,
              timestamp: msg.timestamp,
              source: "own",
            },
          }),
        });

        // Get author's followers
        const authorDoId = env.USER_DO.idFromName(msg.authorId);
        const authorStub = env.USER_DO.get(authorDoId);
        const followersResp = await authorStub.fetch(
          "https://do.internal/followers",
        );
        const followersData = (await followersResp.json()) as {
          followers: string[];
        };

        // OPTIMIZED: Filter out author (already added above) to avoid duplicate
        const followers = followersData.followers.filter(
          (id) => id !== msg.authorId,
        );

        // Get post metadata once for broadcasts
        const postData = await env.POSTS_KV.get(`post:${msg.postId}`);
        const postMetadata = postData ? JSON.parse(postData) : null;

        // OPTIMIZED: Process followers in chunks of 10 with concurrency of 5
        // This keeps subrequests under control for large follower lists
        await processFanoutChunk(
          followers,
          async (followerId) => {
            const feedId = env.FEED_DO.idFromName(followerId);
            const feedStub = env.FEED_DO.get(feedId);

            await feedStub.fetch("https://do.internal/add-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entry: {
                  postId: msg.postId,
                  authorId: msg.authorId,
                  timestamp: msg.timestamp,
                  source: "follow",
                },
              }),
            });

            // Broadcast new post to follower's WebSocket connections
            if (postMetadata) {
              try {
                const wsDoId = env.WEBSOCKET_DO.idFromName(followerId);
                const wsStub = env.WEBSOCKET_DO.get(wsDoId);
                await wsStub.fetch("https://do.internal/broadcast-post", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ post: postMetadata }),
                });
              } catch {
                // Ignore WebSocket broadcast errors - not critical
              }
            }
          },
          5,
        );
      } else if (msg.type === "delete_post") {
        // Remove from author's feed
        const authorFeedId = env.FEED_DO.idFromName(msg.authorId);
        const authorFeedStub = env.FEED_DO.get(authorFeedId);
        await authorFeedStub.fetch("https://do.internal/remove-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: msg.postId }),
        });

        // Get author's followers and remove from their feeds
        const authorDoId = env.USER_DO.idFromName(msg.authorId);
        const authorStub = env.USER_DO.get(authorDoId);
        const followersResp = await authorStub.fetch(
          "https://do.internal/followers",
        );
        const followersData = (await followersResp.json()) as {
          followers: string[];
        };

        // OPTIMIZED: Filter out author and process in chunks
        const followers = followersData.followers.filter(
          (id) => id !== msg.authorId,
        );

        await processFanoutChunk(
          followers,
          async (followerId) => {
            const feedId = env.FEED_DO.idFromName(followerId);
            const feedStub = env.FEED_DO.get(feedId);

            await feedStub.fetch("https://do.internal/remove-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postId: msg.postId }),
            });
          },
          5,
        );
      }

      message.ack();
    } catch (error) {
      logger.error("Error processing queue message", error);
      const backoff = Math.min(3600, 30 ** message.attempts);
      message.retry({ delaySeconds: backoff });
    }
  }
}

// Scheduled handler for cron triggers
async function scheduledHandler(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  await handleScheduled(event, env, ctx);
}

// Export app for testing
export { app };

// Export for Cloudflare Workers - all handlers in one object
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: scheduledHandler,
};
