# The Wire - Complete Codebase Guide

A Twitter clone built on Cloudflare Workers with Durable Objects, KV, R2, and a React SPA frontend.

## Quick Reference

```
npm run dev          # Start dev server on localhost:8080
npm run typecheck    # TypeScript validation
npm test             # Unit tests
npm run test:api     # API integration tests
```

---

## Architecture Overview

### The Stack

| Layer                     | Technology         | Purpose                                   |
| ------------------------- | ------------------ | ----------------------------------------- |
| **Runtime**               | Cloudflare Workers | Edge compute, HTTP routing                |
| **Framework**             | Hono               | Lightweight routing, middleware           |
| **State (Authoritative)** | Durable Objects    | User state, post interactions, feeds      |
| **Cache (Global)**        | KV Namespaces      | Profiles, posts, sessions, search indexes |
| **Media**                 | R2                 | Images, videos                            |
| **Async**                 | Queues             | Post fanout to follower feeds             |
| **AI Services**           | Claude API         | News processing, conversation generation  |
| **Auth**                  | Clerk + Legacy JWT | OAuth (Google/Apple) + email/password     |
| **Frontend**              | React + Vite       | SPA in `/web`                             |

### Data Flow Mental Model

```
User Request → Worker → KV (cache check) → Durable Object (authoritative) → Response
                           ↓
                    R2 (media files)
                           ↓
                    Queue (async fanout)
```

**Key insight**: KV is the read cache, DOs are the source of truth. Always write to DO first, then update KV cache.

---

## Cloudflare Primitives

### KV Namespaces

Global eventually-consistent key-value store. Fast reads (~1ms), slower writes (propagation delay).

| Namespace     | Purpose              | Key Patterns                                                            |
| ------------- | -------------------- | ----------------------------------------------------------------------- |
| `USERS_KV`    | User data            | `user:{userId}`, `handle:{handle}`, `profile:{handle}`, `email:{email}` |
| `POSTS_KV`    | Post data            | `post:{postId}`, `user-posts:{userId}`, `replies:{postId}`, `search:*`  |
| `SESSIONS_KV` | Auth & notifications | `session:{token}`, `notifications:{userId}:*`                           |
| `FEEDS_KV`    | Feed caches          | `feed:{userId}`, `explore:ranked`                                       |

**Critical KV Key Patterns**:

```typescript
// Users
`user:{userId}` // { id, email, handle, passwordHash, createdAt }
`handle:{handle}` // userId (lookup by handle)
`email:{email}` // userId (lookup by email)
`profile:{handle}` // Full UserProfile (cached from UserDO)
// Posts
`post:{postId}` // PostMetadata (full post data with author info)
`user-posts:{userId}` // string[] of postIds (author's post index)
`replies:{postId}` // string[] of reply postIds
// Search indexes
`search:handle:{prefix}` // string[] of userIds matching prefix
`search:word:{word}:{postId}`; // Post search index
```

### Durable Objects

Single-threaded, strongly consistent per-instance. Each user/post/feed has its own DO.

| DO            | ID Pattern           | Responsibilities                                                   |
| ------------- | -------------------- | ------------------------------------------------------------------ |
| `UserDO`      | `idFromName(userId)` | Profile, settings, following/followers, blocked users, liked posts |
| `PostDO`      | `idFromName(postId)` | Like/repost tracking, interaction counts                           |
| `FeedDO`      | `idFromName(userId)` | User's personalized feed entries                                   |
| `WebSocketDO` | `idFromName(userId)` | Real-time notification delivery                                    |

**DO Internal State** (stored in durable storage):

```typescript
// UserDO state
{
  profile: UserProfile,
  settings: UserSettings,
  following: Set<string>,      // userIds
  followers: Set<string>,      // userIds
  blocked: Set<string>,        // userIds
  likedPostsSet: Set<string>,  // postIds (O(1) lookup!)
  repostedPostsSet: Set<string>
}

// PostDO state
{
  post: Post,
  likesSet: Set<string>,       // userIds who liked
  repostsSet: Set<string>      // userIds who reposted
}

// FeedDO state
{
  entries: FeedEntry[]  // { postId, authorId, timestamp, source }
}
```

