/**
 * Search handlers for The Wire
 *
 * Implements X.com-style search with:
 * - People search (prefix matching on handle and display name)
 * - Post search (inverted index with HN-style relevance ranking)
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import type { PostMetadata } from "../types/post";
import type { UserProfile } from "../types/user";
import { optionalAuth } from "../middleware/auth";
import { LIMITS, SCORING } from "../constants";
import { searchPostIds, searchUserIds, tokenize } from "../utils/search-index";
import { batchKVGet } from "../utils/batch";

const search = new Hono<{ Bindings: Env }>();

interface UserSearchResult {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  isFollowing?: boolean;
  relevanceScore: number;
}

interface PostSearchResult extends PostMetadata {
  relevanceScore: number;
  hasLiked?: boolean;
  hasReposted?: boolean;
}

interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    type: string;
    people?: UserSearchResult[];
    posts?: PostSearchResult[];
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * GET /api/search - Search for posts and users
 *
 * Query params:
 * - q: search query (required, 2-280 chars)
 * - type: 'top' | 'people' (default: 'top')
 * - cursor: pagination cursor
 * - limit: results per page (default: 20, max: 50)
 */
search.get("/", optionalAuth, async (c) => {
  const query = c.req.query("q")?.trim();
  const type = c.req.query("type") || "top";
  const cursor = c.req.query("cursor");
  const limit = Math.min(
    parseInt(c.req.query("limit") || "20", 10),
    LIMITS.MAX_PAGINATION_LIMIT,
  );

  // Validate query
  if (!query || query.length < 2) {
    return c.json(
      {
        success: false,
        error: "Search query must be at least 2 characters",
      },
      400,
    );
  }

  if (query.length > LIMITS.MAX_NOTE_LENGTH) {
    return c.json(
      {
        success: false,
        error: `Search query cannot exceed ${LIMITS.MAX_NOTE_LENGTH} characters`,
      },
      400,
    );
  }

  const userId = c.get("userId");

  try {
    // Get blocked users if authenticated
    let blockedUserIds: string[] = [];
    if (userId) {
      const userDoId = c.env.USER_DO.idFromName(userId);
      const userStub = c.env.USER_DO.get(userDoId);
      const blockedResp = await userStub.fetch("https://do.internal/blocked");
      const blockedData = (await blockedResp.json()) as { blocked: string[] };
      blockedUserIds = blockedData.blocked || [];
    }

    const response: SearchResponse = {
      success: true,
      data: {
        query,
        type,
        cursor: null,
        hasMore: false,
      },
    };

    if (type === "people") {
      // People-only search
      const people = await searchUsers(
        c.env,
        query,
        userId,
        blockedUserIds,
        limit,
      );
      response.data.people = people;
    } else if (type === "posts") {
      // Posts-only search
      const posts = await searchPosts(
        c.env,
        query,
        userId,
        blockedUserIds,
        limit,
        cursor,
      );
      response.data.posts = posts.posts;
      response.data.cursor = posts.cursor;
      response.data.hasMore = posts.hasMore;
    } else {
      // Top search (default): people at top + posts
      const [people, posts] = await Promise.all([
        searchUsers(c.env, query, userId, blockedUserIds, 5), // Max 5 people at top
        searchPosts(c.env, query, userId, blockedUserIds, limit, cursor),
      ]);

      response.data.people = people;
      response.data.posts = posts.posts;
      response.data.cursor = posts.cursor;
      response.data.hasMore = posts.hasMore;
    }

    return c.json(response);
  } catch (error) {
    console.error("Search error:", error);
    return c.json(
      {
        success: false,
        error: "Search failed",
      },
      500,
    );
  }
});

/**
 * Search for users by handle or display name
 * OPTIMIZED: Uses KV cache for profiles, gets following list once
 */
async function searchUsers(
  env: Env,
  query: string,
  currentUserId: string | undefined,
  blockedUserIds: string[],
  limit: number,
): Promise<UserSearchResult[]> {
  const userIds = await searchUserIds(env, query);
  if (userIds.length === 0) return [];

  const blockedSet = new Set(blockedUserIds);
  const queryLower = query.toLowerCase();

  // Get current user's following list once (if authenticated)
  let followingSet: Set<string> = new Set();
  if (currentUserId) {
    try {
      const currentUserDoId = env.USER_DO.idFromName(currentUserId);
      const currentUserStub = env.USER_DO.get(currentUserDoId);
      const followingResp = await currentUserStub.fetch(
        "https://do.internal/following",
      );
      const followingData = (await followingResp.json()) as {
        following: string[];
      };
      followingSet = new Set(followingData.following || []);
    } catch {
      // Ignore errors, proceed without following info
    }
  }

  const idsToFetch = userIds
    .filter((id) => !blockedSet.has(id))
    .slice(0, limit * 2);

  const userKeys = idsToFetch.map((id) => `user:${id}`);
  const userDataMap = await batchKVGet<{ handle: string }>(
    env,
    userKeys,
    "USERS_KV",
    {
      parse: (val) => (val ? JSON.parse(val) : null),
    },
  );

  const idToHandle = new Map<string, string>();
  const handles: string[] = [];
  for (const id of idsToFetch) {
    const userData = userDataMap.get(`user:${id}`);
    if (userData?.handle) {
      idToHandle.set(id, userData.handle);
      handles.push(userData.handle);
    }
  }

  const profileKeys = handles.map((h) => `profile:${h}`);
  const profileMap = await batchKVGet<UserProfile>(
    env,
    profileKeys,
    "USERS_KV",
    {
      parse: (val) => (val ? JSON.parse(val) : null),
    },
  );

  const profiles: UserSearchResult[] = [];
  for (const id of idsToFetch) {
    if (profiles.length >= limit) break;

    const handle = idToHandle.get(id);
    if (!handle) continue;

    const profile = profileMap.get(`profile:${handle}`);
    if (!profile || profile.isBanned) continue;

    const score = calculateUserRelevance(profile, queryLower);
    const isFollowing =
      currentUserId && currentUserId !== id ? followingSet.has(id) : undefined;

    profiles.push({
      id,
      handle: profile.handle,
      displayName: profile.displayName || profile.handle,
      bio: profile.bio || "",
      avatarUrl: profile.avatarUrl || "",
      followerCount: profile.followerCount || 0,
      ...(isFollowing !== undefined && { isFollowing }),
      relevanceScore: score,
    });
  }

  profiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return profiles.slice(0, limit);
}

