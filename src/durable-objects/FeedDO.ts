/**
 * Feed Durable Object
 * Manages a user's personalized timeline/feed with complete filtering
 */

import type { Env } from '../types/env';
import type { PostMetadata } from '../types/post';
import { LIMITS } from '../constants';

export interface FeedEntry {
  postId: string;
  authorId: string;
  timestamp: number;
  source: 'own' | 'follow' | 'fof';
}

interface FeedState {
  entries: FeedEntry[];
  maxEntries: number;
}

export class FeedDO implements DurableObject {
  private state: FeedState | null = null;

  constructor(
    private durableState: DurableObjectState,
    private env: Env
  ) {}

  /**
   * Lazy load state from durable storage
   */
  private async ensureState(): Promise<FeedState> {
    if (this.state) {
      return this.state;
    }

    const stored = await this.durableState.storage.get<FeedState>('state');
    if (stored) {
      this.state = stored;
      return stored;
    }

    this.state = {
      entries: [],
      maxEntries: LIMITS.MAX_FEED_ENTRIES,
    };
    await this.saveState();
    return this.state;
  }

  /**
   * Save state to durable storage
   */
  private async saveState(): Promise<void> {
    if (!this.state) return;
    await this.durableState.storage.put('state', this.state);
  }

  /**
   * Apply filters to feed entries based on blocked users and muted words
   */
  private async applyFilters(
    entries: FeedEntry[],
    blockedUserIds: string[],
    mutedWords: string[]
  ): Promise<FeedEntry[]> {
    let filtered = entries;

    // Filter blocked authors
    if (blockedUserIds.length > 0) {
      filtered = filtered.filter((entry) => !blockedUserIds.includes(entry.authorId));
    }

    // Filter posts with muted words
    if (mutedWords.length > 0) {
      const normalizedMuted = mutedWords.map((w) => w.toLowerCase());
      
      const entriesWithContent = await Promise.all(
        filtered.map(async (entry) => {
          try {
            // Fetch post metadata from KV to get content
            const postData = await this.env.POSTS_KV.get(`post:${entry.postId}`);
            if (!postData) return { entry, include: false };
            
            const post: PostMetadata = JSON.parse(postData);
            const contentLower = post.content.toLowerCase();
            
            // Check if content contains any muted word
            const hasMutedWord = normalizedMuted.some((word) => 
              contentLower.includes(word)
            );
            
            return { entry, include: !hasMutedWord };
          } catch (error) {
            // If we can't fetch the post, exclude it for safety
            console.error(`Error fetching post ${entry.postId} for muted word filtering:`, error);
            return { entry, include: false };
          }
        })
      );

      filtered = entriesWithContent
        .filter((item) => item.include)
        .map((item) => item.entry);
    }

    return filtered;
  }

  /**
   * Add a post entry to the feed
   */
  async addEntry(entry: FeedEntry): Promise<void> {
    const state = await this.ensureState();
    
    const exists = state.entries.some((e) => e.postId === entry.postId);
    if (exists) return;

    state.entries.unshift(entry);

    if (state.entries.length > state.maxEntries) {
      state.entries = state.entries.slice(0, state.maxEntries);
    }

    await this.saveState();
  }

  /**
   * Remove a post entry from the feed
   */
  async removeEntry(postId: string): Promise<void> {
    const state = await this.ensureState();
    
    state.entries = state.entries.filter((e) => e.postId !== postId);
    await this.saveState();
  }

  /**
   * Get feed entries with filtering and pagination
   */
  async getFeed(
    cursor?: string,
    limit: number = 20,
    blockedUserIds: string[] = [],
    mutedWords: string[] = []
  ): Promise<{
    entries: FeedEntry[];
    cursor: string | null;
    hasMore: boolean;
  }> {
    const state = await this.ensureState();
    
    // Apply filters (blocked users and muted words)
    const filteredEntries = await this.applyFilters(
      state.entries,
      blockedUserIds,
      mutedWords
    );

    let startIndex = 0;
    if (cursor) {
      try {
        startIndex = parseInt(atob(cursor), 10);
      } catch {
        startIndex = 0;
      }
    }

    const entries = filteredEntries.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filteredEntries.length;
    const nextCursor = hasMore ? btoa((startIndex + limit).toString()) : null;

    return {
      entries,
      cursor: nextCursor,
      hasMore,
    };
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    const state = await this.ensureState();
    state.entries = [];
    await this.saveState();
  }

  /**
   * Get total entry count
   */
  async getCount(): Promise<number> {
    const state = await this.ensureState();
    return state.entries.length;
  }

  /**
   * Handle HTTP fetch requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Add entry
      if (path === '/add-entry' && method === 'POST') {
        const body = await request.json() as { entry: FeedEntry };
        await this.addEntry(body.entry);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Remove entry
      if (path === '/remove-entry' && method === 'POST') {
        const body = await request.json() as { postId: string };
        await this.removeEntry(body.postId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get feed with filters
      if (path === '/feed' && method === 'GET') {
        const cursor = url.searchParams.get('cursor') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        
        // Parse filter params with validation
        let blockedUserIds: string[] = [];
        let mutedWords: string[] = [];
        
        const blockedParam = url.searchParams.get('blocked');
        if (blockedParam) {
          try {
            blockedUserIds = JSON.parse(blockedParam);
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid blocked parameter' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
        
        const mutedParam = url.searchParams.get('muted');
        if (mutedParam) {
          try {
            mutedWords = JSON.parse(mutedParam);
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid muted parameter' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
        
        const result = await this.getFeed(cursor, limit, blockedUserIds, mutedWords);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Clear feed
      if (path === '/clear' && method === 'POST') {
        await this.clear();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get count
      if (path === '/count' && method === 'GET') {
        const count = await this.getCount();
        return new Response(JSON.stringify({ count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('FeedDO fetch error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}