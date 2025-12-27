/**
 * KV client utilities with consistent error handling
 */

import type { Env } from '../types/env';
import { safeJsonParse } from '../utils/safe-parse';

type KVNamespace = 'USERS_KV' | 'POSTS_KV' | 'SESSIONS_KV' | 'FEEDS_KV';

/**
 * Get and parse JSON from KV
 */
export async function kvGet<T>(
  env: Env,
  namespace: KVNamespace,
  key: string
): Promise<T | null> {
  const data = await env[namespace].get(key);
  return safeJsonParse<T>(data);
}

/**
 * Put JSON to KV
 */
export async function kvPut(
  env: Env,
  namespace: KVNamespace,
  key: string,
  value: unknown,
  options?: KVNamespacePutOptions
): Promise<void> {
  await env[namespace].put(key, JSON.stringify(value), options);
}

/**
 * Delete from KV
 */
export async function kvDelete(
  env: Env,
  namespace: KVNamespace,
  key: string
): Promise<void> {
  await env[namespace].delete(key);
}

/**
 * List keys from KV with pagination
 */
export async function kvList(
  env: Env,
  namespace: KVNamespace,
  options: KVNamespaceListOptions
): Promise<KVNamespaceListResult<unknown, string>> {
  return env[namespace].list(options);
}

// User-specific KV operations
export const UsersKV = {
  async getUser(env: Env, userId: string) {
    return kvGet(env, 'USERS_KV', `user:${userId}`);
  },

  async getUserByEmail(env: Env, email: string) {
    const userId = await env.USERS_KV.get(`email:${email}`);
    if (!userId) return null;
    return this.getUser(env, userId);
  },

  async getUserByHandle(env: Env, handle: string) {
    const userId = await env.USERS_KV.get(`handle:${handle}`);
    if (!userId) return null;
    return this.getUser(env, userId);
  },

  async getProfile(env: Env, handle: string) {
    return kvGet(env, 'USERS_KV', `profile:${handle}`);
  },
};

// Post-specific KV operations
export const PostsKV = {
  async getPost(env: Env, postId: string) {
    return kvGet(env, 'POSTS_KV', `post:${postId}`);
  },

  async putPost(env: Env, postId: string, post: unknown) {
    return kvPut(env, 'POSTS_KV', `post:${postId}`, post);
  },

  async getUserPosts(env: Env, userId: string) {
    return kvGet<string[]>(env, 'POSTS_KV', `user-posts:${userId}`);
  },
};