**Critical Pattern**: DOs use `Set<T>` internally for O(1) membership checks, but serialize to arrays for storage (JSON compatibility).

### R2 (Object Storage)

```typescript
// Upload
await env.MEDIA_BUCKET.put(key, file, { httpMetadata: { contentType } });

// Serve (via handler)
const object = await env.MEDIA_BUCKET.get(key);
return new Response(object.body, { headers: { "Content-Type": contentType } });
```

### Queues

Used for fanout when posting:

```typescript
// Producer (posts.ts)
await env.FANOUT_QUEUE.send({
  type: "new-post",
  postId,
  authorId,
  timestamp,
});

// Consumer (index.ts queue handler)
// Adds post to each follower's FeedDO
```

---

## File Structure

```
src/
├── index.ts                 # Worker entry, route mounting, queue consumer
├── constants.ts             # LIMITS, CACHE_TTL, SCORING, BATCH_SIZE, RETENTION
├── styles.ts                # Inline CSS for SSR pages
├── client-js.ts             # Client-side JavaScript for SSR pages
│
├── durable-objects/
│   ├── UserDO.ts           # User state, social graph, settings
│   ├── PostDO.ts           # Post interactions (likes, reposts)
│   ├── FeedDO.ts           # Per-user feed management
│   └── WebSocketDO.ts      # Real-time WebSocket connections
│
├── handlers/
│   ├── auth.ts             # Legacy signup, login, password reset (JWT)
│   ├── clerk-auth.ts       # Clerk OAuth integration (Google/Apple)
│   ├── users.ts            # Profile CRUD, follow/block
│   ├── posts.ts            # Create, like, repost, delete, thread/replies
│   ├── feed.ts             # Home feed, explore, chronological
│   ├── search.ts           # User and post search
│   ├── notifications.ts    # Notification list, mark read
│   ├── media.ts            # Upload/serve images and videos
│   ├── batch.ts            # Batch API endpoints
│   ├── admin.ts            # Admin dashboard, user/post management
│   ├── moderation.ts       # Ban, takedown
│   ├── seed.ts             # Dev seeding (basic AI-generated content)
│   ├── news-seed.ts        # AI News Seeder (RSS/HN → Claude → posts)
│   ├── scheduled.ts        # Cron jobs (ranking updates, cleanup)
│   └── unfurl.ts           # Link preview metadata extraction
│
├── middleware/
│   ├── auth.ts             # requireAuth, optionalAuth, requireAdmin
│   ├── clerk-auth.ts       # Clerk JWT validation middleware
│   ├── csrf.ts             # Origin validation
│   └── rate-limit.ts       # KV-based rate limiting
│
├── services/
│   ├── notifications.ts    # Notification CRUD helpers
│   ├── kv-client.ts        # KV helper utilities
│   ├── snowflake.ts        # Snowflake ID generation
│   ├── news-aggregator.ts  # Fetch AI/ML news from RSS feeds & HN
│   ├── story-processor.ts  # Claude-powered story analysis
│   └── conversation-generator.ts  # Generate posts & threads from stories
│
├── shared/                  # Shared utilities
│   ├── index.ts            # Barrel export
│   ├── utils.ts            # escapeHtml, formatTimeAgo, linkifyMentions
│   ├── post-renderer.ts    # Post card rendering
│   ├── sidebar-renderer.ts # Sidebar rendering
│   └── bottom-nav.ts       # Mobile bottom nav
│
├── types/
│   ├── env.ts              # Env interface with all bindings
│   ├── user.ts             # UserProfile, UserSettings, AuthUser
│   ├── post.ts             # Post, PostMetadata
│   ├── feed.ts             # FeedEntry, FanOutMessage
│   ├── notification.ts     # Notification types
│   └── news.ts             # NewsItem, ProcessedStory, PersonaProfile
│
└── utils/
    ├── batch.ts            # batchKVGet, batchInChunks, sanitizeIds
    ├── crypto.ts           # Password hashing (scrypt)
    ├── jwt.ts              # Token creation/verification
    ├── validation.ts       # Input validation helpers
    ├── response.ts         # success(), notFound(), serverError()
    ├── safe-parse.ts       # safeJsonParse, safeAtob
    ├── search-index.ts     # Tokenization, indexing
    └── logger.ts           # Structured logging (JSON/pretty modes)

web/                         # React SPA (Vite)
├── src/
│   ├── App.tsx             # Router setup
│   ├── main.tsx            # Entry point
│   ├── components/
│   │   ├── layout/         # AppLayout, Sidebar, BottomNav
│   │   ├── posts/          # PostCard, ComposeBox
│   │   └── users/          # UserCard, FollowButton
│   ├── pages/              # Route components
│   ├── lib/
│   │   ├── api.ts          # API client with typed methods
│   │   ├── queryClient.ts  # React Query setup
│   │   ├── websocket.ts    # WebSocket connection
│   │   └── useWebSocket.ts # WebSocket React hook
│   ├── stores/
│   │   ├── authStore.ts    # Zustand auth state
│   │   └── themeStore.ts   # Theme persistence
│   └── utils/
│       └── format.ts       # formatTimeAgo, linkifyContent
└── index.html
```

