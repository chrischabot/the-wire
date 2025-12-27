/**
 * Feed handlers for The Wire
 *
 * Implements the feed algorithm:
 * - Round-robin merge: 2 posts from followed users + 1 FoF post
 * - Friends-of-friends posts ranked using Hacker News scoring
 * - Filtering for blocked users and muted words
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import type { PostMetadata } from "../types/post";
import type { MutedWordEntry } from "../types/user";
import { requireAuth } from "../middleware/auth";
import { getFoFRankedPosts } from "./scheduled";
import { LIMITS, BATCH_SIZE, SCORING } from "../constants";
import { safeJsonParse, safeAtob } from "../utils/safe-parse";
import { success, serverError } from "../utils/response";

const feed = new Hono<{ Bindings: Env }>();

interface FeedPost extends PostMetadata {
  source: "own" | "follow" | "fof";
  hasLiked?: boolean;
  hasReposted?: boolean;
}

/**
 * GET /api/feed/home - Get user's home timeline
 *
 * Algorithm: Round-robin merge
 * - 2 posts from followed users (chronological)
 * - 1 post from friends-of-friends (ranked by HN score)
 * - Repeat pattern
 */
/**
 * OPTIMIZED Home Feed - Low subrequest version
 *
 * Core subrequests:
 * 1. UserDO /context - blocked, settings, following in one call
 * 2. FeedDO /feed-with-posts - feed entries WITH full post data
 * 3. FEEDS_KV explore:ranked - explore posts with full data
 *
 * Optional batched KV backfill (limited) when author diversity is low.
 */
