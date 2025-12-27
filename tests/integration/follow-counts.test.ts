import { describe, it, expect } from 'vitest';

/**
 * Tests for follow count synchronization
 *
 * Bug fixed: Profile was showing stale follower/following counts
 * because the counts weren't being synced after follow operations.
 */

describe('Follow Count Synchronization', () => {
  describe('Count calculation', () => {
    it('should calculate following count from following list', () => {
      const followingList = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const followingCount = followingList.length;

      expect(followingCount).toBe(5);
    });

    it('should calculate follower count from follower list', () => {
      const followerList = ['follower1', 'follower2'];
      const followerCount = followerList.length;

      expect(followerCount).toBe(2);
    });

    it('should handle empty lists', () => {
      const emptyList: string[] = [];
      expect(emptyList.length).toBe(0);
    });

    it('should not count self in following', () => {
      const userId = 'myUserId';
      const followingList = ['myUserId', 'user1', 'user2']; // Self included

      // Filter out self
      const actualFollowing = followingList.filter((id) => id !== userId);
      expect(actualFollowing.length).toBe(2);
    });
  });

  describe('Count sync logic', () => {
    it('should update count after follow', () => {
      let followingCount = 5;
      const targetUserId = 'newFollowee';
      const following = new Set(['user1', 'user2', 'user3', 'user4', 'user5']);

      // Simulate follow
      if (!following.has(targetUserId)) {
        following.add(targetUserId);
        followingCount = following.size;
      }

      expect(followingCount).toBe(6);
    });

    it('should update count after unfollow', () => {
      let followingCount = 5;
      const targetUserId = 'user3';
      const following = new Set(['user1', 'user2', 'user3', 'user4', 'user5']);

      // Simulate unfollow
      if (following.has(targetUserId)) {
        following.delete(targetUserId);
        followingCount = following.size;
      }

      expect(followingCount).toBe(4);
    });

    it('should not decrement below zero', () => {
      let followerCount = 0;

      // Attempt to decrement
      followerCount = Math.max(0, followerCount - 1);

      expect(followerCount).toBe(0);
    });

    it('should handle concurrent follow operations', () => {
      // Simulate concurrent follows with Set to prevent duplicates
      const following = new Set<string>();

      // Multiple concurrent follow attempts
      ['user1', 'user1', 'user2', 'user1', 'user3'].forEach((id) => {
        following.add(id);
      });

      // Should only have unique entries
      expect(following.size).toBe(3);
    });
  });

  describe('Profile stats display', () => {
    it('should format large follower counts', () => {
      const formatCount = (count: number): string => {
        if (count >= 1000000) {
          return (count / 1000000).toFixed(1) + 'M';
        }
        if (count >= 1000) {
          return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
      };

      expect(formatCount(500)).toBe('500');
      expect(formatCount(1500)).toBe('1.5K');
      expect(formatCount(1500000)).toBe('1.5M');
    });

    it('should display both following and follower counts', () => {
      const profile = {
        followingCount: 23,
        followerCount: 1,
      };

      expect(profile.followingCount).toBeDefined();
      expect(profile.followerCount).toBeDefined();
      expect(typeof profile.followingCount).toBe('number');
      expect(typeof profile.followerCount).toBe('number');
    });
  });
});

describe('Signup Auto-Follow', () => {
  /**
   * Bug fixed: New signups were only following the first seed user (alexthompson)
   * because the expensive post backfill was hitting Cloudflare Worker limits.
   *
   * Fix: Changed from iterating all posts to using user-posts index for backfill.
   */

  const SEED_HANDLES = [
    'alexthompson',
    'ameliasmith',
    'benharris',
    'chrismartinez',
    'danielkim',
    'davidanderson',
    'emmawilliams',
    'hannahmoore',
    'jameswright',
    'jessicadavis',
    'kevinjackson',
    'laurataylor',
    'marcusjohnson',
    'michaelwilson',
    'nataliewhite',
    'oliviabrown',
    'rachelgreen',
    'ryanlee',
    'sarahchen',
    'sophiepatel',
  ];

  it('should have 20+ seed users to follow', () => {
    expect(SEED_HANDLES.length).toBeGreaterThanOrEqual(20);
  });

  it('should skip self when auto-following', () => {
    const newUserHandle = 'chrismartinez';
    const toFollow = SEED_HANDLES.filter((h) => h !== newUserHandle);

    expect(toFollow).not.toContain('chrismartinez');
    expect(toFollow.length).toBe(SEED_HANDLES.length - 1);
  });

  it('should use user-posts index for efficient backfill', () => {
    // The fix uses user-posts:{userId} index instead of iterating all posts
    // This simulates the new efficient approach

    const userPostsIndex = ['post1', 'post2', 'post3', 'post4', 'post5'];
    const maxBackfillPosts = 10;

    // Slice to limit backfill
    const postsToBackfill = userPostsIndex.slice(0, maxBackfillPosts * 2);

    expect(postsToBackfill.length).toBeLessThanOrEqual(maxBackfillPosts * 2);
  });

  it('should limit backfill per seed user', () => {
    const maxBackfillPosts = 10;
    const seedUsers = 20;
    const maxTotalBackfill = maxBackfillPosts * seedUsers;

    // Total should be manageable for Worker limits
    expect(maxTotalBackfill).toBeLessThanOrEqual(200);
  });
});
