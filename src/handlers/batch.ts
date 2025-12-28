import { Hono } from "hono";
import type { Env } from "../types/env";
import type { UserProfile } from "../types/user";
import type { PostMetadata } from "../types/post";
import { requireAuth } from "../middleware/auth";
import { rateLimit, RATE_LIMITS } from "../middleware/rate-limit";
import { batchKVGet, sanitizeIds } from "../utils/batch";
import { safeJsonParse } from "../utils/safe-parse";
import { success, error } from "../utils/response";
import { PLACEHOLDERS } from "../constants";

const batch = new Hono<{ Bindings: Env }>();

const MAX_BATCH_SIZE = 100;

batch.post("/profiles", requireAuth, rateLimit(RATE_LIMITS.api), async (c) => {
  let body: { handles?: string[]; userIds?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return error("Invalid JSON body");
  }

  const handles = sanitizeIds(body.handles, MAX_BATCH_SIZE);
  const userIds = sanitizeIds(body.userIds, MAX_BATCH_SIZE);

  if (handles.length === 0 && userIds.length === 0) {
    return success({ profiles: {} });
  }

  const profiles: Record<string, UserProfile | null> = {};

  if (handles.length > 0) {
    const keys = handles.map((h) => `profile:${h.toLowerCase()}`);
    const kvResults = await batchKVGet<UserProfile>(c.env, keys, "USERS_KV", {
      parse: (val) => (val ? safeJsonParse<UserProfile>(val) : null),
    });

    for (const handle of handles) {
      const key = `profile:${handle.toLowerCase()}`;
      const profile = kvResults.get(key) ?? null;
      if (profile) {
        profile.avatarUrl = profile.avatarUrl || PLACEHOLDERS.AVATAR;
        profile.bannerUrl = profile.bannerUrl || PLACEHOLDERS.BANNER;
      }
      profiles[handle] = profile;
    }
  }

  if (userIds.length > 0) {
    const keys = userIds.map((id) => `user:${id}`);
    const userToHandleMap = await batchKVGet<string>(c.env, keys, "USERS_KV", {
      parse: (val) => val,
    });

    const handlesToFetch: string[] = [];
    const idToHandleMap = new Map<string, string>();

    for (const userId of userIds) {
      const handle = userToHandleMap.get(`user:${userId}`);
      if (handle && !profiles[userId]) {
        handlesToFetch.push(handle);
        idToHandleMap.set(userId, handle);
      }
    }

    if (handlesToFetch.length > 0) {
      const profileKeys = handlesToFetch.map((h) => `profile:${h}`);
      const profileResults = await batchKVGet<UserProfile>(
        c.env,
        profileKeys,
        "USERS_KV",
        {
          parse: (val) => (val ? safeJsonParse<UserProfile>(val) : null),
        },
      );

      for (const userId of userIds) {
        const handle = idToHandleMap.get(userId);
        if (handle) {
          const profile = profileResults.get(`profile:${handle}`) ?? null;
          if (profile) {
            profile.avatarUrl = profile.avatarUrl || PLACEHOLDERS.AVATAR;
            profile.bannerUrl = profile.bannerUrl || PLACEHOLDERS.BANNER;
          }
          profiles[userId] = profile;
        }
      }
    }
  }

  return success({ profiles });
});

batch.post("/posts", requireAuth, rateLimit(RATE_LIMITS.api), async (c) => {
  const userId = c.get("userId");

  let body: { postIds?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return error("Invalid JSON body");
  }

  const postIds = sanitizeIds(body.postIds, MAX_BATCH_SIZE);

  if (postIds.length === 0) {
    return success({ posts: {}, liked: {}, reposted: {} });
  }

  const keys = postIds.map((id) => `post:${id}`);
  const kvResults = await batchKVGet<PostMetadata>(c.env, keys, "POSTS_KV", {
    parse: (val) => (val ? safeJsonParse<PostMetadata>(val) : null),
  });

  const posts: Record<string, PostMetadata | null> = {};
  for (const postId of postIds) {
    posts[postId] = kvResults.get(`post:${postId}`) ?? null;
  }

  let liked: Record<string, boolean> = {};
  let reposted: Record<string, boolean> = {};

  if (userId) {
    try {
      const userStubId = c.env.USER_DO.idFromName(userId);
      const userStub = c.env.USER_DO.get(userStubId);

      const [likedRes, repostedRes] = await Promise.all([
        userStub.fetch("https://user-do/batch-has-liked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postIds }),
        }),
        userStub.fetch("https://user-do/batch-has-reposted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postIds }),
        }),
      ]);

      if (likedRes.ok) {
        const likedData = (await likedRes.json()) as {
          liked: Record<string, boolean>;
        };
        liked = likedData.liked;
      }

      if (repostedRes.ok) {
        const repostedData = (await repostedRes.json()) as {
          reposted: Record<string, boolean>;
        };
        reposted = repostedData.reposted;
      }
    } catch {
      // Non-fatal: continue without interaction data
    }
  }

  return success({ posts, liked, reposted });
});

export default batch;
