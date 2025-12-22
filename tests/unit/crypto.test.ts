import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  timingSafeEqual,
  generateToken,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../../src/utils/crypto';

describe('Crypto Utilities', () => {
  describe('generateSalt', () => {
    it('should generate a base64 string', () => {
      const salt = generateSalt();
      expect(salt).toBeTruthy();
      expect(typeof salt).toBe('string');
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });

    it('should generate consistent length salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      // Base64 length varies but should be consistent for same input size
      expect(salt1.length).toBe(salt2.length);
    });
  });

  describe('hashPassword', () => {
    it('should produce a hash string', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('password123', salt);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should produce different hashes for different passwords', async () => {
      const salt = generateSalt();
      const hash1 = await hashPassword('password1', salt);
      const hash2 = await hashPassword('password2', salt);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for same password with different salts', async () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const hash1 = await hashPassword('password', salt1);
      const hash2 = await hashPassword('password', salt2);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same password and salt', async () => {
      const salt = generateSalt();
      const hash1 = await hashPassword('password', salt);
      const hash2 = await hashPassword('password', salt);
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('correctPassword', salt);
      const isValid = await verifyPassword('correctPassword', salt, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('correctPassword', salt);
      const isValid = await verifyPassword('wrongPassword', salt, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
      expect(timingSafeEqual('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeEqual('hello', 'world')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(timingSafeEqual('hello', 'hi')).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a base64 string', () => {
      const token = generateToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should respect length parameter', () => {
      const token16 = generateToken(16);
      const token32 = generateToken(32);
      // Base64 encoding: 4 chars per 3 bytes, so length varies
      expect(token32.length).toBeGreaterThan(token16.length);
    });
  });

  describe('base64 conversion', () => {
    it('should roundtrip correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const base64 = arrayBufferToBase64(original);
      const restored = base64ToArrayBuffer(base64);
      expect(Array.from(restored)).toEqual(Array.from(original));
    });
  });
});