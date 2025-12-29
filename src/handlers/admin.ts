/**
 * Admin dashboard handlers for The Wire
 * Provides stats, user management, and post management for admins
 */

import { Hono, type Context } from "hono";
import type { Env } from "../types/env";
import type { UserProfile } from "../types/user";
import type { PostMetadata } from "../types/post";
import { requireAuth } from "../middleware/auth";
import { BATCH_SIZE } from "../constants";
import { batchKVGet } from "../utils/batch";
import { safeJsonParse } from "../utils/safe-parse";
import { logger } from "../utils/logger";

type HonoContext = Context<{ Bindings: Env }>;

const admin = new Hono<{ Bindings: Env }>();

/**
 * Middleware to require admin role
 */
async function requireAdmin(
  c: HonoContext,
  next: () => Promise<void>,
): Promise<Response | void> {
  const userId = c.get("userId");

  if (!userId) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    const response = await stub.fetch("https://do.internal/is-admin");
    const data = (await response.json()) as { isAdmin: boolean };

    if (!data.isAdmin) {
      return c.json(
        { success: false, error: "Admin privileges required" },
        403,
      );
    }

    await next();
  } catch (error) {
    logger.error("Error checking admin status", error, { userId });
    return c.json(
      { success: false, error: "Error verifying admin status" },
      500,
    );
  }
}

/**
 * GET /api/admin/stats - Get dashboard statistics
 */
admin.get("/stats", requireAuth, requireAdmin, async (c) => {
  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const userKeys: string[] = [];
    let userCursor: string | undefined;
    do {
      const userList = await c.env.USERS_KV.list({
        prefix: "user:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: userCursor ?? null,
      });
      userKeys.push(...userList.keys.map((k) => k.name));
      userCursor = userList.list_complete ? undefined : userList.cursor;
    } while (userCursor);

    const postKeys: string[] = [];
    let postCursor: string | undefined;
    do {
      const postList = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: postCursor ?? null,
      });
      postKeys.push(...postList.keys.map((k) => k.name));
      postCursor = postList.list_complete ? undefined : postList.cursor;
    } while (postCursor);

    const [userDataMap, postDataMap] = await Promise.all([
      batchKVGet(c.env, userKeys, "USERS_KV"),
      batchKVGet(c.env, postKeys, "POSTS_KV"),
    ]);

    const handles: string[] = [];
    for (const [, data] of userDataMap) {
      const user = safeJsonParse<{ handle: string; createdAt?: number }>(data);
      if (user?.handle) handles.push(user.handle);
    }

    const profileKeys = handles.map((h) => `profile:${h}`);
    const profileDataMap = await batchKVGet(c.env, profileKeys, "USERS_KV");
    const profileByHandle = new Map<string, UserProfile>();
    for (const [key, data] of profileDataMap) {
      const handle = key.replace("profile:", "");
      const profile = safeJsonParse<UserProfile>(data);
      if (profile) profileByHandle.set(handle, profile);
    }

    let totalUsers = 0;
    let bannedUsers = 0;
    let usersLast24h = 0;
    for (const [, data] of userDataMap) {
      const user = safeJsonParse<{ handle: string; createdAt?: number }>(data);
      if (!user) continue;
      totalUsers++;
      const profile = profileByHandle.get(user.handle);
      if (profile) {
        if (profile.isBanned) bannedUsers++;
        if (profile.joinedAt && profile.joinedAt > oneDayAgo) usersLast24h++;
      } else if (user.createdAt && user.createdAt > oneDayAgo) {
        usersLast24h++;
      }
    }

    let totalPosts = 0;
    let takenDownPosts = 0;
    let totalLikes = 0;
    let totalReposts = 0;
    let postsLast24h = 0;
    for (const [, data] of postDataMap) {
      const post = safeJsonParse<PostMetadata>(data);
      if (!post) continue;
      if (!post.isDeleted) {
        totalPosts++;
        totalLikes += post.likeCount || 0;
        totalReposts += post.repostCount || 0;
        if (post.createdAt > oneDayAgo) postsLast24h++;
      }
      if (post.isTakenDown) takenDownPosts++;
    }

    return c.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          banned: bannedUsers,
          last24h: usersLast24h,
        },
        posts: {
          total: totalPosts,
          takenDown: takenDownPosts,
          last24h: postsLast24h,
        },
        engagement: { totalLikes, totalReposts },
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    logger.error("Error fetching admin stats", error);
    return c.json({ success: false, error: "Error fetching statistics" }, 500);
  }
});

/**
 * GET /api/admin/users - List all users with optional search
 */