feed.get("/home", requireAuth, async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  try {
    // SINGLE CALL 1: Get all user context in one request
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    const contextResp = await userStub.fetch("https://do.internal/context");
    const context = (await contextResp.json()) as {
      blocked: string[];
      mutedWords: Array<string | MutedWordEntry>;
      following: string[];
    };

    const blockedSet = new Set(context.blocked || []);
    const mutedWords = context.mutedWords || [];
    const followingSet = new Set(context.following || []);
    const { all: mutedAll, notFollowing: mutedNotFollowing } =
      splitMutedWords(mutedWords);
    const mutedAllMatcher = buildMutedWordMatcher(mutedAll);
    const mutedNotFollowingMatcher = buildMutedWordMatcher(mutedNotFollowing);
    const isFollowingAuthor = (authorId: string) =>
      authorId === userId || followingSet.has(authorId);
    const isMutedContent = (content: string, authorId: string) => {
      if (!content) return false;
      if (mutedAllMatcher && mutedAllMatcher(content)) return true;
      if (!isFollowingAuthor(authorId) && mutedNotFollowingMatcher) {
        return mutedNotFollowingMatcher(content);
      }
      return false;
    };

    // SINGLE CALL 2: Get feed with full post data from FeedDO
    const feedDoId = c.env.FEED_DO.idFromName(userId);
    const feedStub = c.env.FEED_DO.get(feedDoId);
    const feedUrl = new URL("https://do.internal/feed-with-posts");
    if (cursor) feedUrl.searchParams.set("cursor", cursor);
    feedUrl.searchParams.set("limit", (limit * 3).toString());

    const feedResp = await feedStub.fetch(feedUrl.toString());
    const feedData = (await feedResp.json()) as {
      posts: Array<PostMetadata & { source: string }>;
      cursor: string | null;
      hasMore: boolean;
    };

    // Filter feed posts
    const followedPosts: FeedPost[] = [];
    const seenPostIds = new Set<string>();
    const seenOriginalIds = new Set<string>();
    const authorFrequency = new Map<string, number>();

    for (const post of feedData.posts || []) {
      if (blockedSet.has(post.authorId)) continue;
      if (post.isDeleted || post.isTakenDown) continue;

      const contentForFilter =
        post.content || post.originalPost?.content || "";
      if (contentForFilter && isMutedContent(contentForFilter, post.authorId)) {
        continue;
      }

      if (isLowValueRepost(post)) continue;
      if (post.repostOfId) {
        if (seenOriginalIds.has(post.repostOfId)) continue;
        seenOriginalIds.add(post.repostOfId);
      }

      followedPosts.push({
        ...post,
        source: post.source as "own" | "follow" | "fof",
        hasLiked: false,
        hasReposted: false,
      });
      seenPostIds.add(post.id);
      authorFrequency.set(
        post.authorId,
        (authorFrequency.get(post.authorId) || 0) + 1,
      );
    }

    // SINGLE CALL 3: Get explore posts from pre-computed cache
    const exploreData = await c.env.FEEDS_KV.get("explore:ranked");
    let explorePosts: FeedPost[] = [];

    if (exploreData) {
      const rawExplorePosts = safeJsonParse<PostMetadata[]>(exploreData);
      if (rawExplorePosts) {
        for (const post of rawExplorePosts) {
          if (explorePosts.length >= limit) break;
          if (seenPostIds.has(post.id)) continue;
          if (blockedSet.has(post.authorId)) continue;
          if (post.isDeleted || post.isTakenDown) continue;
          if (post.authorId === userId) continue;
          const contentForFilter =
            post.content || post.originalPost?.content || "";
          if (contentForFilter && isMutedContent(contentForFilter, post.authorId)) {
            continue;
          }
          if (isLowValueRepost(post)) continue;
          if (post.repostOfId) {
            if (seenOriginalIds.has(post.repostOfId)) continue;
            seenOriginalIds.add(post.repostOfId);
          }

          explorePosts.push({
            ...post,
            source: "fof" as const,
            hasLiked: false,
            hasReposted: false,
          });
          seenPostIds.add(post.id);
          authorFrequency.set(
            post.authorId,
            (authorFrequency.get(post.authorId) || 0) + 1,
          );
        }
      }
    }

    // Backfill: pull recent posts from underrepresented followees
    const uniqueAuthors = new Set(followedPosts.map((post) => post.authorId));
    const followeeIds = [...followingSet].filter(
      (id) => id !== userId && !blockedSet.has(id),
    );
    const targetUniqueAuthors = Math.min(
      followeeIds.length,
      Math.max(6, Math.floor(limit / 3)),
    );

    if (uniqueAuthors.size < targetUniqueAuthors && followeeIds.length > 0) {
      const missingAuthors = followeeIds.filter(
        (id) => !uniqueAuthors.has(id),
      );
      const maxBackfill = Math.min(
        8,
        targetUniqueAuthors - uniqueAuthors.size,
        missingAuthors.length,
      );

      if (maxBackfill > 0) {
        const backfillAuthors = missingAuthors.slice(0, maxBackfill);
        const backfillIndexes = await Promise.all(
          backfillAuthors.map((authorId) =>
            c.env.POSTS_KV.get(`user-posts:${authorId}`),
          ),
        );

        const backfillPostIds: Array<{ authorId: string; postId: string }> = [];
        for (let i = 0; i < backfillAuthors.length; i++) {
          const authorId = backfillAuthors[i]!;
          const indexData = backfillIndexes[i];
          if (!indexData) continue;
          const postIds = safeJsonParse<string[]>(indexData) || [];
          const postId = postIds.find((id) => !seenPostIds.has(id));
          if (!postId) continue;
          backfillPostIds.push({ authorId, postId });
        }

        const backfillPostsData = await Promise.all(
          backfillPostIds.map((item) =>
            c.env.POSTS_KV.get(`post:${item.postId}`),
          ),
        );

        for (let i = 0; i < backfillPostIds.length; i++) {
          const data = backfillPostsData[i];
          if (!data) continue;
          const post = safeJsonParse<PostMetadata>(data);
          if (!post) continue;
          if (post.isDeleted || post.isTakenDown) continue;
          if (blockedSet.has(post.authorId)) continue;

          const contentForFilter =
            post.content || post.originalPost?.content || "";
          if (contentForFilter && isMutedContent(contentForFilter, post.authorId)) {
            continue;
          }
          if (isLowValueRepost(post)) continue;
          if (post.repostOfId) {
            if (seenOriginalIds.has(post.repostOfId)) continue;
            seenOriginalIds.add(post.repostOfId);
          }
          if (seenPostIds.has(post.id)) continue;

          followedPosts.push({
            ...post,
            source: "follow" as const,
            hasLiked: false,
            hasReposted: false,
          });
          seenPostIds.add(post.id);
          uniqueAuthors.add(post.authorId);
          authorFrequency.set(
            post.authorId,
            (authorFrequency.get(post.authorId) || 0) + 1,
          );
        }
      }
    }

    const candidates = [...followedPosts, ...explorePosts];
    const now = Date.now();
    const scoredCandidates = candidates
      .map((post) => ({
        post,
        score: scoreFeedPost(post, authorFrequency, now),
      }))
      .sort((a, b) => b.score - a.score);

    const maxPerAuthorTotal = Math.max(
      2,
      Math.ceil(limit / Math.max(1, targetUniqueAuthors)),
    );
    const selectedPosts = selectDiversePosts(scoredCandidates, limit, {
      windowSize: 5,
      maxPerAuthorInWindow: 1,
      maxPerAuthorTotal,
    });

    return success({
      posts: selectedPosts,
      cursor: feedData.cursor,
      hasMore: feedData.hasMore || explorePosts.length > 0,
    });
  } catch (error) {
    console.error("Error fetching home feed:", error);
    return serverError("Error fetching feed");
  }
});

/**
 * Score feed posts for ranking
 */
