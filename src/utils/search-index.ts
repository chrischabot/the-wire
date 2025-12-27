/**
 * Search indexing utilities for The Wire
 * Implements KV-based inverted index for full-text search
 */

import type { Env } from '../types/env';

/**
 * Stopwords to exclude from search index
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'and', 'or', 'but', 'if', 'then', 'than', 'so', 'just', 'also',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'you', 'your',
  'he', 'she', 'they', 'we', 'us', 'them', 'his', 'her', 'their', 'our',
  'what', 'which', 'who', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'not', 'only', 'same', 'too', 'very', 'can', 'get', 'got',
]);

/**
 * Minimum word length for indexing
 */
const MIN_WORD_LENGTH = 2;

/**
 * Maximum words to index per post
 */
const MAX_WORDS_PER_POST = 50;

/**
 * Maximum query terms to process
 */
const MAX_QUERY_TERMS = 10;

/**
 * Maximum posts to scan per word during search
 */
const MAX_POSTS_PER_WORD = 500;

/**
 * Tokenize content into searchable words
 * Preserves @mentions and #hashtags
 */
export function tokenize(content: string): string[] {
  if (!content) return [];

  // Normalize to lowercase
  const normalized = content.toLowerCase();

  // Extract words, preserving @mentions and #hashtags
  const words = normalized
    .replace(/[^\w\s@#]/g, ' ')  // Remove punctuation except @#
    .split(/\s+/)
    .filter(word => {
      // Keep @mentions and #hashtags regardless of length
      if (word.startsWith('@') || word.startsWith('#')) {
        return word.length > 1;
      }
      // Filter regular words by length and stopwords
      return word.length >= MIN_WORD_LENGTH && !STOPWORDS.has(word);
    })
    .slice(0, MAX_WORDS_PER_POST);

  // Deduplicate
  return [...new Set(words)];
}

/**
 * Index a post's content for search
 */
export async function indexPostContent(
  env: Env,
  postId: string,
  content: string,
  createdAt: number
): Promise<void> {
  const words = tokenize(content);
  if (words.length === 0) return;

  // Store word -> postId mappings in parallel
  const indexPromises = words.map(word =>
    env.POSTS_KV.put(
      `search:word:${word}:${postId}`,
      JSON.stringify({ createdAt })
    )
  );

  // Store reverse index for cleanup on delete
  indexPromises.push(
    env.POSTS_KV.put(
      `search:idx:${postId}`,
      JSON.stringify({ words })
    )
  );

  await Promise.all(indexPromises);
}

/**
 * Remove a post from the search index
 */
export async function removePostFromIndex(
  env: Env,
  postId: string
): Promise<void> {
  // Get the reverse index to find which words to clean up
  const indexData = await env.POSTS_KV.get(`search:idx:${postId}`);
  if (!indexData) return;

  const { words } = JSON.parse(indexData) as { words: string[] };

  // Delete word -> postId mappings in parallel
  const deletePromises = words.map(word =>
    env.POSTS_KV.delete(`search:word:${word}:${postId}`)
  );

  // Delete reverse index
  deletePromises.push(env.POSTS_KV.delete(`search:idx:${postId}`));

  await Promise.all(deletePromises);
}

/**
 * Index a user for search by handle and display name
 */
export async function indexUser(
  env: Env,
  userId: string,
  handle: string,
  displayName?: string
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Index handle prefixes (3+ characters)
  const handleLower = handle.toLowerCase();
  for (let i = 3; i <= Math.min(handleLower.length, 15); i++) {
    const prefix = handleLower.slice(0, i);
    promises.push(addToUserIndex(env, `search:handle:${prefix}`, userId));
  }

  // Index display name prefixes
  if (displayName) {
    const nameLower = displayName.toLowerCase();
    // Index first word and full name
    const nameParts = nameLower.split(/\s+/).filter(p => p.length >= 3);

    for (const part of nameParts) {
      for (let i = 3; i <= Math.min(part.length, 15); i++) {
        const prefix = part.slice(0, i);
        promises.push(addToUserIndex(env, `search:name:${prefix}`, userId));
      }
    }
  }

  await Promise.all(promises);
}

/**
 * Remove a user from search index
 */
export async function removeUserFromIndex(
  env: Env,
  userId: string,
  handle: string,
  displayName?: string
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Remove handle prefixes
  const handleLower = handle.toLowerCase();
  for (let i = 3; i <= Math.min(handleLower.length, 15); i++) {
    const prefix = handleLower.slice(0, i);
    promises.push(removeFromUserIndex(env, `search:handle:${prefix}`, userId));
  }

  // Remove display name prefixes
  if (displayName) {
    const nameLower = displayName.toLowerCase();
    const nameParts = nameLower.split(/\s+/).filter(p => p.length >= 3);

    for (const part of nameParts) {
      for (let i = 3; i <= Math.min(part.length, 15); i++) {
        const prefix = part.slice(0, i);
        promises.push(removeFromUserIndex(env, `search:name:${prefix}`, userId));
      }
    }
  }

  await Promise.all(promises);
}

/**
 * Add a user ID to a search index key
 */
async function addToUserIndex(
  env: Env,
  key: string,
  userId: string
): Promise<void> {
  const existing = await env.USERS_KV.get(key);
  const ids: string[] = existing ? JSON.parse(existing) : [];

  if (!ids.includes(userId)) {
    ids.push(userId);
    await env.USERS_KV.put(key, JSON.stringify(ids));
  }
}

/**
 * Remove a user ID from a search index key
 */
async function removeFromUserIndex(
  env: Env,
  key: string,
  userId: string
): Promise<void> {
  const existing = await env.USERS_KV.get(key);
  if (!existing) return;

  const ids: string[] = JSON.parse(existing);
  const filtered = ids.filter(id => id !== userId);

  if (filtered.length === 0) {
    await env.USERS_KV.delete(key);
  } else if (filtered.length !== ids.length) {
    await env.USERS_KV.put(key, JSON.stringify(filtered));
  }
}

/**
 * Search for posts matching a query
 * Returns post IDs sorted by relevance
 */
export async function searchPostIds(
  env: Env,
  query: string
): Promise<string[]> {
  const words = tokenize(query).slice(0, MAX_QUERY_TERMS);
  if (words.length === 0) return [];

  // Find posts containing each word
  const matchingSets = await Promise.all(
    words.map(async (word) => {
      const postIds = new Set<string>();
      let cursor: string | null = null;

      // List all posts containing this word
      do {
        const listOptions: { prefix: string; limit: number; cursor?: string } = {
          prefix: `search:word:${word}:`,
          limit: 100,
        };
        if (cursor) listOptions.cursor = cursor;
        const list = await env.POSTS_KV.list(listOptions);

        for (const key of list.keys) {
          // Extract postId from key: search:word:{word}:{postId}
          const parts = key.name.split(':');
          const postId = parts[parts.length - 1];
          if (postId) {
            postIds.add(postId);
          }
        }

        cursor = list.list_complete ? null : list.cursor;
      } while (cursor && postIds.size < MAX_POSTS_PER_WORD);

      return postIds;
    })
  );

  // Intersect all sets (posts must contain ALL query words)
  if (matchingSets.length === 0) return [];

  const firstSet = matchingSets[0];
  if (!firstSet) return [];

  let intersection = firstSet;
  for (let i = 1; i < matchingSets.length; i++) {
    const currentSet = matchingSets[i];
    if (!currentSet) continue;
    intersection = new Set([...intersection].filter(x => currentSet.has(x)));
  }

  return [...intersection];
}

/**
 * Search for user IDs matching a query
 */
export async function searchUserIds(
  env: Env,
  query: string
): Promise<string[]> {
  const queryLower = query.toLowerCase().trim();
  if (queryLower.length < 2) return [];

  const prefix = queryLower.slice(0, Math.min(queryLower.length, 15));

  // Fetch handle matches and name matches in parallel
  const [handleMatches, nameMatches] = await Promise.all([
    env.USERS_KV.get(`search:handle:${prefix}`),
    env.USERS_KV.get(`search:name:${prefix}`),
  ]);

  const handleIds: string[] = handleMatches ? JSON.parse(handleMatches) : [];
  const nameIds: string[] = nameMatches ? JSON.parse(nameMatches) : [];

  // Merge and deduplicate
  return [...new Set([...handleIds, ...nameIds])];
}

export { MAX_QUERY_TERMS, MAX_POSTS_PER_WORD };
