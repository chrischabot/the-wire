import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertUnauthorized,
  assertForbidden,
  assertNotFound,
  assertBadRequest,
} from '../setup/assertions';

// Shared test state
let sharedClient: ApiClient;
let sharedAdminUser: UserWithToken;
let sharedRegularUser: UserWithToken;
let testUserPool: UserWithToken[] = []; // Pool of test users to avoid hitting rate limits
let isSetupComplete = false;

// Helper function to ensure setup is complete before tests run
async function ensureSetup() {
  if (isSetupComplete) return;

  sharedClient = createApiClient();
  await sharedClient.resetDatabase();

  // Create admin user and bootstrap admin privileges
  sharedAdminUser = await createUser(sharedClient, { handle: 'testadmin' });

  // Bootstrap admin status using the debug endpoint (doesn't require auth)
  const bootstrapResponse = await sharedClient.post(`/debug/bootstrap-admin/${sharedAdminUser.handle}`);
  if (!bootstrapResponse.body.success) {
    throw new Error(`Failed to bootstrap admin: ${bootstrapResponse.body.error}`);
  }

  sharedRegularUser = await createUser(sharedClient);

  // Create a pool of test users to avoid hitting rate limits
  // We need users for: banning, unbanning, admin changes, post creation, etc.
  for (let i = 0; i < 8; i++) {
    const user = await createUser(sharedClient, { handle: `testuser${i}` });
    testUserPool.push(user);
  }

  isSetupComplete = true;
}

// Helper to get a fresh test user from the pool
function getTestUser(index: number = 0): UserWithToken {
  return testUserPool[index % testUserPool.length];
}