function scoreFeedPost(
  post: FeedPost,
  authorFrequency: Map<string, number>,
  now: number,
): number {
  const ageHours = Math.max(0, (now - post.createdAt) / (1000 * 60 * 60));
  const engagement =
    (post.likeCount || 0) * SCORING.LIKE_WEIGHT +
    (post.replyCount || 0) * SCORING.REPLY_WEIGHT +
    (post.repostCount || 0) * SCORING.REPOST_WEIGHT +
    (post.quoteCount || 0) * SCORING.REPOST_WEIGHT;

  const hnScore =
    engagement /
    Math.pow(ageHours + SCORING.HN_BASE_OFFSET, SCORING.HN_AGING_EXPONENT);
  const engagementScore = Math.log10(engagement + 1);
  const recencyScore = 1 / (1 + ageHours / 8);

  const sourceBoost =
    post.source === "own" ? 0.2 : post.source === "follow" ? 0.1 : 0;
  const emptyRepostPenalty =
    post.repostOfId && !post.content?.trim() ? 0.4 : 0;

  const frequency = authorFrequency.get(post.authorId) || 1;
  const frequencyPenalty = Math.min(0.6, (frequency - 1) * 0.05);

  return (
    hnScore * 4 +
    engagementScore * 2 +
    recencyScore +
    sourceBoost -
    emptyRepostPenalty -
    frequencyPenalty
  );
}

/**
 * Enforce author diversity and total caps on ranked posts
 */
function selectDiversePosts(
  scoredPosts: Array<{ post: FeedPost; score: number }>,
  limit: number,
  options: {
    windowSize: number;
    maxPerAuthorInWindow: number;
    maxPerAuthorTotal: number;
  },
): FeedPost[] {
  const result: Array<{ post: FeedPost; score: number }> = [];
  const skipped: Array<{ post: FeedPost; score: number }> = [];
  const totalCounts = new Map<string, number>();
  const recentAuthors: string[] = [];
  const recentCounts = new Map<string, number>();

  for (const item of scoredPosts) {
    if (result.length >= limit) break;
    const authorId = item.post.authorId;
    const total = totalCounts.get(authorId) || 0;
    const recent = recentCounts.get(authorId) || 0;

    if (total >= options.maxPerAuthorTotal || recent >= options.maxPerAuthorInWindow) {
      skipped.push(item);
      continue;
    }

    result.push(item);
    totalCounts.set(authorId, total + 1);

    recentAuthors.push(authorId);
    recentCounts.set(authorId, recent + 1);
    if (recentAuthors.length > options.windowSize) {
      const removed = recentAuthors.shift();
      if (removed) {
        const count = recentCounts.get(removed) || 0;
        if (count <= 1) recentCounts.delete(removed);
        else recentCounts.set(removed, count - 1);
      }
    }
  }

  if (result.length < limit) {
    for (const item of skipped) {
      if (result.length >= limit) break;
      const authorId = item.post.authorId;
      const total = totalCounts.get(authorId) || 0;
      if (total >= options.maxPerAuthorTotal * 2) continue;
      result.push(item);
      totalCounts.set(authorId, total + 1);
    }
  }

  return result.map((item) => item.post);
}

/**
 * Build a single muted-words matcher for fast checks
 */
function splitMutedWords(
  mutedWords: Array<string | MutedWordEntry>,
): { all: string[]; notFollowing: string[] } {
  const all = new Set<string>();
  const notFollowing = new Set<string>();
  const now = Date.now();

  for (const entry of mutedWords) {
    if (typeof entry === "string") {
      const word = entry.trim().toLowerCase();
      if (word) all.add(word);
      continue;
    }

    if (!entry || typeof entry !== "object") continue;
    const word = String(entry.word || "").trim().toLowerCase();
    if (!word) continue;
    if (entry.expiresAt && entry.expiresAt <= now) continue;
    if (entry.scope === "not_following") {
      notFollowing.add(word);
    } else {
      all.add(word);
    }
  }

  return { all: [...all], notFollowing: [...notFollowing] };
}

function buildMutedWordMatcher(
  mutedWords: string[],
): ((content: string) => boolean) | null {
  if (!mutedWords.length) return null;
  const escaped = mutedWords
    .map((word) => escapeRegex(word.trim().toLowerCase()))
    .filter((word) => word.length > 0);
  if (escaped.length === 0) return null;
  const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  return (content: string) => regex.test(content);
}

/**
 * Skip empty reposts with zero engagement
 */
function isLowValueRepost(post: PostMetadata): boolean {
  if (!post.repostOfId) return false;
  if ((post.content || "").trim().length > 0) return false;
  const engagement =
    (post.likeCount || 0) +
    (post.replyCount || 0) +
    (post.repostCount || 0) +
    (post.quoteCount || 0);
  return engagement === 0;
}

/**
 * LEGACY: Complex home feed with fallbacks (kept for reference)
 * This version makes many subrequests and will hit limits
 */
