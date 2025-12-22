/**
 * Moderation handlers for The Wire
 * Admin-only actions for user bans and post takedowns
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { normalizeHandle } from '../utils/validation';

const moderation = new Hono<{ Bindings: Env }>();

/**
 * Middleware to require admin role
 */
async function requireAdmin(c: any, next: () => Promise<void>): Promise<Response | void> {
  const userId = c.get('userId');
  
  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  
  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  
  try {
    const response = await stub.fetch('https://do.internal/is-admin');
    const data = await response.json() as { isAdmin: boolean };
    
    if (!data.isAdmin) {
      return c.json({ success: false, error: 'Admin privileges required' }, 403);
    }
    
    await next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return c.json({ success: false, error: 'Error verifying admin status' }, 500);
  }
}

/**
 * POST /api/moderation/users/:handle/ban - Ban a user
 */
moderation.post('/users/:handle/ban', requireAuth, requireAdmin, async (c) => {
  const targetHandle = normalizeHandle(c.req.param('handle'));
  
  let body: { reason: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  
  if (!body.reason || body.reason.trim().length === 0) {
    return c.json({ success: false, error: 'Ban reason is required' }, 400);
  }
  
  // Get target user ID
  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  // Check if target is also an admin
  const targetDoId = c.env.USER_DO.idFromName(targetUserId);
  const targetStub = c.env.USER_DO.get(targetDoId);
  
  const adminCheckResp = await targetStub.fetch('https://do.internal/is-admin');
  const adminCheck = await adminCheckResp.json() as { isAdmin: boolean };
  
  if (adminCheck.isAdmin) {
    return c.json({ success: false, error: 'Cannot ban another admin' }, 403);
  }
  
  // Ban the user
  await targetStub.fetch('https://do.internal/ban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: body.reason.trim() }),
  });
  
  // Log the action
  console.log(`User ${targetHandle} banned by admin ${c.get('userId')} - Reason: ${body.reason}`);
  
  return c.json({
    success: true,
    data: { message: `User @${targetHandle} has been banned` },
  });
});

/**
 * POST /api/moderation/users/:handle/unban - Unban a user
 */
moderation.post('/users/:handle/unban', requireAuth, requireAdmin, async (c) => {
  const targetHandle = normalizeHandle(c.req.param('handle'));
  
  // Get target user ID
  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  // Unban the user
  const targetDoId = c.env.USER_DO.idFromName(targetUserId);
  const targetStub = c.env.USER_DO.get(targetDoId);
  
  await targetStub.fetch('https://do.internal/unban', {
    method: 'POST',
  });
  
  // Log the action
  console.log(`User ${targetHandle} unbanned by admin ${c.get('userId')}`);
  
  return c.json({
    success: true,
    data: { message: `User @${targetHandle} has been unbanned` },
  });
});

/**
 * POST /api/moderation/posts/:id/takedown - Take down a post
 */
moderation.post('/posts/:id/takedown', requireAuth, requireAdmin, async (c) => {
  const postId = c.req.param('id');
  
  let body: { reason?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  
  // Check if post exists
  const postData = await c.env.POSTS_KV.get(`post:${postId}`);
  if (!postData) {
    return c.json({ success: false, error: 'Post not found' }, 404);
  }
  
  const post = JSON.parse(postData);
  
  // Mark as deleted in PostDO
  const doId = c.env.POST_DO.idFromName(postId);
  const stub = c.env.POST_DO.get(doId);
  
  await stub.fetch('https://do.internal/delete', {
    method: 'POST',
  });
  
  // Update KV with takedown flag
  post.isTakenDown = true;
  post.takenDownAt = Date.now();
  post.takenDownReason = body.reason || 'Removed by moderator';
  post.takenDownBy = c.get('userId');
  await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(post));
  
  // Log the action
  console.log(`Post ${postId} taken down by admin ${c.get('userId')} - Reason: ${body.reason || 'No reason provided'}`);
  
  return c.json({
    success: true,
    data: { message: 'Post has been taken down' },
  });
});

/**
 * GET /api/moderation/users/:handle/status - Get user moderation status
 */
moderation.get('/users/:handle/status', requireAuth, requireAdmin, async (c) => {
  const targetHandle = normalizeHandle(c.req.param('handle'));
  
  // Get target user ID
  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  const targetDoId = c.env.USER_DO.idFromName(targetUserId);
  const targetStub = c.env.USER_DO.get(targetDoId);
  
  const profileResp = await targetStub.fetch('https://do.internal/profile');
  const profile = await profileResp.json() as import('../types/user').UserProfile;
  
  return c.json({
    success: true,
    data: {
      handle: profile.handle,
      isBanned: profile.isBanned || false,
      bannedAt: profile.bannedAt,
      bannedReason: profile.bannedReason,
      isAdmin: profile.isAdmin || false,
    },
  });
});

/**
 * POST /api/moderation/users/:handle/set-admin - Set admin status
 * This should only be accessible to super admins in production
 */
moderation.post('/users/:handle/set-admin', requireAuth, requireAdmin, async (c) => {
  const targetHandle = normalizeHandle(c.req.param('handle'));
  
  let body: { isAdmin: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  
  if (typeof body.isAdmin !== 'boolean') {
    return c.json({ success: false, error: 'isAdmin must be a boolean' }, 400);
  }
  
  // Get target user ID
  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  // Cannot remove own admin status
  if (targetUserId === c.get('userId') && !body.isAdmin) {
    return c.json({ success: false, error: 'Cannot remove your own admin status' }, 400);
  }
  
  const targetDoId = c.env.USER_DO.idFromName(targetUserId);
  const targetStub = c.env.USER_DO.get(targetDoId);
  
  await targetStub.fetch('https://do.internal/set-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isAdmin: body.isAdmin }),
  });
  
  const action = body.isAdmin ? 'granted admin privileges' : 'had admin privileges revoked';
  console.log(`User ${targetHandle} ${action} by admin ${c.get('userId')}`);
  
  return c.json({
    success: true,
    data: { message: `User @${targetHandle} ${action}` },
  });
});

export default moderation;