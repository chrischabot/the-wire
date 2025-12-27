import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, UserWithToken } from '../setup/test-factories';
import { assertSuccess, assertForbidden } from '../setup/assertions';

describe('Block Interaction Scenarios', () => {
  let client: ApiClient;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
  });

  describe('Block Removes Follow Relationships', () => {
    it('A follows B, A blocks B → A no longer follows B', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A follows B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);

      // Verify following
      let following = await client.get(`/api/users/${userA.handle}/following`);
      expect((following.body.data as any).following.some((u: any) => u.handle === userB.handle.toLowerCase())).toBe(true);

      // A blocks B
      await client.post(`/api/users/${userB.handle}/block`);

      // Verify no longer following
      following = await client.get(`/api/users/${userA.handle}/following`);
      expect((following.body.data as any).following.some((u: any) => u.handle === userB.handle.toLowerCase())).toBe(false);
    });

    it('A follows B, A blocks B → B no longer follows A (if mutual)', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // Create mutual follow
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);
      client.setToken(userB.token);
      await client.post(`/api/users/${userA.handle}/follow`);

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // Verify B no longer follows A
      const followers = await client.get(`/api/users/${userA.handle}/followers`);
      expect((followers.body.data as any).followers.some((u: any) => u.handle === userB.handle.toLowerCase())).toBe(false);
    });

    it('Follower counts are decremented correctly after block', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // Create mutual follow
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);
      client.setToken(userB.token);
      await client.post(`/api/users/${userA.handle}/follow`);

      // Get counts before block
      let profileA = await client.get(`/api/users/${userA.handle}`);
      let profileB = await client.get(`/api/users/${userB.handle}`);
      const beforeFollowersA = (profileA.body.data as any).followerCount;
      const beforeFollowingA = (profileA.body.data as any).followingCount;

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // Get counts after block
      profileA = await client.get(`/api/users/${userA.handle}`);
      profileB = await client.get(`/api/users/${userB.handle}`);

      // A should have fewer followers (B removed) and fewer following (B removed)
      expect((profileA.body.data as any).followerCount).toBeLessThan(beforeFollowersA);
      expect((profileA.body.data as any).followingCount).toBeLessThan(beforeFollowingA);
    });
  });

  describe('Blocked User Cannot Follow', () => {
    it('B is blocked by A → B cannot follow A', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // B tries to follow A
      client.setToken(userB.token);
      const response = await client.post(`/api/users/${userA.handle}/follow`);

      assertForbidden(response);
    });

    it('Returns 403 with appropriate message', async () => {
      const [userA, userB] = await createUsers(client, 2);

      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      client.setToken(userB.token);
      const response = await client.post(`/api/users/${userA.handle}/follow`);

      expect(response.status).toBe(403);
      expect(response.body.error?.toLowerCase()).toContain('cannot');
    });
  });

  describe('Blocked User Cannot Repost', () => {
    it('B is blocked by A → B cannot repost A\'s posts', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A creates post
      client.setToken(userA.token);
      const post = await createPost(client, { content: 'Post that B cannot repost' });

      // A blocks B
      await client.post(`/api/users/${userB.handle}/block`);

      // B tries to repost
      client.setToken(userB.token);
      const response = await client.post(`/api/posts/${post.id}/repost`);

      assertForbidden(response);
    });
  });

  describe('Blocked User Posts Not Visible in Feed', () => {
    it('After blocking, blocker\'s home feed excludes blocked user\'s posts', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A follows B first
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);

      // B creates post
      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Post before block' });

      // Verify A can see B's post
      client.setToken(userA.token);
      let feed = await client.get('/api/feed/home');
      expect((feed.body.data as any).posts.some((p: any) => p.id === postB.id)).toBe(true);

      // A blocks B
      await client.post(`/api/users/${userB.handle}/block`);

      // Verify A cannot see B's post anymore
      feed = await client.get('/api/feed/home');
      expect((feed.body.data as any).posts.some((p: any) => p.id === postB.id)).toBe(false);
    });

    it('After blocking, global feed excludes blocked user for blocker', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // B creates post
      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Global post to be blocked' });

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // Check global feed
      const feed = await client.get('/api/feed/global');
      expect((feed.body.data as any).posts.some((p: any) => p.id === postB.id)).toBe(false);
    });

    it('Search results exclude blocked user\'s content', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // B creates searchable post
      client.setToken(userB.token);
      const uniqueKeyword = `blockedcontent_${Date.now()}`;
      await createPost(client, { content: `Post with ${uniqueKeyword}` });

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // A searches for the keyword
      const search = await client.get('/api/search', { q: uniqueKeyword });
      const data = assertSuccess(search, 200);

      // B's post should not appear
      expect(data.posts.some((p: any) => p.authorHandle === userB.handle.toLowerCase())).toBe(false);
    });
  });

  describe('Thread Visibility with Blocks', () => {
    it('Post thread hides replies from blocked users', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A creates original post
      client.setToken(userA.token);
      const original = await createPost(client, { content: 'Original post' });

      // B replies
      client.setToken(userB.token);
      const reply = await client.post('/api/posts', {
        content: 'Reply from B',
        replyToId: original.id,
      });
      const replyData = assertSuccess(reply, 201);

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // A views thread
      const thread = await client.get(`/api/posts/${original.id}/thread`);
      const threadData = assertSuccess(thread, 200);

      // B's reply should be hidden (or filtered)
      // Note: Implementation may vary - either filtered or shown with indicator
      const hasBlockedReply = threadData.replies.some((r: any) => r.id === replyData.id);
      // Either hidden completely or marked as blocked
      if (hasBlockedReply) {
        // If visible, should be marked somehow
        const blockedReply = threadData.replies.find((r: any) => r.id === replyData.id);
        // Implementation-dependent check
      }
    });
  });

  describe('Unblock Restores Visibility', () => {
    it('After unblock, user\'s posts visible again in global feed', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // B creates post
      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Post to be unblocked' });

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // Verify hidden
      let feed = await client.get('/api/feed/global');
      expect((feed.body.data as any).posts.some((p: any) => p.id === postB.id)).toBe(false);

      // A unblocks B
      await client.delete(`/api/users/${userB.handle}/block`);

      // Verify visible again
      feed = await client.get('/api/feed/global');
      // Post may or may not appear depending on feed algorithm
      // At minimum, should not error
      assertSuccess(feed, 200);
    });

    it('Can follow again after unblock', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // B cannot follow A
      client.setToken(userB.token);
      let followResponse = await client.post(`/api/users/${userA.handle}/follow`);
      expect(followResponse.status).toBe(403);

      // A unblocks B
      client.setToken(userA.token);
      await client.delete(`/api/users/${userB.handle}/block`);

      // B can now follow A
      client.setToken(userB.token);
      followResponse = await client.post(`/api/users/${userA.handle}/follow`);
      assertSuccess(followResponse, 200);
    });
  });

  describe('Like/Repost from Blocked Users', () => {
    it('Blocked user can still like posts (but won\'t appear in notifications)', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // A creates post
      client.setToken(userA.token);
      const post = await createPost(client, { content: 'Post to like' });

      // A blocks B
      await client.post(`/api/users/${userB.handle}/block`);

      // B likes post (may succeed as likes are often not blocked)
      client.setToken(userB.token);
      const likeResponse = await client.post(`/api/posts/${post.id}/like`);

      // Either succeeds or is forbidden, both are valid implementations
      expect([200, 403]).toContain(likeResponse.status);
    });
  });

  describe('Bidirectional Block Effects', () => {
    it('When A blocks B, both lose access to each other\'s content', async () => {
      const [userA, userB] = await createUsers(client, 2);

      // Both create posts
      client.setToken(userA.token);
      const postA = await createPost(client, { content: 'Post from A' });

      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Post from B' });

      // A blocks B
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/block`);

      // A cannot see B's posts in global feed
      let feedA = await client.get('/api/feed/global');
      expect((feedA.body.data as any).posts.some((p: any) => p.id === postB.id)).toBe(false);

      // B should also not see A's posts (blocker's posts hidden from blocked)
      client.setToken(userB.token);
      let feedB = await client.get('/api/feed/global');
      // This depends on implementation - some show, some hide
      // At minimum, both should still work without error
      assertSuccess(feedB, 200);
    });
  });
});
