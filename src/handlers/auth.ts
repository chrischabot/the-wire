/**
 * Authentication handlers for The Wire
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { AuthUser, SignupRequest, LoginRequest, AuthResponse } from '../types/user';
import { generateSalt, hashPassword, verifyPassword } from '../utils/crypto';
import { createToken } from '../utils/jwt';
import {
  validateEmail,
  validatePassword,
  validateHandle,
  normalizeEmail,
  normalizeHandle,
} from '../utils/validation';
import { generateId } from '../services/snowflake';
import { requireAuth, getJwtSecret } from '../middleware/auth';
import { rateLimit, RATE_LIMITS, accountLockout } from '../middleware/rate-limit';
import { logger } from '../utils/logger';
import { indexUser } from '../utils/search-index';
import type { PostMetadata } from '../types/post';
import { RETENTION, FOUNDER_HANDLE } from '../constants';
import { success, error, unauthorized, notFound } from '../utils/response';

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/signup - Create a new account
 * Rate limited: 10 signups per hour per IP
 */
auth.post('/signup', rateLimit(RATE_LIMITS.signup), async (c) => {
  const log = logger.child({ handler: 'auth.signup' });
  log.info('Signup request received');

  let body: SignupRequest;
  try {
    body = await c.req.json<SignupRequest>();
    log.debug('Request body parsed', { email: body.email, handle: body.handle });
  } catch (err) {
    log.warn('Invalid JSON body in signup request');
    return error('Invalid JSON body');
  }

  // Validate email
  const emailResult = validateEmail(body.email);
  if (!emailResult.valid) {
    log.warn('Email validation failed', { email: body.email, error: emailResult.error });
    return error(emailResult.error ?? 'Invalid email');
  }

  // Validate password
  const passwordResult = validatePassword(body.password);
  if (!passwordResult.valid) {
    log.warn('Password validation failed', { error: passwordResult.error });
    return error(passwordResult.error ?? 'Invalid password');
  }

  // Validate handle
  const handleResult = validateHandle(body.handle);
  if (!handleResult.valid) {
    log.warn('Handle validation failed', { handle: body.handle, error: handleResult.error });
    return error(handleResult.error ?? 'Invalid handle');
  }

  const email = normalizeEmail(body.email);
  const handle = normalizeHandle(body.handle);
  log.debug('Input normalized', { email, handle });

  try {
    // Check if email already exists
    log.debug('Checking if email exists');
    const existingEmail = await c.env.USERS_KV.get(`email:${email}`);
    if (existingEmail) {
      log.warn('Email already registered', { email });
      return error('Email already registered', 409);
    }

    // Check if handle already exists
    log.debug('Checking if handle exists');
    const existingHandle = await c.env.USERS_KV.get(`handle:${handle}`);
    if (existingHandle) {
      log.warn('Handle already taken', { handle });
      return error('Handle already taken', 409);
    }

    // Create user
    log.debug('Generating user ID');
    const userId = generateId();
    log.debug('Generating password hash', { userId });
    const salt = generateSalt();
    const passwordHash = await hashPassword(body.password, salt);
    const now = Date.now();

    const authUser: AuthUser = {
      id: userId,
      email,
      handle,
      passwordHash,
      salt,
      createdAt: now,
      lastLogin: now,
    };

    // Store user data
    log.debug('Storing user in KV', { userId });
    await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));
    await c.env.USERS_KV.put(`email:${email}`, userId);
    await c.env.USERS_KV.put(`handle:${handle}`, userId);
    log.debug('User stored in KV successfully');

    // Initialize UserDO
    log.debug('Initializing UserDO', { userId });
    const defaultProfile: import('../types/user').UserProfile = {
      id: userId,
      handle,
      displayName: handle,
      bio: '',
      location: '',
      website: '',
      avatarUrl: '',
      bannerUrl: '',
      joinedAt: now,
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      isVerified: false,
      isBanned: false,
      isAdmin: handle === c.env.INITIAL_ADMIN_HANDLE || false,
    };

    const defaultSettings: import('../types/user').UserSettings = {
      emailNotifications: true,
      privateAccount: false,
      mutedWords: [],
    };

    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);

    log.debug('Calling UserDO.initialize');
    const initResp = await stub.fetch('https://do.internal/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: defaultProfile, settings: defaultSettings }),
    });
    if (!initResp.ok) {
      const errText = await initResp.text();
      log.error('UserDO.initialize failed', new Error(errText), { userId, status: initResp.status });
      throw new Error(`UserDO initialize failed: ${errText}`);
    }
    log.debug('UserDO.initialize succeeded');

    // Make user follow themselves so they see their own posts in the feed
    log.debug('Setting up self-follow');
    const followResp = await stub.fetch('https://do.internal/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!followResp.ok) {
      log.warn('Self-follow failed', { userId, status: followResp.status });
    }

    const addFollowerResp = await stub.fetch('https://do.internal/add-follower', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!addFollowerResp.ok) {
      log.warn('Self add-follower failed', { userId, status: addFollowerResp.status });
    }
    log.debug('Self-follow setup complete');

    // Auto-follow founder account (always happens first, required)
    if (handle !== FOUNDER_HANDLE) {
      log.debug('Auto-following founder account', { founder: FOUNDER_HANDLE });
      try {
        const founderUserId = await c.env.USERS_KV.get(`handle:${FOUNDER_HANDLE}`);
        if (founderUserId) {
          // Add founder to new user's following list
          await stub.fetch('https://do.internal/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: founderUserId }),
          });

          // Add new user to founder's followers list
          const founderDoId = c.env.USER_DO.idFromName(founderUserId);
          const founderStub = c.env.USER_DO.get(founderDoId);
          await founderStub.fetch('https://do.internal/add-follower', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });

          // Backfill founder's recent posts to new user's feed
          const feedDoId = c.env.FEED_DO.idFromName(userId);
          const feedStub = c.env.FEED_DO.get(feedDoId);
          const cutoffTime = Date.now() - RETENTION.FEED_ENTRIES;

          const founderPostsIndex = await c.env.POSTS_KV.get(`user-posts:${founderUserId}`);
          if (founderPostsIndex) {
            const postIds: string[] = JSON.parse(founderPostsIndex);
            let addedCount = 0;
            for (const postId of postIds.slice(0, 20)) {
              if (addedCount >= 10) break;
              const postData = await c.env.POSTS_KV.get(`post:${postId}`);
              if (!postData) continue;
              const post: PostMetadata = JSON.parse(postData);
              if (post.isDeleted || post.createdAt < cutoffTime) continue;
              await feedStub.fetch('https://do.internal/add-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entry: {
                    postId: post.id,
                    authorId: post.authorId,
                    timestamp: post.createdAt,
                    source: 'follow',
                  },
                }),
              });
              addedCount++;
            }
            log.debug('Backfilled founder posts', { addedCount });
          }
          log.info('Auto-followed founder account', { founder: FOUNDER_HANDLE });
        } else {
          log.warn('Founder account not found', { founder: FOUNDER_HANDLE });
        }
      } catch (founderErr) {
        log.warn('Failed to auto-follow founder', { error: founderErr });
      }
    }

    // Auto-follow initial seed users to avoid empty feed problem
    // This is a FIXED list of the 21 users that existed at launch (Dec 2024)
    const INITIAL_SEED_HANDLES = [
      'alexthompson', 'ameliasmith', 'benharris', 'chrismartinez',
      'danielkim', 'davidanderson', 'emmawilliams', 'hannahmoore', 'jameswright',
      'jessicadavis', 'kevinjackson', 'laurataylor', 'marcusjohnson', 'michaelwilson',
      'nataliewhite', 'oliviabrown', 'rachelgreen', 'ryanlee', 'sarahchen', 'sophiepatel',
    ];

    log.debug('Starting auto-follow of initial seed users');
    try {
      let followedCount = 0;

      for (const seedHandle of INITIAL_SEED_HANDLES) {
        // Skip if user is signing up with one of the seed handles or founder (already followed)
        if (seedHandle === handle || seedHandle === FOUNDER_HANDLE) continue;

        const targetUserId = await c.env.USERS_KV.get(`handle:${seedHandle}`);
        if (!targetUserId) {
          log.debug('Seed user not found, skipping', { seedHandle });
          continue;
        }

        try {
          // Add to new user's following list
          await stub.fetch('https://do.internal/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: targetUserId }),
          });

          // Add new user to target's followers list
          const targetDoId = c.env.USER_DO.idFromName(targetUserId);
          const targetStub = c.env.USER_DO.get(targetDoId);
          await targetStub.fetch('https://do.internal/add-follower', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });

          // Backfill recent posts from this seed user to the new user's FeedDO
          // Use the user-posts index instead of iterating all posts (much faster)
          try {
            const feedDoId = c.env.FEED_DO.idFromName(userId);
            const feedStub = c.env.FEED_DO.get(feedDoId);
            const cutoffTime = Date.now() - RETENTION.FEED_ENTRIES;
            const maxBackfillPosts = 10; // Limit per seed user

            // Get user's posts index (fast O(1) lookup)
            const userPostsIndex = await c.env.POSTS_KV.get(`user-posts:${targetUserId}`);
            if (userPostsIndex) {
              const postIds: string[] = JSON.parse(userPostsIndex);
              let addedCount = 0;

              for (const postId of postIds.slice(0, maxBackfillPosts * 2)) {
                if (addedCount >= maxBackfillPosts) break;

                const postData = await c.env.POSTS_KV.get(`post:${postId}`);
                if (!postData) continue;

                const post: PostMetadata = JSON.parse(postData);
                if (post.isDeleted || post.createdAt < cutoffTime) continue;

                await feedStub.fetch('https://do.internal/add-entry', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    entry: {
                      postId: post.id,
                      authorId: post.authorId,
                      timestamp: post.createdAt,
                      source: 'follow',
                    },
                  }),
                });
                addedCount++;
              }
              log.debug('Backfilled posts from seed user', { seedHandle, addedCount });
            }
          } catch (backfillErr) {
            log.warn('Failed to backfill posts from seed user', { seedHandle, error: backfillErr });
          }

          followedCount++;
        } catch (followErr) {
          log.warn('Failed to auto-follow seed user', { seedHandle, error: followErr });
        }
      }

      log.info('Auto-follow complete', { userId, followedCount });
    } catch (autoFollowErr) {
      log.warn('Auto-follow process failed', { error: autoFollowErr });
      // Don't fail signup if auto-follow fails
    }

    // Index user for search
    await indexUser(c.env, userId, handle, handle);
    log.debug('User indexed for search');

    // Generate token
    log.debug('Generating JWT token');
    const expiryHours = parseInt(c.env.JWT_EXPIRY_HOURS || '24', 10);
    const { token, expiresAt } = await createToken(
      { sub: userId, email, handle },
      getJwtSecret(c.env),
      expiryHours
    );
    log.debug('JWT token generated');

    const response: AuthResponse = {
      user: { id: userId, email, handle },
      token,
      expiresAt,
    };

    log.info('Signup successful', { userId, handle });
    return success(response, 201);
  } catch (err) {
    log.error('Signup failed with exception', err, { email, handle });
    throw err;
  }
});

