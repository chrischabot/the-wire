import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
  assertNotFound,
  assertUserProfile,
} from '../setup/assertions';

describe('User Profile Endpoints', () => {
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

  describe('PUT /api/users/me', () => {
    beforeEach(() => {
      client.setToken(testUser.token);
    });

    describe('Happy Path', () => {
      it('should update display name', async () => {
        const response = await client.put('/api/users/me', {
          displayName: 'New Display Name',
        });

        const data = assertSuccess(response, 200);
        expect(data.displayName).toBe('New Display Name');
      });

      it('should update bio', async () => {
        const newBio = 'This is my new bio for testing purposes.';
        const response = await client.put('/api/users/me', {
          bio: newBio,
        });

        const data = assertSuccess(response, 200);
        expect(data.bio).toBe(newBio);
      });

      it('should update location', async () => {
        const response = await client.put('/api/users/me', {
          location: 'New York, NY',
        });

        const data = assertSuccess(response, 200);
        expect(data.location).toBe('New York, NY');
      });

      it('should update website', async () => {
        const response = await client.put('/api/users/me', {
          website: 'https://example.com',
        });

        const data = assertSuccess(response, 200);
        expect(data.website).toBe('https://example.com');
      });

      it('should update multiple fields at once', async () => {
        const response = await client.put('/api/users/me', {
          displayName: 'Multi Update',
          bio: 'Updated bio',
          location: 'San Francisco',
          website: 'https://multi.example.com',
        });

        const data = assertSuccess(response, 200);
        expect(data.displayName).toBe('Multi Update');
        expect(data.bio).toBe('Updated bio');
        expect(data.location).toBe('San Francisco');
        expect(data.website).toBe('https://multi.example.com');
      });

      it('should clear optional field with empty string', async () => {
        // First set a value
        await client.put('/api/users/me', { bio: 'Some bio' });

        // Then clear it
        const response = await client.put('/api/users/me', { bio: '' });

        const data = assertSuccess(response, 200);
        expect(data.bio).toBe('');
      });

      it('should preserve fields not included in update', async () => {
        // Set initial values
        await client.put('/api/users/me', {
          displayName: 'Initial Name',
          bio: 'Initial bio',
        });

        // Update only displayName
        const response = await client.put('/api/users/me', {
          displayName: 'Updated Name',
        });

        const data = assertSuccess(response, 200);
        expect(data.displayName).toBe('Updated Name');
        expect(data.bio).toBe('Initial bio'); // Should be preserved
      });
    });

    describe('Validation', () => {
      it('should reject display name longer than 50 characters', async () => {
        const response = await client.put('/api/users/me', {
          displayName: 'a'.repeat(51),
        });

        assertBadRequest(response);
      });

      it('should accept display name of exactly 50 characters', async () => {
        const response = await client.put('/api/users/me', {
          displayName: 'a'.repeat(50),
        });

        assertSuccess(response, 200);
      });

      it('should reject bio longer than 160 characters', async () => {
        const response = await client.put('/api/users/me', {
          bio: 'a'.repeat(161),
        });

        assertBadRequest(response);
      });

      it('should accept bio of exactly 160 characters', async () => {
        const response = await client.put('/api/users/me', {
          bio: 'a'.repeat(160),
        });

        assertSuccess(response, 200);
      });
    });

    describe('Immutable Fields Protection', () => {
      it('should not change handle even if provided', async () => {
        const originalHandle = testUser.handle.toLowerCase();
        const response = await client.put('/api/users/me', {
          handle: 'newhandle',
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.handle).toBe(originalHandle);
      });

      it('should not change id even if provided', async () => {
        const response = await client.put('/api/users/me', {
          id: 'fake-id-123',
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.id).toBe(testUser.id);
      });

      it('should not change joinedAt even if provided', async () => {
        const profileBefore = await client.get('/api/users/me');
        const originalJoinedAt = (profileBefore.body.data as any).joinedAt;

        const response = await client.put('/api/users/me', {
          joinedAt: Date.now() - 1000000000,
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.joinedAt).toBe(originalJoinedAt);
      });

      it('should not change followerCount even if provided', async () => {
        const response = await client.put('/api/users/me', {
          followerCount: 999999,
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.followerCount).not.toBe(999999);
      });

      it('should not change followingCount even if provided', async () => {
        const response = await client.put('/api/users/me', {
          followingCount: 999999,
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.followingCount).not.toBe(999999);
      });

      it('should not change postCount even if provided', async () => {
        const response = await client.put('/api/users/me', {
          postCount: 999999,
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.postCount).not.toBe(999999);
      });

      it('should not change isVerified even if provided', async () => {
        const response = await client.put('/api/users/me', {
          isVerified: true,
          displayName: 'Test Update',
        });

        const data = assertSuccess(response, 200);
        expect(data.isVerified).toBe(false);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.put('/api/users/me', {
          displayName: 'Test',
        });

        assertUnauthorized(response);
      });

      it('should reject request with invalid token', async () => {
        client.setToken('invalid-token');
        const response = await client.put('/api/users/me', {
          displayName: 'Test',
        });

        assertUnauthorized(response);
      });
    });
  });

  describe('GET /api/users/:handle', () => {
    describe('Happy Path', () => {
      it('should get user profile by handle', async () => {
        const response = await client.get(`/api/users/${testUser.handle}`);

        const data = assertSuccess(response, 200);
        assertUserProfile(data);
        expect(data.handle).toBe(testUser.handle.toLowerCase());
      });

      it('should work without authentication', async () => {
        client.clearToken();
        const response = await client.get(`/api/users/${testUser.handle}`);

        assertSuccess(response, 200);
      });

      it('should handle case-insensitive handle lookup', async () => {
        const response = await client.get(`/api/users/${testUser.handle.toUpperCase()}`);

        const data = assertSuccess(response, 200);
        expect(data.handle).toBe(testUser.handle.toLowerCase());
      });

      it('should include all profile fields', async () => {
        const response = await client.get(`/api/users/${testUser.handle}`);

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('handle');
        expect(data).toHaveProperty('displayName');
        expect(data).toHaveProperty('bio');
        expect(data).toHaveProperty('joinedAt');
        expect(data).toHaveProperty('followerCount');
        expect(data).toHaveProperty('followingCount');
        expect(data).toHaveProperty('postCount');
      });

      it('should not include sensitive fields', async () => {
        const response = await client.get(`/api/users/${testUser.handle}`);

        const data = assertSuccess(response, 200);
        expect(data).not.toHaveProperty('email');
        expect(data).not.toHaveProperty('passwordHash');
        expect(data).not.toHaveProperty('salt');
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent handle', async () => {
        const response = await client.get('/api/users/nonexistentuser123');

        assertNotFound(response);
      });

      it('should return 404 for empty handle', async () => {
        // This might route differently, but should not crash
        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/users/`);

        expect([404, 400, 405]).toContain(response.status);
      });
    });

    describe('Handle with Special Characters', () => {
      it('should create and retrieve user with underscore in handle', async () => {
        const userWithUnderscore = await createUser(client, {
          handle: `test_user_${Date.now() % 10000}`,
        });

        const response = await client.get(`/api/users/${userWithUnderscore.handle}`);

        const data = assertSuccess(response, 200);
        expect(data.handle).toBe(userWithUnderscore.handle.toLowerCase());
      });
    });
  });

  describe('GET /api/users/me (via profile)', () => {
    it('should return current user profile when authenticated', async () => {
      client.setToken(testUser.token);
      const response = await client.get('/api/auth/me');

      const data = assertSuccess(response, 200);
      expect(data.id).toBe(testUser.id);
      expect(data.handle).toBe(testUser.handle.toLowerCase());
    });
  });
});
