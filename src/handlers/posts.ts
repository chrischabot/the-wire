/**
 * Post handlers for The Wire
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { Post, PostMetadata, CreatePostRequest } from '../types/post';
import { validateNoteContent } from '../utils/validation';
import { generateId } from '../services/snowflake';
import { requireAuth, optionalAuth } from '../middleware/auth';

const posts = new Hono<{ Bindings: Env }>();

/**
 * POST /api/posts - Create a new post (note)
 */
posts.post('/', requireAuth, async (c) => {
  const userId = c.get('userId');
  const userHandle = c.get('userHandle');

  let body: CreatePostRequest;
  try {
    body = await c.req.json<CreatePostRequest>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  // Validate content
  const maxLength = parseInt(c.env.MAX_NOTE_LENGTH || '280', 10);
  const contentResult = validateNoteContent(body.content, maxLength);
  if (!contentResult.valid) {
    return c.json({ success: false, error: contentResult.error }, 400);
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
  await stub.fetch('https://do.internal/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post }),
  });

  // Get user profile for metadata
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const profileResponse = await userStub.fetch('https://do.internal/profile');
  const profile = await profileResponse.json() as import('../types/user').UserProfile;

  // Create post metadata for KV
  const metadata: PostMetadata = {
    id: postId,
    authorId: userId,
    authorHandle: userHandle,
    authorDisplayName: profile.displayName || userHandle,
    authorAvatarUrl: profile.avatarUrl || '',
    content: post.content,
    mediaUrls: post.mediaUrls,
    createdAt: now,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
  };

  // Store in KV
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

  // Enqueue fan-out message to distribute post to followers
  await c.env.FANOUT_QUEUE.send({
    type: 'new_post',
    postId,
    authorId: userId,
    timestamp: now,
  });

  // Increment user's post count
  await userStub.fetch('https://do.internal/posts/increment', {
    method: 'POST',
  });

  // If this is a reply, increment parent's reply count
  if (body.replyToId) {
    const parentDoId = c.env.POST_DO.idFromName(body.replyToId);
    const parentStub = c.env.POST_DO.get(parentDoId);
    await parentStub.fetch('https://do.internal/replies/increment', {
      method: 'POST',
    });
  }

  // If this is a quote, increment parent's quote count
  if (body.quoteOfId) {
    const quoteDoId = c.env.POST_DO.idFromName(body.quoteOfId);
    const quoteStub = c.env.POST_DO.get(quoteDoId);
    await quoteStub.fetch('https://do.internal/quotes/increment', {
      method: 'POST',
    });
  }

  return c.json({ success: true, data: metadata }, 201);
});

/**
 * GET /api/posts/:id - Get a single post
 */
posts.get('/:id', optionalAuth, async (c) => {
  const postId = c.req.param('id');
  const userId = c.get('userId');

  // Try KV cache first
  const cached = await c.env.POSTS_KV.get(`post:${postId}`);
  if (cached) {
    const metadata: PostMetadata = JSON.parse(cached);
    
    // If user is authenticated, check if they liked it
    let hasLiked = false;
    if (userId) {
      const doId = c.env.POST_DO.idFromName(postId);
      const stub = c.env.POST_DO.get(doId);
      const likedResponse = await stub.fetch(
        `https://do.internal/has-liked?userId=${userId}`
      );
      const likedData = await likedResponse.json() as { hasLiked: boolean };
      hasLiked = likedData.hasLiked;
    }

    return c.json({
      success: true,
      data: { ...metadata, hasLiked },
    });
  }

  return c.json({ success: false, error: 'Post not found' }, 404);
});

/**
 * GET /api/posts/:id/thread - Get post with replies thread
 */
posts.get('/:id/thread', optionalAuth, async (c) => {
  const postId = c.req.param('id');
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);

  // Get the main post
  const mainPostData = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!mainPostData) {
    return c.json({ success: false, error: 'Post not found' }, 404);
  }

  const mainPost = JSON.parse(mainPostData);

  // Check if user liked the main post
  let mainPostLiked = false;
  if (userId) {
    const doId = c.env.POST_DO.idFromName(postId);
    const stub = c.env.POST_DO.get(doId);
    try {
      const likedResp = await stub.fetch(`https://do.internal/has-liked?userId=${userId}`);
      const likedData = await likedResp.json() as { hasLiked: boolean };
      mainPostLiked = likedData.hasLiked;
    } catch {
      // Ignore error
    }
  }

  // Get parent posts if this is a reply (build ancestor chain)
  const ancestors: any[] = [];
  let currentReplyTo = mainPost.replyToId;
  
  while (currentReplyTo && ancestors.length < 10) {
    const parentData = await c.env.POSTS_KV.get(`post:${currentReplyTo}`);
    if (!parentData) break;
    
    const parent = JSON.parse(parentData);
    ancestors.unshift(parent); // Add to beginning
    currentReplyTo = parent.replyToId;
  }

  // Get replies to this post
  const replies: any[] = [];
  let cursor: string | undefined;

  // Search for replies (in production, use a secondary index)
  while (replies.length < limit) {
    const listResult = await c.env.POSTS_KV.list({
      prefix: 'post:',
      limit: 100,
      cursor: cursor ?? null,
    });

    for (const key of listResult.keys) {
      if (replies.length >= limit) break;
      
      const replyData = await c.env.POSTS_KV.get(key.name);
      if (!replyData) continue;
      
      const reply = JSON.parse(replyData);
      
      if (reply.replyToId === postId && !reply.isDeleted) {
        // Check if user liked this reply
        let hasLiked = false;
        if (userId) {
          try {
            const doId = c.env.POST_DO.idFromName(reply.id);
            const stub = c.env.POST_DO.get(doId);
            const likedResp = await stub.fetch(`https://do.internal/has-liked?userId=${userId}`);
            const likedData = await likedResp.json() as { hasLiked: boolean };
            hasLiked = likedData.hasLiked;
          } catch {
            // Ignore error
          }
        }
        replies.push({ ...reply, hasLiked });
      }
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  // Sort replies by creation time ascending (oldest first for thread view)
  replies.sort((a, b) => a.createdAt - b.createdAt);

  return c.json({
    success: true,
    data: {
      ancestors,
      post: { ...mainPost, hasLiked: mainPostLiked },
      replies: replies.slice(0, limit),
      hasMoreReplies: replies.length >= limit,
    },
  });
});

/**
 * DELETE /api/posts/:id - Delete own post
 */
posts.delete('/:id', requireAuth, async (c) => {
  const postId = c.req.param('id');
  const userId = c.get('userId');

  // Get post metadata to check ownership
  const cached = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!cached) {
    return c.json({ success: false, error: 'Post not found' }, 404);
  }

  const metadata: PostMetadata = JSON.parse(cached);
  if (metadata.authorId !== userId) {
    return c.json({ success: false, error: 'Cannot delete another user\'s post' }, 403);
  }

  // Mark as deleted in PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);
  await stub.fetch('https://do.internal/delete', {
    method: 'POST',
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
    type: 'delete_post',
    postId,
    authorId: userId,
    timestamp: Date.now(),
  });

  // Decrement user's post count
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  await userStub.fetch('https://do.internal/posts/decrement', {
    method: 'POST',
  });

  return c.json({ success: true, data: { message: 'Post deleted' } });
});

