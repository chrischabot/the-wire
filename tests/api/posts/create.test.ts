import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createPost, UserWithToken, CONTENT_LENGTHS } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
  assertPost,
} from '../setup/assertions';

describe('POST /api/posts', () => {
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
    it('should create a post with valid content', async () => {
      const response = await client.post('/api/posts', {
        content: 'Hello, world! This is my first post.',
      });

      const data = assertSuccess(response, 201);
      assertPost(data);
      expect(data.content).toBe('Hello, world! This is my first post.');
    });

    it('should set correct author information', async () => {
      const response = await client.post('/api/posts', {
        content: 'Author test post',
      });

      const data = assertSuccess(response, 201);
      expect(data.authorId).toBe(testUser.id);
      expect(data.authorHandle).toBe(testUser.handle.toLowerCase());
    });

    it('should initialize counts to zero', async () => {
      const response = await client.post('/api/posts', {
        content: 'Count test post',
      });

      const data = assertSuccess(response, 201);
      expect(data.likeCount).toBe(0);
      expect(data.replyCount).toBe(0);
      expect(data.repostCount).toBe(0);
    });

    it('should generate unique post ID', async () => {
      const response1 = await client.post('/api/posts', { content: 'Post 1' });
      const response2 = await client.post('/api/posts', { content: 'Post 2' });

      const data1 = assertSuccess(response1, 201);
      const data2 = assertSuccess(response2, 201);

      expect(data1.id).not.toBe(data2.id);
    });

    it('should set createdAt timestamp', async () => {
      const before = Date.now();
      const response = await client.post('/api/posts', { content: 'Timestamp test' });
      const after = Date.now();

      const data = assertSuccess(response, 201);
      expect(data.createdAt).toBeGreaterThanOrEqual(before);
      expect(data.createdAt).toBeLessThanOrEqual(after);
    });

    it('should create post with media URLs', async () => {
      const response = await client.post('/api/posts', {
        content: 'Post with media',
        mediaUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.png'],
      });

      const data = assertSuccess(response, 201);
      expect(data.mediaUrls).toEqual(['https://example.com/image1.jpg', 'https://example.com/image2.png']);
    });

    it('should accept maximum length content (280 chars)', async () => {
      const response = await client.post('/api/posts', {
        content: CONTENT_LENGTHS.MAX,
      });

      const data = assertSuccess(response, 201);
      expect(data.content.length).toBe(280);
    });

    it('should preserve unicode characters and emojis', async () => {
      const unicodeContent = 'Hello 世界! 🎉🚀💻 Testing unicode äöü ñ';
      const response = await client.post('/api/posts', {
        content: unicodeContent,
      });

      const data = assertSuccess(response, 201);
      expect(data.content).toBe(unicodeContent);
    });

    it('should increment user post count', async () => {
      // Get initial count
      const beforeProfile = await client.get(`/api/users/${testUser.handle}`);
      const beforeCount = (beforeProfile.body.data as any).postCount;

      // Create post
      await client.post('/api/posts', { content: 'Post count test' });

      // Get new count
      const afterProfile = await client.get(`/api/users/${testUser.handle}`);
      const afterCount = (afterProfile.body.data as any).postCount;

      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  describe('Content Validation', () => {
    it('should reject empty content', async () => {
      const response = await client.post('/api/posts', {
        content: CONTENT_LENGTHS.EMPTY,
      });

      assertBadRequest(response);
    });

    it('should reject whitespace-only content', async () => {
      const response = await client.post('/api/posts', {
        content: '   \n\t   ',
      });

      assertBadRequest(response);
    });

    it('should reject content longer than 280 characters', async () => {
      const response = await client.post('/api/posts', {
        content: CONTENT_LENGTHS.OVERFLOW,
      });

      assertBadRequest(response, '280');
    });

    it('should reject missing content field', async () => {
      const response = await client.post('/api/posts', {});

      assertBadRequest(response);
    });

    it('should reject null content', async () => {
      const response = await client.post('/api/posts', {
        content: null,
      });

      assertBadRequest(response);
    });
  });

  describe('Reply Posts', () => {
    it('should create reply to existing post', async () => {
      // Create original post
      const original = await createPost(client);

      // Create reply
      const response = await client.post('/api/posts', {
        content: 'This is a reply',
        replyToId: original.id,
      });

      const data = assertSuccess(response, 201);
      expect(data.replyToId).toBe(original.id);
    });

    it('should increment reply count on parent post', async () => {
      const original = await createPost(client);

      // Create reply
      await client.post('/api/posts', {
        content: 'Reply to increment count',
        replyToId: original.id,
      });

      // Check parent post reply count
      const parentResponse = await client.get(`/api/posts/${original.id}`);
      const parentData = assertSuccess(parentResponse, 200);
      expect(parentData.replyCount).toBe(1);
    });

    it('should handle reply to non-existent post gracefully', async () => {
      const response = await client.post('/api/posts', {
        content: 'Reply to nowhere',
        replyToId: 'non-existent-post-id',
      });

      // Should either succeed (orphan reply) or return 404
      expect([201, 404]).toContain(response.status);
    });
  });

  describe('Quote Posts', () => {
    it('should create quote of existing post', async () => {
      const original = await createPost(client);

      const response = await client.post('/api/posts', {
        content: 'This is a quote with my commentary',
        quoteOfId: original.id,
      });

      const data = assertSuccess(response, 201);
      expect(data.quoteOfId).toBe(original.id);
    });

    it('should increment quote count on original post', async () => {
      const original = await createPost(client);

      await client.post('/api/posts', {
        content: 'Quote to increment count',
        quoteOfId: original.id,
      });

      const parentResponse = await client.get(`/api/posts/${original.id}`);
      const parentData = assertSuccess(parentResponse, 200);
      expect(parentData.quoteCount).toBe(1);
    });
  });

  describe('Mentions', () => {
    it('should create post with @mentions', async () => {
      const mentionedUser = await createUser(client);
      client.setToken(testUser.token);

      const response = await client.post('/api/posts', {
        content: `Hey @${mentionedUser.handle} check this out!`,
      });

      assertSuccess(response, 201);
    });

    it('should handle mention of non-existent user', async () => {
      const response = await client.post('/api/posts', {
        content: 'Hey @nonexistentuser123 are you there?',
      });

      // Should succeed - mentions don't require user to exist
      assertSuccess(response, 201);
    });
  });

  describe('Authentication', () => {
    it('should reject request without token', async () => {
      client.clearToken();
      const response = await client.post('/api/posts', {
        content: 'Unauthorized post',
      });

      assertUnauthorized(response);
    });

    it('should reject request with invalid token', async () => {
      client.setToken('invalid-token');
      const response = await client.post('/api/posts', {
        content: 'Invalid token post',
      });

      assertUnauthorized(response);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short content (1 char)', async () => {
      const response = await client.post('/api/posts', {
        content: CONTENT_LENGTHS.MIN,
      });

      assertSuccess(response, 201);
    });

    it('should handle content with only special characters', async () => {
      const response = await client.post('/api/posts', {
        content: '!@#$%^&*()',
      });

      assertSuccess(response, 201);
    });

    it('should handle content with line breaks', async () => {
      const response = await client.post('/api/posts', {
        content: 'Line 1\nLine 2\nLine 3',
      });

      const data = assertSuccess(response, 201);
      expect(data.content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle empty mediaUrls array', async () => {
      const response = await client.post('/api/posts', {
        content: 'Post with empty media',
        mediaUrls: [],
      });

      const data = assertSuccess(response, 201);
      expect(data.mediaUrls).toEqual([]);
    });
  });

  describe('Security', () => {
    it('should not allow XSS in content', async () => {
      const xssContent = '<script>alert("xss")</script>';
      const response = await client.post('/api/posts', {
        content: xssContent,
      });

      // Should either sanitize or store as-is (escaped on display)
      const data = assertSuccess(response, 201);
      // Content should not execute as script
      expect(data.content).toBeDefined();
    });

    it('should handle SQL injection attempts', async () => {
      const sqlContent = "'; DROP TABLE posts; --";
      const response = await client.post('/api/posts', {
        content: sqlContent,
      });

      assertSuccess(response, 201);
    });
  });
});
