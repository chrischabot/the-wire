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

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/signup - Create a new account
 */
auth.post('/signup', async (c) => {
  let body: SignupRequest;
  try {
    body = await c.req.json<SignupRequest>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  // Validate email
  const emailResult = validateEmail(body.email);
  if (!emailResult.valid) {
    return c.json({ success: false, error: emailResult.error }, 400);
  }

  // Validate password
  const passwordResult = validatePassword(body.password);
  if (!passwordResult.valid) {
    return c.json({ success: false, error: passwordResult.error }, 400);
  }

  // Validate handle
  const handleResult = validateHandle(body.handle);
  if (!handleResult.valid) {
    return c.json({ success: false, error: handleResult.error }, 400);
  }

  const email = normalizeEmail(body.email);
  const handle = normalizeHandle(body.handle);

  // Check if email already exists
  const existingEmail = await c.env.USERS_KV.get(`email:${email}`);
  if (existingEmail) {
    return c.json({ success: false, error: 'Email already registered' }, 409);
  }

  // Check if handle already exists
  const existingHandle = await c.env.USERS_KV.get(`handle:${handle}`);
  if (existingHandle) {
    return c.json({ success: false, error: 'Handle already taken' }, 409);
  }

  // Create user
  const userId = generateId();
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
  await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));
  await c.env.USERS_KV.put(`email:${email}`, userId);
  await c.env.USERS_KV.put(`handle:${handle}`, userId);

  // Initialize UserDO
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
  };

  const defaultSettings: import('../types/user').UserSettings = {
    emailNotifications: true,
    privateAccount: false,
    mutedWords: [],
  };

  const doId = c.env.USER_DO.idFromName(userId);
  const stub = c.env.USER_DO.get(doId);
  await stub.fetch('https://do.internal/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: defaultProfile, settings: defaultSettings }),
  });

  // Generate token
  const expiryHours = parseInt(c.env.JWT_EXPIRY_HOURS || '24', 10);
  const { token, expiresAt } = await createToken(
    { sub: userId, email, handle },
    getJwtSecret(c.env),
    expiryHours
  );

  const response: AuthResponse = {
    user: { id: userId, email, handle },
    token,
    expiresAt,
  };

  return c.json({ success: true, data: response }, 201);
});

/**
 * POST /api/auth/login - Login with email and password
 */
auth.post('/login', async (c) => {
  let body: LoginRequest;
  try {
    body = await c.req.json<LoginRequest>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (!body.email || !body.password) {
    return c.json({ success: false, error: 'Email and password required' }, 400);
  }

  const email = normalizeEmail(body.email);

  // Get user ID by email
  const userId = await c.env.USERS_KV.get(`email:${email}`);
  if (!userId) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  // Get user data
  const userData = await c.env.USERS_KV.get(`user:${userId}`);
  if (!userData) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const authUser: AuthUser = JSON.parse(userData);

  // Verify password
  const valid = await verifyPassword(body.password, authUser.salt, authUser.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  // Update last login
  authUser.lastLogin = Date.now();
  await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));

  // Generate token
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

  return c.json({ success: true, data: response });
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

export default auth;