admin.get("/users", requireAuth, requireAdmin, async (c) => {
  const search = c.req.query("q")?.toLowerCase();
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const filter = c.req.query("filter");

  try {
    const userKeys: string[] = [];
    let userCursor: string | undefined;
    do {
      const userList = await c.env.USERS_KV.list({
        prefix: "user:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: userCursor ?? null,
      });
      userKeys.push(...userList.keys.map((k) => k.name));
      userCursor = userList.list_complete ? undefined : userList.cursor;
    } while (userCursor);

    const userDataMap = await batchKVGet(c.env, userKeys, "USERS_KV");

    const handles: string[] = [];
    for (const [, data] of userDataMap) {
      const user = safeJsonParse<{ handle: string }>(data);
      if (user?.handle) handles.push(user.handle);
    }

    const profileKeys = handles.map((h) => `profile:${h}`);
    const profileDataMap = await batchKVGet(c.env, profileKeys, "USERS_KV");

    const users: UserProfile[] = [];
    for (const handle of handles) {
      const profileData = profileDataMap.get(`profile:${handle}`);
      if (!profileData) continue;
      const profile = safeJsonParse<UserProfile>(profileData);
      if (!profile) continue;

      if (filter === "banned" && !profile.isBanned) continue;
      if (filter === "admin" && !profile.isAdmin) continue;

      if (search) {
        const searchMatch =
          profile.handle.toLowerCase().includes(search) ||
          profile.displayName.toLowerCase().includes(search) ||
          (profile.bio && profile.bio.toLowerCase().includes(search));
        if (!searchMatch) continue;
      }

      users.push(profile);
    }

    users.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
    const paginatedUsers = users.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        users: paginatedUsers,
        total: users.length,
        limit,
        offset,
        hasMore: offset + limit < users.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching users", error);
    return c.json({ success: false, error: "Error fetching users" }, 500);
  }
});

/**
 * GET /api/admin/users/:handle - Get detailed user info
 */
admin.get("/users/:handle", requireAuth, requireAdmin, async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  try {
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const profileData = await c.env.USERS_KV.get(`profile:${handle}`);
    if (!profileData) {
      return c.json({ success: false, error: "Profile not found" }, 404);
    }

    const profile: UserProfile = JSON.parse(profileData);

    // Get additional stats from UserDO
    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    const [followingResp, followersResp] = await Promise.all([
      stub.fetch("https://do.internal/following"),
      stub.fetch("https://do.internal/followers"),
    ]);

    const followingData = (await followingResp.json()) as {
      following: string[];
    };
    const followersData = (await followersResp.json()) as {
      followers: string[];
    };

    return c.json({
      success: true,
      data: {
        ...profile,
        followingCount: followingData.following?.length || 0,
        followerCount: followersData.followers?.length || 0,
      },
    });
  } catch (error) {
    logger.error("Error fetching user", error);
    return c.json({ success: false, error: "Error fetching user" }, 500);
  }
});

/**
 * PUT /api/admin/users/:handle - Update user profile (admin override)
 */
admin.put("/users/:handle", requireAuth, requireAdmin, async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  let body: Partial<UserProfile>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  try {
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    // Only allow certain fields to be updated
    const allowedFields = [
      "displayName",
      "bio",
      "location",
      "website",
      "isVerified",
    ];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field as keyof UserProfile] !== undefined) {
        updates[field] = body[field as keyof UserProfile];
      }
    }

    if (Object.keys(updates).length === 0) {
      return c.json(
        { success: false, error: "No valid fields to update" },
        400,
      );
    }

    await stub.fetch("https://do.internal/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    return c.json({
      success: true,
      data: { message: `User @${handle} updated successfully` },
    });
  } catch (error) {
    logger.error("Error updating user", error);
    return c.json({ success: false, error: "Error updating user" }, 500);
  }
});

/**
 * DELETE /api/admin/users/:handle - Delete a user account
 */
admin.delete("/users/:handle", requireAuth, requireAdmin, async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  try {
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Check if target is admin
    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    const adminResp = await stub.fetch("https://do.internal/is-admin");
    const adminData = (await adminResp.json()) as { isAdmin: boolean };

    if (adminData.isAdmin) {
      return c.json(
        { success: false, error: "Cannot delete admin accounts" },
        403,
      );
    }

    // Get user email for cleanup
    const userData = await c.env.USERS_KV.get(`user:${userId}`);
    let email: string | undefined;
    if (userData) {
      const user = JSON.parse(userData);
      email = user.email;
    }

    // Delete all user data from KV
    await Promise.all([
      c.env.USERS_KV.delete(`user:${userId}`),
      c.env.USERS_KV.delete(`handle:${handle}`),
      c.env.USERS_KV.delete(`profile:${handle}`),
      email ? c.env.USERS_KV.delete(`email:${email}`) : Promise.resolve(),
    ]);

    return c.json({
      success: true,
      data: { message: `User @${handle} has been deleted` },
    });
  } catch (error) {
    logger.error("Error deleting user", error);
    return c.json({ success: false, error: "Error deleting user" }, 500);
  }
});

/**
 * GET /api/admin/posts - List all posts with optional search
 */
admin.get("/posts", requireAuth, requireAdmin, async (c) => {
  const search = c.req.query("q")?.toLowerCase();
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const filter = c.req.query("filter");

  try {
    const postKeys: string[] = [];
    let postCursor: string | undefined;
    do {
      const postList = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: postCursor ?? null,
      });
      postKeys.push(...postList.keys.map((k) => k.name));
      postCursor = postList.list_complete ? undefined : postList.cursor;
    } while (postCursor);

    const postDataMap = await batchKVGet(c.env, postKeys, "POSTS_KV");

    const posts: PostMetadata[] = [];
    for (const [, data] of postDataMap) {
      const post = safeJsonParse<PostMetadata>(data);
      if (!post) continue;

      if (filter === "taken-down" && !post.isTakenDown) continue;
      if (filter === "deleted" && !post.isDeleted) continue;

      if (search) {
        const searchMatch =
          post.content?.toLowerCase().includes(search) ||
          post.authorHandle?.toLowerCase().includes(search) ||
          post.id.includes(search);
        if (!searchMatch) continue;
      }

      posts.push(post);
    }

    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const paginatedPosts = posts.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        posts: paginatedPosts,
        total: posts.length,
        limit,
        offset,
        hasMore: offset + limit < posts.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching posts", error);
    return c.json({ success: false, error: "Error fetching posts" }, 500);
  }
});

