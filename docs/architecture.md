# The Wire - Architecture Documentation

A Twitter-like social network built entirely on Cloudflare's edge infrastructure.

![Architecture Diagram](architecture.png)

Diagram source: `docs/architecture.dot` (Graphviz) and `docs/architecture.mmd` (Mermaid).

## Overview

The Wire is a globally distributed social network that runs on Cloudflare Workers with sub-50ms latency worldwide. It uses Durable Objects for strong consistency, KV for caching, R2 for media storage, and Queues for async fan-out.

## System Architecture

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                    CLOUDFLARE EDGE                          │
┌──────────┐                        │  ┌─────────────────────────────────────────────────────┐   │
│  Client  │◄──────HTTP/WS─────────►│  │                  WORKERS (Hono.js)                  │   │
│ Browser  │                        │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │   │
└──────────┘                        │  │  │  Auth   │ │  Posts  │ │  Feed   │ │  Media   │  │   │
                                    │  │  │ Handler │ │ Handler │ │ Handler │ │ Handler  │  │   │
                                    │  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘  │   │
                                    │  │       │          │          │           │         │   │
                                    │  │  ┌────▼──────────▼──────────▼───────────▼─────┐   │   │
                                    │  │  │              MIDDLEWARE STACK              │   │   │
                                    │  │  │  CORS → Rate Limit → CSRF → JWT Auth      │   │   │
                                    │  │  └────────────────────────────────────────────┘   │   │
                                    │  └──────────────────────┬────────────────────────────┘   │
                                    │                         │                                │
                                    │  ┌──────────────────────▼────────────────────────────┐   │
                                    │  │              DURABLE OBJECTS (State)              │   │
                                    │  │  ┌────────┐  ┌────────┐  ┌───────┐  ┌──────────┐  │   │
                                    │  │  │ UserDO │  │ PostDO │  │FeedDO │  │WebSocketDO│ │   │
                                    │  │  └────────┘  └────────┘  └───────┘  └──────────┘  │   │
                                    │  └───────────────────────────────────────────────────┘   │
                                    │                                                          │
                                    │  ┌────────────────────────────────────────────────────┐  │
                                    │  │                    STORAGE                         │  │
                                    │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │  │
                                    │  │  │ USERS_KV │  │ POSTS_KV │  │SESSIONS_KV│         │  │
                                    │  │  └──────────┘  └──────────┘  └──────────┘         │  │
                                    │  │  ┌──────────┐  ┌──────────────────────────┐       │  │
                                    │  │  │ FEEDS_KV │  │ R2: MEDIA_BUCKET         │       │  │
                                    │  │  └──────────┘  └──────────────────────────┘       │  │
                                    │  └────────────────────────────────────────────────────┘  │
                                    │                                                          │
                                    │  ┌────────────────────────────────────────────────────┐  │
                                    │  │              ASYNC PROCESSING                      │  │
                                    │  │  ┌─────────────────┐  ┌─────────────────────────┐  │  │
                                    │  │  │  FANOUT_QUEUE   │  │   CRON TRIGGERS         │  │  │
                                    │  │  │  (post fanout)  │  │   (rankings, cleanup)   │  │  │
                                    │  │  └─────────────────┘  └─────────────────────────┘  │  │
                                    │  └────────────────────────────────────────────────────┘  │
                                    └─────────────────────────────────────────────────────────────┘