describe('Admin Endpoints', () => {
  let client: ApiClient;
  let regularUser: UserWithToken;
  let adminUser: UserWithToken;

  beforeAll(async () => {
    await ensureSetup();
    client = sharedClient;
    adminUser = sharedAdminUser;
    regularUser = sharedRegularUser;
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('Authorization Checks', () => {
    describe('GET /api/admin/stats', () => {
      it('should reject request without token', async () => {
        const response = await client.get('/api/admin/stats');
        assertUnauthorized(response);
      });

      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.get('/api/admin/stats');
        assertForbidden(response);
      });
    });

    describe('GET /api/admin/users', () => {
      it('should reject request without token', async () => {
        const response = await client.get('/api/admin/users');
        assertUnauthorized(response);
      });

      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.get('/api/admin/users');
        assertForbidden(response);
      });
    });

    describe('GET /api/admin/users/:handle', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.get(`/api/admin/users/${regularUser.handle}`);
        assertForbidden(response);
      });
    });

    describe('PUT /api/admin/users/:handle', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.put(`/api/admin/users/${regularUser.handle}`, {
          displayName: 'Hacked Name',
        });
        assertForbidden(response);
      });
    });

    describe('DELETE /api/admin/users/:handle', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const targetUser = getTestUser(1);
        client.setToken(regularUser.token);

        const response = await client.delete(`/api/admin/users/${targetUser.handle}`);
        assertForbidden(response);
      });
    });

    describe('GET /api/admin/posts', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.get('/api/admin/posts');
        assertForbidden(response);
      });
    });

    describe('GET /api/admin/posts/:id', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const post = await createPost(client);
        const response = await client.get(`/api/admin/posts/${post.id}`);
        assertForbidden(response);
      });
    });

    describe('POST /api/admin/posts/:id/restore', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.post('/api/admin/posts/someid/restore');
        assertForbidden(response);
      });
    });

    describe('DELETE /api/admin/posts/:id', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const post = await createPost(client);
        const response = await client.delete(`/api/admin/posts/${post.id}`);
        assertForbidden(response);
      });
    });
  });

  describe('Admin Functionality (requires admin user)', () => {
    describe('GET /api/admin/stats', () => {
      it('should return platform statistics', async () => {
        client.setToken(adminUser.token);
        const response = await client.get('/api/admin/stats');

        assertSuccess(response);
        expect(response.body.data).toBeDefined();
        expect(response.body.data).toHaveProperty('users');
        expect(response.body.data.users).toHaveProperty('total');
        expect(response.body.data.users).toHaveProperty('banned');
        expect(response.body.data.users).toHaveProperty('last24h');
        expect(response.body.data).toHaveProperty('posts');
        expect(response.body.data.posts).toHaveProperty('total');
        expect(response.body.data.posts).toHaveProperty('takenDown');
        expect(response.body.data.posts).toHaveProperty('last24h');
        expect(response.body.data).toHaveProperty('engagement');
        expect(response.body.data).toHaveProperty('generatedAt');
      });
    });

    describe('GET /api/admin/users', () => {
      it('should list users with pagination', async () => {
        client.setToken(adminUser.token);

        // We already have plenty of test users in the pool
        const response = await client.get('/api/admin/users', { limit: 2 });

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('users');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('limit');
        expect(response.body.data).toHaveProperty('offset');
        expect(response.body.data).toHaveProperty('hasMore');
        expect(Array.isArray(response.body.data.users)).toBe(true);
        expect(response.body.data.users.length).toBeLessThanOrEqual(2);
      });

      it('should filter by banned status', async () => {
        client.setToken(adminUser.token);

        // Use a test user from the pool
        const userToBan = getTestUser(0);
        await client.post(`/api/moderation/users/${userToBan.handle}/ban`, {
          reason: 'Test ban',
        });

        const response = await client.get('/api/admin/users', { filter: 'banned' });

        assertSuccess(response);
        expect(response.body.data.users).toBeDefined();
        // All returned users should be banned
        response.body.data.users.forEach((user: any) => {
          expect(user.isBanned).toBe(true);
        });
      });

      it('should filter by admin status', async () => {
        client.setToken(adminUser.token);

        const response = await client.get('/api/admin/users', { filter: 'admin' });

        assertSuccess(response);
        expect(response.body.data.users).toBeDefined();
        // All returned users should be admins
        response.body.data.users.forEach((user: any) => {
          expect(user.isAdmin).toBe(true);
        });
      });

      it('should search users by query', async () => {
        client.setToken(adminUser.token);

        // Use a test user from the pool - testuser0 has a unique handle
        const response = await client.get('/api/admin/users', { q: 'testuser0' });

        assertSuccess(response);
        expect(response.body.data.users).toBeDefined();
        expect(response.body.data.users.length).toBeGreaterThan(0);
        const found = response.body.data.users.find((u: any) => u.handle === 'testuser0');
        expect(found).toBeDefined();
      });
    });

    describe('PUT /api/admin/users/:handle', () => {
      it('should update user profile fields', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(2);

        const response = await client.put(`/api/admin/users/${targetUser.handle}`, {
          displayName: 'Updated Name',
          bio: 'Updated bio',
          location: 'New Location',
          website: 'https://example.com',
          isVerified: true,
        });

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');
      });

      it('should reject update with no valid fields', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        const response = await client.put(`/api/admin/users/${targetUser.handle}`, {
          invalidField: 'should not work',
        });

        assertBadRequest(response);
        expect(response.body.error).toContain('No valid fields to update');
      });
    });

    describe('DELETE /api/admin/users/:handle', () => {
      it('should delete non-admin user', async () => {
        client.setToken(adminUser.token);

        // Use a dedicated user for deletion tests (testuser7 - the last in our pool)
        const targetUser = getTestUser(7);

        const response = await client.delete(`/api/admin/users/${targetUser.handle}`);

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');

        // Verify user is deleted
        const checkResponse = await client.get(`/api/admin/users/${targetUser.handle}`);
        assertNotFound(checkResponse);
      });

      it('should reject deletion of admin user', async () => {
        client.setToken(adminUser.token);

        // Try to delete the admin user themselves
        const response = await client.delete(`/api/admin/users/${adminUser.handle}`);

        assertForbidden(response);
        expect(response.body.error).toContain('Cannot delete admin accounts');
      });

      it('should return 404 for non-existent user', async () => {
        client.setToken(adminUser.token);

        const response = await client.delete('/api/admin/users/nonexistentuser');

        assertNotFound(response);
      });
    });

    describe('POST /api/admin/posts/:id/restore', () => {
      it('should restore taken-down post', async () => {
        client.setToken(adminUser.token);

        // Create a post and take it down
        const postUser = getTestUser(4);
        client.setToken(postUser.token);
        const post = await createPost(client);

        client.setToken(adminUser.token);
        await client.post(`/api/moderation/posts/${post.id}/takedown`, {
          reason: 'Test takedown',
        });

        // Now restore it
        const response = await client.post(`/api/admin/posts/${post.id}/restore`);

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');
      });

      it('should reject restore of non-taken-down post', async () => {
        client.setToken(adminUser.token);

        // Create a normal post
        const postUser = getTestUser(4);
        client.setToken(postUser.token);
        const post = await createPost(client);

        client.setToken(adminUser.token);
        const response = await client.post(`/api/admin/posts/${post.id}/restore`);

        assertBadRequest(response);
        expect(response.body.error).toContain('not taken down');
      });
    });
  });
});

