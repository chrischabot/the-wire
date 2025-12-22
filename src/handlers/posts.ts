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
    replyToId: body.replyToId,
    quoteOfId: body.quoteOfId,
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
  const profile = await profileResponse.json();

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
      const likedData = await likedResponse.json();
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
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

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

    const { likeCount } = await response.json();

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

    const { likeCount } = await response.json();

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

export default posts;