import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, UserWithToken, Post } from '../setup/test-factories';
import {
  assertSuccess,
  assertUnauthorized,
  assertForbidden,
  assertConflict,
  assertNotFound,
} from '../setup/assertions';

describe('Post Interactions', () => {
  let client: ApiClient;
  let testUser: UserWithToken;
  let otherUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    [testUser, otherUser] = await createUsers(client, 2);
  });

  beforeEach(() => {
    client.setToken(testUser.token);
  });

  describe('POST /api/posts/:id/like', () => {
    let testPost: Post;

    beforeEach(async () => {
      client.setToken(otherUser.token);
      testPost = await createPost(client);
      client.setToken(testUser.token);
    });

    describe('Happy Path', () => {
      it('should like a post', async () => {
        const response = await client.post(`/api/posts/${testPost.id}/like`);

        const data = assertSuccess(response, 200);
        expect(data.likeCount).toBe(1);
      });

      it('should increment like count', async () => {
        await client.post(`/api/posts/${testPost.id}/like`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.likeCount).toBe(1);
      });

      it('should be idempotent - liking twice keeps count at 1', async () => {
        await client.post(`/api/posts/${testPost.id}/like`);
        await client.post(`/api/posts/${testPost.id}/like`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.likeCount).toBe(1);
      });

      it('should allow liking own post', async () => {
        // Create own post
        const ownPost = await createPost(client);

        const response = await client.post(`/api/posts/${ownPost.id}/like`);
        assertSuccess(response, 200);
      });

      it('should set hasLiked flag when fetching liked post', async () => {
        await client.post(`/api/posts/${testPost.id}/like`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.hasLiked).toBe(true);
      });

      it('should allow multiple users to like same post', async () => {
        // First user likes
        await client.post(`/api/posts/${testPost.id}/like`);

        // Second user likes
        const thirdUser = await createUser(client);
        client.setToken(thirdUser.token);
        await client.post(`/api/posts/${testPost.id}/like`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.likeCount).toBe(2);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.post(`/api/posts/${testPost.id}/like`);

        assertUnauthorized(response);
      });
    });
  });

  describe('DELETE /api/posts/:id/like', () => {
    let testPost: Post;

    beforeEach(async () => {
      client.setToken(otherUser.token);
      testPost = await createPost(client);
      client.setToken(testUser.token);
      // Like the post first
      await client.post(`/api/posts/${testPost.id}/like`);
    });

    describe('Happy Path', () => {
      it('should unlike a post', async () => {
        const response = await client.delete(`/api/posts/${testPost.id}/like`);

        const data = assertSuccess(response, 200);
        expect(data.likeCount).toBe(0);
      });

      it('should decrement like count', async () => {
        await client.delete(`/api/posts/${testPost.id}/like`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.likeCount).toBe(0);
      });

      it('should be idempotent - unliking when not liked returns success', async () => {
        await client.delete(`/api/posts/${testPost.id}/like`);
        const response = await client.delete(`/api/posts/${testPost.id}/like`);

        assertSuccess(response, 200);
      });

      it('should set hasLiked flag to false after unlike', async () => {
        await client.delete(`/api/posts/${testPost.id}/like`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.hasLiked).toBe(false);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.delete(`/api/posts/${testPost.id}/like`);

        assertUnauthorized(response);
      });
    });
  });

  describe('POST /api/posts/:id/repost', () => {
    let testPost: Post;

    beforeEach(async () => {
      client.setToken(otherUser.token);
      testPost = await createPost(client);
      client.setToken(testUser.token);
    });

    describe('Happy Path', () => {
      it('should repost a post', async () => {
        const response = await client.post(`/api/posts/${testPost.id}/repost`);

        const data = assertSuccess(response, 201);
        expect(data.repostOfId).toBe(testPost.id);
      });

      it('should create new post entry for repost', async () => {
        const response = await client.post(`/api/posts/${testPost.id}/repost`);

        const data = assertSuccess(response, 201);
        expect(data.id).toBeDefined();
        expect(data.id).not.toBe(testPost.id);
        expect(data.authorId).toBe(testUser.id);
      });

      it('should increment repost count on original post', async () => {
        await client.post(`/api/posts/${testPost.id}/repost`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.repostCount).toBe(1);
      });

      it('should set hasReposted flag when fetching reposted post', async () => {
        await client.post(`/api/posts/${testPost.id}/repost`);

        const postResponse = await client.get(`/api/posts/${testPost.id}`);
        const postData = assertSuccess(postResponse, 200);
        expect(postData.hasReposted).toBe(true);
      });

      it('should include original post info in repost', async () => {
        const response = await client.post(`/api/posts/${testPost.id}/repost`);

        const data = assertSuccess(response, 201);
        expect(data.originalPost).toBeDefined();
        expect(data.originalPost.id).toBe(testPost.id);
        expect(data.originalPost.authorHandle).toBe(otherUser.handle.toLowerCase());
      });
    });

    describe('Duplicate Prevention', () => {
      it('should reject reposting same post twice', async () => {
        await client.post(`/api/posts/${testPost.id}/repost`);

        const response = await client.post(`/api/posts/${testPost.id}/repost`);
        assertConflict(response, 'already reposted');
      });
    });

    describe('Block Restrictions', () => {
      it('should reject repost if original author blocked you', async () => {
        // otherUser blocks testUser
        client.setToken(otherUser.token);
        await client.post(`/api/users/${testUser.handle}/block`);

        // testUser tries to repost otherUser's post
        client.setToken(testUser.token);
        const response = await client.post(`/api/posts/${testPost.id}/repost`);

        assertForbidden(response);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent post', async () => {
        const response = await client.post('/api/posts/nonexistent123/repost');

        assertNotFound(response);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.post(`/api/posts/${testPost.id}/repost`);

        assertUnauthorized(response);
      });
    });
  });

  describe('GET /api/posts/:id', () => {
    let testPost: Post;

    beforeEach(async () => {
      client.setToken(testUser.token);
      testPost = await createPost(client);
    });

    describe('Happy Path', () => {
      it('should get a post by ID', async () => {
        const response = await client.get(`/api/posts/${testPost.id}`);

        const data = assertSuccess(response, 200);
        expect(data.id).toBe(testPost.id);
        expect(data.content).toBe(testPost.content);
      });

      it('should work without authentication', async () => {
        client.clearToken();
        const response = await client.get(`/api/posts/${testPost.id}`);

        assertSuccess(response, 200);
      });

      it('should include interaction flags when authenticated', async () => {
        const response = await client.get(`/api/posts/${testPost.id}`);

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('hasLiked');
        expect(data).toHaveProperty('hasReposted');
      });

      it('should set interaction flags to false when not authenticated', async () => {
        client.clearToken();
        const response = await client.get(`/api/posts/${testPost.id}`);

        const data = assertSuccess(response, 200);
        expect(data.hasLiked).toBe(false);
        expect(data.hasReposted).toBe(false);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent post', async () => {
        const response = await client.get('/api/posts/nonexistent123');

        assertNotFound(response);
      });
    });
  });

  describe('GET /api/posts/:id/thread', () => {
    let parentPost: Post;

    beforeEach(async () => {
      client.setToken(testUser.token);
      parentPost = await createPost(client);
    });

    describe('Happy Path', () => {
      it('should get thread with post and empty replies', async () => {
        const response = await client.get(`/api/posts/${parentPost.id}/thread`);

        const data = assertSuccess(response, 200);
        expect(data.post.id).toBe(parentPost.id);
        expect(data.replies).toEqual([]);
        expect(data.ancestors).toEqual([]);
      });

      it('should include replies in thread', async () => {
        // Create replies
        await client.post('/api/posts', {
          content: 'Reply 1',
          replyToId: parentPost.id,
        });
        await client.post('/api/posts', {
          content: 'Reply 2',
          replyToId: parentPost.id,
        });

        const response = await client.get(`/api/posts/${parentPost.id}/thread`);

        const data = assertSuccess(response, 200);
        expect(data.replies.length).toBe(2);
      });

      it('should include ancestors for reply', async () => {
        // Create reply
        const replyResponse = await client.post('/api/posts', {
          content: 'This is a reply',
          replyToId: parentPost.id,
        });
        const replyData = assertSuccess(replyResponse, 201);

        // Get thread of reply
        const response = await client.get(`/api/posts/${replyData.id}/thread`);

        const data = assertSuccess(response, 200);
        expect(data.ancestors.some((a: any) => a.id === parentPost.id)).toBe(true);
      });
    });

    describe('Pagination', () => {
      it('should limit replies', async () => {
        // Create multiple replies
        for (let i = 0; i < 5; i++) {
          await client.post('/api/posts', {
            content: `Reply ${i}`,
            replyToId: parentPost.id,
          });
        }

        const response = await client.get(`/api/posts/${parentPost.id}/thread`, { limit: 3 });

        const data = assertSuccess(response, 200);
        expect(data.replies.length).toBeLessThanOrEqual(3);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent post', async () => {
        const response = await client.get('/api/posts/nonexistent123/thread');

        assertNotFound(response);
      });
    });
  });

  describe('DELETE /api/posts/:id', () => {
    describe('Happy Path', () => {
      it('should delete own post', async () => {
        const post = await createPost(client);
        const response = await client.delete(`/api/posts/${post.id}`);

        assertSuccess(response, 200);
      });

      it('should decrement user post count', async () => {
        const post = await createPost(client);

        // Get initial count
        const beforeProfile = await client.get(`/api/users/${testUser.handle}`);
        const beforeCount = (beforeProfile.body.data as any).postCount;

        await client.delete(`/api/posts/${post.id}`);

        // Get new count
        const afterProfile = await client.get(`/api/users/${testUser.handle}`);
        const afterCount = (afterProfile.body.data as any).postCount;

        expect(afterCount).toBe(beforeCount - 1);
      });
    });

    describe('Authorization', () => {
      it('should reject deleting another user post', async () => {
        // Create post as other user
        client.setToken(otherUser.token);
        const post = await createPost(client);

        // Try to delete as test user
        client.setToken(testUser.token);
        const response = await client.delete(`/api/posts/${post.id}`);

        assertForbidden(response);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent post', async () => {
        const response = await client.delete('/api/posts/nonexistent123');

        assertNotFound(response);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const post = await createPost(client);
        client.clearToken();

        const response = await client.delete(`/api/posts/${post.id}`);

        assertUnauthorized(response);
      });
    });
  });
});
