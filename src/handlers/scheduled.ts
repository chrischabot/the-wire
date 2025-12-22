/**
 * Scheduled (Cron) Handlers for The Wire
 * 
 * Handles periodic tasks:
 * - Every 15 minutes: Update FoF (friends-of-friends) rankings
 * - Every hour: Cleanup old feed entries
 * - Daily: Compact KV storage
 */

import type { Env } from '../types/env';

/**
 * Main scheduled handler
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const cron = event.cron;
  
  console.log(`Running scheduled task: ${cron} at ${new Date().toISOString()}`);

  try {
    switch (cron) {
      case '*/15 * * * *':
        // Every 15 minutes - update FoF rankings
        await updateFoFRankings(env);
        break;
        
      case '0 * * * *':
        // Every hour - cleanup old feed entries
        await cleanupFeedEntries(env);
        break;
        
      case '0 0 * * *':
        // Daily - compact KV storage
        await compactKVStorage(env);
        break;
        
      default:
        console.log(`Unknown cron pattern: ${cron}`);
    }
  } catch (error) {
    console.error(`Scheduled task failed: ${cron}`, error);
    throw error;
  }
}

/**
 * Update Friends-of-Friends rankings
 * Uses Hacker News scoring formula: points / (age in hours + 2)^1.8
 * 
 * This implementation uses KV list operations with cursor-based pagination
 * and processes posts in batches to handle scale efficiently.
 */
async function updateFoFRankings(env: Env): Promise<void> {
  console.log('Starting FoF ranking update...');
  
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const rankedPosts: Array<{ postId: string; score: number; authorId: string }> = [];
  
  // Paginate through all posts using KV list with cursor
  let cursor: string | undefined;
  const batchSize = 100;
  
  do {
    const listResult = await env.POSTS_KV.list({ 
      prefix: 'post:', 
      limit: batchSize,
      cursor: cursor ?? null
    });
    
    // Process batch of posts in parallel
    const batchPromises = listResult.keys.map(async (key) => {
      const postData = await env.POSTS_KV.get(key.name);
      if (!postData) return null;
      
      const post = JSON.parse(postData);
      
      // Only consider recent posts
      if (post.createdAt < oneDayAgo) return null;
      
      // Calculate Hacker News score
      const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
      const points = post.likeCount + (post.replyCount * 2) + (post.repostCount * 1.5);
      const score = points / Math.pow(ageHours + 2, 1.8);
      
      return {
        postId: post.id,
        score,
        authorId: post.authorId,
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      if (result) rankedPosts.push(result);
    }
    
    cursor = listResult.list_complete ? undefined : listResult.cursor;
  } while (cursor);
  
  // Sort by score descending
  rankedPosts.sort((a, b) => b.score - a.score);
  
  // Store top 1000 ranked posts in KV for quick access
  const topPosts = rankedPosts.slice(0, 1000);
  await env.FEEDS_KV.put('fof:ranked', JSON.stringify(topPosts), {
    expirationTtl: 900, // 15 minutes
  });
  
  console.log(`Updated FoF rankings: ${topPosts.length} posts ranked`);
}

/**
 * Cleanup old feed entries beyond retention period
 */
async function cleanupFeedEntries(env: Env): Promise<void> {
  console.log('Starting feed cleanup...');
  
  // Feed entries older than 7 days can be removed
  const retentionPeriod = 7 * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - retentionPeriod;
  
  let cursor: string | undefined;
  let cleanedCount = 0;
  
  do {
    const feedList = await env.FEEDS_KV.list({ 
      prefix: 'feed:', 
      limit: 100,
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
  
  console.log(`Feed cleanup complete: ${cleanedCount} entries removed`);
}

/**
 * Compact KV storage by removing stale entries
 */
async function compactKVStorage(env: Env): Promise<void> {
  console.log('Starting KV compaction...');
  
  let sessionsCleaned = 0;
  let postsCleaned = 0;
  let rlCleaned = 0;
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  // Clean up deleted posts (marked as deleted but still in KV)
  let postCursor: string | undefined;
  do {
    const postList = await env.POSTS_KV.list({ 
      prefix: 'post:', 
      limit: 100,
      cursor: postCursor ?? null
    });
    
    for (const key of postList.keys) {
      const postData = await env.POSTS_KV.get(key.name);
      if (!postData) continue;
      
      const post = JSON.parse(postData);
      
      // Remove posts deleted more than 30 days ago
      if (post.isDeleted && post.deletedAt && post.deletedAt < thirtyDaysAgo) {
        await env.POSTS_KV.delete(key.name);
        postsCleaned++;
      } else if (post.isTakenDown && post.takenDownAt && post.takenDownAt < thirtyDaysAgo) {
        // Also clean up old takedowns
        await env.POSTS_KV.delete(key.name);
        postsCleaned++;
      }
    }
    
    postCursor = postList.list_complete ? undefined : postList.cursor;
  } while (postCursor);
  
  // Clean up rate limit entries
  let rlCursor: string | undefined;
  do {
    const rlList = await env.SESSIONS_KV.list({ 
      prefix: 'rl:', 
      limit: 100,
      cursor: rlCursor ?? null
    });
    
    for (const key of rlList.keys) {
      const rlData = await env.SESSIONS_KV.get(key.name);
      if (!rlData) continue;
      
      try {
        const rl = JSON.parse(rlData);
        if (rl.resetAt && rl.resetAt < Date.now()) {
          await env.SESSIONS_KV.delete(key.name);
          rlCleaned++;
        }
      } catch {
        // Invalid data, delete it
        await env.SESSIONS_KV.delete(key.name);
        rlCleaned++;
      }
    }
    
    rlCursor = rlList.list_complete ? undefined : rlList.cursor;
  } while (rlCursor);
  
  console.log(`KV compaction complete: ${sessionsCleaned} sessions, ${postsCleaned} posts, ${rlCleaned} rate limits cleaned`);
}

/**
 * Get FoF ranked posts for a user's feed
 */
export async function getFoFRankedPosts(
  env: Env,
  userId: string,
  followingIds: string[],
  limit: number = 10
): Promise<Array<{ postId: string; score: number }>> {
  // Get pre-computed rankings
  const rankedData = await env.FEEDS_KV.get('fof:ranked');
  if (!rankedData) return [];
  
  const rankedPosts = JSON.parse(rankedData);
  
  // Get user's blocked list
  const userDoId = env.USER_DO.idFromName(userId);
  const userStub = env.USER_DO.get(userDoId);
  const blockedResp = await userStub.fetch('https://do.internal/blocked');
  const blockedData = await blockedResp.json() as { blocked: string[] };
  const blockedIds = new Set(blockedData.blocked || []);
  
  // Get friends-of-friends (users followed by people you follow)
  const fofSet = new Set<string>();
  for (const followingId of followingIds) {
    const followingDoId = env.USER_DO.idFromName(followingId);
    const followingStub = env.USER_DO.get(followingDoId);
    const fofResp = await followingStub.fetch('https://do.internal/following');
    const fofData = await fofResp.json() as { following: string[] };
    
    for (const fofId of fofData.following || []) {
      // Don't include users you already follow or yourself
      if (!followingIds.includes(fofId) && fofId !== userId) {
        fofSet.add(fofId);
      }
    }
  }
  
  // Filter ranked posts to only FoF authors, excluding blocked users
  const fofPosts = rankedPosts.filter((post: any) => 
    fofSet.has(post.authorId) && !blockedIds.has(post.authorId)
  );
  
  return fofPosts.slice(0, limit);
}