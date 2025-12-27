import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
  assertNotFound,
} from '../setup/assertions';

describe('Block/Unblock Endpoints', () => {
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

  describe('POST /api/users/:handle/block', () => {
    describe('Happy Path', () => {
      it('should block a user', async () => {
        client.setToken(userA.token);
        const response = await client.post(`/api/users/${userB.handle}/block`);

        assertSuccess(response, 200);
      });

      it('should be idempotent - blocking twice returns success', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        const response1 = await client.post(`/api/users/${newUser.handle}/block`);
        assertSuccess(response1, 200);

        const response2 = await client.post(`/api/users/${newUser.handle}/block`);
        assertSuccess(response2, 200);
      });

      it('should add user to blocked list', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);
        await client.post(`/api/users/${newUser.handle}/block`);

        const blockedResponse = await client.get('/api/users/me/blocked');
        const blockedData = assertSuccess(blockedResponse, 200);

        expect(blockedData.blocked.some((u: any) => u.handle === newUser.handle.toLowerCase())).toBe(true);
      });
    });

    describe('Block Removes Follow Relationships', () => {
      it('should remove follow when blocker was following blocked', async () => {
        const [follower, target] = await createUsers(client, 2);

        // follower follows target
        client.setToken(follower.token);
        await client.post(`/api/users/${target.handle}/follow`);

        // Verify following
        let followingResponse = await client.get(`/api/users/${follower.handle}/following`);
        expect((followingResponse.body.data as any).following.some((u: any) => u.handle === target.handle.toLowerCase())).toBe(true);

        // follower blocks target
        await client.post(`/api/users/${target.handle}/block`);

        // Verify no longer following
        followingResponse = await client.get(`/api/users/${follower.handle}/following`);
        expect((followingResponse.body.data as any).following.some((u: any) => u.handle === target.handle.toLowerCase())).toBe(false);
      });

      it('should remove follow when blocked was following blocker', async () => {
        const [blocker, blocked] = await createUsers(client, 2);

        // blocked follows blocker
        client.setToken(blocked.token);
        await client.post(`/api/users/${blocker.handle}/follow`);

        // Verify following
        let followersResponse = await client.get(`/api/users/${blocker.handle}/followers`);
        expect((followersResponse.body.data as any).followers.some((u: any) => u.handle === blocked.handle.toLowerCase())).toBe(true);

        // blocker blocks blocked
        client.setToken(blocker.token);
        await client.post(`/api/users/${blocked.handle}/block`);

        // Verify blocked is no longer a follower
        followersResponse = await client.get(`/api/users/${blocker.handle}/followers`);
        expect((followersResponse.body.data as any).followers.some((u: any) => u.handle === blocked.handle.toLowerCase())).toBe(false);
      });

      it('should remove mutual follow relationship on block', async () => {
        const [user1, user2] = await createUsers(client, 2);

        // Create mutual follow
        client.setToken(user1.token);
        await client.post(`/api/users/${user2.handle}/follow`);
        client.setToken(user2.token);
        await client.post(`/api/users/${user1.handle}/follow`);

        // user1 blocks user2
        client.setToken(user1.token);
        await client.post(`/api/users/${user2.handle}/block`);

        // Verify no follow relationship exists in either direction
        const following1 = await client.get(`/api/users/${user1.handle}/following`);
        const followers1 = await client.get(`/api/users/${user1.handle}/followers`);

        expect((following1.body.data as any).following.some((u: any) => u.handle === user2.handle.toLowerCase())).toBe(false);
        expect((followers1.body.data as any).followers.some((u: any) => u.handle === user2.handle.toLowerCase())).toBe(false);
      });
    });

    describe('Validation', () => {
      it('should reject self-block', async () => {
        client.setToken(userA.token);
        const response = await client.post(`/api/users/${userA.handle}/block`);

        assertBadRequest(response, 'cannot block yourself');
      });

      it('should return 404 for non-existent user', async () => {
        client.setToken(userA.token);
        const response = await client.post('/api/users/nonexistentuser/block');

        assertNotFound(response);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const response = await client.post(`/api/users/${userB.handle}/block`);

        assertUnauthorized(response);
      });
    });
  });

  describe('DELETE /api/users/:handle/block', () => {
    describe('Happy Path', () => {
      it('should unblock a user', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        // Block first
        await client.post(`/api/users/${newUser.handle}/block`);

        // Unblock
        const response = await client.delete(`/api/users/${newUser.handle}/block`);
        assertSuccess(response, 200);
      });

      it('should remove user from blocked list', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        // Block
        await client.post(`/api/users/${newUser.handle}/block`);

        // Verify blocked
        let blockedResponse = await client.get('/api/users/me/blocked');
        expect((blockedResponse.body.data as any).blocked.some((u: any) => u.handle === newUser.handle.toLowerCase())).toBe(true);

        // Unblock
        await client.delete(`/api/users/${newUser.handle}/block`);

        // Verify unblocked
        blockedResponse = await client.get('/api/users/me/blocked');
        expect((blockedResponse.body.data as any).blocked.some((u: any) => u.handle === newUser.handle.toLowerCase())).toBe(false);
      });

      it('should be idempotent - unblocking when not blocked returns success', async () => {
        const newUser = await createUser(client);
        client.setToken(userA.token);

        const response = await client.delete(`/api/users/${newUser.handle}/block`);
        assertSuccess(response, 200);
      });
    });

    describe('Unblock Restores Ability to Follow', () => {
      it('should allow follow after unblock', async () => {
        const [blocker, blocked] = await createUsers(client, 2);

        // Block
        client.setToken(blocker.token);
        await client.post(`/api/users/${blocked.handle}/block`);

        // Verify blocked cannot follow
        client.setToken(blocked.token);
        const blockedFollowResponse = await client.post(`/api/users/${blocker.handle}/follow`);
        expect(blockedFollowResponse.status).toBe(403);

        // Unblock
        client.setToken(blocker.token);
        await client.delete(`/api/users/${blocked.handle}/block`);

        // Verify blocked can now follow
        client.setToken(blocked.token);
        const unblockedFollowResponse = await client.post(`/api/users/${blocker.handle}/follow`);
        assertSuccess(unblockedFollowResponse, 200);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const response = await client.delete(`/api/users/${userB.handle}/block`);

        assertUnauthorized(response);
      });
    });
  });

  describe('GET /api/users/me/blocked', () => {
    describe('Happy Path', () => {
      it('should return list of blocked users', async () => {
        client.setToken(userA.token);
        const response = await client.get('/api/users/me/blocked');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('blocked');
        expect(Array.isArray(data.blocked)).toBe(true);
        expect(data).toHaveProperty('count');
      });

      it('should return empty list when no users blocked', async () => {
        const freshUser = await createUser(client);
        client.setToken(freshUser.token);

        const response = await client.get('/api/users/me/blocked');

        const data = assertSuccess(response, 200);
        expect(data.blocked).toEqual([]);
        expect(data.count).toBe(0);
      });

      it('should return accurate count', async () => {
        const freshUser = await createUser(client);
        const [target1, target2] = await createUsers(client, 2);

        client.setToken(freshUser.token);
        await client.post(`/api/users/${target1.handle}/block`);
        await client.post(`/api/users/${target2.handle}/block`);

        const response = await client.get('/api/users/me/blocked');

        const data = assertSuccess(response, 200);
        expect(data.count).toBe(2);
        expect(data.blocked.length).toBe(2);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.get('/api/users/me/blocked');

        assertUnauthorized(response);
      });
    });
  });
});
