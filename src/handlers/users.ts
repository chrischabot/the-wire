/**
 * User profile handlers for The Wire
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import type { UserProfile, UserSettings } from "../types/user";
import type { PostMetadata } from "../types/post";
import {
  validateDisplayName,
  validateBio,
  sanitizeString,
  normalizeHandle,
} from "../utils/validation";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { rateLimit, RATE_LIMITS } from "../middleware/rate-limit";
import { LIMITS, BATCH_SIZE, CACHE_TTL, PLACEHOLDERS } from "../constants";
import { batchKVGet } from "../utils/batch";
import { createNotification } from "../services/notifications";
import { indexUser, removeUserFromIndex } from "../utils/search-index";
import { safeJsonParse, safeAtob } from "../utils/safe-parse";
import {
  success,
  error,
  notFound,
  forbidden,
  serverError,
} from "../utils/response";
import { logger } from "../utils/logger";

const users = new Hono<{ Bindings: Env }>();

// =====================================================
// IMPORTANT: All /me/* routes MUST come before /:handle
// routes to prevent "me" being matched as a handle param
// =====================================================

/**
 * Update own profile
 */
users.put("/me", requireAuth, async (c) => {
  const userId = c.get("userId");

  let updates: Partial<UserProfile>;
  try {
    updates = await c.req.json();
  } catch {
    return error("Invalid JSON body");
  }

  // Validate updates
  if (updates.displayName !== undefined) {
    const result = validateDisplayName(updates.displayName);
    if (!result.valid) {
      return error(result.error ?? "Invalid display name");
    }
    updates.displayName = sanitizeString(updates.displayName);
  }

  if (updates.bio !== undefined) {
    const result = validateBio(updates.bio);
    if (!result.valid) {
      return error(result.error ?? "Invalid bio");
    }
    updates.bio = sanitizeString(updates.bio);
  }

  if (updates.location !== undefined) {
    updates.location = sanitizeString(updates.location);
  }

  if (updates.website !== undefined) {
    updates.website = sanitizeString(updates.website);
  }

  // Disallow changing immutable fields
  delete updates.id;
  delete updates.handle;
  delete updates.joinedAt;
  delete updates.followerCount;
  delete updates.followingCount;
  delete updates.postCount;
  delete updates.isVerified;

  // Update via UserDO
  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    // Get old profile to compare displayName for search re-indexing
    const oldProfileResp = await stub.fetch("https://do.internal/profile");
    const oldProfile: UserProfile = await oldProfileResp.json();

    const response = await stub.fetch("https://do.internal/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      return serverError("Error updating profile");
    }

    const profile: UserProfile = await response.json();

    // Re-index user if displayName changed
    if (
      updates.displayName !== undefined &&
      updates.displayName !== oldProfile.displayName
    ) {
      await removeUserFromIndex(
        c.env,
        userId,
        profile.handle,
        oldProfile.displayName,
      );
      await indexUser(c.env, userId, profile.handle, profile.displayName);
    }

    return success(profile);
  } catch (error) {
    logger.error("Error updating profile", error, { userId });
    return serverError("Error updating profile");
  }
});

/**
 * Get own settings
 */
users.get("/me/settings", requireAuth, async (c) => {
  const userId = c.get("userId");

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    const response = await stub.fetch("https://do.internal/settings");
    const settings: UserSettings = await response.json();
    return success(settings);
  } catch (err) {
    logger.error("Error fetching settings", err, { userId });
    return serverError("Error fetching settings");
  }
});

/**
 * Update own settings
 */
users.put("/me/settings", requireAuth, async (c) => {
  const userId = c.get("userId");

  let updates: Partial<UserSettings>;
  try {
    updates = await c.req.json();
  } catch {
    return error("Invalid JSON body");
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    const response = await stub.fetch("https://do.internal/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      return serverError("Error updating settings");
    }

    const settings: UserSettings = await response.json();
    return success(settings);
  } catch (err) {
    logger.error("Error updating settings", err, { userId });
    return serverError("Error updating settings");
  }
});

/**
 * GET /api/users/me/blocked - Get blocked users list
 */
