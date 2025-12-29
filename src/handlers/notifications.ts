/**
 * Notifications handlers for The Wire
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import { requireAuth } from "../middleware/auth";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notifications";
import { logger } from "../utils/logger";

const notifications = new Hono<{ Bindings: Env }>();

/**
 * GET /api/notifications - Get user's notifications
 */
notifications.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);

  try {
    const result = await getUserNotifications(c.env, userId, cursor, limit);

    return c.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error("Error fetching notifications", err, { userId });
    return c.json(
      { success: false, error: "Error fetching notifications" },
      500,
    );
  }
});

/**
 * GET /api/notifications/unread-count - Get unread notification count
 */
notifications.get("/unread-count", requireAuth, async (c) => {
  const userId = c.get("userId");

  try {
    const result = await getUserNotifications(c.env, userId, undefined, 100);

    return c.json({
      success: true,
      data: { count: result.unreadCount },
    });
  } catch (err) {
    logger.error("Error fetching unread count", err, { userId });
    return c.json(
      { success: false, error: "Error fetching unread count" },
      500,
    );
  }
});

/**
 * PUT /api/notifications/:id/read - Mark notification as read
 */
notifications.put("/:id/read", requireAuth, async (c) => {
  const userId = c.get("userId");
  const notificationId = c.req.param("id");

  try {
    const success = await markNotificationRead(c.env, userId, notificationId);

    if (!success) {
      return c.json({ success: false, error: "Notification not found" }, 404);
    }

    return c.json({
      success: true,
      data: { message: "Notification marked as read" },
    });
  } catch (err) {
    logger.error("Error marking notification as read", err, {
      userId,
      notificationId,
    });
    return c.json(
      { success: false, error: "Error updating notification" },
      500,
    );
  }
});

/**
 * PUT /api/notifications/read-all - Mark all notifications as read
 */
notifications.put("/read-all", requireAuth, async (c) => {
  const userId = c.get("userId");

  try {
    const count = await markAllNotificationsRead(c.env, userId);

    return c.json({
      success: true,
      data: { markedCount: count },
    });
  } catch (err) {
    logger.error("Error marking all notifications as read", err, { userId });
    return c.json(
      { success: false, error: "Error updating notifications" },
      500,
    );
  }
});

export default notifications;
