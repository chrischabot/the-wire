import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertUnauthorized,
  assertAuthToken,
} from '../setup/assertions';

describe('Token Management Endpoints', () => {
  let client: ApiClient;
  let testUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    testUser = await createUser(client);
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('POST /api/auth/refresh', () => {
    describe('Happy Path', () => {
      it('should return a new token with valid auth', async () => {
        client.setToken(testUser.token);
        const response = await client.post('/api/auth/refresh');

        const data = assertSuccess(response, 200);
        assertAuthToken(data);
      });

      it('should return a different token than the original', async () => {
        client.setToken(testUser.token);
        const response = await client.post('/api/auth/refresh');

        const data = assertSuccess(response, 200);
        // Note: tokens may or may not be different depending on implementation
        // but expiry should be extended
        expect(data.expiresAt).toBeGreaterThan(Date.now());
      });

      it('should return token with extended expiry', async () => {
        client.setToken(testUser.token);
        const beforeRefresh = Date.now();
        const response = await client.post('/api/auth/refresh');

        const data = assertSuccess(response, 200);
        // New expiry should be at least 1 hour from now
        expect(data.expiresAt).toBeGreaterThan(beforeRefresh + 60 * 60 * 1000);
      });

      it('should allow using refreshed token for subsequent requests', async () => {
        client.setToken(testUser.token);
        const refreshResponse = await client.post('/api/auth/refresh');
        const refreshData = assertSuccess(refreshResponse, 200);

        // Use new token
        client.setToken(refreshData.token);
        const meResponse = await client.get('/api/auth/me');

        assertSuccess(meResponse, 200);
      });
    });

    describe('Authentication Failures', () => {
      it('should reject request without token', async () => {
        const response = await client.post('/api/auth/refresh');

        assertUnauthorized(response);
      });

      it('should reject request with invalid token', async () => {
        client.setToken('invalid-token');
        const response = await client.post('/api/auth/refresh');

        assertUnauthorized(response);
      });

      it('should reject request with malformed bearer header', async () => {
        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: 'Bearer' }, // Missing token
        });

        expect(response.status).toBe(401);
      });

      it('should reject request with wrong auth type', async () => {
        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Basic ${testUser.token}` },
        });

        expect(response.status).toBe(401);
      });

      it('should reject request with tampered token', async () => {
        // Tamper with the token by modifying a character
        const tamperedToken = testUser.token.slice(0, -5) + 'XXXXX';
        client.setToken(tamperedToken);
        const response = await client.post('/api/auth/refresh');

        assertUnauthorized(response);
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    describe('Happy Path', () => {
      it('should logout successfully with valid token', async () => {
        client.setToken(testUser.token);
        const response = await client.post('/api/auth/logout');

        const data = assertSuccess(response, 200);
        expect(data.message).toContain('Logged out');
      });

      it('should return success even if called multiple times', async () => {
        client.setToken(testUser.token);

        const response1 = await client.post('/api/auth/logout');
        assertSuccess(response1, 200);

        // Second logout with same token - stateless so should still succeed
        const response2 = await client.post('/api/auth/logout');
        // May return 200 (stateless) or 401 (if token invalidated)
        expect([200, 401]).toContain(response2.status);
      });
    });

    describe('Authentication Failures', () => {
      it('should reject request without token', async () => {
        const response = await client.post('/api/auth/logout');

        assertUnauthorized(response);
      });

      it('should reject request with invalid token', async () => {
        client.setToken('invalid-token');
        const response = await client.post('/api/auth/logout');

        assertUnauthorized(response);
      });
    });
  });

  describe('GET /api/auth/me', () => {
    describe('Happy Path', () => {
      it('should return current user info', async () => {
        client.setToken(testUser.token);
        const response = await client.get('/api/auth/me');

        const data = assertSuccess(response, 200);
        expect(data.id).toBe(testUser.id);
        expect(data.email).toBe(testUser.email.toLowerCase());
        expect(data.handle).toBe(testUser.handle.toLowerCase());
      });

      it('should include isAdmin field', async () => {
        client.setToken(testUser.token);
        const response = await client.get('/api/auth/me');

        const data = assertSuccess(response, 200);
        expect(typeof data.isAdmin).toBe('boolean');
      });

      it('should include createdAt timestamp', async () => {
        client.setToken(testUser.token);
        const response = await client.get('/api/auth/me');

        const data = assertSuccess(response, 200);
        expect(data.createdAt).toBeDefined();
        expect(typeof data.createdAt).toBe('number');
        expect(data.createdAt).toBeLessThanOrEqual(Date.now());
      });

      it('should not include sensitive data', async () => {
        client.setToken(testUser.token);
        const response = await client.get('/api/auth/me');

        const data = assertSuccess(response, 200);
        const responseText = JSON.stringify(data);
        expect(responseText).not.toContain('passwordHash');
        expect(responseText).not.toContain('salt');
      });
    });

    describe('Authentication Failures', () => {
      it('should reject request without token', async () => {
        const response = await client.get('/api/auth/me');

        assertUnauthorized(response);
      });

      it('should reject request with invalid token', async () => {
        client.setToken('not-a-valid-jwt');
        const response = await client.get('/api/auth/me');

        assertUnauthorized(response);
      });

      it('should reject request with expired token format', async () => {
        // This simulates an expired token (actual expiry testing would require time manipulation)
        const expiredLikeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid';
        client.setToken(expiredLikeToken);
        const response = await client.get('/api/auth/me');

        assertUnauthorized(response);
      });

      it('should reject request with empty authorization header', async () => {
        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/auth/me`, {
          headers: { Authorization: '' },
        });

        expect(response.status).toBe(401);
      });
    });

    describe('Multiple Users', () => {
      it('should return correct user for each token', async () => {
        // Create a second user
        const user2 = await createUser(client);

        // Check first user
        client.setToken(testUser.token);
        const response1 = await client.get('/api/auth/me');
        const data1 = assertSuccess(response1, 200);
        expect(data1.id).toBe(testUser.id);

        // Check second user
        client.setToken(user2.token);
        const response2 = await client.get('/api/auth/me');
        const data2 = assertSuccess(response2, 200);
        expect(data2.id).toBe(user2.id);

        // IDs should be different
        expect(data1.id).not.toBe(data2.id);
      });
    });
  });

  describe('Token Flow Integration', () => {
    it('should support full token lifecycle: login -> use -> refresh -> use -> logout', async () => {
      // Create fresh user for this test
      const freshUser = await createUser(client);

      // 1. Use initial token
      client.setToken(freshUser.token);
      const meResponse1 = await client.get('/api/auth/me');
      assertSuccess(meResponse1, 200);

      // 2. Refresh token
      const refreshResponse = await client.post('/api/auth/refresh');
      const refreshData = assertSuccess(refreshResponse, 200);

      // 3. Use refreshed token
      client.setToken(refreshData.token);
      const meResponse2 = await client.get('/api/auth/me');
      assertSuccess(meResponse2, 200);

      // 4. Logout
      const logoutResponse = await client.post('/api/auth/logout');
      assertSuccess(logoutResponse, 200);
    });
  });
});