users.get("/me/blocked", requireAuth, async (c) => {
  const userId = c.get("userId");

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const blockedResp = await stub.fetch("https://do.internal/blocked");
  const data = (await blockedResp.json()) as { blocked: string[] };

  const blocked = await Promise.all(
    data.blocked.map(async (blockedId: string) => {
      const blockedData = await c.env.USERS_KV.get(`user:${blockedId}`);
      if (blockedData) {
        const authUser =
          safeJsonParse<import("../types/user").AuthUser>(blockedData);
        if (!authUser) return null;
        return { id: blockedId, handle: authUser.handle };
      }
      return null;
    }),
  );

  const validBlocked = blocked.filter(
    (b): b is { id: string; handle: string } => b !== null,
  );

  return c.json({
    success: true,
    data: { blocked: validBlocked, count: validBlocked.length },
  });
});

// =====================================================
// /:handle routes - These MUST come after /me routes
// =====================================================

/**
 * Get user profile by handle
 * Cached in KV for fast global reads
 */
users.get("/:handle", optionalAuth, async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const currentUserId = c.get("userId"); // May be undefined if not authenticated

  // Try KV cache first
  const cacheKey = `profile:${handle}`;
  const cached = await c.env.USERS_KV.get(cacheKey);

  let profile: UserProfile | null = null;

  if (cached) {
    profile = safeJsonParse<UserProfile>(cached);
  }

  if (!profile) {
    // Get user ID by handle
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) {
      return notFound("User not found");
    }

    // Get profile from UserDO
    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    try {
      const response = await stub.fetch("https://do.internal/profile");
      profile = await response.json();

      // Cache in KV (1 hour TTL)
      await c.env.USERS_KV.put(cacheKey, JSON.stringify(profile), {
        expirationTtl: CACHE_TTL.PROFILE,
      });
    } catch (error) {
      logger.error("Error fetching profile from DO", error, { handle });
      return serverError("Error fetching profile");
    }
  }

  if (!profile) {
    return c.json({ success: false, error: "Profile not found" }, 404);
  }

  // Check if current user is following this profile
  let isFollowing = false;
  if (currentUserId && profile.id !== currentUserId) {
    try {
      const currentUserDoId = c.env.USER_DO.idFromName(currentUserId);
      const currentUserStub = c.env.USER_DO.get(currentUserDoId);
      const followResp = await currentUserStub.fetch(
        `https://do.internal/is-following?userId=${profile.id}`,
      );
      const followData = (await followResp.json()) as { isFollowing: boolean };
      isFollowing = followData.isFollowing;
    } catch (error) {
      logger.error("Error checking follow status", error, {
        currentUserId,
        profileId: profile.id,
      });
    }
  }

  // Check privacy settings
  const isOwnProfile = currentUserId === profile.id;

  // Get user settings to check if account is private
  const doId = c.env.USER_DO.idFromName(profile.id);
  const stub = c.env.USER_DO.get(doId);

  let settings: UserSettings | null = null;
  try {
    const settingsResp = await stub.fetch("https://do.internal/settings");
    settings = await settingsResp.json();
  } catch (error) {
    logger.error("Error fetching settings", error, { profileId: profile.id });
  }

  // If account is private and viewer is not the owner and not following, return limited profile
  if (settings?.privateAccount && !isOwnProfile && !isFollowing) {
    return c.json({
      success: true,
      data: {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isPrivate: true,
        isFollowing: false,
        // Don't include bio, location, website, banner, counts, etc.
      },
    });
  }

  return c.json({ success: true, data: { ...profile, isFollowing } });
});

/**
 * POST /api/users/:handle/follow - Follow a user
 */
