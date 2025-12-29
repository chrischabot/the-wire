import { Hono } from "hono";
import type { Env } from "../types/env";
import type { AuthUser, UserProfile, UserSettings } from "../types/user";
import {
  clerkAuthMiddleware,
  requireClerkAuth,
} from "../middleware/clerk-auth";
import {
  validateHandle,
  normalizeHandle,
  normalizeEmail,
} from "../utils/validation";
import { generateId } from "../services/snowflake";
import { indexUser } from "../utils/search-index";
import { rateLimit, RATE_LIMITS } from "../middleware/rate-limit";
import { logger } from "../utils/logger";
import { success, error } from "../utils/response";
import { RETENTION, FOUNDER_HANDLE } from "../constants";
import type { PostMetadata } from "../types/post";
import { getAuth } from "@hono/clerk-auth";

const clerkAuth = new Hono<{ Bindings: Env }>();

clerkAuth.use("*", clerkAuthMiddleware);

clerkAuth.get("/session", requireClerkAuth, async (c) => {
  const log = logger.child({ handler: "clerk-auth.session" });
  const clerkUserId = c.get("clerkUserId");

  log.info("Session check", { clerkUserId });

  const internalUserId = await c.env.USERS_KV.get(`clerk:${clerkUserId}`);

  if (!internalUserId) {
    const auth = getAuth(c);
    let email = "";

    if (auth?.userId) {
      try {
        const clerk = c.get("clerk");
        if (clerk) {
          const user = await clerk.users.getUser(auth.userId);
          const primaryEmail = user.emailAddresses.find(
            (e: { id: string }) => e.id === user.primaryEmailAddressId,
          );
          if (primaryEmail) {
            email = primaryEmail.emailAddress;
          }
        }
      } catch {
        log.warn("Could not fetch Clerk user email");
      }
    }

    return success({
      status: "needs_handle",
      clerkUserId,
      email,
    });
  }

  const userData = await c.env.USERS_KV.get(`user:${internalUserId}`);
  if (!userData) {
    log.error("Internal user not found despite clerk mapping", null, {
      clerkUserId,
      internalUserId,
    });
    return error("User data inconsistency", 500);
  }

  const authUser: AuthUser = JSON.parse(userData);

  const doId = c.env.USER_DO.idFromName(internalUserId);
  const stub = c.env.USER_DO.get(doId);
  const profileResp = await stub.fetch("https://do.internal/profile");
  const profile = (await profileResp.json()) as UserProfile;

  authUser.lastLogin = Date.now();
  await c.env.USERS_KV.put(`user:${internalUserId}`, JSON.stringify(authUser));

  return success({
    status: "linked",
    user: {
      id: authUser.id,
      email: authUser.email,
      handle: authUser.handle,
      displayName: profile.displayName || authUser.handle,
      avatarUrl: profile.avatarUrl || undefined,
      isAdmin: profile.isAdmin || undefined,
    },
  });
});

clerkAuth.get("/handles/check", async (c) => {
  const handle = c.req.query("handle");

  if (!handle) {
    return error("Handle parameter required");
  }

  const normalized = normalizeHandle(handle);
  const existing = await c.env.USERS_KV.get(`handle:${normalized}`);

  return success({ available: !existing });
});

