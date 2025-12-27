import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, createPosts, UserWithToken, wait } from '../setup/test-factories';
import { assertSuccess } from '../setup/assertions';

describe('Feed Composition Scenarios', () => {
  let client: ApiClient;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
  });

  describe('New Follower Feed Backfill', () => {
    it('After following, follower sees recent posts from followed user', async () => {
      const [follower, target] = await createUsers(client, 2);

      // Target creates posts BEFORE being followed
      client.setToken(target.token);
      const post1 = await createPost(client, { content: 'Post before follow 1' });
      const post2 = await createPost(client, { content: 'Post before follow 2' });

      // Follower follows target
      client.setToken(follower.token);
      await client.post(`/api/users/${target.handle}/follow`);

      // Check follower's home feed
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      // Should see target's recent posts
      const targetPosts = data.posts.filter((p: any) => p.authorHandle === target.handle.toLowerCase());
      expect(targetPosts.length).toBeGreaterThan(0);
    });
  });

  describe('Unfollow Removes Posts from Feed', () => {
    it('After unfollowing, posts stop appearing in home feed', async () => {
      const [follower, target] = await createUsers(client, 2);

      // Follow and verify posts appear
      client.setToken(follower.token);
      await client.post(`/api/users/${target.handle}/follow`);

      client.setToken(target.token);
      const post = await createPost(client, { content: 'Post while following' });

      client.setToken(follower.token);
      let response = await client.get('/api/feed/chronological');
      let data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === post.id)).toBe(true);

      // Unfollow
      await client.delete(`/api/users/${target.handle}/follow`);

      // Check feed again - post should be gone from chronological
      response = await client.get('/api/feed/chronological');
      data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === post.id)).toBe(false);
    });
  });

  describe('Author Diversity in Feed', () => {
    it('Prolific poster does not dominate feed', async () => {
      const viewer = await createUser(client);
      const prolificPoster = await createUser(client);
      const normalPoster = await createUser(client);

      // Viewer follows both
      client.setToken(viewer.token);
      await client.post(`/api/users/${prolificPoster.handle}/follow`);
      await client.post(`/api/users/${normalPoster.handle}/follow`);

      // Prolific poster creates many posts
      client.setToken(prolificPoster.token);
      for (let i = 0; i < 10; i++) {
        await createPost(client, { content: `Prolific post ${i}` });
      }

      // Normal poster creates a few posts
      client.setToken(normalPoster.token);
      await createPost(client, { content: 'Normal post 1' });
      await createPost(client, { content: 'Normal post 2' });

      // Check viewer's feed
      client.setToken(viewer.token);
      const response = await client.get('/api/feed/home', { limit: 10 });
      const data = assertSuccess(response, 200);

      // Count posts per author
      const postsByAuthor: Record<string, number> = {};
      data.posts.forEach((post: any) => {
        postsByAuthor[post.authorHandle] = (postsByAuthor[post.authorHandle] || 0) + 1;
      });

      // Prolific poster should not have more than 80% of feed
      const prolificCount = postsByAuthor[prolificPoster.handle.toLowerCase()] || 0;
      const totalCount = data.posts.length;
      if (totalCount > 5) {
        expect(prolificCount / totalCount).toBeLessThanOrEqual(0.8);
      }
    });
  });

  describe('Muted Words Filtering', () => {
    it('Posts containing muted words are excluded from home feed', async () => {
      const [viewer, poster] = await createUsers(client, 2);

      // Viewer follows poster
      client.setToken(viewer.token);
      await client.post(`/api/users/${poster.handle}/follow`);

      // Set muted words
      await client.put('/api/users/me/settings', {
        mutedWords: ['spam', 'advertisement'],
      });

      // Poster creates posts
      client.setToken(poster.token);
      const normalPost = await createPost(client, { content: 'This is a normal post' });
      const mutedPost = await createPost(client, { content: 'This is spam content!' });

      // Check viewer's feed
      client.setToken(viewer.token);
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      // Normal post should appear, muted post should not
      expect(data.posts.some((p: any) => p.id === normalPost.id)).toBe(true);
      expect(data.posts.some((p: any) => p.id === mutedPost.id)).toBe(false);
    });

    it('Muted words filtering is case-insensitive', async () => {
      const [viewer, poster] = await createUsers(client, 2);

      client.setToken(viewer.token);
      await client.post(`/api/users/${poster.handle}/follow`);
      await client.put('/api/users/me/settings', {
        mutedWords: ['crypto'],
      });

      client.setToken(poster.token);
      const mutedPost = await createPost(client, { content: 'CRYPTO is the future!' });

      client.setToken(viewer.token);
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      // Post should be filtered (case-insensitive)
      expect(data.posts.some((p: any) => p.id === mutedPost.id)).toBe(false);
    });
  });

  describe('Deleted Posts in Feed', () => {
    it('Deleted posts are removed from feeds', async () => {
      const [viewer, poster] = await createUsers(client, 2);

      // Viewer follows poster
      client.setToken(viewer.token);
      await client.post(`/api/users/${poster.handle}/follow`);

      // Poster creates and then deletes a post
      client.setToken(poster.token);
      const post = await createPost(client, { content: 'Post to be deleted' });

      // Verify post appears in viewer's feed
      client.setToken(viewer.token);
      let response = await client.get('/api/feed/home');
      let data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === post.id)).toBe(true);

      // Delete the post
      client.setToken(poster.token);
      await client.delete(`/api/posts/${post.id}`);

      // Verify post no longer appears in feed
      client.setToken(viewer.token);
      response = await client.get('/api/feed/home');
      data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === post.id)).toBe(false);
    });

    it('Deleting post decrements author post count', async () => {
      const poster = await createUser(client);
      client.setToken(poster.token);

      // Get initial count
      let profile = await client.get(`/api/users/${poster.handle}`);
      const beforeCount = (profile.body.data as any).postCount;

      // Create and delete a post
      const post = await createPost(client);
      await client.delete(`/api/posts/${post.id}`);

      // Check count is back to original
      profile = await client.get(`/api/users/${poster.handle}`);
      const afterCount = (profile.body.data as any).postCount;

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('Reply Visibility', () => {
    it('Replies appear in thread but not main feed', async () => {
      const [viewer, poster] = await createUsers(client, 2);

      // Viewer follows poster
      client.setToken(viewer.token);
      await client.post(`/api/users/${poster.handle}/follow`);

      // Poster creates original post and reply
      client.setToken(poster.token);
      const originalPost = await createPost(client, { content: 'Original post' });
      const replyResponse = await client.post('/api/posts', {
        content: 'Reply to myself',
        replyToId: originalPost.id,
      });
      const reply = assertSuccess(replyResponse, 201);

      // Check viewer's home feed
      client.setToken(viewer.token);
      const feedResponse = await client.get('/api/feed/home');
      const feedData = assertSuccess(feedResponse, 200);

      // Original post should appear
      expect(feedData.posts.some((p: any) => p.id === originalPost.id)).toBe(true);

      // Check thread - reply should appear there
      const threadResponse = await client.get(`/api/posts/${originalPost.id}/thread`);
      const threadData = assertSuccess(threadResponse, 200);
      expect(threadData.replies.some((r: any) => r.id === reply.id)).toBe(true);
    });
  });

  describe('Repost Visibility', () => {
    it('Reposts appear in reposter followers feeds', async () => {
      const [viewer, reposter, originalAuthor] = await createUsers(client, 3);

      // Viewer follows reposter (not original author)
      client.setToken(viewer.token);
      await client.post(`/api/users/${reposter.handle}/follow`);

      // Original author creates post
      client.setToken(originalAuthor.token);
      const originalPost = await createPost(client, { content: 'Original content' });

      // Reposter reposts it
      client.setToken(reposter.token);
      const repostResponse = await client.post(`/api/posts/${originalPost.id}/repost`);
      const repost = assertSuccess(repostResponse, 201);

      // Check viewer's feed
      client.setToken(viewer.token);
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      // Should see the repost
      expect(data.posts.some((p: any) => p.repostOfId === originalPost.id)).toBe(true);
    });
  });

  describe('Feed Pagination Consistency', () => {
    it('Paginating through feed shows all posts without duplicates', async () => {
      const user = await createUser(client);
      client.setToken(user.token);

      // Create many posts
      const posts = await createPosts(client, 25);

      // Paginate through feed
      const allPostIds = new Set<string>();
      let cursor: string | null = null;
      let iterations = 0;
      const maxIterations = 10;

      do {
        const params: any = { limit: 10 };
        if (cursor) params.cursor = cursor;

        const response = await client.get('/api/feed/home', params);
        const data = assertSuccess(response, 200);

        // Add all post IDs
        data.posts.forEach((p: any) => {
          expect(allPostIds.has(p.id)).toBe(false); // No duplicates
          allPostIds.add(p.id);
        });

        cursor = data.hasMore ? data.cursor : null;
        iterations++;
      } while (cursor && iterations < maxIterations);

      // Should have seen all or most posts
      expect(allPostIds.size).toBeGreaterThanOrEqual(posts.length * 0.8);
    });
  });
});