users.post(
  "/:handle/follow",
  requireAuth,
  rateLimit(RATE_LIMITS.follow),
  async (c) => {
    const currentUserId = c.get("userId");
    const targetHandle = normalizeHandle(c.req.param("handle"));

    const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
    if (!targetUserId) {
      return notFound("User not found");
    }

    if (currentUserId === targetUserId) {
      return error("Cannot follow yourself");
    }

    const targetDoId = c.env.USER_DO.idFromName(targetUserId);
    const targetStub = c.env.USER_DO.get(targetDoId);
    const blockedCheckResponse = await targetStub.fetch(
      `https://do.internal/is-blocked?userId=${currentUserId}`,
    );
    const blockedData = (await blockedCheckResponse.json()) as {
      isBlocked: boolean;
    };

    if (blockedData.isBlocked) {
      return forbidden("Cannot follow this user");
    }

    // Check if target account is private
    const targetSettingsResp = await targetStub.fetch(
      "https://do.internal/settings",
    );
    const targetSettings: UserSettings = await targetSettingsResp.json();

    if (targetSettings.privateAccount) {
      // For now, private accounts can't be followed directly
      // In a full implementation, this would create a follow request
      return c.json(
        {
          success: false,
          error:
            "This account is private. Follow requests are not yet implemented.",
        },
        403,
      );
    }

    const currentDoId = c.env.USER_DO.idFromName(currentUserId);
    const currentStub = c.env.USER_DO.get(currentDoId);

    // Execute both DO updates in parallel to reduce partial failure window
    const [followResult, addFollowerResult] = await Promise.allSettled([
      currentStub.fetch("https://do.internal/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      }),
      targetStub.fetch("https://do.internal/add-follower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      }),
    ]);

    // Check if either operation failed
    if (
      followResult.status === "rejected" ||
      addFollowerResult.status === "rejected"
    ) {
      // Attempt rollback if one succeeded but other failed
      if (
        followResult.status === "fulfilled" &&
        addFollowerResult.status === "rejected"
      ) {
        try {
          await currentStub.fetch("https://do.internal/unfollow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: targetUserId }),
          });
        } catch {
          logger.error("Failed to rollback follow operation", undefined, {
            currentUserId,
            targetUserId,
          });
        }
      }
      return serverError("Failed to complete follow operation");
    }

    await createNotification(c.env, {
      userId: targetUserId,
      type: "follow",
      actorId: currentUserId,
    });

    try {
      const feedDoId = c.env.FEED_DO.idFromName(currentUserId);
      const feedStub = c.env.FEED_DO.get(feedDoId);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const maxBackfillPosts = 20;

      const userPostsIndex = await c.env.POSTS_KV.get(
        `user-posts:${targetUserId}`,
      );
      if (userPostsIndex) {
        const postIds = safeJsonParse<string[]>(userPostsIndex);
        if (postIds) {
          let addedCount = 0;
          for (const postId of postIds.slice(0, maxBackfillPosts * 2)) {
            if (addedCount >= maxBackfillPosts) break;

            const postData = await c.env.POSTS_KV.get(`post:${postId}`);
            if (!postData) continue;

            const post = safeJsonParse<PostMetadata>(postData);
            if (!post || post.isDeleted || post.createdAt < sevenDaysAgo)
              continue;

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
    } catch (backfillErr) {
      logger.error("Failed to backfill posts from followed user", backfillErr, {
        currentUserId,
        targetUserId,
      });
    }

    return c.json({
      success: true,
      data: { message: "Followed successfully" },
    });
  },
);

/**
 * DELETE /api/users/:handle/follow - Unfollow a user
 */
users.delete(
  "/:handle/follow",
  requireAuth,
  rateLimit(RATE_LIMITS.follow),
  async (c) => {
    const currentUserId = c.get("userId");
    const targetHandle = normalizeHandle(c.req.param("handle"));

    const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
    if (!targetUserId) {
      return notFound("User not found");
    }

    // Users cannot unfollow themselves (they always follow themselves)
    if (currentUserId === targetUserId) {
      return error("Cannot unfollow yourself");
    }

    const currentDoId = c.env.USER_DO.idFromName(currentUserId);
    const currentStub = c.env.USER_DO.get(currentDoId);
    const targetDoId = c.env.USER_DO.idFromName(targetUserId);
    const targetStub = c.env.USER_DO.get(targetDoId);

    // Execute both DO updates in parallel to reduce partial failure window
    const [unfollowResult, removeFollowerResult] = await Promise.allSettled([
      currentStub.fetch("https://do.internal/unfollow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      }),
      targetStub.fetch("https://do.internal/remove-follower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      }),
    ]);

    // Check if either operation failed
    if (
      unfollowResult.status === "rejected" ||
      removeFollowerResult.status === "rejected"
    ) {
      // Attempt rollback if one succeeded but other failed
      if (
        unfollowResult.status === "fulfilled" &&
        removeFollowerResult.status === "rejected"
      ) {
        try {
          await currentStub.fetch("https://do.internal/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: targetUserId }),
          });
        } catch {
          logger.error("Failed to rollback unfollow operation", undefined, {
            currentUserId,
            targetUserId,
          });
        }
      }
      return serverError("Failed to complete unfollow operation");
    }

    return c.json({
      success: true,
      data: { message: "Unfollowed successfully" },
    });
  },
);

/**
 * GET /api/users/:handle/followers - Get followers list
 */
users.get("/:handle/followers", optionalAuth, async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const currentUserId = c.get("userId");

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return notFound("User not found");
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const followersResp = await stub.fetch("https://do.internal/followers");
  const data = (await followersResp.json()) as { followers: string[] };

  // Filter out null/empty IDs
  const validFollowerIds = data.followers.filter(
    (id): id is string => id !== null && id !== undefined && id !== "",
  );

  // First try KV cache for user data
  const userKeys = validFollowerIds.map((id) => `user:${id}`);
  const userMap = await batchKVGet(c.env, userKeys, "USERS_KV", {
    parse: (val) =>
      val ? safeJsonParse<import("../types/user").AuthUser>(val) : null,
  });

  const handlesToFetch: string[] = [];
  const idToHandle = new Map<string, string>();
  const missingFromKV: string[] = [];

  for (const followerId of validFollowerIds) {
    const authUser = userMap.get(`user:${followerId}`);
    if (authUser?.handle) {
      handlesToFetch.push(authUser.handle);
      idToHandle.set(followerId, authUser.handle);
    } else {
      missingFromKV.push(followerId);
    }
  }

  // For users missing from KV, fetch directly from their UserDO
  const directProfiles = new Map<string, UserProfile>();
  if (missingFromKV.length > 0) {
    const profileFetches = missingFromKV.map(async (followerId) => {
      try {
        const followerDoId = c.env.USER_DO.idFromName(followerId);
        const followerStub = c.env.USER_DO.get(followerDoId);
        const profileResp = await followerStub.fetch(
          "https://do.internal/profile",
        );
        if (profileResp.ok) {
          const profile = (await profileResp.json()) as UserProfile;
          return { followerId, profile };
        }
      } catch {
        // User DO doesn't exist or errored
      }
      return { followerId, profile: null };
    });

    // Process in chunks of 6 to respect concurrent connection limits
    for (let i = 0; i < profileFetches.length; i += 6) {
      const chunk = profileFetches.slice(i, i + 6);
      const results = await Promise.all(chunk);
      for (const { followerId, profile } of results) {
        if (profile) {
          directProfiles.set(followerId, profile);
          idToHandle.set(followerId, profile.handle);
        }
      }
    }
  }

  const profileKeys = handlesToFetch.map((h) => `profile:${h}`);
  const profileMap = await batchKVGet<UserProfile>(
    c.env,
    profileKeys,
    "USERS_KV",
    {
      parse: (val) => (val ? safeJsonParse<UserProfile>(val) : null),
    },
  );

  // Get current user's following list to determine isFollowing for each profile
  let currentUserFollowing: Set<string> = new Set();
  if (currentUserId) {
    try {
      const currentUserDoId = c.env.USER_DO.idFromName(currentUserId);
      const currentUserStub = c.env.USER_DO.get(currentUserDoId);
      const followingResp = await currentUserStub.fetch(
        "https://do.internal/following",
      );
      const followingData = (await followingResp.json()) as {
        following: string[];
      };
      currentUserFollowing = new Set(followingData.following || []);
    } catch (err) {
      logger.error("Error fetching current user following", err, {
        currentUserId,
      });
    }
  }

  const followers: (UserProfile & { isFollowing?: boolean })[] = [];
  for (const followerId of validFollowerIds) {
    // Try direct profile first (for users missing from KV), then KV cache
    let profile = directProfiles.get(followerId);
    if (!profile) {
      const followerHandle = idToHandle.get(followerId);
      if (followerHandle) {
        profile = profileMap.get(`profile:${followerHandle}`) ?? undefined;
      }
    }

    // Last resort: try fetching from UserDO if still missing
    if (!profile) {
      try {
        const followerDoId = c.env.USER_DO.idFromName(followerId);
        const followerStub = c.env.USER_DO.get(followerDoId);
        const profileResp = await followerStub.fetch(
          "https://do.internal/profile",
        );
        if (profileResp.ok) {
          profile = (await profileResp.json()) as UserProfile;
        }
      } catch {
        // Skip this user
      }
    }

    if (profile) {
      const followerProfile: UserProfile & { isFollowing?: boolean } = {
        ...profile,
        avatarUrl: profile.avatarUrl || PLACEHOLDERS.AVATAR,
        bannerUrl: profile.bannerUrl || PLACEHOLDERS.BANNER,
      };
      if (currentUserId) {
        followerProfile.isFollowing = currentUserFollowing.has(followerId);
      }
      followers.push(followerProfile);
    }
  }

  return c.json({
    success: true,
    data: { followers, count: followers.length },
  });
});

/**
 * GET /api/users/:handle/following - Get following list
 */
users.get("/:handle/following", optionalAuth, async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const currentUserId = c.get("userId");

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return notFound("User not found");
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const followingResp = await stub.fetch("https://do.internal/following");
  const data = (await followingResp.json()) as { following: string[] };

  // Filter out null/empty IDs
  const validFollowingIds = data.following.filter(
    (id): id is string => id !== null && id !== undefined && id !== "",
  );

  // First try KV cache for user data
  const userKeys = validFollowingIds.map((id) => `user:${id}`);
  const userMap = await batchKVGet(c.env, userKeys, "USERS_KV", {
    parse: (val) =>
      val ? safeJsonParse<import("../types/user").AuthUser>(val) : null,
  });

  const handlesToFetch: string[] = [];
  const idToHandle = new Map<string, string>();
  const missingFromKV: string[] = [];

  for (const followingId of validFollowingIds) {
    const authUser = userMap.get(`user:${followingId}`);
    if (authUser?.handle) {
      handlesToFetch.push(authUser.handle);
      idToHandle.set(followingId, authUser.handle);
    } else {
      missingFromKV.push(followingId);
    }
  }

  // For users missing from KV, fetch directly from their UserDO
  const directProfiles = new Map<string, UserProfile>();
  if (missingFromKV.length > 0) {
    const profileFetches = missingFromKV.map(async (followingId) => {
      try {
        const followingDoId = c.env.USER_DO.idFromName(followingId);
        const followingStub = c.env.USER_DO.get(followingDoId);
        const profileResp = await followingStub.fetch(
          "https://do.internal/profile",
        );
        if (profileResp.ok) {
          const profile = (await profileResp.json()) as UserProfile;
          return { followingId, profile };
        }
      } catch {
        // User DO doesn't exist or errored
      }
      return { followingId, profile: null };
    });

    // Process in chunks of 6 to respect concurrent connection limits
    for (let i = 0; i < profileFetches.length; i += 6) {
      const chunk = profileFetches.slice(i, i + 6);
      const results = await Promise.all(chunk);
      for (const { followingId, profile } of results) {
        if (profile) {
          directProfiles.set(followingId, profile);
          idToHandle.set(followingId, profile.handle);
        }
      }
    }
  }

  const profileKeys = handlesToFetch.map((h) => `profile:${h}`);
  const profileMap = await batchKVGet<UserProfile>(
    c.env,
    profileKeys,
    "USERS_KV",
    {
      parse: (val) => (val ? safeJsonParse<UserProfile>(val) : null),
    },
  );

  // Get current user's following list to determine isFollowing for each profile
  let currentUserFollowing: Set<string> = new Set();
  if (currentUserId) {
    try {
      const currentUserDoId = c.env.USER_DO.idFromName(currentUserId);
      const currentUserStub = c.env.USER_DO.get(currentUserDoId);
      const currentFollowingResp = await currentUserStub.fetch(
        "https://do.internal/following",
      );
      const currentFollowingData = (await currentFollowingResp.json()) as {
        following: string[];
      };
      currentUserFollowing = new Set(currentFollowingData.following || []);
    } catch (err) {
      logger.error("Error fetching current user following", err, {
        currentUserId,
      });
    }
  }

  const following: (UserProfile & { isFollowing?: boolean })[] = [];
  for (const followingId of validFollowingIds) {
    // Try direct profile first (for users missing from KV), then KV cache
    let profile = directProfiles.get(followingId);
    if (!profile) {
      const followingHandle = idToHandle.get(followingId);
      if (followingHandle) {
        profile = profileMap.get(`profile:${followingHandle}`) ?? undefined;
      }
    }

    // Last resort: try fetching from UserDO if still missing
    if (!profile) {
      try {
        const followingDoId = c.env.USER_DO.idFromName(followingId);
        const followingStub = c.env.USER_DO.get(followingDoId);
        const profileResp = await followingStub.fetch(
          "https://do.internal/profile",
        );
        if (profileResp.ok) {
          profile = (await profileResp.json()) as UserProfile;
        }
      } catch {
        // Skip this user
      }
    }

    if (profile) {
      const followingProfile: UserProfile & { isFollowing?: boolean } = {
        ...profile,
        avatarUrl: profile.avatarUrl || PLACEHOLDERS.AVATAR,
        bannerUrl: profile.bannerUrl || PLACEHOLDERS.BANNER,
      };
      if (currentUserId) {
        followingProfile.isFollowing = currentUserFollowing.has(followingId);
      }
      following.push(followingProfile);
    }
  }

  return c.json({
    success: true,
    data: { following, count: following.length },
  });
});

/**
 * POST /api/users/:handle/block - Block a user
 */
users.post("/:handle/block", requireAuth, async (c) => {
  const currentUserId = c.get("userId");
  const targetHandle = normalizeHandle(c.req.param("handle"));

  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return notFound("User not found");
  }

  if (currentUserId === targetUserId) {
    return c.json({ success: false, error: "Cannot block yourself" }, 400);
  }

  const currentDoId = c.env.USER_DO.idFromName(currentUserId);
  const currentStub = c.env.USER_DO.get(currentDoId);
  await currentStub.fetch("https://do.internal/block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: targetUserId }),
  });

  return c.json({
    success: true,
    data: { message: "User blocked successfully" },
  });
});

/**
 * DELETE /api/users/:handle/block - Unblock a user
 */
users.delete("/:handle/block", requireAuth, async (c) => {
  const currentUserId = c.get("userId");
  const targetHandle = normalizeHandle(c.req.param("handle"));

  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return notFound("User not found");
  }

  const currentDoId = c.env.USER_DO.idFromName(currentUserId);
  const currentStub = c.env.USER_DO.get(currentDoId);
  await currentStub.fetch("https://do.internal/unblock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: targetUserId }),
  });

  return c.json({
    success: true,
    data: { message: "User unblocked successfully" },
  });
});

