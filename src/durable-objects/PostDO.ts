/**
 * Post Durable Object
 * Manages post state, likes, and interaction counters
 */

import type { Post } from "../types/post";

interface PostStateStored {
  post: Post;
  likes: string[];
  reposts: string[];
}

interface PostStateRuntime {
  post: Post;
  likesSet: Set<string>;
  repostsSet: Set<string>;
}

export class PostDO implements DurableObject {
  private state: PostStateRuntime | null = null;

  constructor(private durableState: DurableObjectState) {}

  private async ensureState(): Promise<PostStateRuntime> {
    if (this.state) {
      return this.state;
    }

    const stored =
      await this.durableState.storage.get<PostStateStored>("state");
    if (stored) {
      this.state = {
        post: stored.post,
        likesSet: new Set(stored.likes || []),
        repostsSet: new Set(stored.reposts || []),
      };
      return this.state;
    }

    throw new Error("PostDO state not initialized");
  }

  private async saveState(): Promise<void> {
    if (!this.state) return;
    const toStore: PostStateStored = {
      post: this.state.post,
      likes: [...this.state.likesSet],
      reposts: [...this.state.repostsSet],
    };
    await this.durableState.storage.put("state", toStore);
  }

  async initialize(post: Post): Promise<void> {
    this.state = {
      post,
      likesSet: new Set(),
      repostsSet: new Set(),
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

  async like(userId: string): Promise<number> {
    const state = await this.ensureState();
    if (!state.likesSet.has(userId)) {
      state.likesSet.add(userId);
      state.post.likeCount++;
      await this.saveState();
    }
    return state.post.likeCount;
  }

  async unlike(userId: string): Promise<number> {
    const state = await this.ensureState();
    if (state.likesSet.has(userId)) {
      state.likesSet.delete(userId);
      state.post.likeCount = Math.max(0, state.post.likeCount - 1);
      await this.saveState();
    }
    return state.post.likeCount;
  }

  async hasLiked(userId: string): Promise<boolean> {
    const state = await this.ensureState();
    return state.likesSet.has(userId);
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

  async addRepost(userId: string): Promise<number> {
    const state = await this.ensureState();
    if (!state.repostsSet.has(userId)) {
      state.repostsSet.add(userId);
      state.post.repostCount++;
      await this.saveState();
    }
    return state.post.repostCount;
  }

  async removeRepost(userId: string): Promise<number> {
    const state = await this.ensureState();
    if (state.repostsSet.has(userId)) {
      state.repostsSet.delete(userId);
      state.post.repostCount = Math.max(0, state.post.repostCount - 1);
      await this.saveState();
    }
    return state.post.repostCount;
  }

  async hasReposted(userId: string): Promise<boolean> {
    const state = await this.ensureState();
    return state.repostsSet.has(userId);
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
      if (path === "/initialize" && method === "POST") {
        const body = (await request.json()) as { post: Post };
        await this.initialize(body.post);
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get post
      if (path === "/post" && method === "GET") {
        const post = await this.getPost();
        return new Response(JSON.stringify(post), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Like post
      if (path === "/like" && method === "POST") {
        const body = (await request.json()) as { userId: string };
        const count = await this.like(body.userId);
        return new Response(JSON.stringify({ likeCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Unlike post
      if (path === "/unlike" && method === "POST") {
        const body = (await request.json()) as { userId: string };
        const count = await this.unlike(body.userId);
        return new Response(JSON.stringify({ likeCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if liked
      if (path === "/has-liked" && method === "GET") {
        const userId = url.searchParams.get("userId");
        if (!userId) {
          return new Response(JSON.stringify({ error: "userId required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const hasLiked = await this.hasLiked(userId);
        return new Response(JSON.stringify({ hasLiked }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Increment reply count
      if (path === "/replies/increment" && method === "POST") {
        const count = await this.incrementReplyCount();
        return new Response(JSON.stringify({ replyCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Increment repost count
      if (path === "/reposts/increment" && method === "POST") {
        const count = await this.incrementRepostCount();
        return new Response(JSON.stringify({ repostCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Add repost
      if (path === "/repost" && method === "POST") {
        const body = (await request.json()) as { userId: string };
        const count = await this.addRepost(body.userId);
        return new Response(JSON.stringify({ repostCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Remove repost
      if (path === "/repost" && method === "DELETE") {
        const body = (await request.json()) as { userId: string };
        const count = await this.removeRepost(body.userId);
        return new Response(JSON.stringify({ repostCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if reposted
      if (path === "/has-reposted" && method === "GET") {
        const userId = url.searchParams.get("userId");
        if (!userId) {
          return new Response(JSON.stringify({ error: "userId required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const hasReposted = await this.hasReposted(userId);
        return new Response(JSON.stringify({ hasReposted }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Increment quote count
      if (path === "/quotes/increment" && method === "POST") {
        const count = await this.incrementQuoteCount();
        return new Response(JSON.stringify({ quoteCount: count }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Delete post
      if (path === "/delete" && method === "POST") {
        await this.delete();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("PostDO fetch error:", error);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
