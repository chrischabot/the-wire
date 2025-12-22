/**
 * Application Constants for The Wire
 */

/**
 * System limits
 */
export const LIMITS = {
  /** Maximum feed entries per user */
  MAX_FEED_ENTRIES: 1000,
  
  /** Maximum thread depth for reply chains */
  MAX_THREAD_DEPTH: 10,
  
  /** Maximum pagination limit */
  MAX_PAGINATION_LIMIT: 50,
  
  /** Maximum note/post length */
  MAX_NOTE_LENGTH: 280,
  
  /** Default feed page size */
  DEFAULT_FEED_PAGE_SIZE: 20,
} as const;

/**
 * Cache TTLs (in seconds)
 */
export const CACHE_TTL = {
  /** Profile cache TTL */
  PROFILE: 3600, // 1 hour
  
  /** FoF rankings cache TTL */
  FOF_RANKINGS: 900, // 15 minutes
  
  /** Media cache TTL */
  MEDIA: 31536000, // 1 year (immutable content)
} as const;

/**
 * Retention periods (in milliseconds)
 */
export const RETENTION = {
  /** Feed entry retention */
  FEED_ENTRIES: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  /** Deleted post retention */
  DELETED_POSTS: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  /** FoF ranking window */
  FOF_RANKING_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Scoring parameters
 */
export const SCORING = {
  /** Hacker News aging exponent */
  HN_AGING_EXPONENT: 1.8,
  
  /** Hacker News base offset (hours) */
  HN_BASE_OFFSET: 2,
  
  /** Reply weight in ranking */
  REPLY_WEIGHT: 2,
  
  /** Repost weight in ranking */
  REPOST_WEIGHT: 1.5,
  
  /** Like weight in ranking */
  LIKE_WEIGHT: 1,
} as const;

/**
 * Batch sizes
 */
export const BATCH_SIZE = {
  /** KV list batch size */
  KV_LIST: 100,
  
  /** Queue batch size */
  QUEUE_BATCH: 100,
  
  /** FoF ranking batch */
  FOF_RANKING: 100,
} as const;