feed.get("/home-legacy", requireAuth, async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  try {
    // Get user's blocked list, muted words, and following list
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);

    const [blockedResp, settingsResp, followingResp] = await Promise.all([
      userStub.fetch("https://do.internal/blocked"),
      userStub.fetch("https://do.internal/settings"),
      userStub.fetch("https://do.internal/following"),
    ]);

    const blockedData = (await blockedResp.json()) as { blocked: string[] };
    const settingsData = (await settingsResp.json()) as {
      mutedWords: Array<string | MutedWordEntry>;
    };
    const followingData = (await followingResp.json()) as {
      following: string[];
    };

    const blockedUserIds = blockedData.blocked || [];
    const { all: mutedAll, notFollowing: mutedNotFollowing } =
      splitMutedWords(settingsData.mutedWords || []);
    const followingIds = followingData.following || [];

    // Get feed entries from FeedDO (posts from followed users)
    const feedDoId = c.env.FEED_DO.idFromName(userId);
    const feedStub = c.env.FEED_DO.get(feedDoId);

    const feedUrl = new URL("https://do.internal/feed");
    if (cursor) feedUrl.searchParams.set("cursor", cursor);
    // Request more entries to account for round-robin merge
    feedUrl.searchParams.set("limit", (limit * 2).toString());
    if (blockedUserIds.length > 0) {
      feedUrl.searchParams.set("blocked", JSON.stringify(blockedUserIds));
    }
    if (mutedAll.length > 0) {
      feedUrl.searchParams.set("muted", JSON.stringify(mutedAll));
    }

    const feedResp = await feedStub.fetch(feedUrl.toString());
    const feedData = (await feedResp.json()) as {
      entries: Array<{
        postId: string;
        authorId: string;
        timestamp: number;
        source: string;
      }>;
      cursor: string | null;
      hasMore: boolean;
    };

    // Get FoF ranked posts
    const fofPosts = await getFoFRankedPosts(
      c.env,
      userId,
      followingIds,
      Math.ceil(limit / 3) + 5,
    );

    // Filter FoF posts for muted words
    const filteredFofPosts = await filterPostsForMutedWords(
      c.env,
      fofPosts,
      mutedAll.concat(mutedNotFollowing),
    );

    // Fetch full post metadata for followed user entries
    const followedPosts: FeedPost[] = [];
    const seenPostIds = new Set<string>();
    let followSourceCount = 0; // Track how many are actually from followed users

    for (const entry of feedData.entries) {
      const postData = await c.env.POSTS_KV.get(`post:${entry.postId}`);
      if (postData) {
        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) continue;
        if (!post.isDeleted && !post.isTakenDown) {
          const source = entry.source === "own" ? "own" : "follow";
          followedPosts.push({
            ...post,
            source,
          });
          seenPostIds.add(post.id);
          if (source === "follow") followSourceCount++;
        }
      }
    }

    // ALWAYS fetch posts from followed users directly if we don't have enough "follow" source posts
    // This is the key fix: trigger fallback based on FOLLOW posts, not total entries
    const needMoreFollowedContent = followSourceCount < limit;
    const usersWithoutIndex: string[] = [];

    if (needMoreFollowedContent && followingIds.length > 0) {
      const maxPostsPerUser = Math.ceil((limit * 3) / followingIds.length);

      // First try: Fetch posts from each followed user using their user-posts index
      const userPostPromises = followingIds
        .slice(0, 30)
        .map(async (followedUserId) => {
          if (blockedUserIds.includes(followedUserId)) return [];

          const userPostsIndex = await c.env.POSTS_KV.get(
            `user-posts:${followedUserId}`,
          );
          if (!userPostsIndex) {
            usersWithoutIndex.push(followedUserId);
            return [];
          }

          const postIds = safeJsonParse<string[]>(userPostsIndex);
          if (!postIds) return [];
          const posts: FeedPost[] = [];

          for (const postId of postIds.slice(0, maxPostsPerUser)) {
            if (seenPostIds.has(postId)) continue;

            const postData = await c.env.POSTS_KV.get(`post:${postId}`);
            if (!postData) continue;

            const post = safeJsonParse<PostMetadata>(postData);
            if (!post) continue;
            if (post.isDeleted || post.isTakenDown) continue;

            posts.push({
              ...post,
              source: "follow" as const,
            });
            seenPostIds.add(postId);
          }

          return posts;
        });

      const allUserPosts = await Promise.all(userPostPromises);
      for (const userPosts of allUserPosts) {
        followedPosts.push(...userPosts);
      }
    }

    // Second fallback: If still need more content OR posts lack author diversity, scan posts directly
    // This ensures we get posts from followed users even when indexes are missing or backfill is incomplete
    const followAuthors = new Set(
      followedPosts.filter((p) => p.source === "follow").map((p) => p.authorId),
    );
    const needMoreDiversity =
      followAuthors.size < Math.min(3, followingIds.length);
    const needMoreFollowContent =
      followedPosts.filter((p) => p.source === "follow").length < limit / 2;

    if (
      (needMoreDiversity || needMoreFollowContent) &&
      followingIds.length > 0
    ) {
      const followingSet = new Set(followingIds);
      let postCursor: string | undefined;
      let scannedBatches = 0;
      const maxBatches = 20; // Increased to cover more posts when diversity is needed

      while (followedPosts.length < limit * 2 && scannedBatches < maxBatches) {
        const listResult = await c.env.POSTS_KV.list({
          prefix: "post:",
          limit: BATCH_SIZE.KV_LIST,
          ...(postCursor ? { cursor: postCursor } : {}),
        });
        scannedBatches++;

        for (const key of listResult.keys) {
          if (followedPosts.length >= limit * 3) break;

          const postData = await c.env.POSTS_KV.get(key.name);
          if (!postData) continue;

          const post = safeJsonParse<PostMetadata>(postData);
          if (!post) continue;

          // Include posts from followed users that aren't already seen
          if (
            followingSet.has(post.authorId) &&
            !post.isDeleted &&
            !post.isTakenDown &&
            !seenPostIds.has(post.id) &&
            !blockedUserIds.includes(post.authorId)
          ) {
            followedPosts.push({
              ...post,
              source: post.authorId === userId ? "own" : "follow",
            });
            seenPostIds.add(post.id);
          }
        }

        if (listResult.list_complete) break;
        postCursor = listResult.cursor;
      }
    }

    // Score followed posts using HN algorithm
    const scoredFollowed = followedPosts.map((post) => ({
      post,
      score: calculateHNScore(post),
    }));
    scoredFollowed.sort((a, b) => b.score - a.score);

    // Enforce strict author diversity: max 2 posts per author total
    const authorCounts = new Map<string, number>();
    const diverseFollowed: FeedPost[] = [];
    for (const { post } of scoredFollowed) {
      const count = authorCounts.get(post.authorId) || 0;
      if (count < 2) {
        diverseFollowed.push(post);
        authorCounts.set(post.authorId, count + 1);
      }
    }

    // Fetch full post metadata for FoF posts
    const fofPostsWithMeta: FeedPost[] = [];
    for (const fofPost of filteredFofPosts) {
      const postData = await c.env.POSTS_KV.get(`post:${fofPost.postId}`);
      if (postData) {
        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) continue;
        fofPostsWithMeta.push({
          ...post,
          source: "fof",
        });
      }
    }

    // Get explore content to ensure interesting posts always appear
    const exploreData = await c.env.FEEDS_KV.get("explore:ranked");
    let explorePosts: FeedPost[] = [];
    const followedPostIds = new Set(diverseFollowed.map((p) => p.id));
    const blockedSet = new Set(blockedUserIds);
    const followingSet = new Set(followingIds);

    if (exploreData) {
      const rawExplorePosts = safeJsonParse<PostMetadata[]>(exploreData);
      if (rawExplorePosts) {
        for (const post of rawExplorePosts) {
          if (explorePosts.length >= limit) break;
          if (followedPostIds.has(post.id)) continue;
          if (blockedSet.has(post.authorId)) continue;
          if (post.isDeleted || post.isTakenDown) continue;
          // Skip posts from the user themselves
          if (post.authorId === userId) continue;
          explorePosts.push({ ...post, source: "fof" as const });
        }
      }
    }

    // FALLBACK: If explore cache is empty, fetch posts on-demand for variety
    // This ensures the home feed always has interesting content even when cache isn't built
    if (explorePosts.length === 0 && fofPostsWithMeta.length === 0) {
      let postCursor: string | undefined;
      let scannedBatches = 0;
      const maxBatches = 10;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      while (explorePosts.length < limit && scannedBatches < maxBatches) {
        const listResult = await c.env.POSTS_KV.list({
          prefix: "post:",
          limit: BATCH_SIZE.KV_LIST,
          ...(postCursor ? { cursor: postCursor } : {}),
        });
        scannedBatches++;

        for (const key of listResult.keys) {
          if (explorePosts.length >= limit * 2) break;

          const postData = await c.env.POSTS_KV.get(key.name);
          if (!postData) continue;

          const post = safeJsonParse<PostMetadata>(postData);
          if (!post) continue;
          // Skip own posts, followed users' posts (those go in followed section), blocked, deleted, old
          if (post.authorId === userId) continue;
          if (followingSet.has(post.authorId)) continue;
          if (blockedSet.has(post.authorId)) continue;
          if (post.isDeleted || post.isTakenDown) continue;
          if (post.createdAt < sevenDaysAgo) continue;
          if (followedPostIds.has(post.id)) continue;

          explorePosts.push({ ...post, source: "fof" as const });
        }

        if (listResult.list_complete) break;
        postCursor = listResult.cursor;
      }

      // Sort by engagement score for better content
      explorePosts.sort((a, b) => {
        const scoreA = a.likeCount * 2 + a.replyCount * 3 + a.repostCount * 2;
        const scoreB = b.likeCount * 2 + b.replyCount * 3 + b.repostCount * 2;
        return scoreB - scoreA;
      });
    }

    // Combine FoF posts with explore posts for variety
    const interestingPosts = [...fofPostsWithMeta];
    for (const post of explorePosts) {
      if (!interestingPosts.find((p) => p.id === post.id)) {
        interestingPosts.push(post);
      }
    }

    // Apply round-robin merge: 2 followed + 1 interesting (explore/fof)
    let mergedPosts = roundRobinMerge(diverseFollowed, interestingPosts, limit);

    // If still not enough posts, just add more interesting content
    if (mergedPosts.length < limit) {
      const mergedIds = new Set(mergedPosts.map((p) => p.id));
      for (const post of interestingPosts) {
        if (mergedPosts.length >= limit) break;
        if (!mergedIds.has(post.id)) {
          mergedPosts.push(post);
          mergedIds.add(post.id);
        }
      }
    }

    // Check if user has liked/reposted each post, and refresh original post data for reposts
    // OPTIMIZED: Limit interaction checks to first 10 posts to stay under subrequest limits
    const maxInteractionChecks = 10;
    const postsWithInteractionStatus = await Promise.all(
      mergedPosts.map(async (post, index) => {
        // For reposts, always fetch fresh original post data (just KV, no DO call)
        let enrichedPost: typeof post & { hasLiked: boolean; hasReposted: boolean } = {
          ...post,
          hasLiked: false,
          hasReposted: false,
        };

        if (post.repostOfId && post.originalPost) {
          const originalPostData = await c.env.POSTS_KV.get(
            `post:${post.repostOfId}`,
          );
          if (originalPostData) {
            const freshOriginal = safeJsonParse<PostMetadata>(originalPostData);
            if (freshOriginal) {
              enrichedPost.originalPost = {
                id: freshOriginal.id,
                authorHandle: freshOriginal.authorHandle,
                authorDisplayName: freshOriginal.authorDisplayName,
                authorAvatarUrl: freshOriginal.authorAvatarUrl,
                content: freshOriginal.content,
                mediaUrls: freshOriginal.mediaUrls,
                createdAt: freshOriginal.createdAt,
                likeCount: freshOriginal.likeCount,
                replyCount: freshOriginal.replyCount,
                repostCount: freshOriginal.repostCount,
              };
            }
          }
        }

        // Only check interaction status for first N posts to avoid subrequest limits
        if (index < maxInteractionChecks) {
          const postDoId = c.env.POST_DO.idFromName(post.id);
          const postStub = c.env.POST_DO.get(postDoId);
          try {
            const [likedResp, repostedResp] = await Promise.all([
              postStub.fetch(`https://do.internal/has-liked?userId=${userId}`),
              postStub.fetch(`https://do.internal/has-reposted?userId=${userId}`),
            ]);
            const likedData = (await likedResp.json()) as { hasLiked: boolean };
            const repostedData = (await repostedResp.json()) as {
              hasReposted: boolean;
            };
            enrichedPost.hasLiked = likedData.hasLiked;
            enrichedPost.hasReposted = repostedData.hasReposted;
          } catch (error) {
            console.error("Error checking interaction status:", error);
          }
        }

        return enrichedPost;
      }),
    );

    return success({
      posts: postsWithInteractionStatus,
      cursor: feedData.cursor,
      hasMore: feedData.hasMore || filteredFofPosts.length > 0,
    });
  } catch (error) {
    console.error("Error fetching home feed:", error);
    return serverError("Error fetching feed");
  }
});