/**
 * POST /api/posts/:id/like - Like a post
 */
posts.post('/:id/like', requireAuth, async (c) => {
  const postId = c.req.param('id');
  const userId = c.get('userId');

  // Like via PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);

  try {
    const response = await stub.fetch('https://do.internal/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      return c.json({ success: false, error: 'Error liking post' }, 500);
    }

    const { likeCount } = await response.json() as { likeCount: number };

    // Update KV cache
    const cached = await c.env.POSTS_KV.get(`post:${postId}`);
    if (cached) {
      const metadata: PostMetadata = JSON.parse(cached);
      metadata.likeCount = likeCount;
      await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));
    }

    return c.json({ success: true, data: { likeCount } });
  } catch (error) {
    console.error('Error liking post:', error);
    return c.json({ success: false, error: 'Error liking post' }, 500);
  }
});

/**
 * DELETE /api/posts/:id/like - Unlike a post
 */
posts.delete('/:id/like', requireAuth, async (c) => {
  const postId = c.req.param('id');
  const userId = c.get('userId');

  // Unlike via PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);

  try {
    const response = await stub.fetch('https://do.internal/unlike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      return c.json({ success: false, error: 'Error unliking post' }, 500);
    }

    const { likeCount } = await response.json() as { likeCount: number };

    // Update KV cache
    const cached = await c.env.POSTS_KV.get(`post:${postId}`);
    if (cached) {
      const metadata: PostMetadata = JSON.parse(cached);
      metadata.likeCount = likeCount;
      await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));
    }

    return c.json({ success: true, data: { likeCount } });
  } catch (error) {
    console.error('Error unliking post:', error);
    return c.json({ success: false, error: 'Error unliking post' }, 500);
  }
});