/**
 * GET /api/users/:handle/posts - Get user's posts timeline
 * Uses author posts index for fast lookups
 */
users.get("/:handle/posts", optionalAuth, async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );
  const includeReplies = c.req.query("include_replies") === "true";

  // Get user ID by handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return notFound("User not found");
  }

  // Parse cursor (offset-based pagination)
  let offset = 0;
  if (cursor) {
    try {
      const decoded = safeAtob(cursor);
      if (decoded) {
        offset = parseInt(decoded, 10) || 0;
      }
    } catch {
      offset = 0;
    }
  }

  const posts: PostMetadata[] = [];

  // Try fast path: use author posts index
  const authorPostsKey = `user-posts:${userId}`;
  const indexData = await c.env.POSTS_KV.get(authorPostsKey);

  if (indexData) {
    // Fast path: fetch posts from index
    const postIds = safeJsonParse<string[]>(indexData);
    if (!postIds) {
      return c.json({ success: false, error: "Error parsing index data" }, 500);
    }
    const relevantIds = postIds.slice(offset, offset + limit * 2); // Fetch extra for filtering

    const fetchedPosts = await Promise.all(
      relevantIds.map(async (postId) => {
        const postData = await c.env.POSTS_KV.get(`post:${postId}`);
        if (!postData) return null;
        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) return null;
        if (post.isDeleted || post.isTakenDown) return null;
        if (!includeReplies && post.replyToId) return null;
        return post;
      }),
    );

    for (const post of fetchedPosts) {
      if (post && posts.length < limit) {
        posts.push(post);
      }
    }
  } else {
    // Fallback: scan all posts (for users without index yet)
    let postCursor: string | undefined;
    let scannedBatches = 0;
    const maxBatches = 10;

    while (posts.length < limit && scannedBatches < maxBatches) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: postCursor ?? null,
      });
      scannedBatches++;

      for (const key of listResult.keys) {
        if (posts.length >= limit) break;
        const postData = await c.env.POSTS_KV.get(key.name);
        if (!postData) continue;
        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) continue;
        if (post.authorId === userId && !post.isDeleted && !post.isTakenDown) {
          if (includeReplies || !post.replyToId) {
            posts.push(post);
          }
        }
      }

      if (listResult.list_complete) break;
      postCursor = listResult.cursor;
    }

    posts.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Enrich reposts with fresh originalPost data (counts, createdAt)
  const enrichedPosts = await Promise.all(
    posts.slice(0, limit).map(async (post) => {
      if (post.repostOfId && post.originalPost) {
        const originalPostData = await c.env.POSTS_KV.get(
          `post:${post.repostOfId}`,
        );
        if (originalPostData) {
          const freshOriginal = safeJsonParse<PostMetadata>(originalPostData);
          if (freshOriginal) {
            return {
              ...post,
              hasLiked: false,
              originalPost: {
                id: freshOriginal.id,
                authorHandle: freshOriginal.authorHandle,
                authorDisplayName: freshOriginal.authorDisplayName,
                authorAvatarUrl: freshOriginal.authorAvatarUrl,
                content: freshOriginal.content,
                mediaUrls: freshOriginal.mediaUrls,
                createdAt: freshOriginal.createdAt,
                likeCount: freshOriginal.likeCount,
                replyCount: freshOriginal.replyCount,
                repostCount: freshOriginal.repostCount,
              },
            };
          }
        }
      }
      return { ...post, hasLiked: false };
    }),
  );

  // Return posts without hasLiked status - client can fetch lazily if needed
  // This avoids expensive DO calls for each post (stays under subrequest limits)
  const hasMore = posts.length >= limit;
  const nextCursor = hasMore ? btoa(String(offset + limit)) : null;

  return c.json({
    success: true,
    data: {
      items: enrichedPosts,
      nextCursor,
      hasMore,
    },
  });
});

