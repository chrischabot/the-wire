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

/**
 * Placeholder images (SVG data URIs)
 */
export const PLACEHOLDERS = {
  /** Default avatar - simple user silhouette */
  AVATAR: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect fill='%231d9bf0' width='128' height='128'/%3E%3Ccircle fill='%23fff' cx='64' cy='48' r='24'/%3E%3Cpath fill='%23fff' d='M64 80c-28 0-48 16-48 32v16h96v-16c0-16-20-32-48-32z'/%3E%3C/svg%3E",

  /** Default banner - gradient background */
  BANNER: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231d9bf0'/%3E%3Cstop offset='100%25' stop-color='%230d4f7a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='600' height='200'/%3E%3C/svg%3E",
} as const;