/**
 * GET /api/admin/posts/:id - Get detailed post info
 */
admin.get("/posts/:id", requireAuth, requireAdmin, async (c) => {
  const postId = c.req.param("id");

  try {
    const postData = await c.env.POSTS_KV.get(`post:${postId}`);
    if (!postData) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    const post: PostMetadata = JSON.parse(postData);

    return c.json({
      success: true,
      data: post,
    });
  } catch (error) {
    logger.error("Error fetching post", error);
    return c.json({ success: false, error: "Error fetching post" }, 500);
  }
});

/**
 * POST /api/admin/posts/:id/restore - Restore a taken-down post
 */
admin.post("/posts/:id/restore", requireAuth, requireAdmin, async (c) => {
  const postId = c.req.param("id");

  try {
    const postData = await c.env.POSTS_KV.get(`post:${postId}`);
    if (!postData) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    const post: PostMetadata = JSON.parse(postData);

    if (!post.isTakenDown) {
      return c.json({ success: false, error: "Post is not taken down" }, 400);
    }

    // Restore the post
    post.isTakenDown = false;
    post.isDeleted = false;
    delete post.takenDownAt;
    delete post.takenDownReason;

    await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(post));

    return c.json({
      success: true,
      data: { message: "Post has been restored" },
    });
  } catch (error) {
    logger.error("Error restoring post", error);
    return c.json({ success: false, error: "Error restoring post" }, 500);
  }
});

/**
 * DELETE /api/admin/posts/:id - Permanently delete a post
 */
admin.delete("/posts/:id", requireAuth, requireAdmin, async (c) => {
  const postId = c.req.param("id");

  try {
    const postData = await c.env.POSTS_KV.get(`post:${postId}`);
    if (!postData) {
      return c.json({ success: false, error: "Post not found" }, 404);
    }

    // Delete from KV
    await c.env.POSTS_KV.delete(`post:${postId}`);

    return c.json({
      success: true,
      data: { message: "Post has been permanently deleted" },
    });
  } catch (error) {
    logger.error("Error deleting post", error);
    return c.json({ success: false, error: "Error deleting post" }, 500);
  }
});

/**
 * POST /api/admin/repair/refresh-explore - Manually refresh the explore feed rankings
 * Optimized to avoid subrequest limits by using batched KV gets
 */
