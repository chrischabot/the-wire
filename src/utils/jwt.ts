/**
 * JWT utilities using jose library
 * Edge-compatible JWT implementation
 */

import { SignJWT, jwtVerify, errors } from 'jose';
import type { JWTPayload } from '../types/user';

const JWT_ALGORITHM = 'HS256';
const DEFAULT_EXPIRY_HOURS = 24;

/**
 * Create a secret key from a string
 */
function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT token
 */
export async function createToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiryHours: number = DEFAULT_EXPIRY_HOURS
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiryHours * 60 * 60;

  const token = await new SignJWT({
    sub: payload.sub,
    email: payload.email,
    handle: payload.handle,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(getSecretKey(secret));

  return { token, expiresAt: expiresAt * 1000 }; // Return ms for consistency
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret));
    
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      handle: payload.handle as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return null;
    }
    if (error instanceof errors.JWTInvalid) {
      return null;
    }
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(exp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return exp < now;
}