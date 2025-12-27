import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import {
  createUserData,
  createUniqueEmail,
  createUniqueHandle,
  createValidPassword,
  INVALID_EMAILS,
  INVALID_PASSWORDS,
  INVALID_HANDLES,
  VALID_EDGE_CASE_EMAILS,
  VALID_EDGE_CASE_HANDLES,
  VALID_EDGE_CASE_PASSWORDS,
} from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertConflict,
  assertAuthToken,
} from '../setup/assertions';

describe('POST /api/auth/signup', () => {
  let client: ApiClient;

  beforeAll(async () => {
    client = createApiClient();
    // Reset database for clean state
    await client.resetDatabase();
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('Happy Path', () => {
    it('should create a new user with valid data', async () => {
      const userData = createUserData();
      const response = await client.post('/api/auth/signup', userData);

      const data = assertSuccess(response, 201);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(userData.email.toLowerCase());
      expect(data.user.handle).toBe(userData.handle.toLowerCase());
      expect(data.user.id).toBeDefined();
      assertAuthToken(data);
    });

    it('should normalize email to lowercase', async () => {
      const userData = createUserData({ email: 'TEST@EXAMPLE.COM' });
      const response = await client.post('/api/auth/signup', userData);

      const data = assertSuccess(response, 201);
      expect(data.user.email).toBe('test@example.com');
    });

    it('should normalize handle to lowercase', async () => {
      const userData = createUserData({ handle: 'TestUser123' });
      const response = await client.post('/api/auth/signup', userData);

      const data = assertSuccess(response, 201);
      expect(data.user.handle).toBe('testuser123');
    });

    it('should trim whitespace from email', async () => {
      const email = createUniqueEmail();
      const userData = createUserData({ email: `  ${email}  ` });
      const response = await client.post('/api/auth/signup', userData);

      const data = assertSuccess(response, 201);
      expect(data.user.email).toBe(email.toLowerCase());
    });

    it('should accept email with plus addressing', async () => {
      const userData = createUserData({ email: `test+tag_${Date.now()}@example.com` });
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });

    it('should accept email with subdomain', async () => {
      const userData = createUserData({ email: `test_${Date.now()}@sub.domain.example.com` });
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });

    it('should accept handle with underscores', async () => {
      const userData = createUserData({ handle: `test_user_${Date.now() % 10000}` });
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });

    it('should accept minimum length handle (3 chars)', async () => {
      const userData = createUserData({ handle: `u${(Date.now() % 100).toString().padStart(2, '0')}` });
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });

    it('should accept maximum length handle (15 chars)', async () => {
      const id = Date.now().toString().slice(-10);
      const userData = createUserData({ handle: `user_${id}` });
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });

    it('should accept minimum length password (8 chars)', async () => {
      const userData = createUserData({ password: 'Aa1bbbbb' });
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });
  });

  describe('Email Validation', () => {
    it('should reject missing email field', async () => {
      const response = await client.post('/api/auth/signup', {
        password: createValidPassword(),
        handle: createUniqueHandle(),
      });

      assertBadRequest(response);
    });

    it('should reject empty email', async () => {
      const userData = createUserData({ email: '' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject whitespace-only email', async () => {
      const userData = createUserData({ email: '   ' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject email without @', async () => {
      const userData = createUserData({ email: 'notanemail' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject email without domain', async () => {
      const userData = createUserData({ email: 'user@' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject email without local part', async () => {
      const userData = createUserData({ email: '@domain.com' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject email without TLD', async () => {
      const userData = createUserData({ email: 'user@domain' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject email with space in local part', async () => {
      const userData = createUserData({ email: 'user name@domain.com' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject excessively long email (255+ chars)', async () => {
      const userData = createUserData({ email: 'a'.repeat(250) + '@example.com' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });
  });

  describe('Password Validation', () => {
    it('should reject missing password field', async () => {
      const response = await client.post('/api/auth/signup', {
        email: createUniqueEmail(),
        handle: createUniqueHandle(),
      });

      assertBadRequest(response);
    });

    it('should reject empty password', async () => {
      const userData = createUserData({ password: '' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject password shorter than 8 characters', async () => {
      const userData = createUserData({ password: 'Short1' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject password with exactly 7 characters', async () => {
      const userData = createUserData({ password: 'Aa1bbbb' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject password without uppercase letter', async () => {
      const userData = createUserData({ password: 'alllowercase123' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject password without lowercase letter', async () => {
      const userData = createUserData({ password: 'ALLUPPERCASE123' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject password without number', async () => {
      const userData = createUserData({ password: 'NoNumbersHere' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject excessively long password (129+ chars)', async () => {
      const userData = createUserData({ password: 'Aa1' + 'b'.repeat(127) });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });
  });

  describe('Handle Validation', () => {
    it('should reject missing handle field', async () => {
      const response = await client.post('/api/auth/signup', {
        email: createUniqueEmail(),
        password: createValidPassword(),
      });

      assertBadRequest(response);
    });

    it('should reject empty handle', async () => {
      const userData = createUserData({ handle: '' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle shorter than 3 characters', async () => {
      const userData = createUserData({ handle: 'ab' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle longer than 15 characters', async () => {
      const userData = createUserData({ handle: 'a'.repeat(16) });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle with hyphen', async () => {
      const userData = createUserData({ handle: 'user-name' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle with period', async () => {
      const userData = createUserData({ handle: 'user.name' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle with space', async () => {
      const userData = createUserData({ handle: 'user name' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle starting with underscore', async () => {
      const userData = createUserData({ handle: '_username' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject reserved handle: admin', async () => {
      const userData = createUserData({ handle: 'admin' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject reserved handle: root', async () => {
      const userData = createUserData({ handle: 'root' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject reserved handle: api', async () => {
      const userData = createUserData({ handle: 'api' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject reserved handle: system', async () => {
      const userData = createUserData({ handle: 'system' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject reserved handle case-insensitively: ADMIN', async () => {
      const userData = createUserData({ handle: 'ADMIN' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });

    it('should reject handle with special characters', async () => {
      const userData = createUserData({ handle: 'user@name' });
      const response = await client.post('/api/auth/signup', userData);

      assertBadRequest(response);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should reject duplicate email', async () => {
      const email = createUniqueEmail();

      // First signup
      const userData1 = createUserData({ email });
      const response1 = await client.post('/api/auth/signup', userData1);
      assertSuccess(response1, 201);

      // Second signup with same email
      const userData2 = createUserData({ email });
      const response2 = await client.post('/api/auth/signup', userData2);
      assertConflict(response2, 'email');
    });

    it('should reject duplicate email case-insensitively', async () => {
      const email = createUniqueEmail();

      // First signup with lowercase
      const userData1 = createUserData({ email: email.toLowerCase() });
      const response1 = await client.post('/api/auth/signup', userData1);
      assertSuccess(response1, 201);

      // Second signup with uppercase
      const userData2 = createUserData({ email: email.toUpperCase() });
      const response2 = await client.post('/api/auth/signup', userData2);
      assertConflict(response2, 'email');
    });

    it('should reject duplicate handle', async () => {
      const handle = createUniqueHandle();

      // First signup
      const userData1 = createUserData({ handle });
      const response1 = await client.post('/api/auth/signup', userData1);
      assertSuccess(response1, 201);

      // Second signup with same handle
      const userData2 = createUserData({ handle });
      const response2 = await client.post('/api/auth/signup', userData2);
      assertConflict(response2, 'handle');
    });

    it('should reject duplicate handle case-insensitively', async () => {
      const handle = createUniqueHandle();

      // First signup with lowercase
      const userData1 = createUserData({ handle: handle.toLowerCase() });
      const response1 = await client.post('/api/auth/signup', userData1);
      assertSuccess(response1, 201);

      // Second signup with mixed case
      const userData2 = createUserData({ handle: handle.toUpperCase() });
      const response2 = await client.post('/api/auth/signup', userData2);
      assertConflict(response2, 'handle');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON body', async () => {
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await client.post('/api/auth/signup', {});

      assertBadRequest(response);
    });

    it('should ignore extra fields in request', async () => {
      const userData = {
        ...createUserData(),
        extraField: 'should be ignored',
        anotherExtra: 123,
      };
      const response = await client.post('/api/auth/signup', userData);

      assertSuccess(response, 201);
    });

    it('should handle null values', async () => {
      const response = await client.post('/api/auth/signup', {
        email: null,
        password: null,
        handle: null,
      });

      assertBadRequest(response);
    });

    it('should handle undefined values', async () => {
      const response = await client.post('/api/auth/signup', {
        email: undefined,
        password: createValidPassword(),
        handle: createUniqueHandle(),
      });

      assertBadRequest(response);
    });

    it('should return proper token expiry time', async () => {
      const userData = createUserData();
      const response = await client.post('/api/auth/signup', userData);

      const data = assertSuccess(response, 201);
      // Token should expire in the future (at least 1 hour from now)
      expect(data.expiresAt).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
    });

    it('should handle numeric handle (coerced to string)', async () => {
      const response = await client.post('/api/auth/signup', {
        email: createUniqueEmail(),
        password: createValidPassword(),
        handle: 12345,
      });

      // Should either accept (coerced) or reject with validation error
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Security', () => {
    it('should not leak password in response', async () => {
      const userData = createUserData();
      const response = await client.post('/api/auth/signup', userData);

      const data = assertSuccess(response, 201);
      const responseText = JSON.stringify(data);
      expect(responseText).not.toContain(userData.password);
      expect(responseText).not.toContain('passwordHash');
      expect(responseText).not.toContain('salt');
    });

    it('should reject SQL injection in email', async () => {
      const userData = createUserData({ email: "'; DROP TABLE users; --@example.com" });
      const response = await client.post('/api/auth/signup', userData);

      // Should reject as invalid email format, not cause SQL error
      expect(response.status).toBe(400);
      expect(response.body.error).not.toContain('SQL');
    });

    it('should reject XSS attempt in handle', async () => {
      const userData = createUserData({ handle: '<script>alert(1)</script>' });
      const response = await client.post('/api/auth/signup', userData);

      // Should reject as invalid handle format
      assertBadRequest(response);
    });
  });
});
