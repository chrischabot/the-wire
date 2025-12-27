/**
 * Durable Object client utilities
 * Reduces boilerplate for common DO operations
 */

import type { Env } from '../types/env';

type DONamespace = 'USER_DO' | 'POST_DO' | 'FEED_DO' | 'WEBSOCKET_DO';

interface DOClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Get a Durable Object stub by name
 */
export function getDOStub(env: Env, namespace: DONamespace, name: string) {
  const doNamespace = env[namespace];
  const id = doNamespace.idFromName(name);
  return doNamespace.get(id);
}

/**
 * Make a request to a Durable Object
 */
export async function callDO<T = unknown>(
  env: Env,
  namespace: DONamespace,
  name: string,
  path: string,
  options: DOClientOptions = {}
): Promise<T> {
  const stub = getDOStub(env, namespace, name);
  const { method = 'GET', body, headers = {} } = options;

  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await stub.fetch(`https://do.internal${path}`, requestOptions);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DO request failed: ${error}`);
  }

  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// Convenience methods for UserDO
export const UserDO = {
  async getProfile(env: Env, userId: string) {
    return callDO(env, 'USER_DO', userId, '/profile');
  },

  async updateProfile(env: Env, userId: string, profile: Record<string, unknown>) {
    return callDO(env, 'USER_DO', userId, '/profile', {
      method: 'PUT',
      body: profile,
    });
  },

  async getSettings(env: Env, userId: string) {
    return callDO(env, 'USER_DO', userId, '/settings');
  },

  async follow(env: Env, userId: string, targetId: string) {
    return callDO(env, 'USER_DO', userId, '/follow', {
      method: 'POST',
      body: { targetId },
    });
  },

  async unfollow(env: Env, userId: string, targetId: string) {
    return callDO(env, 'USER_DO', userId, '/unfollow', {
      method: 'POST',
      body: { targetId },
    });
  },

  async getFollowing(env: Env, userId: string): Promise<string[]> {
    return callDO(env, 'USER_DO', userId, '/following');
  },

  async getFollowers(env: Env, userId: string): Promise<string[]> {
    return callDO(env, 'USER_DO', userId, '/followers');
  },

  async getBlocked(env: Env, userId: string): Promise<string[]> {
    return callDO(env, 'USER_DO', userId, '/blocked');
  },

  async isAdmin(env: Env, userId: string): Promise<boolean> {
    const profile = await this.getProfile(env, userId);
    return (profile as { isAdmin?: boolean })?.isAdmin || false;
  },
};

// Convenience methods for PostDO
export const PostDO = {
  async initialize(env: Env, postId: string, postData: unknown) {
    return callDO(env, 'POST_DO', postId, '/initialize', {
      method: 'POST',
      body: postData,
    });
  },

  async getPost(env: Env, postId: string) {
    return callDO(env, 'POST_DO', postId, '/post');
  },

  async like(env: Env, postId: string, userId: string) {
    return callDO(env, 'POST_DO', postId, '/like', {
      method: 'POST',
      body: { userId },
    });
  },

  async unlike(env: Env, postId: string, userId: string) {
    return callDO(env, 'POST_DO', postId, '/unlike', {
      method: 'POST',
      body: { userId },
    });
  },

  async repost(env: Env, postId: string, userId: string) {
    return callDO(env, 'POST_DO', postId, '/repost', {
      method: 'POST',
      body: { userId },
    });
  },

  async unrepost(env: Env, postId: string, userId: string) {
    return callDO(env, 'POST_DO', postId, '/unrepost', {
      method: 'POST',
      body: { userId },
    });
  },

  async hasLiked(env: Env, postId: string, userId: string): Promise<boolean> {
    return callDO(env, 'POST_DO', postId, `/has-liked?userId=${userId}`);
  },

  async hasReposted(env: Env, postId: string, userId: string): Promise<boolean> {
    return callDO(env, 'POST_DO', postId, `/has-reposted?userId=${userId}`);
  },
};

// Convenience methods for FeedDO
export const FeedDO = {
  async addEntry(env: Env, userId: string, entry: unknown) {
    return callDO(env, 'FEED_DO', userId, '/add', {
      method: 'POST',
      body: entry,
    });
  },

  async getFeed(env: Env, userId: string, limit = 20, cursor?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return callDO(env, 'FEED_DO', userId, `/feed?${params}`);
  },

  async removeEntry(env: Env, userId: string, postId: string) {
    return callDO(env, 'FEED_DO', userId, '/remove', {
      method: 'POST',
      body: { postId },
    });
  },
};
