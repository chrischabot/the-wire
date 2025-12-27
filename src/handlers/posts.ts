/**
 * Post handlers for The Wire
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import type { Post, PostMetadata, CreatePostRequest } from "../types/post";
import { validateNoteContent } from "../utils/validation";
import { generateId } from "../services/snowflake";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { rateLimit, RATE_LIMITS } from "../middleware/rate-limit";
import { LIMITS, BATCH_SIZE } from "../constants";
import {
  createNotification,
  createMentionNotifications,
} from "../services/notifications";
import { indexPostContent, removePostFromIndex } from "../utils/search-index";
import {
  success,
  error,
  notFound,
  forbidden,
  serverError,
} from "../utils/response";

const posts = new Hono<{ Bindings: Env }>();

/**
 * POST /api/posts - Create a new post (note)
 */
posts.post("/", requireAuth, rateLimit(RATE_LIMITS.post), async (c) => {
  const userId = c.get("userId");
  const userHandle = c.get("userHandle");

  let body: CreatePostRequest;
  try {
    body = await c.req.json<CreatePostRequest>();
  } catch {
    return error("Invalid JSON body");
  }

  // Validate content
  const maxLength = parseInt(c.env.MAX_NOTE_LENGTH || "280", 10);
  const contentResult = validateNoteContent(body.content, maxLength);
  if (!contentResult.valid) {
    return error(contentResult.error ?? "Invalid content");
  }

  // Create post
  const postId = generateId();
  const now = Date.now();

  const post: Post = {
    id: postId,
    authorId: userId,
    content: body.content.trim(),
    mediaUrls: body.mediaUrls || [],
    ...(body.replyToId && { replyToId: body.replyToId }),
    ...(body.quoteOfId && { quoteOfId: body.quoteOfId }),
    createdAt: now,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
    isDeleted: false,
  };

  // Initialize PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);
  await stub.fetch("https://do.internal/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post }),
  });

  // Get user profile for metadata
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const profileResponse = await userStub.fetch("https://do.internal/profile");
  const profile =
    (await profileResponse.json()) as import("../types/user").UserProfile;

  // Create post metadata for KV
  const metadata: PostMetadata = {
    id: postId,
    authorId: userId,
    authorHandle: userHandle,
    authorDisplayName: profile.displayName || userHandle,
    authorAvatarUrl: profile.avatarUrl || "",
    content: post.content,
    mediaUrls: post.mediaUrls,
    ...(body.replyToId && { replyToId: body.replyToId }),
    ...(body.quoteOfId && { quoteOfId: body.quoteOfId }),
    createdAt: now,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
  };

  // Store in KV
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

  // Add to author's posts index for fast profile lookups
  const authorPostsKey = `user-posts:${userId}`;
  const existingIndex = await c.env.POSTS_KV.get(authorPostsKey);
  const postIds: string[] = existingIndex ? JSON.parse(existingIndex) : [];
  postIds.unshift(postId); // Add to front (newest first)
  if (postIds.length > 1000) postIds.length = 1000; // Cap at 1000 posts
  await c.env.POSTS_KV.put(authorPostsKey, JSON.stringify(postIds));

  // Index post content for search
  await indexPostContent(c.env, postId, post.content, now);

  // Add to author's own feed immediately (for instant visibility)
  const authorFeedId = c.env.FEED_DO.idFromName(userId);
  const authorFeedStub = c.env.FEED_DO.get(authorFeedId);
  await authorFeedStub.fetch("https://do.internal/add-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry: {
        postId,
        authorId: userId,
        timestamp: now,
        source: "own",
      },
    }),
  });

  // Enqueue fan-out message to distribute post to followers
  await c.env.FANOUT_QUEUE.send({
    type: "new_post",
    postId,
    authorId: userId,
    timestamp: now,
  });

  // Increment user's post count
  await userStub.fetch("https://do.internal/posts/increment", {
    method: "POST",
  });

  // Detect and create mention notifications
  await createMentionNotifications(c.env, body.content, userId, postId);

  // If this is a reply, increment parent's reply count and update reply index
  if (body.replyToId) {
    const parentDoId = c.env.POST_DO.idFromName(body.replyToId);
    const parentStub = c.env.POST_DO.get(parentDoId);
    await parentStub.fetch("https://do.internal/replies/increment", {
      method: "POST",
    });

    // Update reply index
    const replyIndexKey = `replies:${body.replyToId}`;
    const existingIndex = await c.env.POSTS_KV.get(replyIndexKey);
    const replyIds: string[] = existingIndex ? JSON.parse(existingIndex) : [];
    replyIds.push(postId);
    await c.env.POSTS_KV.put(replyIndexKey, JSON.stringify(replyIds));

    // Create reply notification for parent post author
    const parentPostData = await c.env.POSTS_KV.get(`post:${body.replyToId}`);
    if (parentPostData) {
      const parentPost = JSON.parse(parentPostData);
      if (parentPost.authorId !== userId) {
        await createNotification(c.env, {
          userId: parentPost.authorId,
          type: "reply",
          actorId: userId,
          postId: body.replyToId,
          content: post.content.slice(0, 100),
        });
      }
    }
  }

  // If this is a quote, increment parent's quote count
  if (body.quoteOfId) {
    const quoteDoId = c.env.POST_DO.idFromName(body.quoteOfId);
    const quoteStub = c.env.POST_DO.get(quoteDoId);
    await quoteStub.fetch("https://do.internal/quotes/increment", {
      method: "POST",
    });
  }

  return success(metadata, 201);
});

