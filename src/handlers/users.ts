/**
 * User profile handlers for The Wire
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { UserProfile, AuthUser, UserSettings } from '../types/user';
import {
  validateDisplayName,
  validateBio,
  sanitizeString,
  normalizeHandle,
} from '../utils/validation';
import { requireAuth } from '../middleware/auth';

const users = new Hono<{ Bindings: Env }>();

/**
 * Get user profile by handle
 * Cached in KV for fast global reads
 */
users.get('/:handle', async (c) => {
  const handle = normalizeHandle(c.req.param('handle'));

  // Try KV cache first
  const cacheKey = `profile:${handle}`;
  const cached = await c.env.USERS_KV.get(cacheKey);
  
  if (cached) {
    const profile: UserProfile = JSON.parse(cached);
    return c.json({ success: true, data: profile });
  }

  // Get user ID by handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Get profile from UserDO
  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  
  try {
    const response = await stub.fetch('https://do.internal/profile');
    const profile: UserProfile = await response.json();
    
    // Cache in KV (1 hour TTL)
    await c.env.USERS_KV.put(cacheKey, JSON.stringify(profile), {
      expirationTtl: 3600,
    });
    
    return c.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching profile from DO:', error);
    return c.json({ success: false, error: 'Error fetching profile' }, 500);
  }
});

/**
 * Update own profile
 */
users.put('/me', requireAuth, async (c) => {
  const userId = c.get('userId');

  let updates: Partial<UserProfile>;
  try {
    updates = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  // Validate updates
  if (updates.displayName !== undefined) {
    const result = validateDisplayName(updates.displayName);
    if (!result.valid) {
      return c.json({ success: false, error: result.error }, 400);
    }
    updates.displayName = sanitizeString(updates.displayName);
  }

  if (updates.bio !== undefined) {
    const result = validateBio(updates.bio);
    if (!result.valid) {
      return c.json({ success: false, error: result.error }, 400);
    }
    updates.bio = sanitizeString(updates.bio);
  }

  if (updates.location !== undefined) {
    updates.location = sanitizeString(updates.location);
  }

  if (updates.website !== undefined) {
    updates.website = sanitizeString(updates.website);
  }

  // Disallow changing immutable fields
  delete updates.id;
  delete updates.handle;
  delete updates.joinedAt;
  delete updates.followerCount;
  delete updates.followingCount;
  delete updates.postCount;
  delete updates.isVerified;

  // Update via UserDO
  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    const response = await stub.fetch('https://do.internal/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      return c.json({ success: false, error: 'Error updating profile' }, 500);
    }

    const profile: UserProfile = await response.json();
    return c.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error updating profile:', error);
    return c.json({ success: false, error: 'Error updating profile' }, 500);
  }
});

/**
 * Get own settings
 */
users.get('/me/settings', requireAuth, async (c) => {
  const userId = c.get('userId');

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    const response = await stub.fetch('https://do.internal/settings');
    const settings: UserSettings = await response.json();
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return c.json({ success: false, error: 'Error fetching settings' }, 500);
  }
});

/**
 * Update own settings
 */
users.put('/me/settings', requireAuth, async (c) => {
  const userId = c.get('userId');

  let updates: Partial<UserSettings>;
  try {
    updates = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);

  try {
    const response = await stub.fetch('https://do.internal/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      return c.json({ success: false, error: 'Error updating settings' }, 500);
    }

    const settings: UserSettings = await response.json();
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return c.json({ success: false, error: 'Error updating settings' }, 500);
  }
});

/**
 * POST /api/users/:handle/follow - Follow a user
 */
users.post('/:handle/follow', requireAuth, async (c) => {
  const currentUserId = c.get('userId');
  const targetHandle = normalizeHandle(c.req.param('handle'));

  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  if (currentUserId === targetUserId) {
    return c.json({ success: false, error: 'Cannot follow yourself' }, 400);
  }

  const targetDoId = c.env.USER_DO.idFromName(targetUserId);
  const targetStub = c.env.USER_DO.get(targetDoId);
  const blockedCheckResponse = await targetStub.fetch(
    `https://do.internal/is-blocked?userId=${currentUserId}`
  );
  const blockedData = await blockedCheckResponse.json();
  
  if (blockedData.isBlocked) {
    return c.json({ success: false, error: 'Cannot follow this user' }, 403);
  }

  const currentDoId = c.env.USER_DO.idFromName(currentUserId);
  const currentStub = c.env.USER_DO.get(currentDoId);
  await currentStub.fetch('https://do.internal/follow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: targetUserId }),
  });

  await targetStub.fetch('https://do.internal/add-follower', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUserId }),
  });

  return c.json({ success: true, data: { message: 'Followed successfully' } });
});

