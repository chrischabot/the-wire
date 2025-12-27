/**
 * Shared utility functions used across frontend and backend
 * These are designed to work in both browser and worker environments
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format a timestamp as relative time (e.g., "2h ago", "3d ago")
 */
export function formatTimeAgo(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  const now = Date.now();
  const timestamp = typeof date === 'number' ? date : new Date(date).getTime();
  const seconds = Math.floor((now - timestamp) / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd';
  if (seconds < 2592000) return Math.floor(seconds / 604800) + 'w';

  // For older dates, show the actual date
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

/**
 * Format a number with K/M suffixes for large numbers
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

/**
 * Convert @mentions to clickable links
 * Uses the unified mention regex pattern
 */
export function linkifyMentions(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(
    MENTION_REGEX,
    '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>'
  );
}

/**
 * Unified mention regex - matches @handle format
 * Handles: 3-15 chars, alphanumeric + underscore, case insensitive matching
 */
export const MENTION_REGEX = /@([a-zA-Z0-9_]{3,15})/gi;

/**
 * Detect mentions in text and return array of handles (without @)
 */
export function detectMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

/**
 * Generate element IDs consistently
 */
export const ElementIds = {
  dropdown: (postId: string) => `dropdown-${postId}`,
  followBtn: (postId: string) => `follow-btn-${postId}`,
  likeBtn: (postId: string) => `like-btn-${postId}`,
  repostBtn: (postId: string) => `repost-btn-${postId}`,
  post: (postId: string) => `post-${postId}`,
} as const;