/**
 * GET /api/users/:handle/replies - Get user's replies
 * Returns replies with parent post author info for "Replying to @handle" display
 * OPTIMIZED: Uses user-posts index instead of scanning all posts
 */
users.get("/:handle/replies", optionalAuth, async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return notFound("User not found");
  }

  // Parse cursor (offset-based pagination)
  let offset = 0;
  if (cursor) {
    try {
      const decoded = safeAtob(cursor);
      if (decoded) {
        offset = parseInt(decoded, 10) || 0;
      }
    } catch {
      offset = 0;
    }
  }

  const replies: PostMetadata[] = [];

  // Fast path: use author posts index
  const authorPostsKey = `user-posts:${userId}`;
  const indexData = await c.env.POSTS_KV.get(authorPostsKey);

  if (indexData) {
    // Fast path: fetch posts from index and filter for replies
    const postIds = safeJsonParse<string[]>(indexData);
    if (postIds) {
      // Batch fetch posts using the index
      const postKeys = postIds.map((id) => `post:${id}`);
      const postsMap = await batchKVGet<PostMetadata>(
        c.env,
        postKeys,
        "POSTS_KV",
        {
          parse: (val) => (val ? safeJsonParse<PostMetadata>(val) : null),
        },
      );

      // Filter for replies only
      for (const postId of postIds) {
        const post = postsMap.get(`post:${postId}`);
        if (!post) continue;
        if (post.isDeleted || post.isTakenDown) continue;
        if (post.replyToId) {
          replies.push(post);
        }
      }
    }
  } else {
    // Fallback: scan posts (with limits to prevent timeout)
    let postCursor: string | undefined;
    let scannedBatches = 0;
    const maxBatches = 20;

    while (replies.length < limit + offset && scannedBatches < maxBatches) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: postCursor ?? null,
      });
      scannedBatches++;

      // Batch fetch this chunk of posts
      const keys = listResult.keys.map((k) => k.name);
      const postsMap = await batchKVGet<PostMetadata>(c.env, keys, "POSTS_KV", {
        parse: (val) => (val ? safeJsonParse<PostMetadata>(val) : null),
      });

      for (const key of listResult.keys) {
        const post = postsMap.get(key.name);
        if (!post) continue;
        if (
          post.authorId === userId &&
          !post.isDeleted &&
          !post.isTakenDown &&
          post.replyToId
        ) {
          replies.push(post);
        }
      }

      if (listResult.list_complete) break;
      postCursor = listResult.cursor;
    }
  }

  // Sort by creation time (newest first)
  replies.sort((a, b) => b.createdAt - a.createdAt);

  // Apply pagination
  const paginatedReplies = replies.slice(offset, offset + limit);

  // Batch fetch parent post info for "Replying to @handle" display
  const parentIds = paginatedReplies
    .map((p) => p.replyToId)
    .filter((id): id is string => !!id);
  const parentKeys = [...new Set(parentIds)].map((id) => `post:${id}`);
  const parentsMap = await batchKVGet<PostMetadata>(
    c.env,
    parentKeys,
    "POSTS_KV",
    {
      parse: (val) => (val ? safeJsonParse<PostMetadata>(val) : null),
    },
  );

  const enrichedPosts = paginatedReplies.map((post) => {
    let replyToHandle: string | undefined;
    let replyToDisplayName: string | undefined;

    if (post.replyToId) {
      const parentPost = parentsMap.get(`post:${post.replyToId}`);
      if (parentPost) {
        replyToHandle = parentPost.authorHandle;
        replyToDisplayName = parentPost.authorDisplayName;
      }
    }

    return {
      ...post,
      hasLiked: false,
      replyToHandle,
      replyToDisplayName,
    };
  });

  const hasMore = replies.length > offset + limit;
  const nextCursor = hasMore ? btoa(String(offset + limit)) : null;

  return c.json({
    success: true,
    data: {
      items: enrichedPosts,
      nextCursor,
      hasMore,
    },
  });
});

