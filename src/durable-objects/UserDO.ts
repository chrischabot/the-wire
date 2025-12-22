/**
 * User Durable Object
 * Manages user profile, settings, and social graph
 */

import type { Env } from '../types/env';
import type { UserProfile, UserSettings } from '../types/user';

interface UserState {
  profile: UserProfile;
  settings: UserSettings;
  following: string[];      // User IDs
  followers: string[];      // User IDs
  blocked: string[];        // User IDs
}

export class UserDO implements DurableObject {
  private state: UserState | null = null;

  constructor(
    private durableState: DurableObjectState,
    private env: Env
  ) {}

  /**
   * Lazy load state from durable storage
   */
  private async ensureState(): Promise<UserState> {
    if (this.state) {
      return this.state;
    }

    const stored = await this.durableState.storage.get<UserState>('state');
    if (stored) {
      this.state = stored;
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
    await this.saveState();
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<UserProfile> {
    const state = await this.ensureState();
    return state.profile;
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
    
    return state.profile;
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<UserSettings> {
    const state = await this.ensureState();
    return state.settings;
  }

  /**
   * Update user settings
   */
  async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const state = await this.ensureState();
    state.settings = { ...state.settings, ...updates };
    await this.saveState();
    return state.settings;
  }

  /**
   * Follow another user
   */
  async follow(userId: string): Promise<void> {
    const state = await this.ensureState();
    if (!state.following.includes(userId)) {
      state.following.push(userId);
      state.profile.followingCount++;
      await this.saveState();
    }
  }

  /**
   * Unfollow a user
   */
  async unfollow(userId: string): Promise<void> {
    const state = await this.ensureState();
    const index = state.following.indexOf(userId);
    if (index > -1) {
      state.following.splice(index, 1);
      state.profile.followingCount = Math.max(0, state.profile.followingCount - 1);
      await this.saveState();
    }
  }

  /**
   * Add a follower
   */
  async addFollower(userId: string): Promise<void> {
    const state = await this.ensureState();
    if (!state.followers.includes(userId)) {
      state.followers.push(userId);
      state.profile.followerCount++;
      await this.saveState();
    }
  }

  /**
   * Remove a follower
   */
  async removeFollower(userId: string): Promise<void> {
    const state = await this.ensureState();
    const index = state.followers.indexOf(userId);
    if (index > -1) {
      state.followers.splice(index, 1);
      state.profile.followerCount = Math.max(0, state.profile.followerCount - 1);
      await this.saveState();
    }
  }

  /**
   * Block a user
   */
  async block(userId: string): Promise<void> {
    const state = await this.ensureState();
    if (!state.blocked.includes(userId)) {
      state.blocked.push(userId);
      await this.saveState();
      
      await this.unfollow(userId);
      await this.removeFollower(userId);
    }
  }

  /**
   * Unblock a user
   */
  async unblock(userId: string): Promise<void> {
    const state = await this.ensureState();
    const index = state.blocked.indexOf(userId);
    if (index > -1) {
      state.blocked.splice(index, 1);
      await this.saveState();
    }
  }

  /**
   * Check if following a user
   */
  async isFollowing(userId: string): Promise<boolean> {
    const state = await this.ensureState();
    return state.following.includes(userId);
  }

  /**
   * Check if user is blocked
   */
  async isBlocked(userId: string): Promise<boolean> {
    const state = await this.ensureState();
    return state.blocked.includes(userId);
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
      console.error('UserDO fetch error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}