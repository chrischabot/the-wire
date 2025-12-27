/**
 * User Durable Object
 * Manages user profile, settings, and social graph
 */

import type { Env } from '../types/env';
import type { UserProfile, UserSettings, MutedWordEntry, MutedWordScope } from '../types/user';
import { PLACEHOLDERS } from '../constants';

interface UserState {
  profile: UserProfile;
  settings: UserSettings;
  following: string[];      // User IDs
  followers: string[];      // User IDs
  blocked: string[];        // User IDs
  likedPosts?: string[];    // Post IDs the user has liked (for efficient likes tab)
}

const MAX_MUTED_WORDS = 100;

export class UserDO implements DurableObject {
  private state: UserState | null = null;

  // OPTIMIZED: Set caches for O(1) membership checks
  private followingSet: Set<string> | null = null;
  private followersSet: Set<string> | null = null;
  private blockedSet: Set<string> | null = null;

  constructor(
    private durableState: DurableObjectState,
    private env: Env
  ) {}

  /**
   * Lazy load state from durable storage
   * OPTIMIZED: Builds Set caches for O(1) lookups
   */
  private async ensureState(): Promise<UserState> {
    if (this.state) {
      return this.state;
    }

    const stored = await this.durableState.storage.get<UserState>('state');
    if (stored) {
      this.state = stored;
      // Build Set caches for O(1) membership checks
      this.followingSet = new Set(stored.following);
      this.followersSet = new Set(stored.followers);
      this.blockedSet = new Set(stored.blocked);
      return stored;
    }

    throw new Error('UserDO state not initialized');
  }

  /**
   * Save state to durable storage
   */
  private async saveState(): Promise<void> {
    if (!this.state) return;
    await this.durableState.storage.put('state', this.state);
  }