/**
 * GET /api/posts/:id - Get a single post
 */
posts.get("/:id", optionalAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");

  // Try KV cache first
  const cached = await c.env.POSTS_KV.get(`post:${postId}`);
  if (cached) {
    const metadata: PostMetadata = JSON.parse(cached);

    // If user is authenticated, check if they liked/reposted it
    let hasLiked = false;
    let hasReposted = false;
    if (userId) {
      try {
        const doId = c.env.POST_DO.idFromName(postId);
        const stub = c.env.POST_DO.get(doId);
        const [likedResponse, repostedResponse] = await Promise.all([
          stub.fetch(`https://do.internal/has-liked?userId=${userId}`),
          stub.fetch(`https://do.internal/has-reposted?userId=${userId}`),
        ]);
        const likedData = (await likedResponse.json()) as { hasLiked: boolean };
        const repostedData = (await repostedResponse.json()) as {
          hasReposted: boolean;
        };
        hasLiked = likedData.hasLiked;
        hasReposted = repostedData.hasReposted;
      } catch (err) {
        console.error("Error checking liked/reposted status:", err);
      }
    }

    return success({ ...metadata, hasLiked, hasReposted });
  }

  return notFound("Post not found");
});

/**
 * GET /api/posts/:id/thread - Get post with replies thread
 */
posts.get("/:id/thread", optionalAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  // Get the main post
  const mainPostData = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!mainPostData) {
    return notFound("Post not found");
  }

  const mainPost = JSON.parse(mainPostData);

  // Check if user liked the main post
  let mainPostLiked = false;
  if (userId) {
    const doId = c.env.POST_DO.idFromName(postId);
    const stub = c.env.POST_DO.get(doId);
    try {
      const likedResp = await stub.fetch(
        `https://do.internal/has-liked?userId=${userId}`,
      );
      const likedData = (await likedResp.json()) as { hasLiked: boolean };
      mainPostLiked = likedData.hasLiked;
    } catch {
      // Ignore error
    }
  }

  // Get parent posts if this is a reply (build ancestor chain)
  const ancestors: PostMetadata[] = [];
  let currentReplyTo = mainPost.replyToId;

  while (currentReplyTo && ancestors.length < LIMITS.MAX_THREAD_DEPTH) {
    const parentData = await c.env.POSTS_KV.get(`post:${currentReplyTo}`);
    if (!parentData) break;

    const parent = JSON.parse(parentData);
    ancestors.unshift(parent); // Add to beginning
    currentReplyTo = parent.replyToId;
  }

  // Get replies using the reply index
  const replies: PostMetadata[] = [];

  // First try the reply index
  const replyIndexKey = `replies:${postId}`;
  const replyIndexData = await c.env.POSTS_KV.get(replyIndexKey);

  if (replyIndexData) {
    const replyIds: string[] = JSON.parse(replyIndexData);
    const newestFirstIds = replyIds.slice().reverse();
    const replyIdsToFetch = newestFirstIds.slice(0, Math.min(limit, 50));

    for (const replyId of replyIdsToFetch) {
      const replyData = await c.env.POSTS_KV.get(`post:${replyId}`);
      if (!replyData) continue;

      const reply = JSON.parse(replyData);
      if (reply.isDeleted) continue;

      // Check if user liked this reply
      let hasLiked = false;
      if (userId) {
        try {
          const doId = c.env.POST_DO.idFromName(reply.id);
          const stub = c.env.POST_DO.get(doId);
          const likedResp = await stub.fetch(
            `https://do.internal/has-liked?userId=${userId}`,
          );
          const likedData = (await likedResp.json()) as { hasLiked: boolean };
          hasLiked = likedData.hasLiked;
        } catch {
          // Ignore error
        }
      }
      replies.push({ ...reply, hasLiked });
    }
  } else {
    // Fallback: scan KV but with a strict limit to avoid hitting subrequest limit
    let cursor: string | undefined;
    let scannedBatches = 0;
    const maxBatches = 5; // Limit to 5 batches (500 posts) to avoid subrequest limit

    while (replies.length < limit && scannedBatches < maxBatches) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        cursor: cursor ?? null,
      });
      scannedBatches++;

      for (const key of listResult.keys) {
        if (replies.length >= limit) break;

        const replyData = await c.env.POSTS_KV.get(key.name);
        if (!replyData) continue;

        const reply = JSON.parse(replyData);

        if (reply.replyToId === postId && !reply.isDeleted) {
          let hasLiked = false;
          // Skip like check in fallback mode to save subrequests
          replies.push({ ...reply, hasLiked });
        }
      }

      if (listResult.list_complete) break;
      cursor = listResult.cursor;
    }
  }

  const sortOwnRepliesFirst = (a: PostMetadata, b: PostMetadata) => {
    const aIsOwnReply = userId && a.authorId === userId;
    const bIsOwnReply = userId && b.authorId === userId;
    if (aIsOwnReply && !bIsOwnReply) return -1;
    if (!aIsOwnReply && bIsOwnReply) return 1;
    return a.createdAt - b.createdAt;
  };
  replies.sort(sortOwnRepliesFirst);

  return success({
    ancestors,
    post: { ...mainPost, hasLiked: mainPostLiked },
    replies: replies.slice(0, limit),
    hasMoreReplies: replies.length >= limit,
  });
});