/**
 * Calculate Hacker News style score for a post
 */
function calculateHNScore(post: PostMetadata): number {
  const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
  const points =
    post.likeCount * SCORING.LIKE_WEIGHT +
    post.replyCount * SCORING.REPLY_WEIGHT +
    post.repostCount * SCORING.REPOST_WEIGHT;
  return (
    points /
    Math.pow(ageHours + SCORING.HN_BASE_OFFSET, SCORING.HN_AGING_EXPONENT)
  );
}

/**
 * Apply author diversity to prevent clusters of posts from the same authors
 * Uses a sliding window approach: no more than 2 posts from the same author in any 5-post window
 */
function applyAuthorDiversity(posts: PostMetadata[]): PostMetadata[] {
  const result: PostMetadata[] = [];
  const pending: PostMetadata[] = [...posts];
  const windowSize = 5;
  const maxPerAuthorInWindow = 2;

  while (pending.length > 0 && result.length < posts.length) {
    let added = false;

    for (let i = 0; i < pending.length; i++) {
      const post = pending[i]!;

      // Count this author's posts in the last windowSize posts
      const windowStart = Math.max(0, result.length - windowSize + 1);
      const window = result.slice(windowStart);
      const authorCountInWindow = window.filter(
        (p) => p.authorId === post.authorId,
      ).length;

      if (authorCountInWindow < maxPerAuthorInWindow) {
        result.push(post);
        pending.splice(i, 1);
        added = true;
        break;
      }
    }

    // If no post could be added (all violate diversity), just add the first one
    if (!added && pending.length > 0) {
      result.push(pending.shift()!);
    }
  }

  return result;
}

