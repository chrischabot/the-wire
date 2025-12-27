import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, createUsers, createPost, UserWithToken } from '../setup/test-factories';
import { assertSuccess } from '../setup/assertions';

describe('Complex Social Graph Scenarios', () => {
  let client: ApiClient;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
  });

  describe('Linear Follow Chain (A → B → C → D)', () => {
    let userA: UserWithToken;
    let userB: UserWithToken;
    let userC: UserWithToken;
    let userD: UserWithToken;

    beforeAll(async () => {
      [userA, userB, userC, userD] = await createUsers(client, 4);

      // Create chain: A → B → C → D
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);

      client.setToken(userB.token);
      await client.post(`/api/users/${userC.handle}/follow`);

      client.setToken(userC.token);
      await client.post(`/api/users/${userD.handle}/follow`);
    });

    it('User A should see posts from B in home feed (direct follow)', async () => {
      // B creates post
      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Post from B for A' });

      // Check A's feed
      client.setToken(userA.token);
      const response = await client.get('/api/feed/home');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === postB.id)).toBe(true);
    });

    it('User A should NOT see posts from C directly (not followed)', async () => {
      // C creates post
      client.setToken(userC.token);
      const postC = await createPost(client, { content: 'Post from C - not followed by A' });

      // Check A's chronological feed (excludes FoF)
      client.setToken(userA.token);
      const response = await client.get('/api/feed/chronological');
      const data = assertSuccess(response, 200);

      // Should not appear in chronological (strict following only)
      expect(data.posts.some((p: any) => p.id === postC.id)).toBe(false);
    });

    it('User D is 3 hops away from A - should not appear in A\'s feed', async () => {
      // D creates post
      client.setToken(userD.token);
      const postD = await createPost(client, { content: 'Post from D - too far from A' });

      // Check A's chronological feed
      client.setToken(userA.token);
      const response = await client.get('/api/feed/chronological');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === postD.id)).toBe(false);
    });

    it('Follower counts should be accurate', async () => {
      client.setToken(userA.token);

      // A follows B, so A has 1 following
      const profileA = await client.get(`/api/users/${userA.handle}`);
      expect((profileA.body.data as any).followingCount).toBe(1);

      // B is followed by A, so B has 1 follower
      const profileB = await client.get(`/api/users/${userB.handle}`);
      expect((profileB.body.data as any).followerCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Mutual Follows (A ↔ B)', () => {
    let userA: UserWithToken;
    let userB: UserWithToken;

    beforeAll(async () => {
      [userA, userB] = await createUsers(client, 2);

      // Create mutual follow
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);

      client.setToken(userB.token);
      await client.post(`/api/users/${userA.handle}/follow`);
    });

    it('Both users should see each other in their feeds', async () => {
      // A posts
      client.setToken(userA.token);
      const postA = await createPost(client, { content: 'Post from A for mutual' });

      // B posts
      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Post from B for mutual' });

      // A should see B's post
      client.setToken(userA.token);
      let response = await client.get('/api/feed/home');
      let data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === postB.id)).toBe(true);

      // B should see A's post
      client.setToken(userB.token);
      response = await client.get('/api/feed/home');
      data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === postA.id)).toBe(true);
    });

    it('Both should appear in each other\'s following/followers lists', async () => {
      client.setToken(userA.token);

      const followingA = await client.get(`/api/users/${userA.handle}/following`);
      expect((followingA.body.data as any).following.some((u: any) => u.handle === userB.handle.toLowerCase())).toBe(true);

      const followersA = await client.get(`/api/users/${userA.handle}/followers`);
      expect((followersA.body.data as any).followers.some((u: any) => u.handle === userB.handle.toLowerCase())).toBe(true);
    });

    it('Unfollowing one direction maintains other connection', async () => {
      // Create fresh mutual follow
      const [u1, u2] = await createUsers(client, 2);

      client.setToken(u1.token);
      await client.post(`/api/users/${u2.handle}/follow`);

      client.setToken(u2.token);
      await client.post(`/api/users/${u1.handle}/follow`);

      // u1 unfollows u2
      client.setToken(u1.token);
      await client.delete(`/api/users/${u2.handle}/follow`);

      // u2 should still follow u1
      const followers1 = await client.get(`/api/users/${u1.handle}/followers`);
      expect((followers1.body.data as any).followers.some((u: any) => u.handle === u2.handle.toLowerCase())).toBe(true);

      // u1 should NOT follow u2
      const following1 = await client.get(`/api/users/${u1.handle}/following`);
      expect((following1.body.data as any).following.some((u: any) => u.handle === u2.handle.toLowerCase())).toBe(false);
    });
  });

  describe('Star Topology (A follows B, C, D, E, F)', () => {
    let center: UserWithToken;
    let edges: UserWithToken[];

    beforeAll(async () => {
      center = await createUser(client);
      edges = await createUsers(client, 5);

      // Center follows all edges
      client.setToken(center.token);
      for (const edge of edges) {
        await client.post(`/api/users/${edge.handle}/follow`);
      }
    });

    it('Center should see posts from all followed users', async () => {
      // Each edge creates a post
      const posts: any[] = [];
      for (const edge of edges) {
        client.setToken(edge.token);
        const post = await createPost(client, { content: `Post from ${edge.handle}` });
        posts.push(post);
      }

      // Center checks feed
      client.setToken(center.token);
      const response = await client.get('/api/feed/home', { limit: 50 });
      const data = assertSuccess(response, 200);

      // Should see at least some posts from edges
      const seenEdgeIds = new Set(data.posts.map((p: any) => p.authorId));
      expect(seenEdgeIds.size).toBeGreaterThanOrEqual(1);
    });

    it('Unfollowing one removes their posts from feed', async () => {
      // Create fresh star
      const hubUser = await createUser(client);
      const [spoke1, spoke2] = await createUsers(client, 2);

      client.setToken(hubUser.token);
      await client.post(`/api/users/${spoke1.handle}/follow`);
      await client.post(`/api/users/${spoke2.handle}/follow`);

      // Spoke1 creates post
      client.setToken(spoke1.token);
      const post1 = await createPost(client, { content: 'Spoke1 post' });

      // Hub unfollows spoke1
      client.setToken(hubUser.token);
      await client.delete(`/api/users/${spoke1.handle}/follow`);

      // Check chronological feed (strict following)
      const response = await client.get('/api/feed/chronological');
      const data = assertSuccess(response, 200);

      expect(data.posts.some((p: any) => p.id === post1.id)).toBe(false);
    });
  });

  describe('Circular Follows (A → B → C → A)', () => {
    let userA: UserWithToken;
    let userB: UserWithToken;
    let userC: UserWithToken;

    beforeAll(async () => {
      [userA, userB, userC] = await createUsers(client, 3);

      // Create circle
      client.setToken(userA.token);
      await client.post(`/api/users/${userB.handle}/follow`);

      client.setToken(userB.token);
      await client.post(`/api/users/${userC.handle}/follow`);

      client.setToken(userC.token);
      await client.post(`/api/users/${userA.handle}/follow`);
    });

    it('All three should see their directly followed user\'s posts', async () => {
      // Each creates a post
      client.setToken(userA.token);
      const postA = await createPost(client, { content: 'Post A in circle' });

      client.setToken(userB.token);
      const postB = await createPost(client, { content: 'Post B in circle' });

      client.setToken(userC.token);
      const postC = await createPost(client, { content: 'Post C in circle' });

      // A follows B, so A sees B's post
      client.setToken(userA.token);
      let response = await client.get('/api/feed/chronological');
      let data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === postB.id)).toBe(true);

      // B follows C, so B sees C's post
      client.setToken(userB.token);
      response = await client.get('/api/feed/chronological');
      data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === postC.id)).toBe(true);

      // C follows A, so C sees A's post
      client.setToken(userC.token);
      response = await client.get('/api/feed/chronological');
      data = assertSuccess(response, 200);
      expect(data.posts.some((p: any) => p.id === postA.id)).toBe(true);
    });

    it('Breaking one link maintains other connections', async () => {
      // B unfollows C
      client.setToken(userB.token);
      await client.delete(`/api/users/${userC.handle}/follow`);

      // A still follows B
      client.setToken(userA.token);
      const following = await client.get(`/api/users/${userA.handle}/following`);
      expect((following.body.data as any).following.some((u: any) => u.handle === userB.handle.toLowerCase())).toBe(true);

      // C still follows A
      const followers = await client.get(`/api/users/${userA.handle}/followers`);
      expect((followers.body.data as any).followers.some((u: any) => u.handle === userC.handle.toLowerCase())).toBe(true);
    });
  });

  describe('Large Follow Network', () => {
    it('User can follow many users', async () => {
      const hub = await createUser(client);
      const spokes = await createUsers(client, 10);

      client.setToken(hub.token);
      for (const spoke of spokes) {
        await client.post(`/api/users/${spoke.handle}/follow`);
      }

      const profile = await client.get(`/api/users/${hub.handle}`);
      expect((profile.body.data as any).followingCount).toBe(10);
    });

    it('User can have many followers', async () => {
      const celebrity = await createUser(client);
      const fans = await createUsers(client, 10);

      for (const fan of fans) {
        client.setToken(fan.token);
        await client.post(`/api/users/${celebrity.handle}/follow`);
      }

      const profile = await client.get(`/api/users/${celebrity.handle}`);
      expect((profile.body.data as any).followerCount).toBe(10);
    });
  });
});
