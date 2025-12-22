/**
 * Notification types and structures for The Wire
 */

/**
 * Types of notifications
 */
export type NotificationType = 'like' | 'reply' | 'follow' | 'mention' | 'repost' | 'quote';

/**
 * Core notification structure
 */
export interface Notification {
  id: string;              // Snowflake ID
  userId: string;          // Recipient user ID
  type: NotificationType;
  actorId: string;         // User who triggered the notification
  actorHandle: string;
  actorDisplayName: string;
  actorAvatarUrl: string;
  postId?: string | undefined;         // Related post ID (for like, reply, mention, repost, quote)
  content?: string | undefined;        // Post content preview (for reply, mention, quote)
  createdAt: number;
  read: boolean;
}

/**
 * Notification creation request
 */
export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  actorId: string;
  postId?: string | undefined;
  content?: string | undefined;
}