```

## Cloudflare Services

### 1. Workers (Edge Computing)

**Entry Point:** `src/index.ts`
**Framework:** Hono.js

The main Worker handles all HTTP requests at 300+ edge locations:
- Server-rendered HTML pages
- API routes (`/api/*`)
- WebSocket upgrades (`/ws`)
- Media serving (`/media/*`)
- Static assets (`/css/*`, `/js/*`)

Home feed requests are optimized to use a small, batched set of subrequests:
`UserDO/context` for blocked + following + settings, `FeedDO/feed-with-posts` for
followed content, and cached `FEEDS_KV` rankings for explore blending.

### 2. Durable Objects (Stateful Actors)

Four DO classes provide distributed state management with strong consistency:

| Durable Object | ID Pattern | Purpose | Key Methods |
|----------------|------------|---------|-------------|
| **UserDO** | `{userId}` | Profile, social graph, settings | `getProfile()`, `follow()`, `block()`, `context()` |
| **PostDO** | `{postId}` | Post state, interactions | `like()`, `unlike()`, `repost()`, `delete()` |
| **FeedDO** | `{userId}` | Personalized timeline | `addEntry()`, `getFeed()`, `feed-with-posts()` |
| **WebSocketDO** | `{userId}` | Real-time connections | `connect()`, `broadcast()`, `broadcast-notification()` |

### 3. KV Namespaces (Global Cache)

| Namespace | Key Patterns | Purpose | TTL |
|-----------|--------------|---------|-----|
| **USERS_KV** | `user:{id}`, `email:{email}`, `handle:{handle}`, `profile:{handle}` | Auth, user lookups, profile cache | Profile: 1hr |
| **POSTS_KV** | `post:{id}`, `user-posts:{userId}`, `search:word:{word}` | Post metadata, author index, search index | Infinite |
| **SESSIONS_KV** | `notification_list:{id}`, `notifications:{id}:{nid}`, `rl:*`, `ban-status:{id}` | Notifications, rate limits, ban cache | Varies |
| **FEEDS_KV** | `fof:ranked`, `explore:ranked` | Pre-computed rankings | 15 min |

### 4. R2 Bucket (Object Storage)

**Bucket:** `the-wire-media`

Stores user-uploaded media with magic byte validation:
- Avatars and banners
- Post images (max 5MB): JPEG, PNG, GIF, WebP
- Post videos (max 50MB): MP4, WebM

### 5. Queue (Async Processing)

**Queue:** `fanout-queue`

Fan-out post distribution to followers:
- **Producer:** Post creation in `src/handlers/posts.ts`
- **Consumer:** Batch processor (100 msgs, 30s timeout)
- **Messages:** `new_post`, `delete_post`

### 6. Scheduled Tasks (Cron)

| Schedule | Handler | Purpose |
|----------|---------|---------|
| `*/15 * * * *` | `updateFoFRankings()` | Compute friends-of-friends rankings |
| `*/15 * * * *` | `updateExploreRankings()` | Compute explore page with HN algorithm |
| `0 * * * *` | `cleanupFeedEntries()` | Remove feed entries older than 7 days |
| `0 0 * * *` | `compactKVStorage()` | Remove deleted posts (30+ days) |

## Project Structure

```
src/
├── index.ts                    # Main entry, HTML routes, static serving
├── constants.ts                # System limits, scoring params, TTLs
├── handlers/
│   ├── auth.ts                 # Signup, login, logout, me
│   ├── users.ts                # Profiles, follow, block, posts
│   ├── posts.ts                # CRUD, like, repost, thread
│   ├── feed.ts                 # Home feed, explore (with ranking)
│   ├── media.ts                # R2 upload with magic byte validation
│   ├── search.ts               # Post and user search
│   ├── moderation.ts           # Admin: ban, takedown
│   ├── admin.ts                # Admin dashboard, stats
│   ├── notifications.ts        # Notification endpoints
│   ├── scheduled.ts            # Cron job handlers
│   ├── unfurl.ts               # URL preview/metadata extraction
│   └── seed.ts                 # Debug: data generation
├── middleware/
│   ├── auth.ts                 # JWT validation, requireAuth, optionalAuth
│   ├── csrf.ts                 # CSRF token validation
│   └── rate-limit.ts           # Distributed rate limiting
├── durable-objects/
│   ├── UserDO.ts               # User state actor
│   ├── PostDO.ts               # Post state actor
│   ├── FeedDO.ts               # Feed state actor
│   └── WebSocketDO.ts          # WebSocket state actor
├── services/
│   ├── snowflake.ts            # Unique ID generation
│   ├── notifications.ts        # Create/broadcast notifications
│   ├── do-client.ts            # DO communication helpers
│   └── kv-client.ts            # KV operation helpers
├── shared/
│   └── post-renderer.ts        # Shared post card rendering logic
├── utils/
│   ├── jwt.ts                  # JWT create/verify (jose)
│   ├── crypto.ts               # PBKDF2 password hashing
│   ├── validation.ts           # Input validation
│   ├── search-index.ts         # Inverted index for search
│   ├── response.ts             # Standardized responses
│   ├── logger.ts               # Structured logging
│   └── safe-parse.ts           # Safe JSON/base64 parsing
├── types/
│   ├── env.ts                  # Environment bindings
│   ├── user.ts                 # User types
│   ├── post.ts                 # Post types
│   ├── notification.ts         # Notification types
│   └── feed.ts                 # Feed types
public/
├── css/
│   └── styles.css              # Global styles (6 theme variants)
├── js/
│   ├── api.js                  # Client API library
│   ├── form-handler.js         # Form submission handler
│   └── validation.js           # Client-side validation
├── home.html                   # Static home page
├── login.html                  # Static login page
└── signup.html                 # Static signup page
```

## HTML Pages (Routes)

| Route | Purpose |
|-------|---------|
| `/` | Landing page with features |
| `/signup` | User registration |
| `/login` | User authentication |
| `/home` | Home timeline with compose box |
| `/explore` | Discover FoF posts |
| `/search` | Search posts and users |
| `/notifications` | Notification feed |
| `/post/:id` | Post detail with replies |
| `/settings` | User settings, theme picker |
| `/settings/muted` | Manage muted words (duration + scope) |
| `/admin` | Admin dashboard (admin only) |
| `/u/:handle` | User profile page |
| `/u/:handle/followers` | Followers list |
| `/u/:handle/following` | Following list |

## API Routes

### Authentication (`/api/auth`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/signup` | POST | Create account |
| `/login` | POST | Authenticate, get JWT |
| `/logout` | POST | End session |
| `/me` | GET | Current user info |