/**
 * POST /api/auth/login - Login with email and password
 * Rate limited: 5 attempts per minute per IP
 * Account lockout after 5 failed attempts
 */
auth.post('/login', rateLimit(RATE_LIMITS.login), accountLockout(5, 15), async (c) => {
  const log = logger.child({ handler: 'auth.login' });
  log.info('Login request received');

  let body: LoginRequest;
  try {
    body = await c.req.json<LoginRequest>();
  } catch {
    log.warn('Invalid JSON body in login request');
    return error('Invalid JSON body');
  }

  if (!body.email || !body.password) {
    log.warn('Missing email or password');
    return error('Email and password required');
  }

  const email = normalizeEmail(body.email);
  log.debug('Looking up user by email', { email });

  try {
    // Get user ID by email
    const userId = await c.env.USERS_KV.get(`email:${email}`);
    if (!userId) {
      log.warn('Login failed - email not found', { email });
      return unauthorized('Invalid credentials');
    }

    // Get user data
    const userData = await c.env.USERS_KV.get(`user:${userId}`);
    if (!userData) {
      log.error('User data not found for existing email mapping', null, { email, userId });
      return unauthorized('Invalid credentials');
    }

    const authUser: AuthUser = JSON.parse(userData);

    // Verify password
    log.debug('Verifying password', { userId });
    const valid = await verifyPassword(body.password, authUser.salt, authUser.passwordHash);
    if (!valid) {
      log.warn('Login failed - invalid password', { userId, handle: authUser.handle });
      return unauthorized('Invalid credentials');
    }

    // Update last login
    authUser.lastLogin = Date.now();
    await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));

    // Generate token
    log.debug('Generating JWT token', { userId });
    const expiryHours = parseInt(c.env.JWT_EXPIRY_HOURS || '24', 10);
    const { token, expiresAt } = await createToken(
      { sub: authUser.id, email: authUser.email, handle: authUser.handle },
      getJwtSecret(c.env),
      expiryHours
    );

    const response: AuthResponse = {
      user: { id: authUser.id, email: authUser.email, handle: authUser.handle },
      token,
      expiresAt,
    };

    log.info('Login successful', { userId, handle: authUser.handle });
    return success(response);
  } catch (err) {
    log.error('Login failed with exception', err, { email });
    throw err;
  }
});

