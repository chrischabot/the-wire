import { describe, it, expect, vi } from 'vitest';
import {
  createToken,
  verifyToken,
  extractToken,
  isTokenExpired,
} from '../../src/utils/jwt';

const TEST_SECRET = 'test-secret-key-for-testing';

describe('JWT Utilities', () => {
  describe('createToken', () => {
    it('should create a valid JWT string', async () => {
      const { token } = await createToken(
        { sub: 'user123', email: 'test@example.com', handle: 'testuser' },
        TEST_SECRET
      );
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should return expiration time', async () => {
      const { expiresAt } = await createToken(
        { sub: 'user123', email: 'test@example.com', handle: 'testuser' },
        TEST_SECRET,
        1 // 1 hour
      );
      const oneHourFromNow = Date.now() + 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(expiresAt).toBeLessThanOrEqual(oneHourFromNow + 1000); // Allow 1s tolerance
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const { token } = await createToken(
        { sub: 'user123', email: 'test@example.com', handle: 'testuser' },
        TEST_SECRET
      );

      const payload = await verifyToken(token, TEST_SECRET);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user123');
      expect(payload?.email).toBe('test@example.com');
      expect(payload?.handle).toBe('testuser');
    });

    it('should return null for invalid token', async () => {
      const payload = await verifyToken('invalid.token.here', TEST_SECRET);
      expect(payload).toBeNull();
    });

    it('should return null for wrong secret', async () => {
      const { token } = await createToken(
        { sub: 'user123', email: 'test@example.com', handle: 'testuser' },
        TEST_SECRET
      );

      const payload = await verifyToken(token, 'wrong-secret');
      expect(payload).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Create a token that expires immediately
      const { token } = await createToken(
        { sub: 'user123', email: 'test@example.com', handle: 'testuser' },
        TEST_SECRET,
        0 // 0 hours = expires immediately
      );

      // Wait a bit to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      const payload = await verifyToken(token, TEST_SECRET);
      expect(payload).toBeNull();
    });
  });

  describe('extractToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = extractToken('Bearer abc123');
      expect(token).toBe('abc123');
    });

    it('should be case-insensitive for Bearer', () => {
      expect(extractToken('bearer abc123')).toBe('abc123');
      expect(extractToken('BEARER abc123')).toBe('abc123');
    });

    it('should return null for missing header', () => {
      expect(extractToken(null)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(extractToken('Basic abc123')).toBeNull();
      expect(extractToken('Bearer')).toBeNull();
      expect(extractToken('abc123')).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for future expiration', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      expect(isTokenExpired(futureExp)).toBe(false);
    });

    it('should return true for past expiration', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(isTokenExpired(pastExp)).toBe(true);
    });
  });
});