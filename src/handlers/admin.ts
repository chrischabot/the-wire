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
    console.error("Error checking admin status:", error);
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
    console.error("Error fetching admin stats:", error);
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
    console.error("Error fetching users:", error);
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
    console.error("Error fetching user:", error);
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
    console.error("Error updating user:", error);
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
    console.error("Error deleting user:", error);
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
    console.error("Error fetching posts:", error);
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
    console.error("Error fetching post:", error);
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
    console.error("Error restoring post:", error);
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
    console.error("Error deleting post:", error);
    return c.json({ success: false, error: "Error deleting post" }, 500);
  }
});

export default admin;