/**
 * POST /api/auth/refresh - Refresh JWT token
 */
auth.post('/refresh', requireAuth, async (c) => {
  const userId = c.get('userId');
  const email = c.get('userEmail');
  const handle = c.get('userHandle');

  const expiryHours = parseInt(c.env.JWT_EXPIRY_HOURS || '24', 10);
  const { token, expiresAt } = await createToken(
    { sub: userId, email, handle },
    getJwtSecret(c.env),
    expiryHours
  );

  return success({ token, expiresAt });
});

/**
 * POST /api/auth/logout - Logout (stateless)
 * 
 * This endpoint uses stateless JWT logout: the client removes the token locally.
 * Tokens remain valid until their natural expiration (configured via JWT_EXPIRY_HOURS).
 * This is a standard approach for stateless authentication that avoids the overhead
 * of maintaining a server-side token blocklist while providing acceptable security
 * for most use cases. For enhanced security, use short token expiration times.
 */
auth.post('/logout', requireAuth, async (_c) => {
  return success({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me - Get current user info
 */
auth.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');

  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return notFound('User not found');
  }

  const authUser: AuthUser = JSON.parse(userData);

  // Get admin status from UserDO
  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  const adminResp = await stub.fetch('https://do.internal/is-admin');
  const adminData = await adminResp.json() as { isAdmin: boolean };

  return success({
    id: authUser.id,
    email: authUser.email,
    handle: authUser.handle,
    createdAt: authUser.createdAt,
    lastLogin: authUser.lastLogin,
    isAdmin: adminData.isAdmin,
  });
});

/**
 * POST /api/auth/reset/request - Request password reset
 * Validates user by handle and email, generates time-limited reset token
 */
auth.post('/reset/request', rateLimit({ limit: 3, windowSeconds: 3600, keyPrefix: 'rl:reset' }), async (c) => {
  let body: { handle: string; email: string };
  try {
    body = await c.req.json();
  } catch {
    return error('Invalid JSON body');
  }

  const handle = normalizeHandle(body.handle);
  const email = normalizeEmail(body.email);

  // Get user ID by handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    // Don't reveal if handle exists
    return success({ message: 'If the account exists, a reset token has been generated' });
  }

  // Verify email matches
  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return success({ message: 'If the account exists, a reset token has been generated' });
  }

  const authUser: AuthUser = JSON.parse(userData);
  if (authUser.email !== email) {
    // Don't reveal email mismatch
    return success({ message: 'If the account exists, a reset token has been generated' });
  }

  // Generate reset token
  const { generateToken } = await import('../utils/crypto');
  const resetToken = generateToken(32);
  const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes

  // OPTIMIZED: Store by token for O(1) lookup on confirm
  // Also store by userId to prevent multiple active tokens
  const tokenKey = `reset-token:${resetToken}`;
  const userResetKey = `reset:${userId}`;

  // Delete any existing reset token for this user
  const existingUserReset = await c.env.SESSIONS_KV.get(userResetKey);
  if (existingUserReset) {
    const existing = JSON.parse(existingUserReset);
    if (existing.token) {
      await c.env.SESSIONS_KV.delete(`reset-token:${existing.token}`);
    }
  }

  // Store new token (indexed by token for O(1) lookup)
  await c.env.SESSIONS_KV.put(
    tokenKey,
    JSON.stringify({ userId, expiresAt }),
    { expirationTtl: 900 } // 15 minutes
  );

  // Store reference by userId (to invalidate old tokens)
  await c.env.SESSIONS_KV.put(
    userResetKey,
    JSON.stringify({ token: resetToken, expiresAt }),
    { expirationTtl: 900 }
  );

  return success({
    message: 'Password reset token generated',
    resetToken,
    expiresAt,
  });
});

