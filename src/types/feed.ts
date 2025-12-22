/**
 * Feed-related type definitions for The Wire
 */

/**
 * Feed entry stored in FeedDO
 */
export interface FeedEntry {
  postId: string;
  authorId: string;
  timestamp: number;
  source: 'own' | 'follow' | 'fof';
}

/**
 * Queue message for fan-out operations
 */
export interface FanOutMessage {
  type: 'new_post' | 'delete_post';
  postId: string;
  authorId: string;
  timestamp: number;
}