describe('Moderation Endpoints', () => {
  let client: ApiClient;
  let regularUser: UserWithToken;
  let adminUser: UserWithToken;

  beforeAll(async () => {
    await ensureSetup();
    client = sharedClient;
    adminUser = sharedAdminUser;
    regularUser = sharedRegularUser;
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('Authorization Checks', () => {
    describe('POST /api/moderation/users/:handle/ban', () => {
      it('should reject request without token', async () => {
        const response = await client.post(`/api/moderation/users/${regularUser.handle}/ban`, {
          reason: 'Test ban',
        });
        // CSRF protection returns 403 before auth check, so accept both 401 and 403
        expect([401, 403]).toContain(response.status);
        expect(response.body.success).toBe(false);
      });

      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const targetUser = getTestUser(3);
        client.setToken(regularUser.token);

        const response = await client.post(`/api/moderation/users/${targetUser.handle}/ban`, {
          reason: 'Unauthorized ban attempt',
        });
        assertForbidden(response);
      });
    });

    describe('POST /api/moderation/users/:handle/unban', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.post(`/api/moderation/users/${regularUser.handle}/unban`);
        assertForbidden(response);
      });
    });

    describe('POST /api/moderation/posts/:id/takedown', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const post = await createPost(client);

        const response = await client.post(`/api/moderation/posts/${post.id}/takedown`, {
          reason: 'Unauthorized takedown',
        });
        assertForbidden(response);
      });
    });

    describe('GET /api/moderation/users/:handle/status', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.get(`/api/moderation/users/${regularUser.handle}/status`);
        assertForbidden(response);
      });
    });

    describe('POST /api/moderation/users/:handle/set-admin', () => {
      it('should reject request from non-admin user', async () => {
        client.setToken(regularUser.token);
        const response = await client.post(`/api/moderation/users/${regularUser.handle}/set-admin`, {
          isAdmin: true,
        });
        assertForbidden(response);
      });
    });
  });

  describe('Moderation Functionality (requires admin user)', () => {
    describe('POST /api/moderation/users/:handle/ban', () => {
      it('should ban user with reason', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        const response = await client.post(`/api/moderation/users/${targetUser.handle}/ban`, {
          reason: 'Violation of terms',
        });

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');

        // Verify user is banned
        const statusResponse = await client.get(`/api/moderation/users/${targetUser.handle}/status`);
        assertSuccess(statusResponse);
        expect(statusResponse.body.data.isBanned).toBe(true);
        expect(statusResponse.body.data.bannedReason).toBe('Violation of terms');
      });

      it('should reject ban without reason', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        const response = await client.post(`/api/moderation/users/${targetUser.handle}/ban`, {
          reason: '',
        });

        assertBadRequest(response);
        expect(response.body.error).toContain('reason is required');
      });

      it('should reject banning another admin', async () => {
        client.setToken(adminUser.token);

        // Create another admin user
        const otherAdmin = getTestUser(5);
        await client.post(`/api/moderation/users/${otherAdmin.handle}/set-admin`, {
          isAdmin: true,
        });

        const response = await client.post(`/api/moderation/users/${otherAdmin.handle}/ban`, {
          reason: 'Test',
        });

        assertForbidden(response);
        expect(response.body.error).toContain('Cannot ban another admin');
      });

      it('should return 404 for non-existent user', async () => {
        client.setToken(adminUser.token);

        const response = await client.post('/api/moderation/users/nonexistentuser/ban', {
          reason: 'Test',
        });

        assertNotFound(response);
      });
    });

    describe('POST /api/moderation/users/:handle/unban', () => {
      it('should unban banned user', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        // First ban the user
        await client.post(`/api/moderation/users/${targetUser.handle}/ban`, {
          reason: 'Test ban',
        });

        // Then unban them
        const response = await client.post(`/api/moderation/users/${targetUser.handle}/unban`);

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');

        // Verify user is unbanned
        const statusResponse = await client.get(`/api/moderation/users/${targetUser.handle}/status`);
        assertSuccess(statusResponse);
        expect(statusResponse.body.data.isBanned).toBe(false);
      });
    });

    describe('POST /api/moderation/posts/:id/takedown', () => {
      it('should take down post', async () => {
        client.setToken(adminUser.token);

        // Create a post
        const postUser = getTestUser(4);
        client.setToken(postUser.token);
        const post = await createPost(client);

        client.setToken(adminUser.token);
        const response = await client.post(`/api/moderation/posts/${post.id}/takedown`, {
          reason: 'Violates community guidelines',
        });

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');

        // Verify post is taken down
        const postResponse = await client.get(`/api/admin/posts/${post.id}`);
        assertSuccess(postResponse);
        expect(postResponse.body.data.isTakenDown).toBe(true);
        expect(postResponse.body.data.takenDownReason).toBeDefined();
      });

      it('should work without reason (optional)', async () => {
        client.setToken(adminUser.token);

        // Create a post
        const postUser = getTestUser(4);
        client.setToken(postUser.token);
        const post = await createPost(client);

        client.setToken(adminUser.token);
        const response = await client.post(`/api/moderation/posts/${post.id}/takedown`, {});

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');
      });

      it('should return 404 for non-existent post', async () => {
        client.setToken(adminUser.token);

        const response = await client.post('/api/moderation/posts/nonexistentid/takedown', {
          reason: 'Test',
        });

        assertNotFound(response);
      });
    });

    describe('GET /api/moderation/users/:handle/status', () => {
      it('should return user moderation status', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        const response = await client.get(`/api/moderation/users/${targetUser.handle}/status`);

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('handle');
        expect(response.body.data).toHaveProperty('isBanned');
        expect(response.body.data).toHaveProperty('isAdmin');
        expect(response.body.data.handle).toBe(targetUser.handle);
        expect(typeof response.body.data.isBanned).toBe('boolean');
        expect(typeof response.body.data.isAdmin).toBe('boolean');
      });
    });

    describe('POST /api/moderation/users/:handle/set-admin', () => {
      it('should grant admin privileges', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        const response = await client.post(`/api/moderation/users/${targetUser.handle}/set-admin`, {
          isAdmin: true,
        });

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');

        // Verify user is now admin
        const statusResponse = await client.get(`/api/moderation/users/${targetUser.handle}/status`);
        assertSuccess(statusResponse);
        expect(statusResponse.body.data.isAdmin).toBe(true);
      });

      it('should revoke admin privileges', async () => {
        client.setToken(adminUser.token);

        // Create a user and make them admin first
        const targetUser = getTestUser(3);
        await client.post(`/api/moderation/users/${targetUser.handle}/set-admin`, {
          isAdmin: true,
        });

        // Now revoke admin
        const response = await client.post(`/api/moderation/users/${targetUser.handle}/set-admin`, {
          isAdmin: false,
        });

        assertSuccess(response);
        expect(response.body.data).toHaveProperty('message');

        // Verify user is no longer admin
        const statusResponse = await client.get(`/api/moderation/users/${targetUser.handle}/status`);
        assertSuccess(statusResponse);
        expect(statusResponse.body.data.isAdmin).toBe(false);
      });

      it('should reject removing own admin status', async () => {
        client.setToken(adminUser.token);

        const response = await client.post(`/api/moderation/users/${adminUser.handle}/set-admin`, {
          isAdmin: false,
        });

        assertBadRequest(response);
        expect(response.body.error).toContain('Cannot remove your own admin status');
      });

      it('should reject invalid isAdmin value', async () => {
        client.setToken(adminUser.token);

        const targetUser = getTestUser(3);

        const response = await client.post(`/api/moderation/users/${targetUser.handle}/set-admin`, {
          isAdmin: 'invalid',
        });

        assertBadRequest(response);
        expect(response.body.error).toContain('must be a boolean');
      });
    });
  });
});