/**
 * GET /api/feed/global - Get global public feed for exploration
 * Reads from pre-computed rankings cache for fast response
 * Falls back to on-demand computation if cache is empty
 */
feed.get("/global", async (c) => {
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );
  const cursor = c.req.query("cursor");

  // Optional authentication - get user ID if available
  let blockedUserIds: string[] = [];

  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const { verifyToken } = await import("../utils/jwt");
      const { getJwtSecret } = await import("../middleware/auth");
      const secret = getJwtSecret(c.env);
      const payload = await verifyToken(token, secret);

      if (payload) {
        const userId = payload.sub;
        const userDoId = c.env.USER_DO.idFromName(userId);
        const userStub = c.env.USER_DO.get(userDoId);
        const blockedResp = await userStub.fetch("https://do.internal/blocked");
        const blockedData = (await blockedResp.json()) as { blocked: string[] };
        blockedUserIds = blockedData.blocked || [];
      }
    } catch {
      // Invalid token, proceed as unauthenticated
    }
  }

  try {
    // Decode cursor (offset-based pagination)
    let offset = 0;
    if (cursor) {
      try {
        const decoded = safeAtob(cursor);
        if (decoded) {
          offset = parseInt(decoded, 10) || 0;
        }
      } catch {
        offset = 0;
      }
    }

    // Try to get pre-computed rankings from cache
    const cachedData = await c.env.FEEDS_KV.get("explore:ranked");

    if (cachedData) {
      // Fast path: use cached full post data (no additional fetches needed)
      const parsedPosts = safeJsonParse<PostMetadata[]>(cachedData);
      if (!parsedPosts) {
        return serverError("Error parsing cached data");
      }
      let cachedPosts = parsedPosts;

      // Filter out blocked users and deleted posts
      if (blockedUserIds.length > 0) {
        const blockedSet = new Set(blockedUserIds);
        cachedPosts = cachedPosts.filter((p) => !blockedSet.has(p.authorId));
      }
      cachedPosts = cachedPosts.filter((p) => !p.isDeleted && !p.isTakenDown);

      // Paginate
      const paginatedPosts = cachedPosts.slice(offset, offset + limit);
      const hasMore = offset + limit < cachedPosts.length;
      const nextCursor = hasMore ? btoa(String(offset + limit)) : null;

      return success({
        posts: paginatedPosts,
        cursor: nextCursor,
        hasMore,
      });
    }

    // Fallback: compute on-demand (cache miss or first deploy)
    const allPosts: PostMetadata[] = [];
    let postCursor: string | undefined;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    while (allPosts.length < 200) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: "post:",
        limit: BATCH_SIZE.KV_LIST,
        ...(postCursor ? { cursor: postCursor } : {}),
      });

      for (const key of listResult.keys) {
        const postData = await c.env.POSTS_KV.get(key.name);
        if (!postData) continue;

        const post = safeJsonParse<PostMetadata>(postData);
        if (!post) continue;
        if (post.isDeleted || post.isTakenDown) continue;
        if (blockedUserIds.length > 0 && blockedUserIds.includes(post.authorId))
          continue;
        if (post.createdAt < sevenDaysAgo) continue;

        allPosts.push(post);
      }

      if (listResult.list_complete) break;
      postCursor = listResult.cursor;
    }

    // Score, sort, and apply diversity
    const scoredPosts = allPosts.map((post) => ({
      post,
      score: calculateHNScore(post),
    }));
    scoredPosts.sort((a, b) => b.score - a.score);
    const diversePosts = applyAuthorDiversity(scoredPosts.map((sp) => sp.post));

    const paginatedPosts = diversePosts.slice(offset, offset + limit);
    const hasMore = offset + limit < diversePosts.length;
    const nextCursor = hasMore ? btoa(String(offset + limit)) : null;

    return success({
      posts: paginatedPosts,
      cursor: nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching global feed:", error);
    return serverError("Error fetching feed");
  }
});