/**
 * DELETE /api/users/:handle/follow - Unfollow a user
 */
users.delete('/:handle/follow', requireAuth, async (c) => {
  const currentUserId = c.get('userId');
  const targetHandle = normalizeHandle(c.req.param('handle'));

  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const currentDoId = c.env.USER_DO.idFromName(currentUserId);
  const currentStub = c.env.USER_DO.get(currentDoId);
  await currentStub.fetch('https://do.internal/unfollow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: targetUserId }),
  });

  const targetDoId = c.env.USER_DO.idFromName(targetUserId);
  const targetStub = c.env.USER_DO.get(targetDoId);
  await targetStub.fetch('https://do.internal/remove-follower', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUserId }),
  });

  return c.json({ success: true, data: { message: 'Unfollowed successfully' } });
});

/**
 * GET /api/users/:handle/followers - Get followers list
 */
users.get('/:handle/followers', async (c) => {
  const handle = normalizeHandle(c.req.param('handle'));

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const response = await stub.fetch('https://do.internal/followers');
  const data = await response.json();

  const followers = await Promise.all(
    data.followers.map(async (followerId: string) => {
      const followerData = await c.env.USERS_KV.get(`user:${followerId}`);
      if (followerData) {
        const authUser = JSON.parse(followerData);
        return { id: followerId, handle: authUser.handle };
      }
      return null;
    })
  );

  const validFollowers = followers.filter((f) => f !== null);

  return c.json({
    success: true,
    data: { followers: validFollowers, count: validFollowers.length },
  });
});

/**
 * GET /api/users/:handle/following - Get following list
 */
users.get('/:handle/following', async (c) => {
  const handle = normalizeHandle(c.req.param('handle'));

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const response = await stub.fetch('https://do.internal/following');
  const data = await response.json();

  const following = await Promise.all(
    data.following.map(async (followingId: string) => {
      const followingData = await c.env.USERS_KV.get(`user:${followingId}`);
      if (followingData) {
        const authUser = JSON.parse(followingData);
        return { id: followingId, handle: authUser.handle };
      }
      return null;
    })
  );

  const validFollowing = following.filter((f) => f !== null);

  return c.json({
    success: true,
    data: { following: validFollowing, count: validFollowing.length },
  });
});

/**
 * POST /api/users/:handle/block - Block a user
 */
users.post('/:handle/block', requireAuth, async (c) => {
  const currentUserId = c.get('userId');
  const targetHandle = normalizeHandle(c.req.param('handle'));

  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  if (currentUserId === targetUserId) {
    return c.json({ success: false, error: 'Cannot block yourself' }, 400);
  }

  const currentDoId = c.env.USER_DO.idFromName(currentUserId);
  const currentStub = c.env.USER_DO.get(currentDoId);
  await currentStub.fetch('https://do.internal/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: targetUserId }),
  });

  return c.json({ success: true, data: { message: 'User blocked successfully' } });
});

/**
 * DELETE /api/users/:handle/block - Unblock a user
 */
users.delete('/:handle/block', requireAuth, async (c) => {
  const currentUserId = c.get('userId');
  const targetHandle = normalizeHandle(c.req.param('handle'));

  const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
  if (!targetUserId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const currentDoId = c.env.USER_DO.idFromName(currentUserId);
  const currentStub = c.env.USER_DO.get(currentDoId);
  await currentStub.fetch('https://do.internal/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: targetUserId }),
  });

  return c.json({ success: true, data: { message: 'User unblocked successfully' } });
});

/**
 * GET /api/users/me/blocked - Get blocked users list
 */
users.get('/me/blocked', requireAuth, async (c) => {
  const userId = c.get('userId');

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const response = await stub.fetch('https://do.internal/blocked');
  const data = await response.json();

  const blocked = await Promise.all(
    data.blocked.map(async (blockedId: string) => {
      const blockedData = await c.env.USERS_KV.get(`user:${blockedId}`);
      if (blockedData) {
        const authUser = JSON.parse(blockedData);
        return { id: blockedId, handle: authUser.handle };
      }
      return null;
    })
  );

  const validBlocked = blocked.filter((b) => b !== null);

  return c.json({
    success: true,
    data: { blocked: validBlocked, count: validBlocked.length },
  });
});

export default users;