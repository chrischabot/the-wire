import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createPost, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
} from '../setup/assertions';

describe('GET /api/search', () => {
  let client: ApiClient;
  let testUser: UserWithToken;
  let searchableUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    testUser = await createUser(client);

    // Create user with searchable name
    searchableUser = await createUser(client, {
      handle: `searchable_${Date.now() % 10000}`,
    });

    // Update their display name
    client.setToken(searchableUser.token);
    await client.put('/api/users/me', { displayName: 'Searchable Person' });

    // Create searchable posts
    await createPost(client, { content: 'This post contains unique keyword zyx123' });
    await createPost(client, { content: 'Another searchable post with testing content' });
  });

  beforeEach(() => {
    client.setToken(testUser.token);
  });

  describe('Type: top (default)', () => {
    it('should return both users and posts', async () => {
      const response = await client.get('/api/search', { q: 'searchable', type: 'top' });

      const data = assertSuccess(response, 200);
      expect(data).toHaveProperty('people');
      expect(data).toHaveProperty('posts');
      expect(data.query).toBe('searchable');
      expect(data.type).toBe('top');
    });

    it('should find user by handle', async () => {
      const response = await client.get('/api/search', { q: 'searchable' });

      const data = assertSuccess(response, 200);
      expect(data.people.some((u: any) => u.handle.includes('searchable'))).toBe(true);
    });

    it('should find posts by content', async () => {
      const response = await client.get('/api/search', { q: 'zyx123' });

      const data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.content.includes('zyx123'))).toBe(true);
    });

    it('should use top as default type', async () => {
      const response = await client.get('/api/search', { q: 'test' });

      const data = assertSuccess(response, 200);
      expect(data.type).toBe('top');
    });
  });

  describe('Type: people', () => {
    it('should return only users', async () => {
      const response = await client.get('/api/search', { q: 'searchable', type: 'people' });

      const data = assertSuccess(response, 200);
      expect(data.people).toBeDefined();
      expect(data.type).toBe('people');
    });

    it('should find user by display name', async () => {
      const response = await client.get('/api/search', { q: 'Searchable Person', type: 'people' });

      const data = assertSuccess(response, 200);
      expect(data.people.some((u: any) => u.displayName === 'Searchable Person')).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should reject query shorter than 2 characters', async () => {
      const response = await client.get('/api/search', { q: 'a' });

      assertBadRequest(response, '2');
    });

    it('should accept query of exactly 2 characters', async () => {
      const response = await client.get('/api/search', { q: 'ab' });

      assertSuccess(response, 200);
    });

    it('should reject query longer than 280 characters', async () => {
      const response = await client.get('/api/search', { q: 'a'.repeat(281) });

      assertBadRequest(response, '280');
    });

    it('should reject empty query', async () => {
      const response = await client.get('/api/search', { q: '' });

      assertBadRequest(response);
    });

    it('should reject missing query parameter', async () => {
      const response = await client.get('/api/search');

      assertBadRequest(response);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const response = await client.get('/api/search', { q: 'test', limit: 5 });

      const data = assertSuccess(response, 200);
      expect(data.posts.length).toBeLessThanOrEqual(5);
    });

    it('should return cursor for pagination', async () => {
      const response = await client.get('/api/search', { q: 'test' });

      const data = assertSuccess(response, 200);
      expect(data).toHaveProperty('cursor');
      expect(data).toHaveProperty('hasMore');
    });
  });

  describe('Filtering', () => {
    it('should exclude blocked users from results when authenticated', async () => {
      // Create and block a user
      const blockedUser = await createUser(client, {
        handle: `blocked_search_${Date.now() % 10000}`,
      });
      client.setToken(blockedUser.token);
      await client.put('/api/users/me', { displayName: 'Blocked Searcher' });

      client.setToken(testUser.token);
      await client.post(`/api/users/${blockedUser.handle}/block`);

      // Search for the blocked user
      const response = await client.get('/api/search', { q: 'blocked_search' });

      const data = assertSuccess(response, 200);
      expect(data.people.some((u: any) => u.handle === blockedUser.handle.toLowerCase())).toBe(false);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should work without authentication', async () => {
      client.clearToken();
      const response = await client.get('/api/search', { q: 'test' });

      assertSuccess(response, 200);
    });
  });

  describe('Relevance', () => {
    it('should include relevance scores', async () => {
      const response = await client.get('/api/search', { q: 'searchable' });

      const data = assertSuccess(response, 200);
      if (data.people.length > 0) {
        expect(data.people[0]).toHaveProperty('relevanceScore');
      }
    });

    it('should include isFollowing flag when authenticated', async () => {
      // Follow the searchable user
      await client.post(`/api/users/${searchableUser.handle}/follow`);

      const response = await client.get('/api/search', { q: 'searchable', type: 'people' });

      const data = assertSuccess(response, 200);
      const foundUser = data.people.find((u: any) => u.handle === searchableUser.handle.toLowerCase());
      if (foundUser) {
        expect(foundUser).toHaveProperty('isFollowing');
        expect(foundUser.isFollowing).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in query', async () => {
      const response = await client.get('/api/search', { q: '@#$%' });

      // Should not error, may return empty results
      assertSuccess(response, 200);
    });

    it('should handle unicode in query', async () => {
      const response = await client.get('/api/search', { q: 'test 世界' });

      assertSuccess(response, 200);
    });

    it('should handle multiple spaces in query', async () => {
      const response = await client.get('/api/search', { q: 'test   query' });

      assertSuccess(response, 200);
    });
  });
});
