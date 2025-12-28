/**
 * Batch utilities for efficient KV and DO operations
 * Respects Cloudflare Workers limits: 6 simultaneous connections, 1000 subrequests
 */

import type { Env } from "../types/env";

type KVNamespaceName = "USERS_KV" | "POSTS_KV" | "SESSIONS_KV" | "FEEDS_KV";

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunkSize = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

function dedupeStrings(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = typeof raw === "string" ? raw : "";
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Generic concurrency-capped executor.
 * - Preserves output order (results[i] corresponds to items[i])
 * - Catches errors per-item and returns null for failed items
 */
export async function batchInChunks<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  chunkSize = 6,
): Promise<(R | null)[]> {
  const concurrency = Math.max(1, Math.min(6, chunkSize));
  const results: (R | null)[] = new Array(items.length).fill(null);

  for (let start = 0; start < items.length; start += concurrency) {
    const end = Math.min(items.length, start + concurrency);
    const slice = items.slice(start, end);

    const chunkResults = await Promise.all(
      slice.map(async (item, offset) => {
        try {
          return await fn(item, start + offset);
        } catch {
          return null;
        }
      }),
    );

    for (let offset = 0; offset < chunkResults.length; offset++) {
      results[start + offset] = chunkResults[offset] ?? null;
    }
  }

  return results;
}

type BatchKVGetOptions<T> = {
  concurrency?: number;
  parse?: (value: string | null, key: string) => T | null;
};

/**
 * Batch KV reads with parallel execution (max 6 concurrent)
 * Returns Map(key -> parsedValue|null)
 */
export async function batchKVGet<T = string>(
  env: Env,
  keys: readonly string[],
  namespace: KVNamespaceName,
  options?: BatchKVGetOptions<T>,
): Promise<Map<string, T | null>> {
  const uniqueKeys = dedupeStrings(keys);
  const out = new Map<string, T | null>();

  if (uniqueKeys.length === 0) return out;

  const concurrency = Math.max(1, Math.min(6, options?.concurrency ?? 6));
  const kv = env[namespace];

  const keyBatches = chunk(uniqueKeys, concurrency);

  for (const batchKeys of keyBatches) {
    const results = await Promise.all(
      batchKeys.map(async (key) => {
        try {
          const value = await kv.get(key);
          return { key, value };
        } catch {
          return { key, value: null };
        }
      }),
    );

    for (const { key, value } of results) {
      if (options?.parse) {
        out.set(key, options.parse(value, key));
      } else {
        out.set(key, value as T | null);
      }
    }
  }

  return out;
}

/**
 * Batch KV reads returning array in same order as input keys
 * Nulls are included for missing/failed keys
 */
export async function batchKVGetArray<T>(
  env: Env,
  keys: readonly string[],
  namespace: KVNamespaceName,
  parse: (value: string | null) => T | null,
): Promise<(T | null)[]> {
  const map = await batchKVGet(env, keys, namespace, { parse });
  return keys.map((key) => map.get(key) ?? null);
}

/**
 * Sanitize and dedupe an array of string IDs
 */
export function sanitizeIds(input: unknown, maxItems = 100): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= maxItems) break;
  }

  return out;
}
