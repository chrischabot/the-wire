import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertUnauthorized,
  assertNotFound,
  assertNotification,
} from '../setup/assertions';

describe('Notification Endpoints', () => {
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

  describe('GET /api/notifications', () => {
    describe('Happy Path', () => {
      it('should return notifications list', async () => {
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('notifications');
        expect(Array.isArray(data.notifications)).toBe(true);
      });

      it('should include unread count', async () => {
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('unreadCount');
        expect(typeof data.unreadCount).toBe('number');
      });

      it('should return empty list for new user', async () => {
        const freshUser = await createUser(client);
        client.setToken(freshUser.token);

        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        expect(data.notifications).toEqual([]);
      });

      it('should include pagination info', async () => {
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('cursor');
        expect(data).toHaveProperty('hasMore');
      });
    });

    describe('Notification Types', () => {
      it('should receive follow notification', async () => {
        // otherUser follows testUser
        client.setToken(otherUser.token);
        await client.post(`/api/users/${testUser.handle}/follow`);

        // Check testUser's notifications
        client.setToken(testUser.token);
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        const followNotif = data.notifications.find((n: any) => n.type === 'follow' && n.actorHandle === otherUser.handle.toLowerCase());
        expect(followNotif).toBeDefined();
      });

      it('should receive like notification', async () => {
        // testUser creates post
        const post = await createPost(client, { content: 'Like me!' });

        // otherUser likes it
        client.setToken(otherUser.token);
        await client.post(`/api/posts/${post.id}/like`);

        // Check testUser's notifications
        client.setToken(testUser.token);
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        const likeNotif = data.notifications.find((n: any) => n.type === 'like' && n.postId === post.id);
        expect(likeNotif).toBeDefined();
      });

      it('should receive reply notification', async () => {
        // testUser creates post
        const post = await createPost(client, { content: 'Reply to me!' });

        // otherUser replies
        client.setToken(otherUser.token);
        await client.post('/api/posts', {
          content: 'This is a reply',
          replyToId: post.id,
        });

        // Check testUser's notifications
        client.setToken(testUser.token);
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        const replyNotif = data.notifications.find((n: any) => n.type === 'reply' && n.postId === post.id);
        expect(replyNotif).toBeDefined();
      });

      it('should receive repost notification', async () => {
        // testUser creates post
        const post = await createPost(client, { content: 'Repost me!' });

        // otherUser reposts
        client.setToken(otherUser.token);
        await client.post(`/api/posts/${post.id}/repost`);

        // Check testUser's notifications
        client.setToken(testUser.token);
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        const repostNotif = data.notifications.find((n: any) => n.type === 'repost');
        expect(repostNotif).toBeDefined();
      });

      it('should receive mention notification', async () => {
        // otherUser mentions testUser
        client.setToken(otherUser.token);
        await client.post('/api/posts', {
          content: `Hey @${testUser.handle} check this out!`,
        });

        // Check testUser's notifications
        client.setToken(testUser.token);
        const response = await client.get('/api/notifications');

        const data = assertSuccess(response, 200);
        const mentionNotif = data.notifications.find((n: any) => n.type === 'mention');
        expect(mentionNotif).toBeDefined();
      });
    });

    describe('Self-Actions', () => {
      it('should NOT receive notification when liking own post', async () => {
        const post = await createPost(client, { content: 'Self like test' });

        // Like own post
        await client.post(`/api/posts/${post.id}/like`);

        // Check notifications
        const response = await client.get('/api/notifications');
        const data = assertSuccess(response, 200);

        // Should not have self-like notification
        const selfLike = data.notifications.find((n: any) => n.type === 'like' && n.postId === post.id && n.actorId === testUser.id);
        expect(selfLike).toBeUndefined();
      });
    });

    describe('Pagination', () => {
      it('should limit results', async () => {
        const response = await client.get('/api/notifications', { limit: 5 });

        const data = assertSuccess(response, 200);
        expect(data.notifications.length).toBeLessThanOrEqual(5);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.get('/api/notifications');

        assertUnauthorized(response);
      });
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    describe('Happy Path', () => {
      it('should return unread count', async () => {
        const response = await client.get('/api/notifications/unread-count');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('count');
        expect(typeof data.count).toBe('number');
      });

      it('should return 0 for user with all read notifications', async () => {
        const freshUser = await createUser(client);
        client.setToken(freshUser.token);

        const response = await client.get('/api/notifications/unread-count');

        const data = assertSuccess(response, 200);
        expect(data.count).toBe(0);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.get('/api/notifications/unread-count');

        assertUnauthorized(response);
      });
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    let notificationId: string;

    beforeEach(async () => {
      // Create a notification by having someone follow testUser
      const follower = await createUser(client);
      client.setToken(follower.token);
      await client.post(`/api/users/${testUser.handle}/follow`);

      // Get the notification ID
      client.setToken(testUser.token);
      const response = await client.get('/api/notifications');
      const notifications = (response.body.data as any)?.notifications || [];
      if (notifications.length > 0) {
        notificationId = notifications[0].id;
      }
    });

    describe('Happy Path', () => {
      it('should mark notification as read', async () => {
        if (!notificationId) return;

        const response = await client.put(`/api/notifications/${notificationId}/read`);

        assertSuccess(response, 200);
      });

      it('should decrease unread count after marking as read', async () => {
        if (!notificationId) return;

        // Get initial count
        const beforeResponse = await client.get('/api/notifications/unread-count');
        const beforeCount = (beforeResponse.body.data as any).count;

        // Mark as read
        await client.put(`/api/notifications/${notificationId}/read`);

        // Get new count
        const afterResponse = await client.get('/api/notifications/unread-count');
        const afterCount = (afterResponse.body.data as any).count;

        expect(afterCount).toBeLessThanOrEqual(beforeCount);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent notification', async () => {
        const response = await client.put('/api/notifications/nonexistent123/read');

        assertNotFound(response);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        if (!notificationId) return;

        client.clearToken();
        const response = await client.put(`/api/notifications/${notificationId}/read`);

        assertUnauthorized(response);
      });
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    describe('Happy Path', () => {
      it('should mark all notifications as read', async () => {
        // Create some notifications
        const follower = await createUser(client);
        client.setToken(follower.token);
        await client.post(`/api/users/${testUser.handle}/follow`);

        // Mark all as read
        client.setToken(testUser.token);
        const response = await client.put('/api/notifications/read-all');

        const data = assertSuccess(response, 200);
        expect(data).toHaveProperty('markedCount');
      });

      it('should set unread count to 0 after marking all as read', async () => {
        await client.put('/api/notifications/read-all');

        const countResponse = await client.get('/api/notifications/unread-count');
        const countData = assertSuccess(countResponse, 200);

        expect(countData.count).toBe(0);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const response = await client.put('/api/notifications/read-all');

        assertUnauthorized(response);
      });
    });
  });
});