---

## Batching Patterns (Critical!)

### The N+1 Problem

**BAD** - Sequential reads in a loop:

```typescript
for (const id of userIds) {
  const user = await env.USERS_KV.get(`user:${id}`); // N requests!
}
```

**GOOD** - Batched parallel reads:

```typescript
import { batchKVGet } from "../utils/batch";

const keys = userIds.map((id) => `user:${id}`);
const userMap = await batchKVGet(env, keys, "USERS_KV", {
  parse: (val) => (val ? JSON.parse(val) : null),
});

for (const id of userIds) {
  const user = userMap.get(`user:${id}`);
}
```

### batchKVGet Usage

```typescript
// Signature
batchKVGet<T>(
  env: Env,
  keys: string[],
  namespace: 'USERS_KV' | 'POSTS_KV' | 'SESSIONS_KV' | 'FEEDS_KV',
  options?: { parse?: (val: string | null) => T | null }
): Promise<Map<string, T | null>>

// Example: Fetch multiple profiles
const handles = ['alice', 'bob', 'carol'];
const profileKeys = handles.map(h => `profile:${h}`);
const profileMap = await batchKVGet<UserProfile>(env, profileKeys, 'USERS_KV', {
  parse: (val) => val ? JSON.parse(val) : null
});
```

### Cloudflare Limits to Remember

| Limit                  | Value | Mitigation                        |
| ---------------------- | ----- | --------------------------------- |
| Concurrent subrequests | 6     | `batchKVGet` chunks automatically |
| Total subrequests      | 1000  | Paginate, limit batch sizes       |
| KV value size          | 25MB  | Chunk large data                  |
| DO request timeout     | 30s   | Keep operations fast              |

---

## Common Pitfalls & Fixes

### 1. Profile Key Mismatch

**Bug**: Search index stores `userId`, but profiles are keyed by `handle`.

```typescript
// WRONG
const profileKeys = userIds.map(id => `profile:${id}`);

// RIGHT - need two-step lookup
const userKeys = userIds.map(id => `user:${id}`);
const userMap = await batchKVGet(env, userKeys, 'USERS_KV', ...);
const handles = [...userMap.values()].map(u => u?.handle).filter(Boolean);
const profileKeys = handles.map(h => `profile:${h}`);
```

### 2. Repost Missing createdAt

When creating reposts, include `createdAt` in `originalPost`:

```typescript
originalPost: {
  id: original.id,
  authorHandle: original.authorHandle,
  // ... other fields
  createdAt: original.createdAt,  // Don't forget!
  likeCount: original.likeCount,
  replyCount: original.replyCount,
  repostCount: original.repostCount,
}
```

Frontend fallback: `displayPost.createdAt || post.createdAt`

### 3. Array vs Set in DOs

**Problem**: `array.includes()` is O(n), slow for popular posts.

**Solution**: Use Sets internally, serialize to arrays for storage:

```typescript
// PostDO
interface PostStateRuntime {
  post: Post;
  likesSet: Set<string>; // O(1) has/add/delete
  repostsSet: Set<string>;
}

// On load: convert array → Set
this.state = {
  post: stored.post,
  likesSet: new Set(stored.likes || []),
  repostsSet: new Set(stored.reposts || []),
};

// On save: convert Set → array
const toStore = {
  post: this.state.post,
  likes: [...this.state.likesSet],
  reposts: [...this.state.repostsSet],
};
```

### 4. Pagination Counting Bug

**Problem**: Counting only from paginated slice gives wrong totals.

```typescript
// WRONG - counts only current page
const paginatedIds = allIds.slice(offset, offset + limit);
let unreadCount = 0;
for (const id of paginatedIds) {
  if (!notif.read) unreadCount++;  // Undercounts!
}

// RIGHT - count from all, return subset
const allNotifs = await batchKVGet(env, allKeys, ...);
let unreadCount = 0;
for (const notif of allNotifs.values()) {
  if (notif && !notif.read) unreadCount++;
}
// Then paginate the response array separately
```

### 5. Client-Side Request Deduplication

For link unfurling, cache results to avoid duplicate requests:

```typescript
const unfurlCache = new Map<string, UnfurlData | null>();
const unfurlPending = new Map<string, Promise<UnfurlData | null>>();

async function fetchUnfurl(url: string) {
  if (unfurlCache.has(url)) return unfurlCache.get(url);
  if (unfurlPending.has(url)) return unfurlPending.get(url);

  const promise = doFetch(url);
  unfurlPending.set(url, promise);
  const result = await promise;
  unfurlCache.set(url, result);
  unfurlPending.delete(url);
  return result;
}
```

---

## API Patterns

### Response Format

All API responses follow this structure:

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: "Error message" }

// Paginated
{ success: true, data: { items: [...], nextCursor: "...", hasMore: true } }
```

### Authentication

The Wire supports two authentication methods:

**1. Legacy JWT (email/password):**
```typescript
// Middleware
import { requireAuth, optionalAuth } from "../middleware/auth";

// Protected route
app.get("/api/me", requireAuth, async (c) => {
  const userId = c.get("userId"); // Set by middleware
});

// Optional auth (different behavior for logged in)
app.get("/api/posts/:id", optionalAuth, async (c) => {
  const userId = c.get("userId"); // May be undefined
});
```

**2. Clerk OAuth (Google/Apple sign-in):**
```typescript
// Middleware
import { clerkAuthMiddleware, requireClerkAuth } from "../middleware/clerk-auth";

// Session check - returns user info or needs_handle status
app.get("/api/clerk/session", requireClerkAuth, async (c) => {
  const clerkUserId = c.get("clerkUserId");
  // Returns { status: "linked", user: {...} } or { status: "needs_handle" }
});

// Onboarding - creates internal user linked to Clerk
app.post("/api/clerk/onboarding/complete", requireClerkAuth, async (c) => {
  // Takes { handle } and creates full user account
});
```

**Auto-follow on signup:** All new users automatically follow `FOUNDER_HANDLE` ("chabotc") and receive their recent posts in their initial feed.

### Handler Response Helpers

```typescript
import { success, notFound, badRequest, serverError } from "../utils/response";