### Users (`/api/users`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/me` | GET/PUT | Current user profile |
| `/me/settings` | GET/PUT | User preferences (muted words with scope + expiry) |
| `/:handle` | GET | Get user profile |
| `/:handle/posts` | GET | User's posts |
| `/:handle/replies` | GET | User's replies |
| `/:handle/media` | GET | User's media posts |
| `/:handle/likes` | GET | User's liked posts |
| `/:handle/follow` | POST/DELETE | Follow/unfollow |
| `/:handle/block` | POST/DELETE | Block/unblock |
| `/:handle/followers` | GET | List followers |
| `/:handle/following` | GET | List following |

### Posts (`/api/posts`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/` | POST | Create post |
| `/:id` | GET | Get post |
| `/:id` | DELETE | Delete post |
| `/:id/like` | POST/DELETE | Like/unlike |
| `/:id/repost` | POST/DELETE | Repost/unrepost |
| `/:id/thread` | GET | Get with ancestors & replies |

### Feed (`/api/feed`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/home` | GET | Personalized timeline |
| `/explore` | GET | Ranked explore feed |

### Search (`/api/search`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Search posts (type=top) or users (type=people) |

### Notifications (`/api/notifications`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | List notifications |
| `/unread-count` | GET | Unread count |
| `/:id/read` | PUT | Mark as read |
| `/read-all` | PUT | Mark all read |

### Media (`/api/media`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/upload` | POST | Upload image/video |

### Moderation (`/api/moderation`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/users/:handle/ban` | POST | Ban user |
| `/users/:handle/unban` | POST | Unban user |
| `/posts/:id/takedown` | POST | Remove post |

### Admin (`/api/admin`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/stats` | GET | Platform statistics |
| `/users` | GET | User list with details |
| `/posts` | GET | Recent posts |

### Other
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/unfurl` | GET | URL preview metadata |
| `/ws` | GET | WebSocket upgrade |
| `/media/:key` | GET | Serve media from R2 |

## Middleware Stack

```
Request → CORS → Body Limit → Rate Limit → CSRF → JWT Auth → Handler
```

### Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Login | 5 | per minute per IP |
| Signup | 10 | per hour per IP |
| General API | 100 | per minute per user |
| Post creation | 30 | per hour per user |
| Follow actions | 50 | per hour per user |
| Media uploads | 20 | per hour per user |

## Feed Algorithm

### Home Feed Composition

The home feed blends followed content with explore-ranked posts, then scores
and diversifies the result:

```
1. Pull followed posts (FeedDO) + explore-ranked candidates (FEEDS_KV)
2. Backfill underrepresented followees if author diversity is low
3. Score candidates (engagement + recency + source boosts)
4. Apply author diversity caps and return top N
```

### Ranking Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| Recency | Decay curve | `1 / (1 + ageHours / 8)` |
| Replies | 10x | High engagement signal |
| Reposts | 3x | Medium engagement signal |
| Likes | 1x | Base engagement unit |
| Source | +0.1-0.2 | Boost own/follow posts |
| Empty repost | -0.4 | Penalty for zero-content reposts |
| Author frequency | -0.05/post | Prevent feed domination |

### Explore Scoring (HN-style)

```
score = (likes + replies*10 + reposts*3) / (ageHours + 4)^1.3
```

- Gentler decay (1.3 vs HN's 1.5)
- 4-hour grace period
- Updated every 15 minutes via cron

### Author Diversity

- Max 1 post per author in any 5-post window
- Total caps per author across full feed

## Key Data Schemas

### PostMetadata (POSTS_KV)
```typescript
{
  id: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  content: string;
  mediaUrls: string[];
  replyToId?: string;
  quoteOfId?: string;
  repostOfId?: string;
  originalPost?: { id, authorHandle, content, mediaUrls, createdAt, counts... };
  createdAt: number;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  isDeleted?: boolean;
  isTakenDown?: boolean;
}
```

### UserDO State
```typescript
{
  profile: {
    id, handle, displayName, bio, location, website,
    avatarUrl, bannerUrl, joinedAt,
    followerCount, followingCount, postCount,
    isVerified, isBanned, isAdmin
  },
  settings: {
    emailNotifications, privateAccount,
    mutedWords: [{ word, scope?, expiresAt? }]
  },
  following: Set<string>,
  followers: Set<string>,
  blocked: Set<string>,
  likedPosts: string[]
}
```

### FeedDO Entry
```typescript
{
  postId: string;
  authorId: string;
  timestamp: number;
  source: 'own' | 'follow' | 'fof';
}
```

### Notification
```typescript
{
  id: string;
  userId: string;
  type: 'like' | 'reply' | 'follow' | 'mention' | 'repost' | 'quote';
  actorId: string;
  actorHandle: string;
  actorDisplayName: string;
  actorAvatarUrl: string;
  postId?: string;
  postContent?: string;
  createdAt: number;
  read: boolean;
}
```

## Environment Bindings

```typescript
interface Env {
  // KV Namespaces
  USERS_KV: KVNamespace;
  POSTS_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  FEEDS_KV: KVNamespace;

