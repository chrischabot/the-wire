/**
 * Feed handlers for The Wire
 * 
 * Implements the feed algorithm:
 * - Round-robin merge: 2 posts from followed users + 1 FoF post
 * - Friends-of-friends posts ranked using Hacker News scoring
 * - Filtering for blocked users and muted words
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { PostMetadata } from '../types/post';
import { requireAuth } from '../middleware/auth';
import { getFoFRankedPosts } from './scheduled';
import { LIMITS, BATCH_SIZE } from '../constants';

const feed = new Hono<{ Bindings: Env }>();

interface FeedPost extends PostMetadata {
  source: 'own' | 'follow' | 'fof';
  hasLiked?: boolean;
}

/**
 * GET /api/feed/home - Get user's home timeline
 * 
 * Algorithm: Round-robin merge
 * - 2 posts from followed users (chronological)
 * - 1 post from friends-of-friends (ranked by HN score)
 * - Repeat pattern
 */
feed.get('/home', requireAuth, async (c) => {
  const userId = c.get('userId');
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10), LIMITS.MAX_PAGINATION_LIMIT);

  try {
    // Get user's blocked list, muted words, and following list
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    
    const [blockedResp, settingsResp, followingResp] = await Promise.all([
      userStub.fetch('https://do.internal/blocked'),
      userStub.fetch('https://do.internal/settings'),
      userStub.fetch('https://do.internal/following'),
    ]);
    
    const blockedData = await blockedResp.json() as { blocked: string[] };
    const settingsData = await settingsResp.json() as { mutedWords: string[] };
    const followingData = await followingResp.json() as { following: string[] };
    
    const blockedUserIds = blockedData.blocked || [];
    const mutedWords = settingsData.mutedWords || [];
    const followingIds = followingData.following || [];

    // Get feed entries from FeedDO (posts from followed users)
    const feedDoId = c.env.FEED_DO.idFromName(userId);
    const feedStub = c.env.FEED_DO.get(feedDoId);
    
    const feedUrl = new URL('https://do.internal/feed');
    if (cursor) feedUrl.searchParams.set('cursor', cursor);
    // Request more entries to account for round-robin merge
    feedUrl.searchParams.set('limit', (limit * 2).toString());
    if (blockedUserIds.length > 0) {
      feedUrl.searchParams.set('blocked', JSON.stringify(blockedUserIds));
    }
    if (mutedWords.length > 0) {
      feedUrl.searchParams.set('muted', JSON.stringify(mutedWords));
    }
    
    const feedResp = await feedStub.fetch(feedUrl.toString());
    const feedData = await feedResp.json() as {
      entries: Array<{ postId: string; authorId: string; timestamp: number; source: string }>;
      cursor: string | null;
      hasMore: boolean;
    };

    // Get FoF ranked posts
    const fofPosts = await getFoFRankedPosts(c.env, userId, followingIds, Math.ceil(limit / 3) + 5);

    // Filter FoF posts for muted words
    const filteredFofPosts = await filterPostsForMutedWords(c.env, fofPosts, mutedWords);

    // Fetch full post metadata for followed user entries
    const followedPosts: FeedPost[] = [];
    const seenPostIds = new Set<string>();

    for (const entry of feedData.entries) {
      const postData = await c.env.POSTS_KV.get(`post:${entry.postId}`);
      if (postData) {
        const post: PostMetadata = JSON.parse(postData);
        if (!post.isDeleted) {
          followedPosts.push({
            ...post,
            source: entry.source === 'own' ? 'own' : 'follow',
          });
          seenPostIds.add(post.id);
        }
      }
    }

    // Always include user's own recent posts (in case FeedDO wasn't populated)
    // This ensures users always see their own posts in their feed
    const userPostsList = await c.env.POSTS_KV.list({ prefix: 'post:', limit: BATCH_SIZE.KV_LIST });
    for (const key of userPostsList.keys) {
      const postData = await c.env.POSTS_KV.get(key.name);
      if (postData) {
        const post: PostMetadata = JSON.parse(postData);
        if (post.authorId === userId && !post.isDeleted && !seenPostIds.has(post.id)) {
          followedPosts.push({
            ...post,
            source: 'own',
          });
          seenPostIds.add(post.id);
        }
      }
    }

    // Sort by creation time descending
    followedPosts.sort((a, b) => b.createdAt - a.createdAt);

    // Fetch full post metadata for FoF posts
    const fofPostsWithMeta: FeedPost[] = [];
    for (const fofPost of filteredFofPosts) {
      const postData = await c.env.POSTS_KV.get(`post:${fofPost.postId}`);
      if (postData) {
        const post: PostMetadata = JSON.parse(postData);
        fofPostsWithMeta.push({
          ...post,
          source: 'fof',
        });
      }
    }

    // Apply round-robin merge: 2 followed + 1 FoF
    const mergedPosts = roundRobinMerge(followedPosts, fofPostsWithMeta, limit);

    // Check if user has liked each post
    const postsWithLikeStatus = await Promise.all(
      mergedPosts.map(async (post) => {
        const postDoId = c.env.POST_DO.idFromName(post.id);
        const postStub = c.env.POST_DO.get(postDoId);
        try {
          const likedResp = await postStub.fetch(`https://do.internal/has-liked?userId=${userId}`);
          const likedData = await likedResp.json() as { hasLiked: boolean };
          return { ...post, hasLiked: likedData.hasLiked };
        } catch {
          return { ...post, hasLiked: false };
        }
      })
    );

    return c.json({
      success: true,
      data: {
        posts: postsWithLikeStatus,
        cursor: feedData.cursor,
        hasMore: feedData.hasMore || filteredFofPosts.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching home feed:', error);
    return c.json({ success: false, error: 'Error fetching feed' }, 500);
  }
});

/**
 * GET /api/feed/global - Get global public feed for exploration
 * Supports optional authentication to filter blocked users
 */
feed.get('/global', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10), LIMITS.MAX_PAGINATION_LIMIT);
  const cursor = c.req.query('cursor');

  // Optional authentication - get user ID if available
  let userId: string | null = null;
  let blockedUserIds: string[] = [];
  
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const { verifyToken } = await import('../utils/jwt');
      const { getJwtSecret } = await import('../middleware/auth');
      const secret = getJwtSecret(c.env);
      const payload = await verifyToken(token, secret);
      
      if (payload) {
        userId = payload.sub;
        
        // Get blocked users list
        const userDoId = c.env.USER_DO.idFromName(userId);
        const userStub = c.env.USER_DO.get(userDoId);
        const blockedResp = await userStub.fetch('https://do.internal/blocked');
        const blockedData = await blockedResp.json() as { blocked: string[] };
        blockedUserIds = blockedData.blocked || [];
      }
    } catch {
      // Invalid token, proceed as unauthenticated
    }
  }

  try {
    let postCursor: string | undefined;
    if (cursor) {
      try {
        postCursor = atob(cursor);
      } catch {
        postCursor = undefined;
      }
    }
    const posts: PostMetadata[] = [];
    
    // Paginate through posts
    while (posts.length < limit) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: 'post:',
        limit: BATCH_SIZE.KV_LIST,
        ...(postCursor ? { cursor: postCursor } : {}),
      });

      for (const key of listResult.keys) {
        if (posts.length >= limit) break;
        
        const postData = await c.env.POSTS_KV.get(key.name);
        if (!postData) continue;
        
        const post: PostMetadata = JSON.parse(postData);
        
        // Skip deleted posts
        if (post.isDeleted) continue;
        
        // Skip posts from blocked users if authenticated
        if (blockedUserIds.length > 0 && blockedUserIds.includes(post.authorId)) continue;
        
        posts.push(post);
      }

      if (listResult.list_complete) break;
      postCursor = listResult.cursor;
    }

    // Sort by creation time descending
    posts.sort((a, b) => b.createdAt - a.createdAt);

    const nextCursor = posts.length >= limit && postCursor 
      ? btoa(postCursor) 
      : null;

    return c.json({
      success: true,
      data: {
        posts: posts.slice(0, limit),
        cursor: nextCursor,
        hasMore: posts.length >= limit,
      },
    });
  } catch (error) {
    console.error('Error fetching global feed:', error);
    return c.json({ success: false, error: 'Error fetching feed' }, 500);
  }
});

