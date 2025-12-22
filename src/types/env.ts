/**
 * Environment bindings for The Wire Cloudflare Worker
 */

// Durable Object stubs
export interface UserDO extends DurableObject {}
export interface PostDO extends DurableObject {}
export interface FeedDO extends DurableObject {}

/**
 * Main environment interface containing all bindings
 */
export interface Env {
  // KV Namespaces
  USERS_KV: KVNamespace;
  POSTS_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  FEEDS_KV: KVNamespace;

  // R2 Buckets
  MEDIA_BUCKET: R2Bucket;

  // Durable Object Namespaces
  USER_DO: DurableObjectNamespace;
  POST_DO: DurableObjectNamespace;
  FEED_DO: DurableObjectNamespace;

  // Queues
  FANOUT_QUEUE: Queue;

  // Environment Variables
  ENVIRONMENT: string;
  JWT_SECRET?: string;
  JWT_EXPIRY_HOURS: string;
  MAX_NOTE_LENGTH: string;
  FEED_PAGE_SIZE: string;

  // Security settings
  ALLOWED_ORIGINS?: string;
  WORKER_URL?: string;
  INITIAL_ADMIN_HANDLE?: string;
}

/**
 * Request context passed through handlers
 */
export interface RequestContext {
  env: Env;
  ctx: ExecutionContext;
  userId?: string;
  userHandle?: string;
}