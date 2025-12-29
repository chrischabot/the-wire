/**
 * Application Constants for The Wire
 */

/**
 * Founder account - all new users auto-follow this account
 */
export const FOUNDER_HANDLE = "chabotc";

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

  /** Maximum moderation reason length */
  MAX_MODERATION_REASON_LENGTH: 500,

  /** Maximum bio length */
  MAX_BIO_LENGTH: 160,

  /** Maximum display name length */
  MAX_DISPLAY_NAME_LENGTH: 50,
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
 *
 * Freshness-first approach based on Twitter algorithm research.
 * Key insight: recency should dominate, engagement is a tie-breaker.
 * New posts (especially own/follow) must appear at top immediately.
 */
export const SCORING = {
  /** Recency half-life in hours - how fast freshness decays */
  RECENCY_HALF_LIFE_HOURS: 3,

  /** Engagement half-life in hours - slower decay for engagement value */
  ENGAGEMENT_HALF_LIFE_HOURS: 18,

  /** Fresh post boost decay in minutes - how long the "just posted" boost lasts */
  FRESH_BOOST_DECAY_MINUTES_OWN: 20,
  FRESH_BOOST_DECAY_MINUTES_FOLLOW: 30,

  /** Fresh post boost magnitudes */
  FRESH_BOOST_OWN: 40,
  FRESH_BOOST_FOLLOW: 20,
  FRESH_BOOST_EXPLORE: 6,

  /** Score weights */
  RECENCY_WEIGHT: 50,
  ENGAGEMENT_WEIGHT: 5,

  /** Reply weight - replies indicate discussion (reduced from 10 to prevent over-dominance) */
  REPLY_WEIGHT: 4,

  /** Repost weight - reposts amplify reach */
  REPOST_WEIGHT: 3,

  /** Like weight - base unit of engagement */
  LIKE_WEIGHT: 1,

  /** Own post pin threshold - posts newer than this are pinned to top (ms) */
  OWN_POST_PIN_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes

  /** Stale feed threshold - if fewer than this % of posts are recent, increase explore */
  STALE_FEED_RECENT_HOURS: 2,
  STALE_FEED_MIN_RECENT_RATIO: 0.33,

  /** Follow vs explore blend ratios */
  FOLLOW_RATIO_NORMAL: 0.85,
  FOLLOW_RATIO_STALE: 0.6,
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
  AVATAR:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect fill='%231d9bf0' width='128' height='128'/%3E%3Ccircle fill='%23fff' cx='64' cy='48' r='24'/%3E%3Cpath fill='%23fff' d='M64 80c-28 0-48 16-48 32v16h96v-16c0-16-20-32-48-32z'/%3E%3C/svg%3E",

  /** Default banner - gradient background */
  BANNER:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231d9bf0'/%3E%3Cstop offset='100%25' stop-color='%230d4f7a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='600' height='200'/%3E%3C/svg%3E",
} as const;
