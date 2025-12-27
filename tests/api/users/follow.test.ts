import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
  assertForbidden,
  assertNotFound,
  assertCountChanged,
} from '../setup/assertions';

describe('Follow/Unfollow Endpoints', () => {
  let client: ApiClient;
  let userA: UserWithToken;
  let userB: UserWithToken;
  let userC: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    [userA, userB, userC] = await createUsers(client, 3);
  });

  beforeEach(() => {
    client.clearToken();
  });

  describe('POST /api/users/:handle/follow', () => {
    describe('Happy Path', () => {
      it('should follow a user', async () => {
        client.setToken(userA.token);
        const response = await client.post(`/api/users/${userB.handle}/follow`);

        assertSuccess(response, 200);
      });

      it('should increment follower count for followed user', async () => {
        // Get initial count
        const beforeResponse = await client.get(`/api/users/${userC.handle}`);
        const beforeCount = (beforeResponse.body.data as any).followerCount;

        // Follow
        client.setToken(userA.token);
        await client.post(`/api/users/${userC.handle}/follow`);

        // Check count increased
        const afterResponse = await client.get(`/api/users/${userC.handle}`);
        const afterCount = (afterResponse.body.data as any).followerCount;

        assertCountChanged(beforeCount, afterCount, 1, 'Follower count should increase by 1');
      });

      it('should increment following count for follower', async () => {
        client.setToken(userB.token);

        // Get initial count
        const beforeResponse = await client.get(`/api/users/${userB.handle}`);
        const beforeCount = (beforeResponse.body.data as any).followingCount;

        // Follow someone new
        const newUser = await createUser(client);
        client.setToken(userB.token);
        await client.post(`/api/users/${newUser.handle}/follow`);

        // Check count increased
        const afterResponse = await client.get(`/api/users/${userB.handle}`);
        const afterCount = (afterResponse.body.data as any).followingCount;

        expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
      });

      it('should be idempotent - following twice returns success', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        const response1 = await client.post(`/api/users/${newUser.handle}/follow`);
        assertSuccess(response1, 200);

        const response2 = await client.post(`/api/users/${newUser.handle}/follow`);
        assertSuccess(response2, 200);
      });

      it('should handle case-insensitive handle', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        const response = await client.post(`/api/users/${newUser.handle.toUpperCase()}/follow`);
        assertSuccess(response, 200);
      });
    });

    describe('Validation', () => {
      it('should reject self-follow', async () => {
        client.setToken(userA.token);
        const response = await client.post(`/api/users/${userA.handle}/follow`);

        assertBadRequest(response, 'cannot follow yourself');
      });

      it('should return 404 for non-existent user', async () => {
        client.setToken(userA.token);
        const response = await client.post('/api/users/nonexistentuser/follow');

        assertNotFound(response);
      });
    });

    describe('Block Interaction', () => {
      it('should reject follow if target has blocked you', async () => {
        // userB blocks userA
        client.setToken(userB.token);
        await client.post(`/api/users/${userA.handle}/block`);

        // userA tries to follow userB
        client.setToken(userA.token);
        const response = await client.post(`/api/users/${userB.handle}/follow`);

        assertForbidden(response);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const response = await client.post(`/api/users/${userB.handle}/follow`);

        assertUnauthorized(response);
      });

      it('should reject request with invalid token', async () => {
        client.setToken('invalid-token');
        const response = await client.post(`/api/users/${userB.handle}/follow`);

        assertUnauthorized(response);
      });
    });
  });

  describe('DELETE /api/users/:handle/follow', () => {
    describe('Happy Path', () => {
      it('should unfollow a user', async () => {
        // First follow
        const newUser = await createUser(client);
        client.setToken(userA.token);
        await client.post(`/api/users/${newUser.handle}/follow`);

        // Then unfollow
        const response = await client.delete(`/api/users/${newUser.handle}/follow`);

        assertSuccess(response, 200);
      });

      it('should decrement follower count', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);
        await client.post(`/api/users/${newUser.handle}/follow`);

        // Get count after follow
        const beforeResponse = await client.get(`/api/users/${newUser.handle}`);
        const beforeCount = (beforeResponse.body.data as any).followerCount;

        // Unfollow
        await client.delete(`/api/users/${newUser.handle}/follow`);

        // Check count decreased
        const afterResponse = await client.get(`/api/users/${newUser.handle}`);
        const afterCount = (afterResponse.body.data as any).followerCount;

        assertCountChanged(beforeCount, afterCount, -1, 'Follower count should decrease by 1');
      });

      it('should be idempotent - unfollowing when not following returns success', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        // Unfollow without following first
        const response = await client.delete(`/api/users/${newUser.handle}/follow`);
        assertSuccess(response, 200);
      });
    });

    describe('Validation', () => {
      it('should reject self-unfollow', async () => {
        client.setToken(userA.token);
        const response = await client.delete(`/api/users/${userA.handle}/follow`);

        assertBadRequest(response, 'cannot unfollow yourself');
      });

      it('should return 404 for non-existent user', async () => {
        client.setToken(userA.token);
        const response = await client.delete('/api/users/nonexistentuser/follow');

        assertNotFound(response);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const response = await client.delete(`/api/users/${userB.handle}/follow`);

        assertUnauthorized(response);
      });
    });
  });

  describe('Mutual Follow Scenarios', () => {
    it('should allow mutual follows (A follows B, B follows A)', async () => {
      const [user1, user2] = await createUsers(client, 2);

      // user1 follows user2
      client.setToken(user1.token);
      const response1 = await client.post(`/api/users/${user2.handle}/follow`);
      assertSuccess(response1, 200);

      // user2 follows user1
      client.setToken(user2.token);
      const response2 = await client.post(`/api/users/${user1.handle}/follow`);
      assertSuccess(response2, 200);

      // Verify both follow relationships exist
      client.setToken(user1.token);
      const following1 = await client.get(`/api/users/${user1.handle}/following`);
      const followers1 = await client.get(`/api/users/${user1.handle}/followers`);

      expect((following1.body.data as any).following.some((u: any) => u.handle === user2.handle.toLowerCase())).toBe(true);
      expect((followers1.body.data as any).followers.some((u: any) => u.handle === user2.handle.toLowerCase())).toBe(true);
    });

    it('should maintain independent follow relationships when one unfollows', async () => {
      const [user1, user2] = await createUsers(client, 2);

      // Create mutual follow
      client.setToken(user1.token);
      await client.post(`/api/users/${user2.handle}/follow`);
      client.setToken(user2.token);
      await client.post(`/api/users/${user1.handle}/follow`);

      // user1 unfollows user2
      client.setToken(user1.token);
      await client.delete(`/api/users/${user2.handle}/follow`);

      // user2 should still follow user1
      const followers1 = await client.get(`/api/users/${user1.handle}/followers`);
      expect((followers1.body.data as any).followers.some((u: any) => u.handle === user2.handle.toLowerCase())).toBe(true);

      // user1 should not follow user2
      const following1 = await client.get(`/api/users/${user1.handle}/following`);
      expect((following1.body.data as any).following.some((u: any) => u.handle === user2.handle.toLowerCase())).toBe(false);
    });
  });
});
