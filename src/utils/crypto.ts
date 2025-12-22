/**
 * Cryptographic utilities for password hashing
 * Uses WebCrypto API for edge compatibility
 */

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const ALGORITHM = 'PBKDF2';
const HASH = 'SHA-256';

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return arrayBufferToBase64(salt);
}

/**
 * Hash a password with the given salt using PBKDF2
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = base64ToArrayBuffer(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    ALGORITHM,
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: HASH,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  return arrayBufferToBase64(new Uint8Array(derivedBits));
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return timingSafeEqual(computedHash, storedHash);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]!);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Generate a random token (for session IDs, etc.)
 */
export function generateToken(length: number = 32): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return arrayBufferToBase64(buffer);
}