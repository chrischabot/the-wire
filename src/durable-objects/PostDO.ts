/**
 * Post Durable Object
 * Manages post state, likes, and interaction counters
 */

import type { Post } from '../types/post';

interface PostState {
  post: Post;
  likes: string[];  // User IDs who liked this post
  reposts: string[]; // User IDs who reposted this post
}

export class PostDO implements DurableObject {
  private state: PostState | null = null;

  constructor(private durableState: DurableObjectState) {}

  /**
   * Lazy load state from durable storage
   */
  private async ensureState(): Promise<PostState> {
    if (this.state) {
      return this.state;
    }

    const stored = await this.durableState.storage.get<PostState>('state');
    if (stored) {
      // Backward compatibility: ensure reposts array exists
      if (!Array.isArray((stored as any).reposts)) {
        (stored as any).reposts = [];
      }
      this.state = stored;
      return stored;
    }

    throw new Error('PostDO state not initialized');
  }

  /**
   * Save state to durable storage
   */
  private async saveState(): Promise<void> {
    if (!this.state) return;
    await this.durableState.storage.put('state', this.state);
  }

  /**
   * Initialize a new post
   */
  async initialize(post: Post): Promise<void> {
    this.state = {
      post,
      likes: [],
      reposts: [],
    };
    await this.saveState();
  }

  /**
   * Get post data
   */
  async getPost(): Promise<Post> {
    const state = await this.ensureState();
    return state.post;
  }

  /**
   * Like the post
   */
  async like(userId: string): Promise<number> {
    const state = await this.ensureState();
    if (!state.likes.includes(userId)) {
      state.likes.push(userId);
      state.post.likeCount++;
      await this.saveState();
    }
    return state.post.likeCount;
  }

  /**
   * Unlike the post
   */
  async unlike(userId: string): Promise<number> {
    const state = await this.ensureState();
    const index = state.likes.indexOf(userId);
    if (index > -1) {
      state.likes.splice(index, 1);
      state.post.likeCount = Math.max(0, state.post.likeCount - 1);
      await this.saveState();
    }
    return state.post.likeCount;
  }

  /**
   * Check if user has liked the post
   */
  async hasLiked(userId: string): Promise<boolean> {
    const state = await this.ensureState();
    return state.likes.includes(userId);
  }

  /**
   * Increment reply count
   */
  async incrementReplyCount(): Promise<number> {
    const state = await this.ensureState();
    state.post.replyCount++;
    await this.saveState();
    return state.post.replyCount;
  }

  /**
   * Add repost
   */
  async addRepost(userId: string): Promise<number> {
    const state = await this.ensureState();
    if (!state.reposts.includes(userId)) {
      state.reposts.push(userId);
      state.post.repostCount++;
      await this.saveState();
    }
    return state.post.repostCount;
  }

  /**
   * Remove repost
   */
  async removeRepost(userId: string): Promise<number> {
    const state = await this.ensureState();
    const index = state.reposts.indexOf(userId);
    if (index > -1) {
      state.reposts.splice(index, 1);
      state.post.repostCount = Math.max(0, state.post.repostCount - 1);
      await this.saveState();
    }
    return state.post.repostCount;
  }

  /**
   * Check if user has reposted
   */
  async hasReposted(userId: string): Promise<boolean> {
    const state = await this.ensureState();
    return state.reposts.includes(userId);
  }

  /**
   * Increment repost count
   */
  async incrementRepostCount(): Promise<number> {
    const state = await this.ensureState();
    state.post.repostCount++;
    await this.saveState();
    return state.post.repostCount;
  }

  /**
   * Increment quote count
   */
  async incrementQuoteCount(): Promise<number> {
    const state = await this.ensureState();
    state.post.quoteCount++;
    await this.saveState();
    return state.post.quoteCount;
  }

  /**
   * Mark post as deleted
   */
  async delete(): Promise<void> {
    const state = await this.ensureState();
    state.post.isDeleted = true;
    await this.saveState();
  }

  /**
   * Handle HTTP fetch requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Initialize
      if (path === '/initialize' && method === 'POST') {
        const body = await request.json() as { post: Post };
        await this.initialize(body.post);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get post
      if (path === '/post' && method === 'GET') {
        const post = await this.getPost();
        return new Response(JSON.stringify(post), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Like post
      if (path === '/like' && method === 'POST') {
        const body = await request.json() as { userId: string };
        const count = await this.like(body.userId);
        return new Response(JSON.stringify({ likeCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Unlike post
      if (path === '/unlike' && method === 'POST') {
        const body = await request.json() as { userId: string };
        const count = await this.unlike(body.userId);
        return new Response(JSON.stringify({ likeCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if liked
      if (path === '/has-liked' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const hasLiked = await this.hasLiked(userId);
        return new Response(JSON.stringify({ hasLiked }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Increment reply count
      if (path === '/replies/increment' && method === 'POST') {
        const count = await this.incrementReplyCount();
        return new Response(JSON.stringify({ replyCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Increment repost count
      if (path === '/reposts/increment' && method === 'POST') {
        const count = await this.incrementRepostCount();
        return new Response(JSON.stringify({ repostCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Add repost
      if (path === '/repost' && method === 'POST') {
        const body = await request.json() as { userId: string };
        const count = await this.addRepost(body.userId);
        return new Response(JSON.stringify({ repostCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Remove repost
      if (path === '/repost' && method === 'DELETE') {
        const body = await request.json() as { userId: string };
        const count = await this.removeRepost(body.userId);
        return new Response(JSON.stringify({ repostCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if reposted
      if (path === '/has-reposted' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const hasReposted = await this.hasReposted(userId);
        return new Response(JSON.stringify({ hasReposted }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Increment quote count
      if (path === '/quotes/increment' && method === 'POST') {
        const count = await this.incrementQuoteCount();
        return new Response(JSON.stringify({ quoteCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Delete post
      if (path === '/delete' && method === 'POST') {
        await this.delete();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('PostDO fetch error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}