admin.post("/repair/refresh-explore", requireAuth, requireAdmin, async (c) => {
  try {
    // First, list all post keys
    const allKeys: string[] = [];
    let cursor: string | undefined;
    const maxBatches = 20;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: cursor ?? null,
      });
      batchCount++;
      allKeys.push(...listResult.keys.map((k) => k.name));

      if (listResult.list_complete) break;
      cursor = listResult.cursor;
    }

    // Batch fetch all posts using our optimized batchKVGet
    const postMap = await batchKVGet<PostMetadata>(c.env, allKeys, "POSTS_KV", {
      parse: (val) => (val ? safeJsonParse<PostMetadata>(val) : null),
    });

    const scoredPosts: Array<{
      post: PostMetadata;
      score: number;
      authorId: string;
    }> = [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const LN2 = Math.log(2);

    for (const [, post] of postMap) {
      if (!post) continue;
      if (post.isDeleted || post.isTakenDown) continue;
      // Only include posts from last 7 days
      if (post.createdAt < sevenDaysAgo) continue;

      const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
      const recency = Math.exp((-LN2 * ageHours) / 12); // 12 hour half-life
      const engagement =
        (post.likeCount || 0) * 2 +
        (post.replyCount || 0) * 3 +
        (post.repostCount || 0) * 2;
      const engScore = Math.log1p(engagement);
      const engDecay = Math.exp((-LN2 * ageHours) / 24); // 24 hour half-life
      const score = 50 * recency + 30 * engScore * engDecay;

      scoredPosts.push({ post, score, authorId: post.authorId });
    }

    // Sort by score descending
    scoredPosts.sort((a, b) => b.score - a.score);

    // Apply author diversity: max 2 posts per author in any 5-post window
    const diversePosts: typeof scoredPosts = [];
    const pending = [...scoredPosts];
    const windowSize = 5;
    const maxPerAuthorInWindow = 2;

    while (pending.length > 0 && diversePosts.length < 200) {
      let added = false;

      for (let i = 0; i < pending.length; i++) {
        const postItem = pending[i]!;

        const windowStart = Math.max(0, diversePosts.length - windowSize + 1);
        const window = diversePosts.slice(windowStart);
        const authorCountInWindow = window.filter(
          (p) => p.authorId === postItem.authorId,
        ).length;

        if (authorCountInWindow < maxPerAuthorInWindow) {
          diversePosts.push(postItem);
          pending.splice(i, 1);
          added = true;
          break;
        }
      }

      if (!added && pending.length > 0) {
        diversePosts.push(pending.shift()!);
      }
    }

    // Store in KV - full post data for instant loading
    const cacheData = diversePosts.map((p) => p.post);
    await c.env.FEEDS_KV.put("explore:ranked", JSON.stringify(cacheData), {
      expirationTtl: 900, // 15 minutes
    });

    return c.json({
      success: true,
      data: {
        message: "Explore feed refreshed",
        totalPostsScanned: allKeys.length,
        postsInTimeRange: scoredPosts.length,
        postsInFeed: cacheData.length,
        topPosts: cacheData.slice(0, 5).map((p) => ({
          id: p.id,
          authorHandle: p.authorHandle,
          content: p.content?.substring(0, 50),
          createdAt: new Date(p.createdAt).toISOString(),
        })),
      },
    });
  } catch (error) {
    logger.error("Error refreshing explore", error);
    return c.json(
      {
        success: false,
        error: `Error refreshing explore feed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      500,
    );
  }
});

/**
 * POST /api/admin/repair/user/:handle/clean-nulls - Remove null entries from following/followers arrays
 */
admin.post(
  "/repair/user/:handle/clean-nulls",
  requireAuth,
  requireAdmin,
  async (c) => {
    const handle = c.req.param("handle").toLowerCase();

    try {
      const userId = await c.env.USERS_KV.get(`handle:${handle}`);
      if (!userId) {
        return c.json({ success: false, error: "User not found" }, 404);
      }

      const doId = c.env.USER_DO.idFromName(userId);
      const stub = c.env.USER_DO.get(doId);

      // Get current following/followers
      const [followingResp, followersResp] = await Promise.all([
        stub.fetch("https://do.internal/following"),
        stub.fetch("https://do.internal/followers"),
      ]);

      const { following } = (await followingResp.json()) as {
        following: (string | null)[];
      };
      const { followers } = (await followersResp.json()) as {
        followers: (string | null)[];
      };

      // Count nulls before cleaning
      const nullsInFollowing = following.filter(
        (id) => id === null || id === undefined,
      ).length;
      const nullsInFollowers = followers.filter(
        (id) => id === null || id === undefined,
      ).length;

      // Call the DO's clean-nulls endpoint
      const cleanResp = await stub.fetch("https://do.internal/clean-nulls", {
        method: "POST",
      });
      const cleanResult = (await cleanResp.json()) as {
        removedFromFollowing: number;
        removedFromFollowers: number;
        followingCount: number;
        followerCount: number;
      };

      // Clear cache
      await c.env.USERS_KV.delete(`profile:${handle}`);

      return c.json({
        success: true,
        data: {
          message: `Cleaned nulls for @${handle}`,
          nullsFoundInFollowing: nullsInFollowing,
          nullsFoundInFollowers: nullsInFollowers,
          ...cleanResult,
        },
      });
    } catch (error) {
      logger.error("Error cleaning nulls", error);
      return c.json({ success: false, error: "Error cleaning nulls" }, 500);
    }
  },
);

/**
 * POST /api/admin/repair/rebuild-user-kv - Rebuild user:{id} KV entries for all users
 * This fixes the issue where seeded users might not have user:{id} entries
 */
admin.post("/repair/rebuild-user-kv", requireAuth, requireAdmin, async (c) => {
  try {
    // Get all handle:{handle} entries
    const handleKeys: string[] = [];
    let handleCursor: string | undefined;
    do {
      const handleList = await c.env.USERS_KV.list({
        prefix: "handle:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: handleCursor ?? null,
      });
      handleKeys.push(...handleList.keys.map((k) => k.name));
      handleCursor = handleList.list_complete ? undefined : handleList.cursor;
    } while (handleCursor);

    const results: Array<{
      handle: string;
      userId: string;
      hadUserEntry: boolean;
      created: boolean;
    }> = [];

    for (const handleKey of handleKeys) {
      const handle = handleKey.replace("handle:", "");
      const userId = await c.env.USERS_KV.get(handleKey);

      if (!userId) continue;

      // Check if user:{id} entry exists
      const userEntry = await c.env.USERS_KV.get(`user:${userId}`);

      if (!userEntry) {
        // Create user:{id} entry with minimal data
        // We need to get the handle and email from other sources
        const profileData = await c.env.USERS_KV.get(`profile:${handle}`);
        if (profileData) {
          const profile = safeJsonParse<UserProfile>(profileData);
          if (profile) {
            const authUser = {
              id: userId,
              email: `${handle}@seeded.example`, // Placeholder email for seeded users
              handle: handle,
              passwordHash: "", // No password for seeded users
              salt: "",
              createdAt: profile.joinedAt || Date.now(),
            };
            await c.env.USERS_KV.put(
              `user:${userId}`,
              JSON.stringify(authUser),
            );
            results.push({
              handle,
              userId,
              hadUserEntry: false,
              created: true,
            });
          }
        }
      } else {
        results.push({ handle, userId, hadUserEntry: true, created: false });
      }
    }

    const createdCount = results.filter((r) => r.created).length;

    return c.json({
      success: true,
      data: {
        message: `Rebuilt user KV entries`,
        totalUsers: results.length,
        createdEntries: createdCount,
        results,
      },
    });
  } catch (error) {
    logger.error("Error rebuilding user KV", error);
    return c.json({ success: false, error: "Error rebuilding user KV" }, 500);
  }
});

/**
 * POST /api/admin/repair/rebuild-profile-cache - Rebuild profile:{handle} KV entries from DOs
 */
admin.post(
  "/repair/rebuild-profile-cache",
  requireAuth,
  requireAdmin,
  async (c) => {
    try {
      // Get all handle:{handle} entries
      const handleKeys: string[] = [];
      let handleCursor: string | undefined;
      do {
        const handleList = await c.env.USERS_KV.list({
          prefix: "handle:",
          limit: BATCH_SIZE.KV_LIST,
          cursor: handleCursor ?? null,
        });
        handleKeys.push(...handleList.keys.map((k) => k.name));
        handleCursor = handleList.list_complete ? undefined : handleList.cursor;
      } while (handleCursor);

      const results: Array<{
        handle: string;
        hadCachedProfile: boolean;
        cached: boolean;
      }> = [];

      for (const handleKey of handleKeys) {
        const handle = handleKey.replace("handle:", "");
        const userId = await c.env.USERS_KV.get(handleKey);

        if (!userId) continue;

        // Check if profile cache exists
        const existingProfile = await c.env.USERS_KV.get(`profile:${handle}`);
        const hadCachedProfile = !!existingProfile;

        // Fetch fresh profile from DO and cache it
        try {
          const doId = c.env.USER_DO.idFromName(userId);
          const stub = c.env.USER_DO.get(doId);
          const response = await stub.fetch("https://do.internal/profile");
          const profile = await response.json();

          // Cache the profile
          await c.env.USERS_KV.put(
            `profile:${handle}`,
            JSON.stringify(profile),
            { expirationTtl: 3600 }, // 1 hour TTL
          );

          results.push({ handle, hadCachedProfile, cached: true });
        } catch (err) {
          logger.error("Error caching profile", err, { handle });
          results.push({ handle, hadCachedProfile, cached: false });
        }
      }

      const cachedCount = results.filter((r) => r.cached).length;
      const alreadyCachedCount = results.filter(
        (r) => r.hadCachedProfile,
      ).length;

      return c.json({
        success: true,
        data: {
          message: "Rebuilt profile cache",
          totalUsers: results.length,
          alreadyCached: alreadyCachedCount,
          newlyCached: cachedCount - alreadyCachedCount,
          results,
        },
      });
    } catch (error) {
      logger.error("Error rebuilding profile cache", error);
      return c.json(
        { success: false, error: "Error rebuilding profile cache" },
        500,
      );
    }
  },
);

/**
 * GET /api/admin/debug/following/:handle - Debug following resolution
 */
admin.get("/debug/following/:handle", requireAuth, requireAdmin, async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  try {
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    const followingResp = await stub.fetch("https://do.internal/following");
    const { following } = (await followingResp.json()) as {
      following: string[];
    };

    // Step 1: Get user entries
    const userKeys = following.map((id) => `user:${id}`);
    const userMap = await batchKVGet(c.env, userKeys, "USERS_KV", {
      parse: (val) =>
        val
          ? safeJsonParse<{ id: string; handle: string; email: string }>(val)
          : null,
    });

    // Step 2: Extract handles
    const handlesToFetch: string[] = [];
    const idToHandle = new Map<string, string>();
    const userLookupResults: Array<{
      userId: string;
      foundUser: boolean;
      handle: string | null;
    }> = [];

    for (const followingId of following) {
      const authUser = userMap.get(`user:${followingId}`);
      userLookupResults.push({
        userId: followingId,
        foundUser: !!authUser,
        handle: authUser?.handle || null,
      });
      if (authUser?.handle) {
        handlesToFetch.push(authUser.handle);
        idToHandle.set(followingId, authUser.handle);
      }
    }

    // Step 3: Get profiles
    const profileKeys = handlesToFetch.map((h) => `profile:${h}`);
    const profileMap = await batchKVGet<UserProfile>(
      c.env,
      profileKeys,
      "USERS_KV",
      {
        parse: (val) => (val ? safeJsonParse<UserProfile>(val) : null),
      },
    );

    const profileLookupResults: Array<{
      handle: string;
      foundProfile: boolean;
    }> = [];
    for (const h of handlesToFetch) {
      profileLookupResults.push({
        handle: h,
        foundProfile: !!profileMap.get(`profile:${h}`),
      });
    }

    return c.json({
      success: true,
      data: {
        followingCount: following.length,
        userLookupResults,
        handlesFound: handlesToFetch.length,
        profileLookupResults,
        profilesFound: profileLookupResults.filter((r) => r.foundProfile)
          .length,
      },
    });
  } catch (error) {
    logger.error("Error debugging following", error);
    return c.json({ success: false, error: "Error debugging following" }, 500);
  }
});

/**
 * GET /api/admin/debug/user/:handle - Debug user's DO state
 */
admin.get("/debug/user/:handle", requireAuth, requireAdmin, async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  try {
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    const [profileResp, followingResp, followersResp, settingsResp] =
      await Promise.all([
        stub.fetch("https://do.internal/profile"),
        stub.fetch("https://do.internal/following"),
        stub.fetch("https://do.internal/followers"),
        stub.fetch("https://do.internal/settings"),
      ]);

    const profile = await profileResp.json();
    const { following } = (await followingResp.json()) as {
      following: string[];
    };
    const { followers } = (await followersResp.json()) as {
      followers: string[];
    };
    const settings = await settingsResp.json();

    // Get KV data
    const kvProfile = await c.env.USERS_KV.get(`profile:${handle}`);
    const kvUser = await c.env.USERS_KV.get(`user:${userId}`);

    return c.json({
      success: true,
      data: {
        userId,
        handle,
        doState: {
          profile,
          followingCount: following?.length || 0,
          followerCount: followers?.length || 0,
          following: following || [],
          followers: followers || [],
          settings,
        },
        kvState: {
          profile: kvProfile ? JSON.parse(kvProfile) : null,
          user: kvUser ? JSON.parse(kvUser) : null,
        },
        discrepancies: {
          followingMismatch:
            (profile as { followingCount?: number }).followingCount !==
            (following?.length || 0),
          followersMismatch:
            (profile as { followerCount?: number }).followerCount !==
            (followers?.length || 0),
        },
      },
    });
  } catch (error) {
    logger.error("Error debugging user", error);
    return c.json({ success: false, error: "Error debugging user" }, 500);
  }
});

/**
 * POST /api/admin/repair/user/:handle/rebuild-social - Rebuild social graph from all users
 * Scans all users to find who follows this user and who this user follows
 */
admin.post(
  "/repair/user/:handle/rebuild-social",
  requireAuth,
  requireAdmin,
  async (c) => {
    const handle = c.req.param("handle").toLowerCase();

    try {
      const targetUserId = await c.env.USERS_KV.get(`handle:${handle}`);
      if (!targetUserId) {
        return c.json({ success: false, error: "User not found" }, 404);
      }

      // Get all user IDs
      const userKeys: string[] = [];
      let userCursor: string | undefined;
      do {
        const userList = await c.env.USERS_KV.list({
          prefix: "user:",
          limit: BATCH_SIZE.KV_LIST,
          cursor: userCursor ?? null,
        });
        userKeys.push(...userList.keys.map((k) => k.name.replace("user:", "")));
        userCursor = userList.list_complete ? undefined : userList.cursor;
      } while (userCursor);

      // For each user, check if they follow target or if target follows them
      const foundFollowers: string[] = [];
      const foundFollowing: string[] = [];

      for (const userId of userKeys) {
        if (userId === targetUserId) continue;

        try {
          const doId = c.env.USER_DO.idFromName(userId);
          const stub = c.env.USER_DO.get(doId);

          // Check if this user follows target
          const followingResp = await stub.fetch(
            `https://do.internal/is-following?userId=${targetUserId}`,
          );
          const { isFollowing } = (await followingResp.json()) as {
            isFollowing: boolean;
          };
          if (isFollowing) {
            foundFollowers.push(userId);
          }

          // Check if target follows this user (by checking this user's followers)
          const followersResp = await stub.fetch(
            "https://do.internal/followers",
          );
          const { followers } = (await followersResp.json()) as {
            followers: string[];
          };
          if (followers?.includes(targetUserId)) {
            foundFollowing.push(userId);
          }
        } catch (err) {
          logger.error("Error checking user", err, { userId });
        }
      }

      // Now update target user's DO with the found relationships
      const targetDoId = c.env.USER_DO.idFromName(targetUserId);
      const targetStub = c.env.USER_DO.get(targetDoId);

      // Get current state
      const currentFollowingResp = await targetStub.fetch(
        "https://do.internal/following",
      );
      const currentFollowersResp = await targetStub.fetch(
        "https://do.internal/followers",
      );
      const { following: currentFollowing } =
        (await currentFollowingResp.json()) as { following: string[] };
      const { followers: currentFollowers } =
        (await currentFollowersResp.json()) as { followers: string[] };

      // Add missing followers
      for (const followerId of foundFollowers) {
        if (!currentFollowers?.includes(followerId)) {
          await targetStub.fetch("https://do.internal/add-follower", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: followerId }),
          });
        }
      }

      // Add missing following
      for (const followingId of foundFollowing) {
        if (!currentFollowing?.includes(followingId)) {
          await targetStub.fetch("https://do.internal/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: followingId }),
          });
        }
      }

      // Sync counts
      await targetStub.fetch("https://do.internal/sync-counts", {
        method: "POST",
      });

      // Clear profile cache
      await c.env.USERS_KV.delete(`profile:${handle}`);

      return c.json({
        success: true,
        data: {
          message: `Rebuilt social graph for @${handle}`,
          foundFollowers: foundFollowers.length,
          foundFollowing: foundFollowing.length,
          previousFollowers: currentFollowers?.length || 0,
          previousFollowing: currentFollowing?.length || 0,
        },
      });
    } catch (error) {
      logger.error("Error rebuilding social graph", error);
      return c.json(
        { success: false, error: "Error rebuilding social graph" },
        500,
      );
    }
  },
);