return success({ user: profile }); // 200
return notFound("User not found"); // 404
return badRequest("Invalid email"); // 400
return serverError("Database error"); // 500
```

---

## Frontend Architecture

### React Query for Server State

```typescript
// Infinite scroll pattern (HomePage, ExplorePage, PostPage)
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useInfiniteQuery({
    queryKey: ["feed", "home"],
    queryFn: ({ pageParam }) => feedApi.getHome(pageParam),
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

const posts = data?.pages.flatMap((page) => page?.items ?? []) ?? [];
```

### Zustand for Client State

```typescript
// authStore.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: "auth-storage" },
  ),
);
```

### API Client Pattern

```typescript
// web/src/lib/api.ts
export const postsApi = {
  async create(content: string, mediaUrls?: string[]) {
    return apiRequest("/posts", {
      method: "POST",
      body: { content, mediaUrls },
    });
  },
  async getReplies(postId: string, cursor?: string, limit = 20) {
    let url = `/posts/${postId}/replies?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return apiRequest(url);
  },
};
```

---

## UI Design System

### Theming

6 themes available via `data-theme` attribute:

| Theme     | Primary Color | Character            |
| --------- | ------------- | -------------------- |
| `twitter` | `#1d9bf0`     | Classic Twitter blue |
| `vega`    | `#8b5cf6`     | Purple               |
| `nova`    | `#f97316`     | Orange, compact      |
| `maia`    | `#4299e1`     | Soft blue (default)  |
| `lyra`    | `#10b981`     | Green                |
| `mira`    | `#ec4899`     | Pink                 |

### CSS Variables

Always use variables, never hardcode colors:

```css
color: var(--foreground);
background: var(--background);
border: 1px solid var(--border);
```

### Component Classes

| Component | Classes                                                                       | Notes                    |
| --------- | ----------------------------------------------------------------------------- | ------------------------ |
| Buttons   | `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-danger` | Extend `.btn-base`       |
| Cards     | `.post-card`, `.user-card`                                                    | Use `.card-base` pattern |
| Avatars   | `.avatar`, `.avatar-sm`, `.avatar-lg`                                         | Always include fallback  |
| Actions   | `.post-action`, `.liked`, `.reposted`                                         | Pink/green active states |

### Icons

Use Lucide React icons:

```tsx
import { Heart, MessageSquare, Repeat2 } from "lucide-react";
<Heart size={18} />;
```

---

## Testing

### Unit Tests (Vitest)

```bash
npm test                    # Run unit tests
npm test -- --watch        # Watch mode
```

Located in `tests/unit/`. Test utilities, crypto, validation.

### API Integration Tests

```bash
npm run test:api           # Run API tests against local server
```

Located in `tests/api/`. Requires dev server running.

### Visual Regression Tests

```bash
npx playwright test tests/visual/
```

Located in `tests/visual/`. Screenshot comparisons across themes.

---

## Development Workflow

### Local Development

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start Vite frontend (if working on React)
cd web && npm run dev
```

Dev server runs on `localhost:8080`. CSRF requires `Origin: http://localhost:8080` header for POST requests.

### Adding a New Feature

1. **Types first**: Add interfaces to `src/types/`
2. **Handler**: Create/update handler in `src/handlers/`
3. **Mount route**: Add to `src/index.ts`
4. **Frontend**: Add API method to `web/src/lib/api.ts`
5. **Component**: Create React component
6. **Test**: Add tests

### Deployment

```bash
npm run deploy             # Deploy to Cloudflare
```

---

## Key Files to Know

| When working on...   | Read these files                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- |
| Authentication       | `src/handlers/auth.ts`, `src/middleware/auth.ts`, `src/utils/jwt.ts`                  |
| Clerk OAuth          | `src/handlers/clerk-auth.ts`, `src/middleware/clerk-auth.ts`                          |
| Feed algorithm       | `src/handlers/feed.ts`, `src/durable-objects/FeedDO.ts`, `src/constants.ts` (SCORING) |
| User profiles        | `src/handlers/users.ts`, `src/durable-objects/UserDO.ts`                              |
| Posts & interactions | `src/handlers/posts.ts`, `src/durable-objects/PostDO.ts`                              |
| Search               | `src/handlers/search.ts`, `src/utils/search-index.ts`                                 |
| Notifications        | `src/handlers/notifications.ts`, `src/services/notifications.ts`                      |
| Batching             | `src/utils/batch.ts`, `src/handlers/batch.ts`                                         |
| AI News Seeder       | `src/handlers/news-seed.ts`, `src/services/news-aggregator.ts`, `src/services/story-processor.ts`, `src/services/conversation-generator.ts` |
| Logging              | `src/utils/logger.ts`                                                                 |
| Frontend state       | `web/src/stores/`, `web/src/lib/api.ts`                                               |
| UI components        | `web/src/components/`, `AGENTS.md` (design system)                                    |

---

## Constants Reference

```typescript
// src/constants.ts

// Founder account - all new users auto-follow this account
FOUNDER_HANDLE = "chabotc";

// System limits
LIMITS.MAX_FEED_ENTRIES = 1000;
LIMITS.MAX_NOTE_LENGTH = 280;
LIMITS.DEFAULT_FEED_PAGE_SIZE = 20;
LIMITS.MAX_PAGINATION_LIMIT = 50;
LIMITS.MAX_THREAD_DEPTH = 10;
LIMITS.MAX_BIO_LENGTH = 160;
LIMITS.MAX_DISPLAY_NAME_LENGTH = 50;

// Cache TTLs (seconds)
CACHE_TTL.PROFILE = 3600;        // 1 hour
CACHE_TTL.FOF_RANKINGS = 900;    // 15 minutes
CACHE_TTL.MEDIA = 31536000;      // 1 year (immutable)

// Retention periods (milliseconds)
RETENTION.FEED_ENTRIES = 7 * 24 * 60 * 60 * 1000;     // 7 days
RETENTION.DELETED_POSTS = 30 * 24 * 60 * 60 * 1000;   // 30 days
RETENTION.FOF_RANKING_WINDOW = 24 * 60 * 60 * 1000;   // 24 hours

// Scoring parameters (freshness-first approach)
SCORING.RECENCY_HALF_LIFE_HOURS = 3;
SCORING.ENGAGEMENT_HALF_LIFE_HOURS = 18;
SCORING.FRESH_BOOST_OWN = 40;           // Strong boost for user's own posts
SCORING.FRESH_BOOST_FOLLOW = 20;        // Medium boost for followed users
SCORING.FRESH_BOOST_EXPLORE = 6;        // Small boost for explore posts
SCORING.RECENCY_WEIGHT = 50;            // Dominant weight for freshness
SCORING.ENGAGEMENT_WEIGHT = 5;          // Minor weight for engagement
SCORING.REPLY_WEIGHT = 4;               // Replies signal discussion
SCORING.REPOST_WEIGHT = 3;              // Reposts amplify reach
SCORING.LIKE_WEIGHT = 1;                // Base engagement unit
SCORING.OWN_POST_PIN_THRESHOLD_MS = 10 * 60 * 1000;   // 10 min pinning
SCORING.FOLLOW_RATIO_NORMAL = 0.85;     // 85% follow, 15% explore
SCORING.FOLLOW_RATIO_STALE = 0.6;       // When feed is stale, more explore

BATCH_SIZE.KV_LIST = 100;               // KV list operations
BATCH_SIZE.QUEUE_BATCH = 100;           // Queue batch size
```

---

## Checklist Before Committing

- [ ] `npm run typecheck` passes
- [ ] No N+1 queries (use `batchKVGet`)
- [ ] DOs use Sets for membership checks
- [ ] API responses use `success()` / error helpers
- [ ] Frontend uses React Query for server state
- [ ] CSS uses variables, not hardcoded colors
- [ ] New endpoints have proper auth middleware
