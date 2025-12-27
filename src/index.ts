/**
 * The Wire - Main Worker Entry Point
 * A globally distributed social network on Cloudflare edge
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { Env } from "./types/env";
import authRoutes from "./handlers/auth";
import usersRoutes from "./handlers/users";
import postsRoutes from "./handlers/posts";
import mediaRoutes from "./handlers/media";
import feedRoutes from "./handlers/feed";
import moderationRoutes from "./handlers/moderation";
import adminRoutes from "./handlers/admin";
import notificationsRoutes from "./handlers/notifications";
import searchRoutes from "./handlers/search";
import seedRoutes from "./handlers/seed";
import unfurlRoutes from "./handlers/unfurl";
import { rateLimit, RATE_LIMITS } from "./middleware/rate-limit";
import { csrfProtection } from "./middleware/csrf";
import { handleScheduled } from "./handlers/scheduled";
import { getStyles } from "./styles";
import { getClientJS } from "./client-js";
import { getLandingPage } from "./pages/landing";
import { getSignupPage, getLoginPage } from "./pages/auth";
import { getSearchPage } from "./pages/search";
import { getExplorePage } from "./pages/explore";
import { getNotificationsPage } from "./pages/notifications";
import { getHomePage } from "./pages/home";
import { getPostPage } from "./pages/post";
import { getSettingsPage, getMutedSettingsPage } from "./pages/settings";
import { getAdminPage } from "./pages/admin";
import {
  getProfilePage,
  getFollowersPage,
  getFollowingPage,
} from "./pages/profile";

// Create Hono app with environment typing
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", cors());

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
      "/health",
      "/debug/reset", // For testing database reset
      "/debug/bootstrap-admin", // For bootstrapping first admin
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

// Landing page
app.get("/", (c) => {
  return c.html(getLandingPage());
});

// Signup page
app.get("/signup", (c) => {
  return c.html(getSignupPage());
});

// Login page
app.get("/login", (c) => {
  return c.html(getLoginPage());
});

// Home page
app.get("/home", (c) => {
  return c.html(getHomePage());
});

// Search results page
app.get("/search", (c) => {
  return c.html(getSearchPage());
});

// Explore page
app.get("/explore", (c) => {
  return c.html(getExplorePage());
});

// Notifications page
app.get("/notifications", (c) => {
  return c.html(getNotificationsPage());
});

// Single post view
app.get("/post/:id", (c) => {
  const postId = c.req.param("id");
  return c.html(getPostPage(postId));
});

// Settings page
app.get("/settings", (c) => {
  return c.html(getSettingsPage());
});

app.get("/settings/muted", (c) => {
  return c.html(getMutedSettingsPage());
});

// Admin Dashboard
app.get("/admin", (c) => {
  return c.html(getAdminPage());
});

// Public profile page - MUST be before API routes to avoid conflicts
app.get("/u/:handle", (c) => {
  const handle = c.req.param("handle");
  return c.html(getProfilePage(handle));
});

// Followers page
app.get("/u/:handle/followers", (c) => {
  const handle = c.req.param("handle");
  return c.html(getFollowersPage(handle));
});

// Following page
app.get("/u/:handle/following", (c) => {
  const handle = c.req.param("handle");
  return c.html(getFollowingPage(handle));
});

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
    console.error("WebSocket auth error:", error);
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
});

// Mount auth routes
app.route("/api/auth", authRoutes);

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

// Mount seed routes (DEBUG ONLY - remove in production)
app.route("/debug", seedRoutes);

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

// 404 fallback - return HTML for browser requests, JSON for API requests
app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  const isApiRequest = path.startsWith("/api/");

  if (isApiRequest) {
    return c.json({ success: false, error: "Not found" }, 404);
  }

  return c.html(
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
</head>
<body>
  <div class="container">
    <div style="text-align: center; padding: 4rem 0;">
      <h1 style="font-size: 6rem; margin-bottom: 1rem;">404</h1>
      <h2 style="margin-bottom: 2rem;">Page Not Found</h2>
      <p class="text-muted" style="margin-bottom: 2rem;">The page you're looking for doesn't exist.</p>
      <a href="/" class="cta" style="display: inline-block; padding: 1rem 2rem; background: linear-gradient(135deg, #00d9ff 0%, #0077ff 100%); color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600;">Go Home</a>
    </div>
  </div>
  <script>
    const bottomNav = document.getElementById('bottom-nav');
    let lastScrollY = window.scrollY;
    if (bottomNav) {
      window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
          bottomNav.classList.add('hidden');
        } else if (currentScrollY < lastScrollY) {
          bottomNav.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
      });
    }
  </script>
</body>
</html>
  `,
    404,
  );
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
  console.error(JSON.stringify(errorLog));
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
      console.error("Error processing queue message:", error);
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

// Export for Cloudflare Workers - all handlers in one object
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: scheduledHandler,
};
