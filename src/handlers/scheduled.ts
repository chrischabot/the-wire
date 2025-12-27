/**
 * Scheduled (Cron) Handlers for The Wire
 * 
 * Handles periodic tasks:
 * - Every 15 minutes: Update FoF (friends-of-friends) rankings
 * - Every hour: Cleanup old feed entries
 * - Daily: Compact KV storage
 */

import type { Env } from '../types/env';
import { RETENTION, BATCH_SIZE, SCORING, LIMITS, CACHE_TTL } from '../constants';

/**
 * Main scheduled handler
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const cron = event.cron;

  try {
    switch (cron) {
      case '*/15 * * * *':
        // Every 15 minutes - update FoF and Explore rankings
        await Promise.all([
          updateFoFRankings(env),
          updateExploreRankings(env),
        ]);
        break;

      case '0 * * * *':
        // Every hour - cleanup old feed entries
        await cleanupFeedEntries(env);
        break;

      case '0 0 * * *':
        // Daily - compact KV storage
        await compactKVStorage(env);
        break;
    }
  } catch (error) {
    console.error(`Scheduled task failed: ${cron}`, error);
    throw error;
  }
}

/**
 * Update Friends-of-Friends rankings
 * Uses HN-style scoring: points / (ageHours + BASE_OFFSET)^EXPONENT
 * Constants defined in src/constants.ts (SCORING object)
 *
 * No hard age cutoff - scoring naturally demotes older posts but they
 * remain available if nothing newer exists.
 */
