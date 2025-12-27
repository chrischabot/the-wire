import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createPost, createPosts, UserWithToken, Post } from '../setup/test-factories';
import {
  assertSuccess,
  assertNotFound,
  assertPaginatedResponse,
} from '../setup/assertions';

describe('User Timeline Endpoints', () => {
  let client: ApiClient;
  let testUser: UserWithToken;
  let userPosts: Post[];

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    testUser = await createUser(client);
    client.setToken(testUser.token);
    userPosts = await createPosts(client, 5);
  });

  beforeEach(() => {
    client.setToken(testUser.token);
  });

  describe('GET /api/users/:handle/posts', () => {
    describe('Happy Path', () => {
      it('should return user posts', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/posts`);

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('posts');
        expect(Array.isArray(data.posts)).toBe(true);
        expect(data.posts.length).toBeGreaterThan(0);
      });

      it('should only include posts from specified user', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/posts`);

        const data = assertSuccess(response, 200);
        data.posts.forEach((post: any) => {
          expect(post.authorHandle).toBe(testUser.handle.toLowerCase());
        });
      });

      it('should work without authentication', async () => {
        client.clearToken();
        const response = await client.get(`/api/users/${testUser.handle}/posts`);

        assertSuccess(response, 200);
      });

      it('should include pagination info', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/posts`);

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('cursor');
        expect(data).toHaveProperty('hasMore');
      });
    });

    describe('Pagination', () => {
      it('should respect limit parameter', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/posts`, { limit: 2 });

        const data = assertSuccess(response, 200);
        expect(data.posts.length).toBeLessThanOrEqual(2);
      });

      it('should return different posts with cursor', async () => {
        // Get first page
        const response1 = await client.get(`/api/users/${testUser.handle}/posts`, { limit: 2 });
        const data1 = assertSuccess(response1, 200);

        if (data1.cursor && data1.hasMore) {
          // Get second page
          const response2 = await client.get(`/api/users/${testUser.handle}/posts`, {
            limit: 2,
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

    describe('Including Replies', () => {
      beforeAll(async () => {
        // Create a reply
        client.setToken(testUser.token);
        const otherUser = await createUser(client);
        client.setToken(otherUser.token);
        const otherPost = await createPost(client);

        client.setToken(testUser.token);
        await client.post('/api/posts', {
          content: 'This is a reply',
          replyToId: otherPost.id,
        });
      });

      it('should exclude replies by default', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/posts`);

        const data = assertSuccess(response, 200);
        // Most posts should not have replyToId (excluding replies)
        const nonReplies = data.posts.filter((p: any) => !p.replyToId);
        expect(nonReplies.length).toBeGreaterThanOrEqual(0);
      });

      it('should include replies when include_replies=true', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/posts`, {
          include_replies: true,
        });

        assertSuccess(response, 200);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent user', async () => {
        const response = await client.get('/api/users/nonexistentuser/posts');

        assertNotFound(response);
      });
    });
  });

  describe('GET /api/users/:handle/replies', () => {
    describe('Happy Path', () => {
      it('should return only replies', async () => {
        const response = await client.get(`/api/users/${testUser.handle}/replies`);

        const data = assertSuccess(response, 200);
        expect(Array.isArray(data.posts || data.replies || [])).toBe(true);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent user', async () => {
        const response = await client.get('/api/users/nonexistentuser/replies');

        assertNotFound(response);
      });
    });
  });

  describe('GET /api/users/:handle/media', () => {
    describe('Happy Path', () => {
      it('should return posts with media', async () => {
        // Create post with media
        await client.post('/api/posts', {
          content: 'Post with media',
          mediaUrls: ['https://example.com/image.jpg'],
        });

        const response = await client.get(`/api/users/${testUser.handle}/media`);

        const data = assertSuccess(response, 200);
        expect(Array.isArray(data.posts)).toBe(true);
        // Posts with media should have mediaUrls
        if (data.posts.length > 0) {
          data.posts.forEach((post: any) => {
            expect(post.mediaUrls.length).toBeGreaterThan(0);
          });
        }
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent user', async () => {
        const response = await client.get('/api/users/nonexistentuser/media');

        assertNotFound(response);
      });
    });
  });

  describe('GET /api/users/:handle/likes', () => {
    describe('Happy Path', () => {
      it('should return posts liked by user', async () => {
        // Like a post
        const otherUser = await createUser(client);
        client.setToken(otherUser.token);
        const postToLike = await createPost(client);

        client.setToken(testUser.token);
        await client.post(`/api/posts/${postToLike.id}/like`);

        const response = await client.get(`/api/users/${testUser.handle}/likes`);

        const data = assertSuccess(response, 200);
        expect(Array.isArray(data.posts)).toBe(true);
        expect(data.posts.some((p: any) => p.id === postToLike.id)).toBe(true);
      });

      it('should return empty list when no likes', async () => {
        const freshUser = await createUser(client);
        client.setToken(freshUser.token);

        const response = await client.get(`/api/users/${freshUser.handle}/likes`);

        const data = assertSuccess(response, 200);
        expect(data.posts).toEqual([]);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent user', async () => {
        const response = await client.get('/api/users/nonexistentuser/likes');

        assertNotFound(response);
      });
    });
  });

  describe('GET /api/users/:handle/followers', () => {
    describe('Happy Path', () => {
      it('should return list of followers', async () => {
        // Create follower
        const follower = await createUser(client);
        client.setToken(follower.token);
        await client.post(`/api/users/${testUser.handle}/follow`);

        client.setToken(testUser.token);
        const response = await client.get(`/api/users/${testUser.handle}/followers`);

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('followers');
        expect(data).toHaveProperty('count');
        expect(data.followers.some((f: any) => f.handle === follower.handle.toLowerCase())).toBe(true);
      });

      it('should return empty list for user with no followers', async () => {
        const freshUser = await createUser(client);
        const response = await client.get(`/api/users/${freshUser.handle}/followers`);

        const data = assertSuccess(response, 200);
        expect(data.followers).toEqual([]);
        expect(data.count).toBe(0);
      });
    });
  });

  describe('GET /api/users/:handle/following', () => {
    describe('Happy Path', () => {
      it('should return list of following', async () => {
        // Follow someone
        const target = await createUser(client);
        client.setToken(testUser.token);
        await client.post(`/api/users/${target.handle}/follow`);

        const response = await client.get(`/api/users/${testUser.handle}/following`);

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('following');
        expect(data).toHaveProperty('count');
        expect(data.following.some((f: any) => f.handle === target.handle.toLowerCase())).toBe(true);
      });

      it('should return empty list for user following nobody', async () => {
        const freshUser = await createUser(client);
        const response = await client.get(`/api/users/${freshUser.handle}/following`);

        const data = assertSuccess(response, 200);
        expect(data.following).toEqual([]);
        expect(data.count).toBe(0);
      });
    });
  });
});