  // R2 Bucket
  MEDIA_BUCKET: R2Bucket;

  // Durable Objects
  USER_DO: DurableObjectNamespace;
  POST_DO: DurableObjectNamespace;
  FEED_DO: DurableObjectNamespace;
  WEBSOCKET_DO: DurableObjectNamespace;

  // Queue
  FANOUT_QUEUE: Queue;

  // Config
  ENVIRONMENT: string;           // "development" | "production"
  JWT_SECRET?: string;
  JWT_EXPIRY_HOURS: string;      // Default: "24"
  MAX_NOTE_LENGTH: string;       // Default: "280"
  FEED_PAGE_SIZE: string;        // Default: "20"
  ALLOWED_ORIGINS?: string;
  WORKER_URL?: string;
  INITIAL_ADMIN_HANDLE?: string;
}
```

## Data Flow Examples

### Post Creation
```
1. User submits POST /api/posts { content, mediaUrls }
2. Validate JWT, rate limit check
3. Validate content (1-280 chars)
4. Generate Snowflake ID
5. Initialize PostDO with post data
6. Cache PostMetadata in POSTS_KV
7. Add to author's user-posts index
8. Index content for search
9. Detect @mentions, create notifications
10. Add to author's FeedDO
11. Enqueue to FANOUT_QUEUE
12. Queue consumer: add to each follower's FeedDO
13. Broadcast via WebSocketDO for real-time
```

### Home Feed Request
```
1. GET /api/feed/home?limit=20
2. Validate JWT
3. UserDO.context() → blocked users, muted words, following
4. FeedDO.feed-with-posts() → timeline entries with full post data
5. FEEDS_KV → pre-computed explore rankings
6. Filter: blocked, muted, deleted, low-value reposts
7. Score: engagement + recency + source boosts with author frequency penalties
8. Select diverse posts with author caps and recent-window limits
9. Return paginated results with cursor
```

### Real-time Notification
```
1. User likes a post
2. PostDO.like() increments counter
3. Create notification in SESSIONS_KV
4. WebSocketDO.broadcast-notification()
5. Client receives via WebSocket
6. UI updates notification badge
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Global latency | <50ms (edge computing) |
| DO consistency | Strong (single-actor) |
| KV propagation | Eventual (~60s) |
| Feed max entries | 1000 per user |
| Queue batch size | 100 messages |
| Queue timeout | 30 seconds |
| Ranking refresh | 15 minutes |
| Media cache | 1 year immutable |

## Security Features

- **Authentication:** JWT with HS256, configurable expiry
- **Password:** PBKDF2 with 100k iterations, random salt
- **CSRF:** Token validation on state-changing requests
- **Rate Limiting:** Distributed via KV with per-action limits
- **Input Validation:** Strict validation on all user input
- **Media Validation:** Magic byte verification for uploads
- **Ban Caching:** 60s KV cache to avoid DO call per request

## Theme System

Six built-in themes with CSS variables:
- **Twitter** - Pure black, blue accent
- **Vega** - Classic shadcn slate
- **Nova** - Compact & efficient
- **Maia** - Soft & rounded
- **Lyra** - Boxy & monospace
- **Mira** - Ultra dense

Theme selection persisted in localStorage.
