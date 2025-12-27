import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUserData, createUniqueEmail, createValidPassword } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
  assertAuthToken,
} from '../setup/assertions';

describe('POST /api/auth/login', () => {
  let client: ApiClient;
  let testUser: { email: string; password: string; handle: string };

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();

    // Create a test user for login tests
    const userData = createUserData();
    testUser = { ...userData };
    await client.post('/api/auth/signup', userData);
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('Happy Path', () => {
    it('should login with valid credentials', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      const data = assertSuccess(response, 200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testUser.email.toLowerCase());
      expect(data.user.handle).toBe(testUser.handle.toLowerCase());
      assertAuthToken(data);
    });

    it('should handle email case-insensitively', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email.toUpperCase(),
        password: testUser.password,
      });

      assertSuccess(response, 200);
    });

    it('should trim whitespace from email', async () => {
      const response = await client.post('/api/auth/login', {
        email: `  ${testUser.email}  `,
        password: testUser.password,
      });

      assertSuccess(response, 200);
    });

    it('should return a valid JWT token', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      const data = assertSuccess(response, 200);
      // JWT has 3 parts separated by dots
      expect(data.token.split('.').length).toBe(3);
    });

    it('should return user ID in response', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      const data = assertSuccess(response, 200);
      expect(data.user.id).toBeDefined();
      expect(typeof data.user.id).toBe('string');
    });
  });

  describe('Authentication Failures', () => {
    it('should reject wrong password', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'WrongPassword123',
      });

      assertUnauthorized(response);
    });

    it('should reject non-existent email', async () => {
      const response = await client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: testUser.password,
      });

      assertUnauthorized(response);
    });

    it('should return same error for wrong email and wrong password', async () => {
      // This prevents user enumeration attacks
      const wrongEmailResponse = await client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: testUser.password,
      });

      const wrongPasswordResponse = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'WrongPassword123',
      });

      // Both should return 401 with similar error message
      expect(wrongEmailResponse.status).toBe(401);
      expect(wrongPasswordResponse.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('should reject missing email', async () => {
      const response = await client.post('/api/auth/login', {
        password: testUser.password,
      });

      assertBadRequest(response);
    });

    it('should reject missing password', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
      });

      assertBadRequest(response);
    });

    it('should reject empty email', async () => {
      const response = await client.post('/api/auth/login', {
        email: '',
        password: testUser.password,
      });

      assertBadRequest(response);
    });

    it('should reject empty password', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: '',
      });

      assertBadRequest(response);
    });

    it('should reject empty request body', async () => {
      const response = await client.post('/api/auth/login', {});

      assertBadRequest(response);
    });

    it('should reject null values', async () => {
      const response = await client.post('/api/auth/login', {
        email: null,
        password: null,
      });

      assertBadRequest(response);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON', async () => {
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid }',
      });

      expect(response.status).toBe(400);
    });

    it('should not leak user existence in timing', async () => {
      // This is a basic timing check - more sophisticated tests would measure actual timing
      const start1 = Date.now();
      await client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'SomePassword123',
      });
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'WrongPassword123',
      });
      const time2 = Date.now() - start2;

      // Both should take similar time (within reasonable variance)
      // This is a weak test but helps catch obvious timing issues
      expect(Math.abs(time1 - time2)).toBeLessThan(1000);
    });
  });

  describe('Security', () => {
    it('should not return password hash in response', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      const data = assertSuccess(response, 200);
      const responseText = JSON.stringify(data);
      expect(responseText).not.toContain('passwordHash');
      expect(responseText).not.toContain('salt');
      expect(responseText).not.toContain(testUser.password);
    });

    it('should reject SQL injection in email', async () => {
      const response = await client.post('/api/auth/login', {
        email: "' OR '1'='1",
        password: testUser.password,
      });

      // Should fail authentication, not cause SQL error
      expect([400, 401]).toContain(response.status);
      expect(response.body.error).not.toContain('SQL');
    });

    it('should reject SQL injection in password', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: "' OR '1'='1",
      });

      // Should fail authentication, not cause SQL error
      expect(response.status).toBe(401);
    });
  });

  describe('Multiple Users', () => {
    it('should authenticate correct user among multiple', async () => {
      // Create another user
      const user2Data = createUserData();
      await client.post('/api/auth/signup', user2Data);

      // Login as first user
      const response1 = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });
      const data1 = assertSuccess(response1, 200);
      expect(data1.user.handle).toBe(testUser.handle.toLowerCase());

      // Login as second user
      const response2 = await client.post('/api/auth/login', {
        email: user2Data.email,
        password: user2Data.password,
      });
      const data2 = assertSuccess(response2, 200);
      expect(data2.user.handle).toBe(user2Data.handle.toLowerCase());

      // Tokens should be different
      expect(data1.token).not.toBe(data2.token);
    });

    it('should not allow login with another user password', async () => {
      // Create another user
      const user2Data = createUserData();
      await client.post('/api/auth/signup', user2Data);

      // Try to login with user1's email but user2's password
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: user2Data.password,
      });

      assertUnauthorized(response);
    });
  });
});