/**
 * GET /api/feed/chronological - Get pure chronological feed (no FoF)
 */
feed.get('/chronological', requireAuth, async (c) => {
  const userId = c.get('userId');
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10), LIMITS.MAX_PAGINATION_LIMIT);

  try {
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    
    const [blockedResp, settingsResp] = await Promise.all([
      userStub.fetch('https://do.internal/blocked'),
      userStub.fetch('https://do.internal/settings'),
    ]);
    
    const blockedData = await blockedResp.json() as { blocked: string[] };
    const settingsData = await settingsResp.json() as { mutedWords: string[] };
    
    const blockedUserIds = blockedData.blocked || [];
    const mutedWords = settingsData.mutedWords || [];

    const feedDoId = c.env.FEED_DO.idFromName(userId);
    const feedStub = c.env.FEED_DO.get(feedDoId);
    
    const feedUrl = new URL('https://do.internal/feed');
    if (cursor) feedUrl.searchParams.set('cursor', cursor);
    feedUrl.searchParams.set('limit', limit.toString());
    if (blockedUserIds.length > 0) {
      feedUrl.searchParams.set('blocked', JSON.stringify(blockedUserIds));
    }
    if (mutedWords.length > 0) {
      feedUrl.searchParams.set('muted', JSON.stringify(mutedWords));
    }
    
    const feedResp = await feedStub.fetch(feedUrl.toString());
    const feedData = await feedResp.json() as {
      entries: Array<{ postId: string; authorId: string; timestamp: number; source: string }>;
      cursor: string | null;
      hasMore: boolean;
    };

    const posts = await Promise.all(
      feedData.entries.map(async (entry) => {
        const postData = await c.env.POSTS_KV.get(`post:${entry.postId}`);
        if (postData) {
          const post: PostMetadata = JSON.parse(postData);
          
          // Check if liked
          const postDoId = c.env.POST_DO.idFromName(post.id);
          const postStub = c.env.POST_DO.get(postDoId);
          try {
            const likedResp = await postStub.fetch(`https://do.internal/has-liked?userId=${userId}`);
            const likedData = await likedResp.json() as { hasLiked: boolean };
            return { ...post, source: entry.source, hasLiked: likedData.hasLiked };
          } catch {
            return { ...post, source: entry.source, hasLiked: false };
          }
        }
        return null;
      })
    );

    const validPosts = posts.filter((p) => p !== null);

    return c.json({
      success: true,
      data: {
        posts: validPosts,
        cursor: feedData.cursor,
        hasMore: feedData.hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching chronological feed:', error);
    return c.json({ success: false, error: 'Error fetching feed' }, 500);
  }
});

/**
 * Round-robin merge algorithm
 * Pattern: 2 posts from followed users + 1 post from FoF
 */
function roundRobinMerge(
  followedPosts: FeedPost[],
  fofPosts: FeedPost[],
  limit: number
): FeedPost[] {
  const result: FeedPost[] = [];
  let followedIndex = 0;
  let fofIndex = 0;
  let cyclePosition = 0; // 0, 1 = followed, 2 = fof

  while (result.length < limit) {
    if (cyclePosition < 2) {
      // Add from followed posts
      if (followedIndex < followedPosts.length) {
        result.push(followedPosts[followedIndex]!);
        followedIndex++;
      } else if (fofIndex < fofPosts.length) {
        // No more followed posts, use FoF
        result.push(fofPosts[fofIndex]!);
        fofIndex++;
      } else {
        // No more posts at all
        break;
      }
    } else {
      // Add from FoF posts
      if (fofIndex < fofPosts.length) {
        result.push(fofPosts[fofIndex]!);
        fofIndex++;
      } else if (followedIndex < followedPosts.length) {
        // No more FoF posts, use followed
        result.push(followedPosts[followedIndex]!);
        followedIndex++;
      } else {
        // No more posts at all
        break;
      }
    }

    cyclePosition = (cyclePosition + 1) % 3;
  }

  return result;
}

/**
 * Filter posts for muted words
 */
async function filterPostsForMutedWords(
  env: Env,
  posts: Array<{ postId: string; score: number }>,
  mutedWords: string[]
): Promise<Array<{ postId: string; score: number }>> {
  if (mutedWords.length === 0) return posts;

  const normalizedMuted = mutedWords.map((w) => w.toLowerCase());
  
  const filtered = await Promise.all(
    posts.map(async (post) => {
      const postData = await env.POSTS_KV.get(`post:${post.postId}`);
      if (!postData) return null;
      
      const postMeta: PostMetadata = JSON.parse(postData);
      const contentLower = postMeta.content.toLowerCase();
      
      const hasMutedWord = normalizedMuted.some((word) => 
        contentLower.includes(word)
      );
      
      return hasMutedWord ? null : post;
    })
  );

  return filtered.filter((p): p is { postId: string; score: number } => p !== null);
}

export default feed;