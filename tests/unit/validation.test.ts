import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateHandle,
  validateNoteContent,
  validateDisplayName,
  validateBio,
  sanitizeString,
  normalizeEmail,
  normalizeHandle,
} from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('test@example.com').valid).toBe(true);
      expect(validateEmail('user.name@domain.org').valid).toBe(true);
      expect(validateEmail('user+tag@example.co.uk').valid).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('').valid).toBe(false);
      expect(validateEmail('notanemail').valid).toBe(false);
      expect(validateEmail('missing@domain').valid).toBe(false);
      expect(validateEmail('@nodomain.com').valid).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(validateEmail('  test@example.com  ').valid).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      expect(validatePassword('SecurePass123').valid).toBe(true);
      expect(validatePassword('MyP@ssw0rd!').valid).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('short').valid).toBe(false);
      expect(validatePassword('alllowercase1').valid).toBe(false);
      expect(validatePassword('ALLUPPERCASE1').valid).toBe(false);
      expect(validatePassword('NoNumbersHere').valid).toBe(false);
    });

    it('should reject empty passwords', () => {
      expect(validatePassword('').valid).toBe(false);
    });

    it('should reject too long passwords', () => {
      expect(validatePassword('A'.repeat(129) + 'a1').valid).toBe(false);
    });
  });

  describe('validateHandle', () => {
    it('should accept valid handles', () => {
      expect(validateHandle('user').valid).toBe(true);
      expect(validateHandle('user123').valid).toBe(true);
      expect(validateHandle('user_name').valid).toBe(true);
    });

    it('should reject too short handles', () => {
      expect(validateHandle('ab').valid).toBe(false);
    });

    it('should reject too long handles', () => {
      expect(validateHandle('a'.repeat(16)).valid).toBe(false);
    });

    it('should reject handles with invalid characters', () => {
      expect(validateHandle('user-name').valid).toBe(false);
      expect(validateHandle('user.name').valid).toBe(false);
      expect(validateHandle('user name').valid).toBe(false);
    });

    it('should reject handles starting with underscore', () => {
      expect(validateHandle('_username').valid).toBe(false);
    });

    it('should reject reserved handles', () => {
      expect(validateHandle('admin').valid).toBe(false);
      expect(validateHandle('root').valid).toBe(false);
      expect(validateHandle('api').valid).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(validateHandle('ADMIN').valid).toBe(false);
    });
  });

  describe('validateNoteContent', () => {
    it('should accept valid content', () => {
      expect(validateNoteContent('Hello, world!').valid).toBe(true);
    });

    it('should reject empty content', () => {
      expect(validateNoteContent('').valid).toBe(false);
      expect(validateNoteContent('   ').valid).toBe(false);
    });

    it('should reject content exceeding max length', () => {
      expect(validateNoteContent('a'.repeat(281)).valid).toBe(false);
    });

    it('should respect custom max length', () => {
      expect(validateNoteContent('hello', 5).valid).toBe(true);
      expect(validateNoteContent('hello!', 5).valid).toBe(false);
    });
  });

  describe('validateDisplayName', () => {
    it('should accept valid display names', () => {
      expect(validateDisplayName('John Doe').valid).toBe(true);
      expect(validateDisplayName('').valid).toBe(true); // Optional
    });

    it('should reject too long display names', () => {
      expect(validateDisplayName('a'.repeat(51)).valid).toBe(false);
    });
  });

  describe('validateBio', () => {
    it('should accept valid bios', () => {
      expect(validateBio('Hello, I am a developer.').valid).toBe(true);
      expect(validateBio('').valid).toBe(true); // Optional
    });

    it('should reject too long bios', () => {
      expect(validateBio('a'.repeat(161)).valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove null bytes', () => {
      expect(sanitizeString('hello\0world')).toBe('helloworld');
    });

    it('should handle empty input', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('normalizeEmail', () => {
    it('should lowercase and trim', () => {
      expect(normalizeEmail('  TEST@Example.COM  ')).toBe('test@example.com');
    });
  });

  describe('normalizeHandle', () => {
    it('should lowercase and trim', () => {
      expect(normalizeHandle('  TestUser  ')).toBe('testuser');
    });
  });
});