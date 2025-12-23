/**
 * Post-related type definitions for The Wire
 */

/**
 * Core post (Note) data structure
 */
export interface Post {
  id: string;            // Snowflake ID
  authorId: string;
  content: string;       // Max 280 chars
  mediaUrls: string[];
  replyToId?: string;    // If reply
  quoteOfId?: string;    // If quote note
  repostOfId?: string;   // If repost
  createdAt: number;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  isDeleted: boolean;
  deletedAt?: number;
  isTakenDown?: boolean;
  takenDownAt?: number;
  takenDownReason?: string;
  takenDownBy?: string;
}

/**
 * Post metadata cached in KV
 */
export interface PostMetadata {
  id: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  content: string;
  mediaUrls: string[];
  replyToId?: string;
  quoteOfId?: string;
  createdAt: number;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  repostOfId?: string;
  originalPost?: {
    id: string;
    authorHandle: string;
    authorDisplayName: string;
    content: string;
    mediaUrls: string[];
  };
  isDeleted?: boolean;
  deletedAt?: number;
  isTakenDown?: boolean;
  takenDownAt?: number;
  takenDownReason?: string;
}

/**
 * Create post request
 */
export interface CreatePostRequest {
  content: string;
  mediaUrls?: string[];
  replyToId?: string;
  quoteOfId?: string;
}