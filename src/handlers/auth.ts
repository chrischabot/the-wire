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
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  // Validate email
  const emailResult = validateEmail(body.email);
  if (!emailResult.valid) {
    log.warn('Email validation failed', { email: body.email, error: emailResult.error });
    return c.json({ success: false, error: emailResult.error }, 400);
  }

  // Validate password
  const passwordResult = validatePassword(body.password);
  if (!passwordResult.valid) {
    log.warn('Password validation failed', { error: passwordResult.error });
    return c.json({ success: false, error: passwordResult.error }, 400);
  }

  // Validate handle
  const handleResult = validateHandle(body.handle);
  if (!handleResult.valid) {
    log.warn('Handle validation failed', { handle: body.handle, error: handleResult.error });
    return c.json({ success: false, error: handleResult.error }, 400);
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
      return c.json({ success: false, error: 'Email already registered' }, 409);
    }

    // Check if handle already exists
    log.debug('Checking if handle exists');
    const existingHandle = await c.env.USERS_KV.get(`handle:${handle}`);
    if (existingHandle) {
      log.warn('Handle already taken', { handle });
      return c.json({ success: false, error: 'Handle already taken' }, 409);
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
      followerCount: 1,
      followingCount: 1,
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
    return c.json({ success: true, data: response }, 201);
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
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.email || !body.password) {
    log.warn('Missing email or password');
    return c.json({ success: false, error: 'Email and password required' }, 400);
  }

  const email = normalizeEmail(body.email);
  log.debug('Looking up user by email', { email });

  try {
    // Get user ID by email
    const userId = await c.env.USERS_KV.get(`email:${email}`);
    if (!userId) {
      log.warn('Login failed - email not found', { email });
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    // Get user data
    const userData = await c.env.USERS_KV.get(`user:${userId}`);
    if (!userData) {
      log.error('User data not found for existing email mapping', null, { email, userId });
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const authUser: AuthUser = JSON.parse(userData);

    // Verify password
    log.debug('Verifying password', { userId });
    const valid = await verifyPassword(body.password, authUser.salt, authUser.passwordHash);
    if (!valid) {
      log.warn('Login failed - invalid password', { userId, handle: authUser.handle });
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
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
    return c.json({ success: true, data: response });
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

  return c.json({
    success: true,
    data: { token, expiresAt },
  });
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
auth.post('/logout', requireAuth, async (c) => {
  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

/**
 * GET /api/auth/me - Get current user info
 */
auth.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');

  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const authUser: AuthUser = JSON.parse(userData);

  return c.json({
    success: true,
    data: {
      id: authUser.id,
      email: authUser.email,
      handle: authUser.handle,
      createdAt: authUser.createdAt,
      lastLogin: authUser.lastLogin,
    },
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
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const handle = normalizeHandle(body.handle);
  const email = normalizeEmail(body.email);

  // Get user ID by handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    // Don't reveal if handle exists
    return c.json({ 
      success: true, 
      data: { message: 'If the account exists, a reset token has been generated' } 
    });
  }

  // Verify email matches
  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return c.json({ 
      success: true, 
      data: { message: 'If the account exists, a reset token has been generated' } 
    });
  }

  const authUser: AuthUser = JSON.parse(userData);
  if (authUser.email !== email) {
    // Don't reveal email mismatch
    return c.json({ 
      success: true, 
      data: { message: 'If the account exists, a reset token has been generated' } 
    });
  }

  // Generate reset token
  const { generateToken } = await import('../utils/crypto');
  const resetToken = generateToken(32);
  const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes

  // Store reset token
  const resetKey = `reset:${userId}`;
  await c.env.SESSIONS_KV.put(
    resetKey,
    JSON.stringify({ token: resetToken, expiresAt, userId }),
    { expirationTtl: 900 } // 15 minutes
  );

  return c.json({
    success: true,
    data: {
      message: 'Password reset token generated',
      resetToken,
      expiresAt,
    },
  });
});

/**
 * POST /api/auth/reset/confirm - Confirm password reset with token
 */
auth.post('/reset/confirm', rateLimit({ limit: 5, windowSeconds: 3600, keyPrefix: 'rl:reset-confirm' }), async (c) => {
  let body: { resetToken: string; newPassword: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.resetToken || !body.newPassword) {
    return c.json({ success: false, error: 'Reset token and new password required' }, 400);
  }

  // Validate new password
  const passwordResult = validatePassword(body.newPassword);
  if (!passwordResult.valid) {
    return c.json({ success: false, error: passwordResult.error }, 400);
  }

  // Find reset token in KV (scan all reset tokens)
  let userId: string | null = null;

  const resetList = await c.env.SESSIONS_KV.list({ prefix: 'reset:' });
  for (const key of resetList.keys) {
    const data = await c.env.SESSIONS_KV.get(key.name);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.token === body.resetToken) {
        // Check if expired
        if (parsed.expiresAt < Date.now()) {
          await c.env.SESSIONS_KV.delete(key.name);
          return c.json({ success: false, error: 'Reset token expired' }, 401);
        }
        userId = parsed.userId;
        await c.env.SESSIONS_KV.delete(key.name); // One-time use
        break;
      }
    }
  }

  if (!userId) {
    return c.json({ success: false, error: 'Invalid reset token' }, 401);
  }

  // Get user data
  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const authUser: AuthUser = JSON.parse(userData);

  // Update password
  const newSalt = generateSalt();
  const newPasswordHash = await hashPassword(body.newPassword, newSalt);

  authUser.passwordHash = newPasswordHash;
  authUser.salt = newSalt;

  await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));

  return c.json({
    success: true,
    data: { message: 'Password reset successfully' },
  });
});

export default auth;