/**
 * Calculate user relevance score for a query
 */
function calculateUserRelevance(profile: UserProfile, query: string): number {
  let score = 0;
  const handleLower = profile.handle.toLowerCase();
  const displayLower = (profile.displayName || "").toLowerCase();

  // Exact handle match
  if (handleLower === query) score += 1000;
  // Handle starts with query
  else if (handleLower.startsWith(query)) score += 500;
  // Handle contains query
  else if (handleLower.includes(query)) score += 100;

  // Same for display name
  if (displayLower === query) score += 800;
  else if (displayLower.startsWith(query)) score += 400;
  else if (displayLower.includes(query)) score += 80;

  // Follower count bonus (logarithmic)
  score += Math.log10((profile.followerCount || 0) + 1) * 10;

  return score;
}

/**
 * Search for posts matching a query
 * OPTIMIZED: Skips hasLiked/hasReposted checks to avoid subrequest limits
 */
async function searchPosts(
  env: Env,
  query: string,
  _currentUserId: string | undefined,
  blockedUserIds: string[],
  limit: number,
  cursor?: string,
): Promise<{
  posts: PostSearchResult[];
  cursor: string | null;
  hasMore: boolean;
}> {
  const postIds = await searchPostIds(env, query);
  if (postIds.length === 0) {
    return { posts: [], cursor: null, hasMore: false };
  }

  const blockedSet = new Set(blockedUserIds);
  const queryWords = tokenize(query);

  // Parse cursor for pagination
  let offset = 0;
  if (cursor) {
    try {
      offset = parseInt(atob(cursor), 10);
    } catch {
      offset = 0;
    }
  }

  const postIdsToFetch = postIds.slice(offset, offset + limit * 2);

  const kvKeys = postIdsToFetch.map((id) => `post:${id}`);
  const postMap = await batchKVGet<PostMetadata>(env, kvKeys, "POSTS_KV", {
    parse: (val) => (val ? JSON.parse(val) : null),
  });

  const posts: PostSearchResult[] = [];
  for (const postId of postIdsToFetch) {
    if (posts.length >= limit) break;

    const post = postMap.get(`post:${postId}`);
    if (!post) continue;

    if (post.isDeleted || post.isTakenDown || blockedSet.has(post.authorId)) {
      continue;
    }

    const relevanceScore = calculatePostRelevance(post, queryWords);

    posts.push({
      ...post,
      relevanceScore,
      hasLiked: false,
      hasReposted: false,
    });
  }

  posts.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Apply pagination
  const paginatedPosts = posts.slice(0, limit);
  const hasMore = postIds.length > offset + limit;
  const nextCursor = hasMore ? btoa(String(offset + limit)) : null;

  return {
    posts: paginatedPosts,
    cursor: nextCursor,
    hasMore,
  };
}

/**
 * Calculate post relevance score using HN formula + term frequency
 */
function calculatePostRelevance(
  post: PostMetadata,
  queryWords: string[],
): number {
  const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
  const LN2 = Math.log(2);
  const recency = Math.exp((-LN2 * ageHours) / SCORING.RECENCY_HALF_LIFE_HOURS);
  const engagement =
    (post.likeCount || 0) * SCORING.LIKE_WEIGHT +
    (post.replyCount || 0) * SCORING.REPLY_WEIGHT +
    (post.repostCount || 0) * SCORING.REPOST_WEIGHT;
  const engScore = Math.log1p(engagement);
  const engDecay = Math.exp(
    (-LN2 * ageHours) / SCORING.ENGAGEMENT_HALF_LIFE_HOURS,
  );
  const baseScore =
    SCORING.RECENCY_WEIGHT * recency +
    SCORING.ENGAGEMENT_WEIGHT * engScore * engDecay;

  const contentLower = post.content.toLowerCase();
  let termFrequency = 0;
  for (const word of queryWords) {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = contentLower.match(regex);
    termFrequency += matches ? matches.length : 0;
  }

  return baseScore + termFrequency * 5;
}

export default search;