/**
 * GET /api/posts/:id/replies - Get paginated replies for a post
 */
posts.get("/:id/replies", optionalAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  const replyIndexKey = `replies:${postId}`;
  const replyIndexData = await c.env.POSTS_KV.get(replyIndexKey);

  if (!replyIndexData) {
    return success({ replies: [], cursor: null, hasMore: false });
  }

  const replyIds: string[] = JSON.parse(replyIndexData);
  const newestFirstIds = replyIds.slice().reverse();

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = newestFirstIds.indexOf(cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const replyIdsToFetch = newestFirstIds.slice(startIndex, startIndex + limit);
  const replies: PostMetadata[] = [];

  for (const replyId of replyIdsToFetch) {
    const replyData = await c.env.POSTS_KV.get(`post:${replyId}`);
    if (!replyData) continue;

    const reply = JSON.parse(replyData);
    if (reply.isDeleted) continue;

    let hasLiked = false;
    if (userId) {
      try {
        const doId = c.env.POST_DO.idFromName(reply.id);
        const stub = c.env.POST_DO.get(doId);
        const likedResp = await stub.fetch(
          `https://do.internal/has-liked?userId=${userId}`,
        );
        const likedData = (await likedResp.json()) as { hasLiked: boolean };
        hasLiked = likedData.hasLiked;
      } catch {
        // Ignore
      }
    }
    replies.push({ ...reply, hasLiked });
  }

  const sortOwnRepliesFirst = (a: PostMetadata, b: PostMetadata) => {
    const aIsOwnReply = userId && a.authorId === userId;
    const bIsOwnReply = userId && b.authorId === userId;
    if (aIsOwnReply && !bIsOwnReply) return -1;
    if (!aIsOwnReply && bIsOwnReply) return 1;
    return a.createdAt - b.createdAt;
  };
  replies.sort(sortOwnRepliesFirst);

  const lastReplyId = replyIdsToFetch[replyIdsToFetch.length - 1];
  const hasMore = startIndex + limit < newestFirstIds.length;

  return success({
    replies,
    cursor: hasMore ? lastReplyId : null,
    hasMore,
  });
});

/**
 * DELETE /api/posts/:id - Delete own post
 */
posts.delete("/:id", requireAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");

  // Get post metadata to check ownership
  const cached = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!cached) {
    return notFound("Post not found");
  }

  const metadata: PostMetadata = JSON.parse(cached);
  if (metadata.authorId !== userId) {
    return forbidden("Cannot delete another user's post");
  }

  // Mark as deleted in PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);
  await stub.fetch("https://do.internal/delete", {
    method: "POST",
  });

  // Update KV metadata
  metadata.likeCount = 0;
  metadata.replyCount = 0;
  metadata.repostCount = 0;
  metadata.quoteCount = 0;
  metadata.isDeleted = true;
  metadata.deletedAt = Date.now();
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

  // Enqueue delete fan-out message
  await c.env.FANOUT_QUEUE.send({
    type: "delete_post",
    postId,
    authorId: userId,
    timestamp: Date.now(),
  });

  // Decrement user's post count
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  await userStub.fetch("https://do.internal/posts/decrement", {
    method: "POST",
  });

  // Remove post from search index
  await removePostFromIndex(c.env, postId);

  return success({ message: "Post deleted" });
});