  /**
   * Initialize a new user profile
   */
  async initialize(profile: UserProfile, settings: UserSettings): Promise<void> {
    this.state = {
      profile,
      settings,
      following: [],
      followers: [],
      blocked: [],
    };
    // Initialize empty Sets for O(1) lookups
    this.followingSet = new Set();
    this.followersSet = new Set();
    this.blockedSet = new Set();
    await this.saveState();
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<UserProfile> {
    const state = await this.ensureState();
    return {
      ...state.profile,
      avatarUrl: state.profile.avatarUrl || PLACEHOLDERS.AVATAR,
      bannerUrl: state.profile.bannerUrl || PLACEHOLDERS.BANNER,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const state = await this.ensureState();
    state.profile = { ...state.profile, ...updates };
    await this.saveState();

    const cacheKey = `profile:${state.profile.handle}`;
    await this.env.USERS_KV.delete(cacheKey);

    return {
      ...state.profile,
      avatarUrl: state.profile.avatarUrl || PLACEHOLDERS.AVATAR,
      bannerUrl: state.profile.bannerUrl || PLACEHOLDERS.BANNER,
    };
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<UserSettings> {
    const state = await this.ensureState();
    const { mutedWords, changed } = this.normalizeMutedWords(state.settings?.mutedWords);
    if (changed) {
      state.settings.mutedWords = mutedWords;
      await this.saveState();
    }
    return { ...state.settings, mutedWords };
  }

  /**
   * Update user settings
   */
  async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const state = await this.ensureState();
    const nextSettings = { ...state.settings, ...updates };
    if (updates.mutedWords !== undefined) {
      const { mutedWords } = this.normalizeMutedWords(updates.mutedWords);
      nextSettings.mutedWords = mutedWords;
    }
    state.settings = nextSettings;
    await this.saveState();
    return state.settings;
  }

  /**
   * Follow another user
   * OPTIMIZED: Uses Set for O(1) membership check
   */
  async follow(userId: string): Promise<void> {
    await this.ensureState();
    if (!this.followingSet!.has(userId)) {
      this.state!.following.push(userId);
      this.followingSet!.add(userId);
      this.state!.profile.followingCount++;
      await this.saveState();
    }
  }

  /**
   * Unfollow a user
   * OPTIMIZED: Uses Set for O(1) membership check
   */
  async unfollow(userId: string): Promise<void> {
    await this.ensureState();

    // Prevent unfollowing yourself
    if (userId === this.state!.profile.id) {
      return;
    }

    if (this.followingSet!.has(userId)) {
      const index = this.state!.following.indexOf(userId);
      if (index > -1) {
        this.state!.following.splice(index, 1);
      }
      this.followingSet!.delete(userId);
      this.state!.profile.followingCount = Math.max(0, this.state!.profile.followingCount - 1);
      await this.saveState();
    }
  }

  /**
   * Add a follower
   * OPTIMIZED: Uses Set for O(1) membership check
   */
  async addFollower(userId: string): Promise<void> {
    await this.ensureState();
    if (!this.followersSet!.has(userId)) {
      this.state!.followers.push(userId);
      this.followersSet!.add(userId);
      this.state!.profile.followerCount++;
      await this.saveState();
    }
  }

  /**
   * Remove a follower
   * OPTIMIZED: Uses Set for O(1) membership check
   */
  async removeFollower(userId: string): Promise<void> {
    await this.ensureState();

    // Prevent removing yourself as a follower
    if (userId === this.state!.profile.id) {
      return;
    }

    if (this.followersSet!.has(userId)) {
      const index = this.state!.followers.indexOf(userId);
      if (index > -1) {
        this.state!.followers.splice(index, 1);
      }
      this.followersSet!.delete(userId);
      this.state!.profile.followerCount = Math.max(0, this.state!.profile.followerCount - 1);
      await this.saveState();
    }
  }

  /**
   * Block a user
   * OPTIMIZED: Uses Set for O(1) membership check
   */
  async block(userId: string): Promise<void> {
    await this.ensureState();

    // Prevent blocking yourself
    if (userId === this.state!.profile.id) {
      return;
    }

    if (!this.blockedSet!.has(userId)) {
      this.state!.blocked.push(userId);
      this.blockedSet!.add(userId);
      await this.saveState();

      await this.unfollow(userId);
      await this.removeFollower(userId);
    }
  }

  /**
   * Unblock a user
   * OPTIMIZED: Uses Set for O(1) membership check
   */
  async unblock(userId: string): Promise<void> {
    await this.ensureState();
    if (this.blockedSet!.has(userId)) {
      const index = this.state!.blocked.indexOf(userId);
      if (index > -1) {
        this.state!.blocked.splice(index, 1);
      }
      this.blockedSet!.delete(userId);
      await this.saveState();
    }
  }

  /**
   * Check if following a user
   * OPTIMIZED: O(1) Set lookup instead of O(n) array includes
   */
  async isFollowing(userId: string): Promise<boolean> {
    await this.ensureState();
    return this.followingSet!.has(userId);
  }

  /**
   * Check if user is blocked
   * OPTIMIZED: O(1) Set lookup instead of O(n) array includes
   */
  async isBlocked(userId: string): Promise<boolean> {
    await this.ensureState();
    return this.blockedSet!.has(userId);
  }

  /**
   * Get following list
   */
  async getFollowing(): Promise<string[]> {
    const state = await this.ensureState();
    return state.following;
  }

  /**
   * Get followers list
   */
  async getFollowers(): Promise<string[]> {
    const state = await this.ensureState();
    return state.followers;
  }

  /**
   * Get blocked users list
   */
  async getBlocked(): Promise<string[]> {
    const state = await this.ensureState();
    return state.blocked;
  }

  /**
   * Increment post count
   */
  async incrementPostCount(): Promise<number> {
    const state = await this.ensureState();
    state.profile.postCount++;
    await this.saveState();
    return state.profile.postCount;
  }

  /**
   * Decrement post count
   */
  async decrementPostCount(): Promise<number> {
    const state = await this.ensureState();
    state.profile.postCount = Math.max(0, state.profile.postCount - 1);
    await this.saveState();
    return state.profile.postCount;
  }

  /**
   * Ban user (admin action)
   */
  async ban(reason: string): Promise<void> {
    const state = await this.ensureState();
    state.profile.isBanned = true;
    state.profile.bannedAt = Date.now();
    state.profile.bannedReason = reason;
    await this.saveState();
  }

  /**
   * Unban user (admin action)
   */
  async unban(): Promise<void> {
    const state = await this.ensureState();
    state.profile.isBanned = false;
    state.profile.bannedAt = undefined;
    state.profile.bannedReason = undefined;
    await this.saveState();
  }

  /**
   * Check if user is banned
   */
  async isBanned(): Promise<boolean> {
    const state = await this.ensureState();
    return state.profile.isBanned || false;
  }

  /**
   * Set admin status
   */
  async setAdmin(isAdmin: boolean): Promise<void> {
    const state = await this.ensureState();
    state.profile.isAdmin = isAdmin;
    await this.saveState();
  }

  /**
   * Check if user is admin
   */
  async isAdmin(): Promise<boolean> {
    const state = await this.ensureState();
    return state.profile.isAdmin || false;
  }

  /**
   * Add a liked post to user's likes list
   */
  async addLikedPost(postId: string): Promise<void> {
    const state = await this.ensureState();
    if (!state.likedPosts) state.likedPosts = [];
    if (!state.likedPosts.includes(postId)) {
      state.likedPosts.unshift(postId); // Add to front (most recent first)
      // Keep only most recent 1000 likes
      if (state.likedPosts.length > 1000) {
        state.likedPosts = state.likedPosts.slice(0, 1000);
      }
      await this.saveState();
    }
  }

  /**
   * Remove a liked post from user's likes list
   */
  async removeLikedPost(postId: string): Promise<void> {
    const state = await this.ensureState();
    if (!state.likedPosts) return;
    const index = state.likedPosts.indexOf(postId);
    if (index > -1) {
      state.likedPosts.splice(index, 1);
      await this.saveState();
    }
  }

  /**
   * Get user's liked posts (most recent first)
   */
  async getLikedPosts(limit: number = 50): Promise<string[]> {
    const state = await this.ensureState();
    return (state.likedPosts || []).slice(0, limit);
  }

  private normalizeMutedWords(input: unknown): { mutedWords: MutedWordEntry[]; changed: boolean } {
    if (!Array.isArray(input)) {
      return { mutedWords: [], changed: input !== undefined };
    }

    const now = Date.now();
    const mutedWords: MutedWordEntry[] = [];
    const seen = new Set<string>();
    let changed = false;

    for (const entry of input) {
      let word = '';
      let scope: MutedWordScope = 'all';
      let expiresAt: number | null | undefined;

      if (typeof entry === 'string') {
        word = entry;
        changed = true;
      } else if (entry && typeof entry === 'object') {
        const rawWord = (entry as MutedWordEntry).word;
        word = typeof rawWord === 'string' ? rawWord : '';
        const rawScope = (entry as MutedWordEntry).scope;
        scope = rawScope === 'not_following' ? 'not_following' : 'all';
        if (rawScope && rawScope !== scope) {
          changed = true;
        }
        const rawExpires = (entry as MutedWordEntry).expiresAt;
        if (typeof rawExpires === 'number') {
          expiresAt = rawExpires;
        } else if (rawExpires != null) {
          changed = true;
        }
      } else {
        changed = true;
        continue;
      }

      const normalized = word.trim().toLowerCase();
      if (!normalized) {
        changed = true;
        continue;
      }
      if (normalized !== word) {
        changed = true;
      }

      if (expiresAt && expiresAt <= now) {
        changed = true;
        continue;
      }

      const key = `${normalized}:${scope}`;
      if (seen.has(key)) {
        changed = true;
        continue;
      }
      seen.add(key);

      const record: MutedWordEntry = { word: normalized, scope };
      if (expiresAt) record.expiresAt = expiresAt;
      mutedWords.push(record);
      if (mutedWords.length >= MAX_MUTED_WORDS) {
        changed = true;
        break;
      }
    }

    return { mutedWords, changed };
  }

  /**
   * Structured logging helper for Durable Objects
   */
  private log(level: string, message: string, context?: Record<string, unknown>, error?: Error) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { durableObject: 'UserDO', ...context },
      ...(error && { error: { name: error.name, message: error.message, stack: error.stack } }),
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    }
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
        const body = await request.json() as { profile: UserProfile; settings: UserSettings };
        await this.initialize(body.profile, body.settings);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Profile operations
      if (path === '/profile' && method === 'GET') {
        const profile = await this.getProfile();
        return new Response(JSON.stringify(profile), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/profile' && method === 'PUT') {
        const updates = await request.json() as Partial<UserProfile>;
        const profile = await this.updateProfile(updates);
        return new Response(JSON.stringify(profile), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Settings operations
      if (path === '/settings' && method === 'GET') {
        const settings = await this.getSettings();
        return new Response(JSON.stringify(settings), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/settings' && method === 'PUT') {
        const updates = await request.json() as Partial<UserSettings>;
        const settings = await this.updateSettings(updates);
        return new Response(JSON.stringify(settings), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // BATCHED: Get all context in one call (blocked, mutedWords, following)
      if (path === '/context' && method === 'GET') {
        const state = await this.ensureState();
        const { mutedWords, changed } = this.normalizeMutedWords(state.settings?.mutedWords);
        if (changed) {
          state.settings.mutedWords = mutedWords;
          await this.saveState();
        }
        return new Response(JSON.stringify({
          blocked: state.blocked || [],
          mutedWords,
          following: state.following || [],
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Follow operations
      if (path === '/follow' && method === 'POST') {
        const body = await request.json() as { userId: string };
        await this.follow(body.userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/unfollow' && method === 'POST') {
        const body = await request.json() as { userId: string };
        await this.unfollow(body.userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Follower operations
      if (path === '/add-follower' && method === 'POST') {
        const body = await request.json() as { userId: string };
        await this.addFollower(body.userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/remove-follower' && method === 'POST') {
        const body = await request.json() as { userId: string };
        await this.removeFollower(body.userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Block operations
      if (path === '/block' && method === 'POST') {
        const body = await request.json() as { userId: string };
        await this.block(body.userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/unblock' && method === 'POST') {
        const body = await request.json() as { userId: string };
        await this.unblock(body.userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Liked posts operations
      if (path === '/add-liked-post' && method === 'POST') {
        const body = await request.json() as { postId: string };
        await this.addLikedPost(body.postId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/remove-liked-post' && method === 'POST') {
        const body = await request.json() as { postId: string };
        await this.removeLikedPost(body.postId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/liked-posts' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const likedPosts = await this.getLikedPosts(limit);
        return new Response(JSON.stringify({ likedPosts }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // List operations
      if (path === '/following' && method === 'GET') {
        const following = await this.getFollowing();
        return new Response(JSON.stringify({ following }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/followers' && method === 'GET') {
        const followers = await this.getFollowers();
        return new Response(JSON.stringify({ followers }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/blocked' && method === 'GET') {
        const blocked = await this.getBlocked();
        return new Response(JSON.stringify({ blocked }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Relationship checks
      if (path === '/is-following' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const isFollowing = await this.isFollowing(userId);
        return new Response(JSON.stringify({ isFollowing }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/is-blocked' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const isBlocked = await this.isBlocked(userId);
        return new Response(JSON.stringify({ isBlocked }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Post count operations
      if (path === '/posts/increment' && method === 'POST') {
        const count = await this.incrementPostCount();
        return new Response(JSON.stringify({ postCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/posts/decrement' && method === 'POST') {
        const count = await this.decrementPostCount();
        return new Response(JSON.stringify({ postCount: count }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/posts/reset' && method === 'POST') {
        const state = await this.ensureState();
        state.profile.postCount = 0;
        await this.saveState();
        return new Response(JSON.stringify({ postCount: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Sync counts - fix mismatched follower/following counts
      if (path === '/sync-counts' && method === 'POST') {
        const state = await this.ensureState();
        state.profile.followingCount = state.following.length;
        state.profile.followerCount = state.followers.length;
        await this.saveState();
        return new Response(JSON.stringify({
          followingCount: state.profile.followingCount,
          followerCount: state.profile.followerCount,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Ban operations
      if (path === '/ban' && method === 'POST') {
        const body = await request.json() as { reason: string };
        await this.ban(body.reason);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/unban' && method === 'POST') {
        await this.unban();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/is-banned' && method === 'GET') {
        const banned = await this.isBanned();
        return new Response(JSON.stringify({ isBanned: banned }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Admin operations
      if (path === '/set-admin' && method === 'POST') {
        const body = await request.json() as { isAdmin: boolean };
        await this.setAdmin(body.isAdmin);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/is-admin' && method === 'GET') {
        const admin = await this.isAdmin();
        return new Response(JSON.stringify({ isAdmin: admin }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('error', 'UserDO fetch error', { path, method }, err);
      return new Response(JSON.stringify({ error: 'Internal error', details: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