/**
 * POST /api/admin/repair/user/:handle/sync-counts - Sync follower/following counts with arrays
 */
admin.post(
  "/repair/user/:handle/sync-counts",
  requireAuth,
  requireAdmin,
  async (c) => {
    const handle = c.req.param("handle").toLowerCase();

    try {
      const userId = await c.env.USERS_KV.get(`handle:${handle}`);
      if (!userId) {
        return c.json({ success: false, error: "User not found" }, 404);
      }

      const doId = c.env.USER_DO.idFromName(userId);
      const stub = c.env.USER_DO.get(doId);

      const response = await stub.fetch("https://do.internal/sync-counts", {
        method: "POST",
      });
      const data = (await response.json()) as {
        followingCount: number;
        followerCount: number;
      };

      // Clear profile cache
      await c.env.USERS_KV.delete(`profile:${handle}`);

      return c.json({
        success: true,
        data: {
          message: `Synced counts for @${handle}`,
          followingCount: data.followingCount,
          followerCount: data.followerCount,
        },
      });
    } catch (error) {
      logger.error("Error syncing counts", error);
      return c.json({ success: false, error: "Error syncing counts" }, 500);
    }
  },
);

/**
 * GET /api/admin/debug/all-users-social - Get social graph for all users
 */
admin.get("/debug/all-users-social", requireAuth, requireAdmin, async (c) => {
  try {
    // Get all user IDs
    const userKeys: string[] = [];
    let userCursor: string | undefined;
    do {
      const userList = await c.env.USERS_KV.list({
        prefix: "user:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: userCursor ?? null,
      });
      userKeys.push(...userList.keys.map((k) => k.name));
      userCursor = userList.list_complete ? undefined : userList.cursor;
    } while (userCursor);

    const userDataMap = await batchKVGet(c.env, userKeys, "USERS_KV");

    const usersWithSocial: Array<{
      userId: string;
      handle: string;
      followingCount: number;
      followerCount: number;
      actualFollowing: number;
      actualFollowers: number;
      following: string[];
      followers: string[];
    }> = [];

    for (const [key, data] of userDataMap) {
      const userId = key.replace("user:", "");
      const user = safeJsonParse<{ handle: string }>(data);
      if (!user?.handle) continue;

      try {
        const doId = c.env.USER_DO.idFromName(userId);
        const stub = c.env.USER_DO.get(doId);

        const [profileResp, followingResp, followersResp] = await Promise.all([
          stub.fetch("https://do.internal/profile"),
          stub.fetch("https://do.internal/following"),
          stub.fetch("https://do.internal/followers"),
        ]);

        const profile = (await profileResp.json()) as {
          followingCount?: number;
          followerCount?: number;
        };
        const { following } = (await followingResp.json()) as {
          following: string[];
        };
        const { followers } = (await followersResp.json()) as {
          followers: string[];
        };

        usersWithSocial.push({
          userId,
          handle: user.handle,
          followingCount: profile.followingCount || 0,
          followerCount: profile.followerCount || 0,
          actualFollowing: following?.length || 0,
          actualFollowers: followers?.length || 0,
          following: following || [],
          followers: followers || [],
        });
      } catch (err) {
        logger.error("Error fetching social", err, { handle: user.handle });
      }
    }

    return c.json({
      success: true,
      data: {
        users: usersWithSocial,
        totalUsers: usersWithSocial.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching all users social", error);
    return c.json(
      { success: false, error: "Error fetching all users social" },
      500,
    );
  }
});

/**
 * POST /api/admin/repair/rebuild-all-social - Rebuild social graph for all users
 */
admin.post(
  "/repair/rebuild-all-social",
  requireAuth,
  requireAdmin,
  async (c) => {
    try {
      // Get all user IDs and handles
      const userKeys: string[] = [];
      let userCursor: string | undefined;
      do {
        const userList = await c.env.USERS_KV.list({
          prefix: "user:",
          limit: BATCH_SIZE.KV_LIST,
          cursor: userCursor ?? null,
        });
        userKeys.push(...userList.keys.map((k) => k.name));
        userCursor = userList.list_complete ? undefined : userList.cursor;
      } while (userCursor);

      const userDataMap = await batchKVGet(c.env, userKeys, "USERS_KV");

      const userIdToHandle = new Map<string, string>();
      for (const [key, data] of userDataMap) {
        const userId = key.replace("user:", "");
        const user = safeJsonParse<{ handle: string }>(data);
        if (user?.handle) {
          userIdToHandle.set(userId, user.handle);
        }
      }

      const userIds = [...userIdToHandle.keys()];

      // Build a complete map of who follows whom by scanning all DOs
      const followingMap = new Map<string, Set<string>>(); // userId -> Set of userIds they follow
      const followersMap = new Map<string, Set<string>>(); // userId -> Set of userIds who follow them

      for (const userId of userIds) {
        followingMap.set(userId, new Set());
        followersMap.set(userId, new Set());
      }

      // Scan each user's following list
      for (const userId of userIds) {
        try {
          const doId = c.env.USER_DO.idFromName(userId);
          const stub = c.env.USER_DO.get(doId);

          const followingResp = await stub.fetch(
            "https://do.internal/following",
          );
          const { following } = (await followingResp.json()) as {
            following: string[];
          };

          if (following) {
            for (const followedId of following) {
              // Record that userId follows followedId
              followingMap.get(userId)!.add(followedId);
              // Record that followedId has userId as a follower
              if (followersMap.has(followedId)) {
                followersMap.get(followedId)!.add(userId);
              }
            }
          }
        } catch (err) {
          logger.error("Error scanning user", err, { userId });
        }
      }

      // Now update each user's DO with the correct data
      const results: Array<{
        handle: string;
        oldFollowing: number;
        newFollowing: number;
        oldFollowers: number;
        newFollowers: number;
      }> = [];

      for (const userId of userIds) {
        try {
          const handle = userIdToHandle.get(userId)!;
          const doId = c.env.USER_DO.idFromName(userId);
          const stub = c.env.USER_DO.get(doId);

          // Get current state
          const [followingResp, followersResp] = await Promise.all([
            stub.fetch("https://do.internal/following"),
            stub.fetch("https://do.internal/followers"),
          ]);
          const { following: currentFollowing } =
            (await followingResp.json()) as { following: string[] };
          const { followers: currentFollowers } =
            (await followersResp.json()) as { followers: string[] };

          const correctFollowing = followingMap.get(userId)!;
          const correctFollowers = followersMap.get(userId)!;

          // Add missing following
          for (const followingId of correctFollowing) {
            if (!currentFollowing?.includes(followingId)) {
              await stub.fetch("https://do.internal/follow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: followingId }),
              });
            }
          }

          // Add missing followers
          for (const followerId of correctFollowers) {
            if (!currentFollowers?.includes(followerId)) {
              await stub.fetch("https://do.internal/add-follower", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: followerId }),
              });
            }
          }

          // Sync counts
          await stub.fetch("https://do.internal/sync-counts", {
            method: "POST",
          });

          // Clear cache
          await c.env.USERS_KV.delete(`profile:${handle}`);

          results.push({
            handle,
            oldFollowing: currentFollowing?.length || 0,
            newFollowing: correctFollowing.size,
            oldFollowers: currentFollowers?.length || 0,
            newFollowers: correctFollowers.size,
          });
        } catch (err) {
          logger.error("Error updating user", err, { userId });
        }
      }

      return c.json({
        success: true,
        data: {
          message: "Rebuilt social graph for all users",
          results,
        },
      });
    } catch (error) {
      logger.error("Error rebuilding all social", error);
      return c.json(
        { success: false, error: "Error rebuilding all social" },
        500,
      );
    }
  },
);