/**
 * GET /api/users/:handle/media - Get user's posts with media (images/videos)
 */
users.get("/:handle/media", optionalAuth, async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return notFound("User not found");
  }

  // Parse cursor (offset-based pagination)
  let offset = 0;
  if (cursor) {
    try {
      const decoded = safeAtob(cursor);
      if (decoded) {
        offset = parseInt(decoded, 10) || 0;
      }
    } catch {
      offset = 0;
    }
  }

  const posts: PostMetadata[] = [];

  // Try fast path: use author posts index
  const authorPostsKey = `user-posts:${userId}`;
  const indexData = await c.env.POSTS_KV.get(authorPostsKey);

  if (indexData) {
    // Fast path: fetch posts from index
    const postIds = safeJsonParse<string[]>(indexData);
    if (postIds) {
      // Fetch enough posts to account for filtering
      for (const postId of postIds) {
        if (posts.length >= limit + offset) break;

        const postData = await c.env.POSTS_KV.get(`post:${postId}`);
        if (!postData) continue;
        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) continue;
        if (post.isDeleted || post.isTakenDown) continue;
        // Only include posts with media
        if (post.mediaUrls && post.mediaUrls.length > 0) {
          posts.push(post);
        }
      }
    }
  } else {
    // Fallback: scan all posts
    let postCursor: string | undefined;
    let scannedBatches = 0;
    const maxBatches = 20;

    while (posts.length < limit + offset && scannedBatches < maxBatches) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: postCursor ?? null,
      });
      scannedBatches++;

      for (const key of listResult.keys) {
        const postData = await c.env.POSTS_KV.get(key.name);
        if (!postData) continue;
        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) continue;
        if (
          post.authorId === userId &&
          !post.isDeleted &&
          !post.isTakenDown &&
          post.mediaUrls &&
          post.mediaUrls.length > 0
        ) {
          posts.push(post);
        }
      }

      if (listResult.list_complete) break;
      postCursor = listResult.cursor;
    }

    posts.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Apply pagination
  const paginatedPosts = posts.slice(offset, offset + limit);

  const hasMore = posts.length > offset + limit;
  const nextCursor = hasMore ? btoa(String(offset + limit)) : null;

  return c.json({
    success: true,
    data: {
      items: paginatedPosts.map((p) => ({ ...p, hasLiked: false })),
      nextCursor,
      hasMore,
    },
  });
});