/**
 * POST /api/posts/:id/like - Like a post
 */
posts.post("/:id/like", requireAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");

  // Like via PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);

  try {
    const response = await stub.fetch("https://do.internal/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      return serverError("Error liking post");
    }

    const { likeCount } = (await response.json()) as { likeCount: number };

    // Update KV cache with authoritative count from DO
    const cached = await c.env.POSTS_KV.get(`post:${postId}`);

    if (cached) {
      const metadata: PostMetadata = JSON.parse(cached);
      // Use DO's count as source of truth to avoid race conditions
      metadata.likeCount = likeCount;
      await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

      // Create like notification for post author (not self)
      if (metadata.authorId !== userId) {
        try {
          await createNotification(c.env, {
            userId: metadata.authorId,
            type: "like",
            actorId: userId,
            postId,
          });
        } catch (notifError) {
          console.error("Failed to create like notification:", notifError);
        }
      }
    }

    // Track liked post in UserDO for efficient likes tab
    try {
      const userDoId = c.env.USER_DO.idFromName(userId);
      const userStub = c.env.USER_DO.get(userDoId);
      await userStub.fetch("https://do.internal/add-liked-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
    } catch (userErr) {
      console.error("Failed to track liked post in UserDO:", userErr);
    }

    return success({ likeCount });
  } catch (err) {
    console.error("Error liking post:", err);
    return serverError("Error liking post");
  }
});

/**
 * DELETE /api/posts/:id/like - Unlike a post
 */
posts.delete("/:id/like", requireAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");

  // Unlike via PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);

  try {
    const response = await stub.fetch("https://do.internal/unlike", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      return serverError("Error unliking post");
    }

    const { likeCount } = (await response.json()) as { likeCount: number };

    // Update KV cache with authoritative count from DO
    const cached = await c.env.POSTS_KV.get(`post:${postId}`);
    if (cached) {
      const metadata: PostMetadata = JSON.parse(cached);
      // Use DO's count as source of truth to avoid race conditions
      metadata.likeCount = likeCount;
      await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));
    }

    // Remove liked post from UserDO tracking
    try {
      const userDoId = c.env.USER_DO.idFromName(userId);
      const userStub = c.env.USER_DO.get(userDoId);
      await userStub.fetch("https://do.internal/remove-liked-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
    } catch (userErr) {
      console.error("Failed to remove liked post from UserDO:", userErr);
    }

    return success({ likeCount });
  } catch (err) {
    console.error("Error unliking post:", err);
    return serverError("Error unliking post");
  }
});

/**
 * POST /api/posts/:id/repost - Repost a post
 */
