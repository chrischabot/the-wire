/**
 * User-related type definitions for The Wire
 */

/**
 * Authentication user stored in KV
 */
export interface AuthUser {
  id: string;
  email: string;
  handle: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  lastLogin: number;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string;      // User ID
  email: string;
  handle: string;
  iat: number;      // Issued at
  exp: number;      // Expiration
}

/**
 * Public user profile (returned by API)
 */
export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
  bannerUrl: string;
  joinedAt: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isVerified: boolean;
  isBanned: boolean;
  bannedAt?: number | undefined;
  bannedReason?: string | undefined;
  isAdmin: boolean;
}

/**
 * User settings
 */
export interface UserSettings {
  emailNotifications: boolean;
  privateAccount: boolean;
  mutedWords: string[];
}

/**
 * Signup request body
 */
export interface SignupRequest {
  email: string;
  password: string;
  handle: string;
}

/**
 * Login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Auth response with token
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    handle: string;
  };
  token: string;
  expiresAt: number;
}