/**
 * GET /api/feed/chronological - Get pure chronological feed (no FoF)
 * OPTIMIZED: Uses batched context endpoint and skips hasLiked/hasReposted checks
 */
feed.get("/chronological", requireAuth, async (c) => {
  const userId = c.get("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || String(LIMITS.DEFAULT_FEED_PAGE_SIZE), 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  try {
    // SINGLE CALL: Get all user context in one request
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    const contextResp = await userStub.fetch("https://do.internal/context");
    const context = (await contextResp.json()) as {
      blocked: string[];
      mutedWords: Array<string | MutedWordEntry>;
      following: string[];
    };

    const blockedUserIds = context.blocked || [];
    const { all: mutedAll } = splitMutedWords(context.mutedWords || []);
    const mutedMatcher = buildMutedWordMatcher(mutedAll);

    // SINGLE CALL: Get feed with full post data
    const feedDoId = c.env.FEED_DO.idFromName(userId);
    const feedStub = c.env.FEED_DO.get(feedDoId);

    const feedUrl = new URL("https://do.internal/feed-with-posts");
    if (cursor) feedUrl.searchParams.set("cursor", cursor);
    feedUrl.searchParams.set("limit", limit.toString());

    const feedResp = await feedStub.fetch(feedUrl.toString());
    const feedData = (await feedResp.json()) as {
      posts: Array<Record<string, unknown> & { source: string }>;
      cursor: string | null;
      hasMore: boolean;
    };

    // Filter and transform posts (no additional subrequests needed)
    const blockedSet = new Set(blockedUserIds);
    const posts = feedData.posts
      .filter((post) => !blockedSet.has(post.authorId as string))
      .filter((post) => {
        if (!mutedMatcher) return true;
        const content = (post.content as string || "").toLowerCase();
        return !mutedMatcher(content);
      })
      .slice(0, limit)
      .map((post) => ({
        ...post,
        hasLiked: false,
        hasReposted: false,
      }));

    return success({
      posts,
      cursor: feedData.cursor,
      hasMore: feedData.hasMore,
    });
  } catch (error) {
    console.error("Error fetching chronological feed:", error);
    return serverError("Error fetching feed");
  }
});