/**
 * GET /api/admin/cron/refresh-explore - Trigger explore feed refresh (for cron/ops use)
 * Auth options:
 * 1. JWT_SECRET as query param (?secret=xxx)
 * 2. Bearer token from admin user (Authorization: Bearer xxx)
 */
admin.get("/cron/refresh-explore", async (c) => {
  const secret = c.req.query("secret");
  const jwtSecret = c.env.JWT_SECRET;
  const authHeader = c.req.header("Authorization");

  let authorized = false;

  // Option 1: Secret query param
  if (secret && secret === jwtSecret) {
    authorized = true;
  }

  // Option 2: Bearer token auth (verify it's an admin)
  if (!authorized && authHeader?.startsWith("Bearer ") && jwtSecret) {
    const token = authHeader.slice(7);
    try {
      const { verifyToken } = await import("../utils/jwt");
      const payload = await verifyToken(token, jwtSecret);
      if (payload && payload.sub) {
        // Verify this user is an admin
        const doId = c.env.USER_DO.idFromName(payload.sub);
        const stub = c.env.USER_DO.get(doId);
        const resp = await stub.fetch("https://do.internal/is-admin");
        const data = (await resp.json()) as { isAdmin: boolean };
        if (data.isAdmin) {
          authorized = true;
        }
      }
    } catch {
      // Token verification failed, continue to unauthorized
    }
  }

  if (!authorized) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // List all post keys
    const allKeys: string[] = [];
    let cursor: string | undefined;
    const maxBatches = 20;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: cursor ?? null,
      });
      batchCount++;
      allKeys.push(...listResult.keys.map((k) => k.name));

      if (listResult.list_complete) break;
      cursor = listResult.cursor;
    }

    // Batch fetch all posts
    const postMap = await batchKVGet<PostMetadata>(c.env, allKeys, "POSTS_KV", {
      parse: (val) => (val ? safeJsonParse<PostMetadata>(val) : null),
    });

    const scoredPosts: Array<{
      post: PostMetadata;
      score: number;
      authorId: string;
    }> = [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const LN2 = Math.log(2);

    for (const [, post] of postMap) {
      if (!post) continue;
      if (post.isDeleted || post.isTakenDown) continue;
      if (post.createdAt < sevenDaysAgo) continue;

      const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
      const recency = Math.exp((-LN2 * ageHours) / 12);
      const engagement =
        (post.likeCount || 0) * 2 +
        (post.replyCount || 0) * 3 +
        (post.repostCount || 0) * 2;
      const engScore = Math.log1p(engagement);
      const engDecay = Math.exp((-LN2 * ageHours) / 24);
      const score = 50 * recency + 30 * engScore * engDecay;

      scoredPosts.push({ post, score, authorId: post.authorId });
    }

    scoredPosts.sort((a, b) => b.score - a.score);

    // Apply author diversity
    const diversePosts: typeof scoredPosts = [];
    const pending = [...scoredPosts];

    while (pending.length > 0 && diversePosts.length < 200) {
      let added = false;

      for (let i = 0; i < pending.length; i++) {
        const postItem = pending[i]!;
        const windowStart = Math.max(0, diversePosts.length - 4);
        const window = diversePosts.slice(windowStart);
        const authorCountInWindow = window.filter(
          (p) => p.authorId === postItem.authorId,
        ).length;

        if (authorCountInWindow < 2) {
          diversePosts.push(postItem);
          pending.splice(i, 1);
          added = true;
          break;
        }
      }

      if (!added && pending.length > 0) {
        diversePosts.push(pending.shift()!);
      }
    }

    const cacheData = diversePosts.map((p) => p.post);
    await c.env.FEEDS_KV.put("explore:ranked", JSON.stringify(cacheData), {
      expirationTtl: 900,
    });

    return c.json({
      success: true,
      data: {
        message: "Explore feed refreshed",
        postsScanned: allKeys.length,
        postsWithin7Days: scoredPosts.length,
        finalCount: diversePosts.length,
      },
    });
  } catch (error) {
    logger.error("Error in cron refresh-explore", error);
    return c.json(
      {
        success: false,
        error: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      },
      500,
    );
  }
});

export default admin;