clerkAuth.post(
  "/onboarding/complete",
  requireClerkAuth,
  rateLimit(RATE_LIMITS.signup),
  async (c) => {
    const log = logger.child({ handler: "clerk-auth.onboarding" });
    const clerkUserId = c.get("clerkUserId");

    const existingMapping = await c.env.USERS_KV.get(`clerk:${clerkUserId}`);
    if (existingMapping) {
      return error("Account already linked", 409);
    }

    let body: { handle: string };
    try {
      body = await c.req.json();
    } catch {
      return error("Invalid JSON body");
    }

    const handleResult = validateHandle(body.handle);
    if (!handleResult.valid) {
      return error(handleResult.error ?? "Invalid handle");
    }

    const handle = normalizeHandle(body.handle);

    const existingHandle = await c.env.USERS_KV.get(`handle:${handle}`);
    if (existingHandle) {
      return error("Handle already taken", 409);
    }

    let email = "";
    const auth = getAuth(c);
    if (auth?.userId) {
      try {
        const clerk = c.get("clerk");
        if (clerk) {
          const user = await clerk.users.getUser(auth.userId);
          const primaryEmail = user.emailAddresses.find(
            (e: { id: string }) => e.id === user.primaryEmailAddressId,
          );
          if (primaryEmail) {
            email = normalizeEmail(primaryEmail.emailAddress);
          }
        }
      } catch (err) {
        log.warn("Could not fetch Clerk user email", { error: err });
      }
    }

    const userId = generateId();
    const now = Date.now();

    const authUser: AuthUser = {
      id: userId,
      email,
      handle,
      clerkId: clerkUserId,
      authProvider: "clerk",
      createdAt: now,
      lastLogin: now,
    };

    await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));
    await c.env.USERS_KV.put(`handle:${handle}`, userId);
    await c.env.USERS_KV.put(`clerk:${clerkUserId}`, userId);
    if (email) {
      await c.env.USERS_KV.put(`email:${email}`, userId);
    }

    const defaultProfile: UserProfile = {
      id: userId,
      handle,
      displayName: handle,
      bio: "",
      location: "",
      website: "",
      avatarUrl: "",
      bannerUrl: "",
      joinedAt: now,
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      isVerified: false,
      isBanned: false,
      isAdmin: handle === c.env.INITIAL_ADMIN_HANDLE || false,
    };

    const defaultSettings: UserSettings = {
      emailNotifications: true,
      privateAccount: false,
      mutedWords: [],
    };

    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    const initResp = await stub.fetch("https://do.internal/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: defaultProfile,
        settings: defaultSettings,
      }),
    });

    if (!initResp.ok) {
      const errText = await initResp.text();
      log.error("UserDO.initialize failed", new Error(errText), { userId });
      throw new Error(`UserDO initialize failed: ${errText}`);
    }

    await stub.fetch("https://do.internal/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    await stub.fetch("https://do.internal/add-follower", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (handle !== FOUNDER_HANDLE) {
      try {
        const founderUserId = await c.env.USERS_KV.get(
          `handle:${FOUNDER_HANDLE}`,
        );
        if (founderUserId) {
          await stub.fetch("https://do.internal/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: founderUserId }),
          });

          const founderDoId = c.env.USER_DO.idFromName(founderUserId);
          const founderStub = c.env.USER_DO.get(founderDoId);
          await founderStub.fetch("https://do.internal/add-follower", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });

          const feedDoId = c.env.FEED_DO.idFromName(userId);
          const feedStub = c.env.FEED_DO.get(feedDoId);
          const cutoffTime = Date.now() - RETENTION.FEED_ENTRIES;

          const founderPostsIndex = await c.env.POSTS_KV.get(
            `user-posts:${founderUserId}`,
          );
          if (founderPostsIndex) {
            const postIds: string[] = JSON.parse(founderPostsIndex);
            let addedCount = 0;
            for (const postId of postIds.slice(0, 20)) {
              if (addedCount >= 10) break;
              const postData = await c.env.POSTS_KV.get(`post:${postId}`);
              if (!postData) continue;
              const post: PostMetadata = JSON.parse(postData);
              if (post.isDeleted || post.createdAt < cutoffTime) continue;
              await feedStub.fetch("https://do.internal/add-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  entry: {
                    postId: post.id,
                    authorId: post.authorId,
                    timestamp: post.createdAt,
                    source: "follow",
                  },
                }),
              });
              addedCount++;
            }
          }
        }
      } catch (err) {
        log.warn("Failed to auto-follow founder", { error: err });
      }
    }

    await indexUser(c.env, userId, handle, handle);

    log.info("Clerk onboarding complete", { userId, handle, clerkUserId });

    return success(
      {
        status: "linked",
        user: {
          id: userId,
          email,
          handle,
          displayName: handle,
          isAdmin: defaultProfile.isAdmin || undefined,
        },
      },
      201,
    );
  },
);

export default clerkAuth;