/**
 * Round-robin merge algorithm with author diversity
 * Pattern: 2 posts from followed users + 1 post from FoF
 * Ensures no more than 2 posts from same author in any 5-post window
 */
function roundRobinMerge(
  followedPosts: FeedPost[],
  fofPosts: FeedPost[],
  limit: number,
): FeedPost[] {
  const result: FeedPost[] = [];
  let followedIndex = 0;
  let fofIndex = 0;
  let cyclePosition = 0; // 0, 1 = followed, 2 = fof

  // Track recent authors for diversity
  const recentAuthors: string[] = [];
  const maxSameAuthor = 2; // Max posts from same author in window
  const windowSize = 5;

  while (result.length < limit) {
    let postToAdd: FeedPost | null = null;

    if (cyclePosition < 2) {
      // Try to add from followed posts
      if (followedIndex < followedPosts.length) {
        postToAdd = followedPosts[followedIndex]!;
        followedIndex++;
      } else if (fofIndex < fofPosts.length) {
        // No more followed posts, use FoF
        postToAdd = fofPosts[fofIndex]!;
        fofIndex++;
      } else {
        // No more posts at all
        break;
      }
    } else {
      // Try to add from FoF posts
      if (fofIndex < fofPosts.length) {
        postToAdd = fofPosts[fofIndex]!;
        fofIndex++;
      } else if (followedIndex < followedPosts.length) {
        // No more FoF posts, use followed
        postToAdd = followedPosts[followedIndex]!;
        followedIndex++;
      } else {
        // No more posts at all
        break;
      }
    }

    // Check author diversity before adding
    if (postToAdd) {
      const authorCount = recentAuthors.filter((a) => a === postToAdd.authorId)
        .length;
      if (authorCount >= maxSameAuthor) {
        // Skip this post to maintain diversity, but don't increment cycle
        // The post is already consumed (index incremented), so we continue
        continue;
      }

      // Add post and update tracking
      result.push(postToAdd);
      recentAuthors.push(postToAdd.authorId);
      if (recentAuthors.length > windowSize) {
        recentAuthors.shift();
      }
    }

    cyclePosition = (cyclePosition + 1) % 3;
  }

  return result;
}

/**
 * Helper to escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Helper function to check if content contains muted word as whole word
 */
function containsMutedWord(content: string, mutedWords: string[]): boolean {
  if (!content || !mutedWords.length) return false;
  const contentLower = content.toLowerCase();

  return mutedWords.some((word) => {
    const wordLower = word.toLowerCase();
    // Create regex with word boundaries to match whole words only
    const regex = new RegExp(`\\b${escapeRegex(wordLower)}\\b`, "i");
    return regex.test(contentLower);
  });
}

/**
 * Filter posts for muted words (using word boundary matching)
 */
async function filterPostsForMutedWords(
  env: Env,
  posts: Array<{ postId: string; score: number }>,
  mutedWords: string[],
): Promise<Array<{ postId: string; score: number }>> {
  if (mutedWords.length === 0) return posts;

  const filtered = await Promise.all(
    posts.map(async (post) => {
      const postData = await env.POSTS_KV.get(`post:${post.postId}`);
      if (!postData) return null;

      const postMeta = safeJsonParse<PostMetadata>(postData);
      if (!postMeta) return null;

      const hasMutedWord = containsMutedWord(postMeta.content, mutedWords);

      return hasMutedWord ? null : post;
    }),
  );

  return filtered.filter(
    (p): p is { postId: string; score: number } => p !== null,
  );
}

export default feed;