/**
 * POST /api/posts/:id/repost - Repost a post
 */
posts.post('/:id/repost', requireAuth, async (c) => {
  const postId = c.req.param('id');
  const userId = c.get('userId');
  const userHandle = c.get('userHandle');

  // Check if original post exists
  const originalPostData = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!originalPostData) {
    return c.json({ success: false, error: 'Post not found' }, 404);
  }

  const originalPost = JSON.parse(originalPostData);

  // Check if user is blocked by original author
  const authorDoId = c.env.USER_DO.idFromName(originalPost.authorId);
  const authorStub = c.env.USER_DO.get(authorDoId);
  const blockedCheckResp = await authorStub.fetch(
    `https://do.internal/is-blocked?userId=${userId}`
  );
  const blockedData = await blockedCheckResp.json() as { isBlocked: boolean };
  
  if (blockedData.isBlocked) {
    return c.json({ success: false, error: 'Cannot repost this user\'s content' }, 403);
  }

  // Create repost (a new post that references the original)
  const repostId = generateId();
  const now = Date.now();

  const repost: Post = {
    id: repostId,
    authorId: userId,
    content: '', // Reposts have no additional content
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
  await stub.fetch('https://do.internal/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post: repost }),
  });

  // Get user profile for metadata
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const profileResponse = await userStub.fetch('https://do.internal/profile');
  const profile = await profileResponse.json() as import('../types/user').UserProfile;

  // Create repost metadata for KV
  const metadata = {
    id: repostId,
    authorId: userId,
    authorHandle: userHandle,
    authorDisplayName: profile.displayName || userHandle,
    authorAvatarUrl: profile.avatarUrl || '',
    content: '',
    mediaUrls: [],
    repostOfId: postId,
    originalPost: {
      id: originalPost.id,
      authorHandle: originalPost.authorHandle,
      authorDisplayName: originalPost.authorDisplayName,
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

  // Increment repost count on original post
  const originalDoId = c.env.POST_DO.idFromName(postId);
  const originalStub = c.env.POST_DO.get(originalDoId);
  await originalStub.fetch('https://do.internal/reposts/increment', {
    method: 'POST',
  });

  // Update original post's repost count in KV
  originalPost.repostCount = (originalPost.repostCount || 0) + 1;
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(originalPost));

  // Enqueue fan-out for the repost
  await c.env.FANOUT_QUEUE.send({
    type: 'new_post',
    postId: repostId,
    authorId: userId,
    timestamp: now,
  });

  // Increment user's post count
  await userStub.fetch('https://do.internal/posts/increment', {
    method: 'POST',
  });

  return c.json({ success: true, data: metadata }, 201);
});

export default posts;