async function updateFoFRankings(env: Env): Promise<void> {
  const rankedPosts: Array<{ postId: string; score: number; authorId: string }> = [];

  // OPTIMIZED: Limit to 40 KV gets per batch to stay under subrequest limits
  // Process only first 2 batches (80 posts max) - enough for a good ranking sample
  let cursor: string | undefined;
  const maxBatches = 2;
  const batchSize = 40;
  let batchCount = 0;

  while (batchCount < maxBatches) {
    const listResult = await env.POSTS_KV.list({
      prefix: 'post:',
      limit: batchSize,
      cursor: cursor ?? null
    });
    batchCount++;

    // Process batch of posts sequentially to control subrequest count
    for (const key of listResult.keys) {
      const postData = await env.POSTS_KV.get(key.name);
      if (!postData) continue;

      try {
        const post = JSON.parse(postData);
        if (post.isDeleted) continue;

        const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
        const points = (post.likeCount * SCORING.LIKE_WEIGHT) +
                      (post.replyCount * SCORING.REPLY_WEIGHT) +
                      (post.repostCount * SCORING.REPOST_WEIGHT);
        const score = points / Math.pow(ageHours + SCORING.HN_BASE_OFFSET, SCORING.HN_AGING_EXPONENT);

        rankedPosts.push({
          postId: post.id,
          score,
          authorId: post.authorId,
        });
      } catch {
        // Skip invalid post data
      }
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  // Sort by score descending
  rankedPosts.sort((a, b) => b.score - a.score);

  // Store top posts in KV for quick access
  const topPosts = rankedPosts.slice(0, 100);
  await env.FEEDS_KV.put('fof:ranked', JSON.stringify(topPosts), {
    expirationTtl: CACHE_TTL.FOF_RANKINGS,
  });
}

/**
 * Update Explore page rankings
 * Pre-computes HN-scored posts with author diversity applied
 * OPTIMIZED: Limited batches to stay under subrequest limits
 */
async function updateExploreRankings(env: Env): Promise<void> {
  const scoredPosts: Array<{ post: unknown; score: number; authorId: string }> = [];

  // OPTIMIZED: Limit to 40 KV gets per batch, max 2 batches
  let cursor: string | undefined;
  const maxBatches = 2;
  const batchSize = 40;
  let batchCount = 0;

  while (batchCount < maxBatches) {
    const listResult = await env.POSTS_KV.list({
      prefix: 'post:',
      limit: batchSize,
      cursor: cursor ?? null
    });
    batchCount++;

    // Process posts sequentially to control subrequest count
    for (const key of listResult.keys) {
      const postData = await env.POSTS_KV.get(key.name);
      if (!postData) continue;

      try {
        const post = JSON.parse(postData);
        if (post.isDeleted) continue;

        const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
        const points = (post.likeCount * SCORING.LIKE_WEIGHT) +
                      (post.replyCount * SCORING.REPLY_WEIGHT) +
                      (post.repostCount * SCORING.REPOST_WEIGHT);
        const score = points / Math.pow(ageHours + SCORING.HN_BASE_OFFSET, SCORING.HN_AGING_EXPONENT);

        scoredPosts.push({ post, score, authorId: post.authorId });
      } catch {
        // Skip invalid post data
      }
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  // Sort by score descending
  scoredPosts.sort((a, b) => b.score - a.score);

  // Apply author diversity: max 2 posts per author in any 5-post window
  const diversePosts: typeof scoredPosts = [];
  const pending = [...scoredPosts];
  const windowSize = 5;
  const maxPerAuthorInWindow = 2;

  while (pending.length > 0 && diversePosts.length < LIMITS.MAX_FEED_ENTRIES) {
    let added = false;

    for (let i = 0; i < pending.length; i++) {
      const post = pending[i]!;

      const windowStart = Math.max(0, diversePosts.length - windowSize + 1);
      const window = diversePosts.slice(windowStart);
      const authorCountInWindow = window.filter(p => p.authorId === post.authorId).length;

      if (authorCountInWindow < maxPerAuthorInWindow) {
        diversePosts.push(post);
        pending.splice(i, 1);
        added = true;
        break;
      }
    }

    if (!added && pending.length > 0) {
      diversePosts.push(pending.shift()!);
    }
  }

  // Store in KV - full post data for instant loading (no additional fetches needed)
  const cacheData = diversePosts.map(p => p.post);
  await env.FEEDS_KV.put('explore:ranked', JSON.stringify(cacheData), {
    expirationTtl: CACHE_TTL.FOF_RANKINGS, // 15 minutes
  });
}

/**
 * Cleanup old feed entries beyond retention period
 */
async function cleanupFeedEntries(env: Env): Promise<void> {
  // Feed entries older than 7 days can be removed
  const cutoffTime = Date.now() - RETENTION.FEED_ENTRIES;
  
  let cursor: string | undefined;
  let cleanedCount = 0;
  
  do {
    const feedList = await env.FEEDS_KV.list({ 
      prefix: 'feed:', 
      limit: BATCH_SIZE.KV_LIST,
      cursor: cursor ?? null
    });
    
    for (const key of feedList.keys) {
      const feedData = await env.FEEDS_KV.get(key.name);
      if (!feedData) continue;
      
      const entries = JSON.parse(feedData);
      
      // Filter out old entries
      const filteredEntries = entries.filter((entry: any) => entry.timestamp > cutoffTime);
      
      if (filteredEntries.length < entries.length) {
        cleanedCount += entries.length - filteredEntries.length;
        
        if (filteredEntries.length > 0) {
          await env.FEEDS_KV.put(key.name, JSON.stringify(filteredEntries));
        } else {
          await env.FEEDS_KV.delete(key.name);
        }
      }
    }
    
    cursor = feedList.list_complete ? undefined : feedList.cursor;
  } while (cursor);
}

/**
 * Compact KV storage by removing stale entries
 */
async function compactKVStorage(env: Env): Promise<void> {
  // Track cleanup counts (kept for potential future logging)
  void 0; // Placeholder to maintain function structure
  const cutoffTime = Date.now() - RETENTION.DELETED_POSTS;
  
  // Clean up deleted posts (marked as deleted but still in KV)
  let postCursor: string | undefined;
  do {
    const postList = await env.POSTS_KV.list({ 
      prefix: 'post:', 
      limit: BATCH_SIZE.KV_LIST,
      cursor: postCursor ?? null
    });
    
    for (const key of postList.keys) {
      const postData = await env.POSTS_KV.get(key.name);
      if (!postData) continue;
      
      const post = JSON.parse(postData);
      
      // Remove posts deleted more than 30 days ago
      if (post.isDeleted && post.deletedAt && post.deletedAt < cutoffTime) {
        await env.POSTS_KV.delete(key.name);
        // Cleaned post;
      } else if (post.isTakenDown && post.takenDownAt && post.takenDownAt < cutoffTime) {
        // Also clean up old takedowns
        await env.POSTS_KV.delete(key.name);
        // Cleaned post;
      }
    }
    
    postCursor = postList.list_complete ? undefined : postList.cursor;
  } while (postCursor);
  
  // Clean up rate limit entries
  let rlCursor: string | undefined;
  do {
    const rlList = await env.SESSIONS_KV.list({ 
      prefix: 'rl:', 
      limit: BATCH_SIZE.KV_LIST,
      cursor: rlCursor ?? null
    });
    
    for (const key of rlList.keys) {
      const rlData = await env.SESSIONS_KV.get(key.name);
      if (!rlData) continue;
      
      try {
        const rl = JSON.parse(rlData);
        if (rl.resetAt && rl.resetAt < Date.now()) {
          await env.SESSIONS_KV.delete(key.name);
          // Cleaned rl entry;
        }
      } catch {
        // Invalid data, delete it
        await env.SESSIONS_KV.delete(key.name);
        // Cleaned rl entry;
      }
    }
    
    rlCursor = rlList.list_complete ? undefined : rlList.cursor;
  } while (rlCursor);
}

/**
 * Get FoF ranked posts for a user's feed
 *
 * OPTIMIZED: Uses pre-computed fof:ranked cache directly without
 * making expensive DO calls to compute friends-of-friends on every request.
 * The scheduled job pre-computes rankings, so we just filter by blocked users.
 */
export async function getFoFRankedPosts(
  env: Env,
  userId: string,
  _followingIds: string[],
  limit: number = 10
): Promise<Array<{ postId: string; score: number }>> {
  // Get pre-computed rankings - these are already ranked by the scheduled job
  const rankedData = await env.FEEDS_KV.get('fof:ranked');
  if (!rankedData) return [];

  const rankedPosts = JSON.parse(rankedData);

  // Simple filter: exclude user's own posts and return top ranked
  // Blocked user filtering happens at the feed merge level to avoid extra DO calls
  const filteredPosts = rankedPosts.filter((post: any) =>
    post.authorId !== userId
  );

  return filteredPosts.slice(0, limit);
}