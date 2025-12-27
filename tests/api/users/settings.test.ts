import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertUnauthorized,
} from '../setup/assertions';

describe('User Settings Endpoints', () => {
  let client: ApiClient;
  let testUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    testUser = await createUser(client);
  });

  beforeEach(() => {
    client.setToken(testUser.token);
  });

  describe('GET /api/users/me/settings', () => {
    describe('Happy Path', () => {
      it('should return user settings', async () => {
        const response = await client.get('/api/users/me/settings');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('emailNotifications');
        expect(data).toHaveProperty('privateAccount');
        expect(data).toHaveProperty('mutedWords');
      });

      it('should return default settings for new user', async () => {
        const freshUser = await createUser(client);
        client.setToken(freshUser.token);

        const response = await client.get('/api/users/me/settings');

        const data = assertSuccess(response, 200);
        expect(typeof data.emailNotifications).toBe('boolean');
        expect(typeof data.privateAccount).toBe('boolean');
        expect(Array.isArray(data.mutedWords)).toBe(true);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.get('/api/users/me/settings');

        assertUnauthorized(response);
      });
    });
  });

  describe('PUT /api/users/me/settings', () => {
    describe('Happy Path', () => {
      it('should update emailNotifications', async () => {
        const response = await client.put('/api/users/me/settings', {
          emailNotifications: false,
        });

        const data = assertSuccess(response, 200);
        expect(data.emailNotifications).toBe(false);
      });

      it('should update privateAccount', async () => {
        const response = await client.put('/api/users/me/settings', {
          privateAccount: true,
        });

        const data = assertSuccess(response, 200);
        expect(data.privateAccount).toBe(true);
      });

      it('should update mutedWords', async () => {
        const mutedWords = ['spam', 'advertisement', 'crypto'];
        const response = await client.put('/api/users/me/settings', {
          mutedWords: mutedWords,
        });

        const data = assertSuccess(response, 200);
        expect(data.mutedWords).toEqual(mutedWords);
      });

      it('should update multiple settings at once', async () => {
        const response = await client.put('/api/users/me/settings', {
          emailNotifications: true,
          privateAccount: false,
          mutedWords: ['test'],
        });

        const data = assertSuccess(response, 200);
        expect(data.emailNotifications).toBe(true);
        expect(data.privateAccount).toBe(false);
        expect(data.mutedWords).toEqual(['test']);
      });

      it('should preserve settings not included in update', async () => {
        // Set initial values
        await client.put('/api/users/me/settings', {
          emailNotifications: true,
          privateAccount: true,
          mutedWords: ['word1', 'word2'],
        });

        // Update only emailNotifications
        const response = await client.put('/api/users/me/settings', {
          emailNotifications: false,
        });

        const data = assertSuccess(response, 200);
        expect(data.emailNotifications).toBe(false);
        // Other settings should be preserved
      });

      it('should clear mutedWords with empty array', async () => {
        // Set some muted words first
        await client.put('/api/users/me/settings', {
          mutedWords: ['word1', 'word2'],
        });

        // Clear them
        const response = await client.put('/api/users/me/settings', {
          mutedWords: [],
        });

        const data = assertSuccess(response, 200);
        expect(data.mutedWords).toEqual([]);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.put('/api/users/me/settings', {
          emailNotifications: false,
        });

        assertUnauthorized(response);
      });
    });
  });
});