/**
 * POST /api/auth/reset/confirm - Confirm password reset with token
 * OPTIMIZED: Uses O(1) token lookup instead of scanning all reset tokens
 */
auth.post('/reset/confirm', rateLimit({ limit: 5, windowSeconds: 3600, keyPrefix: 'rl:reset-confirm' }), async (c) => {
  let body: { resetToken: string; newPassword: string };
  try {
    body = await c.req.json();
  } catch {
    return error('Invalid JSON body');
  }

  if (!body.resetToken || !body.newPassword) {
    return error('Reset token and new password required');
  }

  // Validate new password
  const passwordResult = validatePassword(body.newPassword);
  if (!passwordResult.valid) {
    return error(passwordResult.error ?? 'Invalid password');
  }

  // OPTIMIZED: Direct O(1) lookup by token
  const tokenKey = `reset-token:${body.resetToken}`;
  const tokenData = await c.env.SESSIONS_KV.get(tokenKey);

  if (!tokenData) {
    return unauthorized('Invalid reset token');
  }

  const parsed = JSON.parse(tokenData);

  // Check if expired
  if (parsed.expiresAt < Date.now()) {
    await c.env.SESSIONS_KV.delete(tokenKey);
    await c.env.SESSIONS_KV.delete(`reset:${parsed.userId}`);
    return unauthorized('Reset token expired');
  }

  const userId = parsed.userId;

  // Delete both token entries (one-time use)
  await c.env.SESSIONS_KV.delete(tokenKey);
  await c.env.SESSIONS_KV.delete(`reset:${userId}`);

  // Get user data
  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return notFound('User not found');
  }

  const authUser: AuthUser = JSON.parse(userData);

  // Update password
  const newSalt = generateSalt();
  const newPasswordHash = await hashPassword(body.newPassword, newSalt);

  authUser.passwordHash = newPasswordHash;
  authUser.salt = newSalt;

  await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));

  return success({ message: 'Password reset successfully' });
});

export default auth;