/**
 * Notification Service for The Wire
 * Handles notification creation and @mention detection
 */

import type { Env } from "../types/env";
import type {
  Notification,
  CreateNotificationRequest,
} from "../types/notification";
import { generateId } from "./snowflake";
import {
  detectMentions as detectMentionsUtil,
} from "../shared/utils";
import { safeJsonParse, safeAtob } from "../utils/safe-parse";

/**
 * Detect @mentions in content
 * Returns array of mentioned handles (without @)
 */
export function detectMentions(content: string): string[] {
  return detectMentionsUtil(content);
}

/**
 * Create a notification
 */
export async function createNotification(
  env: Env,
  request: CreateNotificationRequest,
): Promise<Notification> {
  // Get actor profile for display info
  const actorDoId = env.USER_DO.idFromName(request.actorId);
  const actorStub = env.USER_DO.get(actorDoId);
  const actorProfileResp = await actorStub.fetch("https://do.internal/profile");
  const actorProfile =
    (await actorProfileResp.json()) as import("../types/user").UserProfile;

  // Create notification
  const notification: Notification = {
    id: generateId(),
    userId: request.userId,
    type: request.type,
    actorId: request.actorId,
    actorHandle: actorProfile.handle,
    actorDisplayName: actorProfile.displayName || actorProfile.handle,
    actorAvatarUrl: actorProfile.avatarUrl || "",
    postId: request.postId,
    content: request.content,
    createdAt: Date.now(),
    read: false,
  };

  // Store in KV with user-specific key for easy retrieval
  const notifKey = `notifications:${request.userId}:${notification.id}`;
  await env.SESSIONS_KV.put(notifKey, JSON.stringify(notification), {
    expirationTtl: 30 * 24 * 60 * 60, // 30 days
  });

  // Also add to user's notification list (most recent first)
  const listKey = `notification_list:${request.userId}`;
  const existingList = await env.SESSIONS_KV.get(listKey);
  const notifIds = safeJsonParse<string[]>(existingList) || [];

  // Prepend new notification ID
  notifIds.unshift(notification.id);

  // Keep only most recent 1000 notifications
  const trimmedIds = notifIds.slice(0, 1000);

  await env.SESSIONS_KV.put(listKey, JSON.stringify(trimmedIds), {
    expirationTtl: 30 * 24 * 60 * 60, // 30 days
  });

  // Broadcast notification to user's WebSocket connections for real-time delivery
  try {
    const wsDoId = env.WEBSOCKET_DO.idFromName(request.userId);
    const wsStub = env.WEBSOCKET_DO.get(wsDoId);
    await wsStub.fetch("https://do.internal/broadcast-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification }),
    });
  } catch (error) {
    // WebSocket broadcast failure is non-critical, notification is still stored
    console.error("Failed to broadcast notification via WebSocket:", error);
  }

  return notification;
}

/**
 * Create mention notifications for all mentioned users in a post
 */
export async function createMentionNotifications(
  env: Env,
  content: string,
  actorId: string,
  postId: string,
): Promise<void> {
  const mentions = detectMentions(content);

  for (const handle of mentions) {
    try {
      // Get user ID by handle
      const userId = await env.USERS_KV.get(`handle:${handle}`);

      if (!userId) {
        continue;
      }

      if (userId === actorId) {
        continue;
      }

      // Check if actor is blocked by mentioned user
      const userDoId = env.USER_DO.idFromName(userId);
      const userStub = env.USER_DO.get(userDoId);
      const blockedResp = await userStub.fetch(
        `https://do.internal/is-blocked?userId=${actorId}`,
      );
      const blockedData = (await blockedResp.json()) as { isBlocked: boolean };

      if (blockedData.isBlocked) {
        continue;
      }

      // Create mention notification
      await createNotification(env, {
        userId,
        type: "mention",
        actorId,
        postId,
        content: content.slice(0, 100), // Preview
      });
    } catch (error) {
      console.error(
        `[Mentions] Error creating notification for @${handle}:`,
        error,
      );
    }
  }
}

/**
 * Get user's notifications with pagination
 */
export async function getUserNotifications(
  env: Env,
  userId: string,
  cursor?: string,
  limit: number = 20,
): Promise<{
  notifications: Notification[];
  cursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}> {
  const listKey = `notification_list:${userId}`;
  const notifList = await env.SESSIONS_KV.get(listKey);

  if (!notifList) {
    return {
      notifications: [],
      cursor: null,
      hasMore: false,
      unreadCount: 0,
    };
  }

  const notifIds = safeJsonParse<string[]>(notifList);
  if (!notifIds) {
    return {
      notifications: [],
      cursor: null,
      hasMore: false,
      unreadCount: 0,
    };
  }

  // Handle pagination
  let startIndex = 0;
  if (cursor) {
    try {
      const decoded = safeAtob(cursor);
      if (decoded) {
        startIndex = parseInt(decoded, 10);
      }
    } catch {
      startIndex = 0;
    }
  }

  const paginatedIds = notifIds.slice(startIndex, startIndex + limit);

  // Fetch notification details
  const notifications: Notification[] = [];
  let unreadCount = 0;

  for (const notifId of paginatedIds) {
    const notifKey = `notifications:${userId}:${notifId}`;
    const notifData = await env.SESSIONS_KV.get(notifKey);

    if (notifData) {
      const notif = safeJsonParse<Notification>(notifData);
      if (!notif) continue;
      notifications.push(notif);
      if (!notif.read) unreadCount++;
    }
  }

  const hasMore = startIndex + limit < notifIds.length;
  const nextCursor = hasMore ? btoa((startIndex + limit).toString()) : null;

  return {
    notifications,
    cursor: nextCursor,
    hasMore,
    unreadCount,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  env: Env,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const notifKey = `notifications:${userId}:${notificationId}`;
  const notifData = await env.SESSIONS_KV.get(notifKey);

  if (!notifData) return false;

  const notification = safeJsonParse<Notification>(notifData);

  if (!notification) return false;
  notification.read = true;

  await env.SESSIONS_KV.put(notifKey, JSON.stringify(notification), {
    expirationTtl: 30 * 24 * 60 * 60,
  });

  return true;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(
  env: Env,
  userId: string,
): Promise<number> {
  const listKey = `notification_list:${userId}`;
  const notifList = await env.SESSIONS_KV.get(listKey);

  if (!notifList) return 0;

  const notifIds = safeJsonParse<string[]>(notifList);
  if (!notifIds) return 0;

  let markedCount = 0;

  for (const notifId of notifIds) {
    const success = await markNotificationRead(env, userId, notifId);
    if (success) markedCount++;
  }

  return markedCount;
}