posts.post("/:id/repost", requireAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId");
  const userHandle = c.get("userHandle");

  // Check if original post exists
  const originalPostData = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!originalPostData) {
    return notFound("Post not found");
  }

  const originalPost = JSON.parse(originalPostData);

  // Check if user is blocked by original author
  const authorDoId = c.env.USER_DO.idFromName(originalPost.authorId);
  const authorStub = c.env.USER_DO.get(authorDoId);
  const blockedCheckResp = await authorStub.fetch(
    `https://do.internal/is-blocked?userId=${userId}`,
  );
  const blockedData = (await blockedCheckResp.json()) as { isBlocked: boolean };

  if (blockedData.isBlocked) {
    return forbidden("Cannot repost this user's content");
  }

  // Check if already reposted
  const originalDoId = c.env.POST_DO.idFromName(postId);
  const originalStub = c.env.POST_DO.get(originalDoId);
  const repostedCheckResp = await originalStub.fetch(
    `https://do.internal/has-reposted?userId=${userId}`,
  );
  const repostedData = (await repostedCheckResp.json()) as {
    hasReposted: boolean;
  };

  if (repostedData.hasReposted) {
    return error("You have already reposted this", 409);
  }

  // Fetch the original author's current profile for up-to-date avatar
  const originalAuthorDoId = c.env.USER_DO.idFromName(originalPost.authorId);
  const originalAuthorStub = c.env.USER_DO.get(originalAuthorDoId);
  const originalAuthorProfileResp = await originalAuthorStub.fetch(
    "https://do.internal/profile",
  );
  const originalAuthorProfile =
    (await originalAuthorProfileResp.json()) as import("../types/user").UserProfile;

  // Create repost (a new post that references the original)
  const repostId = generateId();
  const now = Date.now();

  const repost: Post = {
    id: repostId,
    authorId: userId,
    content: "", // Reposts have no additional content
    mediaUrls: [],
    repostOfId: postId, // New field for reposts
    createdAt: now,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
    isDeleted: false,
  };

  // Initialize PostDO for repost
  const doId = c.env.POST_DO.idFromName(repostId);
  const stub = c.env.POST_DO.get(doId);
  await stub.fetch("https://do.internal/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post: repost }),
  });

  // Get user profile for metadata
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const profileResponse = await userStub.fetch("https://do.internal/profile");
  const profile =
    (await profileResponse.json()) as import("../types/user").UserProfile;

  // Create repost metadata for KV - use original author's current profile for avatar
  const metadata = {
    id: repostId,
    authorId: userId,
    authorHandle: userHandle,
    authorDisplayName: profile.displayName || userHandle,
    authorAvatarUrl: profile.avatarUrl || "",
    content: "",
    mediaUrls: [],
    repostOfId: postId,
    originalPost: {
      id: originalPost.id,
      authorHandle: originalPost.authorHandle,
      authorDisplayName:
        originalAuthorProfile.displayName || originalPost.authorHandle,
      authorAvatarUrl: originalAuthorProfile.avatarUrl || "",
      content: originalPost.content,
      mediaUrls: originalPost.mediaUrls,
    },
    createdAt: now,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
  };

  await c.env.POSTS_KV.put(`post:${repostId}`, JSON.stringify(metadata));

  // Add to author's posts index for fast profile lookups
  const authorPostsKey = `user-posts:${userId}`;
  const existingIndex = await c.env.POSTS_KV.get(authorPostsKey);
  const postIds: string[] = existingIndex ? JSON.parse(existingIndex) : [];
  postIds.unshift(repostId);
  if (postIds.length > 1000) postIds.length = 1000;
  await c.env.POSTS_KV.put(authorPostsKey, JSON.stringify(postIds));

  // Add repost tracking and increment count on original post
  const repostResp = await originalStub.fetch("https://do.internal/repost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!repostResp.ok) {
    return serverError("Error updating repost count");
  }

  const { repostCount } = (await repostResp.json()) as { repostCount: number };

  // Update original post's repost count in KV with authoritative count from DO
  const updatedOriginal = await c.env.POSTS_KV.get(`post:${postId}`);
  if (updatedOriginal) {
    const updatedPost = JSON.parse(updatedOriginal);
    // Use DO's count as source of truth to avoid race conditions
    updatedPost.repostCount = repostCount;
    await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(updatedPost));
  }

  // Add to author's own feed immediately (for instant visibility)
  const authorFeedId = c.env.FEED_DO.idFromName(userId);
  const authorFeedStub = c.env.FEED_DO.get(authorFeedId);
  await authorFeedStub.fetch("https://do.internal/add-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry: {
        postId: repostId,
        authorId: userId,
        timestamp: now,
        source: "own",
      },
    }),
  });

  // Enqueue fan-out for followers
  await c.env.FANOUT_QUEUE.send({
    type: "new_post",
    postId: repostId,
    authorId: userId,
    timestamp: now,
  });

  // Increment user's post count
  await userStub.fetch("https://do.internal/posts/increment", {
    method: "POST",
  });

  // Create repost notification for original post author
  if (originalPost.authorId !== userId) {
    await createNotification(c.env, {
      userId: originalPost.authorId,
      type: "repost",
      actorId: userId,
      postId,
    });
  }

  return success(metadata, 201);
});

/**
 * DELETE /api/posts/:id/repost - Remove a repost
 */
posts.delete("/:id/repost", requireAuth, async (c) => {
  const postId = c.req.param("id");
  const userId = c.get("userId")!;

  // Get the original post
  const postData = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!postData) {
    return notFound("Post not found");
  }

  // Call PostDO to remove repost
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);

  const response = await stub.fetch("https://do.internal/repost", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    return serverError("Failed to remove repost");
  }

  const result = (await response.json()) as { repostCount: number };

  // Update KV cache with authoritative count from DO
  const post = JSON.parse(postData);
  // Use DO's count as source of truth to avoid race conditions
  post.repostCount = result.repostCount;
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(post));

  return success({ repostCount: result.repostCount });
});

export default posts;