/**
 * GET /api/users/:handle/likes - Get posts the user has liked
 * OPTIMIZED: Uses UserDO's liked posts index instead of scanning all posts
 */
users.get("/:handle/likes", async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return notFound("User not found");
  }

  try {
    // Get liked post IDs from UserDO (single subrequest)
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    const likedResp = await userStub.fetch(
      `https://do.internal/liked-posts?limit=${limit}`,
    );
    const { likedPosts } = (await likedResp.json()) as { likedPosts: string[] };

    // Fetch post data from KV (already ordered by recency from UserDO)
    const posts: PostMetadata[] = [];
    for (const postId of likedPosts) {
      const postData = await c.env.POSTS_KV.get(`post:${postId}`);
      if (!postData) continue;
      const post = safeJsonParse<PostMetadata>(postData);
      if (!post || post.isDeleted || post.isTakenDown) continue;
      posts.push({ ...post, hasLiked: true } as PostMetadata & {
        hasLiked: boolean;
      });
      if (posts.length >= limit) break;
    }

    return c.json({
      success: true,
      data: { posts },
    });
  } catch (error) {
    logger.error("Error fetching likes", error, { userId });
    return c.json(
      {
        success: false,
        error: "Error fetching likes",
      },
      500,
    );
  }
});

export default users;
