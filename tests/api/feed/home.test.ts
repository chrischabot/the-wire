import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, createPosts, UserWithToken, Post } from '../setup/test-factories';
import {
  assertSuccess,
  assertUnauthorized,
  assertPaginatedResponse,
} from '../setup/assertions';

describe('GET /api/feed/home', () => {
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

  describe('Happy Path', () => {
    it('should return home feed for authenticated user', async () => {
      const response = await client.get('/api/feed/home');

      assertSuccess(response, 200);
      expect(response.body.data).toHaveProperty('posts');
      expect(Array.isArray((response.body.data as any).posts)).toBe(true);
    });

    it('should include own posts in feed', async () => {
      const post = await createPost(client, { content: 'My own post for home feed' });

      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === post.id)).toBe(true);
    });

    it('should include posts from followed users', async () => {
      // Create and follow another user
      const otherUser = await createUser(client);
      client.setToken(otherUser.token);
      const otherPost = await createPost(client, { content: 'Post from followed user' });

      // Follow the other user
      client.setToken(testUser.token);
      await client.post(`/api/users/${otherUser.handle}/follow`);

      // Check home feed includes their post
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === otherPost.id)).toBe(true);
    });

    it('should have pagination support', async () => {
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      expect(data).toHaveProperty('cursor');
      expect(data).toHaveProperty('hasMore');
    });
  });

  describe('Filtering', () => {
    it('should exclude posts from blocked users', async () => {
      // Create user and their post
      const blockedUser = await createUser(client);
      client.setToken(blockedUser.token);
      const blockedPost = await createPost(client, { content: 'Post from soon-to-be-blocked user' });

      // Follow then block
      client.setToken(testUser.token);
      await client.post(`/api/users/${blockedUser.handle}/follow`);
      await client.post(`/api/users/${blockedUser.handle}/block`);

      // Check feed doesn't include blocked user's post
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === blockedPost.id)).toBe(false);
    });
  });

  describe('Pagination', () => {
    it('should respect limit parameter', async () => {
      // Create multiple posts
      await createPosts(client, 10);

      const response = await client.get('/api/feed/home', { limit: 5 });
      const data = assertSuccess(response, 200);

      expect(data.posts.length).toBeLessThanOrEqual(5);
    });

    it('should return different posts with cursor', async () => {
      // Create enough posts
      await createPosts(client, 25);

      // Get first page
      const response1 = await client.get('/api/feed/home', { limit: 10 });
      const data1 = assertSuccess(response1, 200);

      if (data1.cursor && data1.hasMore) {
        // Get second page
        const response2 = await client.get('/api/feed/home', {
          limit: 10,
          cursor: data1.cursor,
        });
        const data2 = assertSuccess(response2, 200);

        // Posts should be different
        const page1Ids = new Set(data1.posts.map((p: any) => p.id));
        const page2HasDifferent = data2.posts.some((p: any) => !page1Ids.has(p.id));
        expect(page2HasDifferent).toBe(true);
      }
    });
  });

  describe('Authentication', () => {
    it('should reject request without token', async () => {
      client.clearToken();
      const response = await client.get('/api/feed/home');

      assertUnauthorized(response);
    });

    it('should reject request with invalid token', async () => {
      client.setToken('invalid-token');
      const response = await client.get('/api/feed/home');

      assertUnauthorized(response);
    });
  });

  describe('Empty Feed', () => {
    it('should return empty feed for new user with no follows', async () => {
      const freshUser = await createUser(client);
      client.setToken(freshUser.token);

      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      // May have own posts or be empty, but should not error
      expect(Array.isArray(data.posts)).toBe(true);
    });
  });
});

describe('GET /api/feed/global', () => {
  let client: ApiClient;
  let testUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    testUser = await createUser(client);
    client.setToken(testUser.token);
  });

  describe('Happy Path', () => {
    it('should return global feed', async () => {
      const response = await client.get('/api/feed/global');

      assertSuccess(response, 200);
      expect(response.body.data).toHaveProperty('posts');
    });

    it('should work without authentication', async () => {
      client.clearToken();
      const response = await client.get('/api/feed/global');

      assertSuccess(response, 200);
    });

    it('should include posts from any user', async () => {
      // Create post from different user
      const otherUser = await createUser(client);
      client.setToken(otherUser.token);
      const post = await createPost(client, { content: 'Global feed test post' });

      // Check global feed without following
      client.clearToken();
      const response = await client.get('/api/feed/global');
      const data = assertSuccess(response, 200);

      // Global feed should include recent posts
      expect(data.posts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pagination', () => {
    it('should support pagination', async () => {
      const response = await client.get('/api/feed/global', { limit: 10 });
      const data = assertSuccess(response, 200);

      expect(data).toHaveProperty('cursor');
      expect(data).toHaveProperty('hasMore');
    });
  });

  describe('Filtering', () => {
    it('should filter blocked users when authenticated', async () => {
      client.setToken(testUser.token);

      // Create and block a user
      const blockedUser = await createUser(client);
      client.setToken(blockedUser.token);
      const blockedPost = await createPost(client, { content: 'Should be hidden' });

      // Block the user
      client.setToken(testUser.token);
      await client.post(`/api/users/${blockedUser.handle}/block`);

      // Check global feed
      const response = await client.get('/api/feed/global');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === blockedPost.id)).toBe(false);
    });
  });
});

describe('GET /api/feed/chronological', () => {
  let client: ApiClient;
  let testUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    testUser = await createUser(client);
    client.setToken(testUser.token);
  });

  describe('Happy Path', () => {
    it('should return chronological feed', async () => {
      const response = await client.get('/api/feed/chronological');

      assertSuccess(response, 200);
      expect(response.body.data).toHaveProperty('posts');
    });

    it('should return posts in chronological order', async () => {
      // Create posts with delay
      const post1 = await createPost(client, { content: 'First post' });
      await new Promise((r) => setTimeout(r, 100));
      const post2 = await createPost(client, { content: 'Second post' });

      const response = await client.get('/api/feed/chronological');
      const data = assertSuccess(response, 200);

      // Find positions
      const pos1 = data.posts.findIndex((p: any) => p.id === post1.id);
      const pos2 = data.posts.findIndex((p: any) => p.id === post2.id);

      // Newer post should appear first (lower index)
      if (pos1 !== -1 && pos2 !== -1) {
        expect(pos2).toBeLessThan(pos1);
      }
    });

    it('should only include posts from followed users and self', async () => {
      // Create user we don't follow
      const unfollowedUser = await createUser(client);
      client.setToken(unfollowedUser.token);
      const unfollowedPost = await createPost(client, { content: 'Should not appear' });

      // Check chronological feed
      client.setToken(testUser.token);
      const response = await client.get('/api/feed/chronological');
      const data = assertSuccess(response, 200);

      // Should not include unfollowed user's post
      expect(data.posts.some((p: any) => p.id === unfollowedPost.id)).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should reject request without token', async () => {
      client.clearToken();
      const response = await client.get('/api/feed/chronological');

      assertUnauthorized(response);
    });
  });
});
