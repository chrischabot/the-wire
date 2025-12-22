/**
 * Feed handlers for The Wire
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { PostMetadata } from '../types/post';
import { requireAuth } from '../middleware/auth';

const feed = new Hono<{ Bindings: Env }>();

/**
 * GET /api/feed/home - Get user's home timeline
 */
feed.get('/home', requireAuth, async (c) => {
  const userId = c.get('userId');
  const cursor = c.req.query('cursor');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  try {
    // Get user's blocked list and muted words from UserDO
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    
    const [blockedResp, settingsResp] = await Promise.all([
      userStub.fetch('https://do.internal/blocked'),
      userStub.fetch('https://do.internal/settings'),
    ]);
    
    const blockedData = await blockedResp.json();
    const settingsData = await settingsResp.json();
    
    const blockedUserIds = blockedData.blocked || [];
    const mutedWords = settingsData.mutedWords || [];

    // Get feed from FeedDO with filters
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
    const feedData = await feedResp.json();

    // Fetch full post metadata for each entry
    const posts = await Promise.all(
      feedData.entries.map(async (entry: any) => {
        const postData = await c.env.POSTS_KV.get(`post:${entry.postId}`);
        if (postData) {
          return JSON.parse(postData);
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
    console.error('Error fetching home feed:', error);
    return c.json({ success: false, error: 'Error fetching feed' }, 500);
  }
});

export default feed;