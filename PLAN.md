# The Wire - Build Specification

Build a fully-featured Twitter clone called "The Wire" running entirely on Cloudflare edge infrastructure. Posts are called "Notes" (280 char max). Prioritize low latency, horizontal scalability, and eventual consistency.

---

## Core Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Cloudflare Workers | Edge compute, HTTP routing |
| Framework | Hono | Lightweight routing, middleware |
| State (Authoritative) | Durable Objects | User state, post interactions, feeds |
| Cache (Global) | KV Namespaces | Profiles, posts, sessions, search indexes |
| Media | R2 | Images, videos, avatars |
| Async | Queues | Post fanout to follower feeds |
| Frontend | React + Vite SPA | Modern single-page application |
| Auth | Clerk | OAuth (Google, Apple) + email/password |

---

## Durable Objects

### UserDO (one per user)
- Profile: displayName, handle, bio, location, website, avatarUrl, bannerUrl
- Settings: theme preference, notification settings, muted words
- Social graph: following (Set), followers (Set), blocked (Set)
- Engagement tracking: likedPostsSet (Set), repostedPostsSet (Set)
- Stats: postCount, followerCount, followingCount

### PostDO (one per post)
- Post metadata and content
- Interaction sets: likesSet (Set), repostsSet (Set) - use Sets for O(1) lookups
- Counts: likeCount, replyCount, repostCount, quoteCount

### FeedDO (one per user)
- Personalized timeline entries: { postId, authorId, timestamp, source }
- Max 1000 entries with 7-day retention
- Supports chronological and ranked views

### WebSocketDO (one per user)
- Real-time notification delivery
- Connection management

---

## KV Schema

```
USERS_KV:
  user:{userId}           -> { id, email, handle, passwordHash, createdAt }
  handle:{handle}         -> userId
  email:{email}           -> userId
  profile:{handle}        -> Full UserProfile (cached from UserDO)
  search:handle:{prefix}  -> string[] of userIds

POSTS_KV:
  post:{postId}           -> PostMetadata with author info embedded
  user-posts:{userId}     -> string[] of postIds (author's post index)
  replies:{postId}        -> string[] of reply postIds
  search:word:{word}:{postId} -> Post search index

SESSIONS_KV:
  session:{token}         -> userId
  notifications:{userId}:* -> Notification data

FEEDS_KV:
  feed:{userId}           -> Cached feed entries
  explore:ranked          -> Global explore feed cache
```

---

## API Endpoints

### Auth (`/api/auth/`)
- POST `/signup` - Create account
- POST `/login` - Email/password login
- POST `/logout` - Invalidate session
- GET `/me` - Current user info
- POST `/clerk-callback` - Clerk OAuth completion
- POST `/clerk-handle` - Set handle after OAuth signup

### Users (`/api/users/`)
- GET `/:handle` - Get profile
- PATCH `/:handle` - Update profile
- POST `/:handle/follow` - Follow user
- DELETE `/:handle/follow` - Unfollow
- GET `/:handle/followers` - List followers
- GET `/:handle/following` - List following
- POST `/:handle/block` - Block user
- DELETE `/:handle/block` - Unblock

### Posts (`/api/posts/`)
- POST `/` - Create note (280 char max)
- GET `/:id` - Get post with thread context
- DELETE `/:id` - Delete own post
- POST `/:id/like` - Like
- DELETE `/:id/like` - Unlike
- POST `/:id/repost` - Repost
- DELETE `/:id/repost` - Undo repost
- GET `/:id/replies` - Get replies (paginated)

### Feed (`/api/feed/`)
- GET `/home` - Personalized home feed (follow + explore blend)
- GET `/explore` - Global ranked feed
- GET `/user/:handle` - User's posts

### Search (`/api/search/`)
- GET `/users?q=` - Search users by handle/name
- GET `/posts?q=` - Search posts by content

### Notifications (`/api/notifications/`)
- GET `/` - List notifications (paginated)
- POST `/read` - Mark notifications as read
- GET `/unread-count` - Unread count

### Media (`/api/media/`)
- POST `/upload` - Upload image/video to R2
- GET `/:key` - Serve media file

---

## Feed Algorithm

Freshness-first ranking (Twitter-inspired):

```typescript
SCORING = {
  RECENCY_HALF_LIFE_HOURS: 3,      // Fast decay
  ENGAGEMENT_HALF_LIFE_HOURS: 18,  // Slower engagement decay

  // Fresh post boosts
  FRESH_BOOST_OWN: 40,             // Own posts boosted 20 min
  FRESH_BOOST_FOLLOW: 20,          // Followed users boosted 30 min
  FRESH_BOOST_EXPLORE: 6,          // Explore content boost

  // Engagement weights
  RECENCY_WEIGHT: 50,
  ENGAGEMENT_WEIGHT: 5,
  REPLY_WEIGHT: 4,
  REPOST_WEIGHT: 3,
  LIKE_WEIGHT: 1,

  // Reply penalty (down-rank unless engaged)
  REPLY_PENALTY_BASE: 25,
  REPLY_ENGAGEMENT_THRESHOLD: 5,

  // Follow vs explore blend
  FOLLOW_RATIO_NORMAL: 0.85,
  FOLLOW_RATIO_STALE: 0.6,         // More explore when feed is stale
}
```

Key behaviors:
- Own posts pinned to top for 10 minutes
- Stale feed detection increases explore content
- Replies penalized unless highly engaged

---

## Frontend (React SPA)

### Tech Stack
- Vite build system
- React Query for server state
- Zustand for client state (auth, theme)
- Lucide icons
- CSS variables for theming

### Pages
- `/` - Home feed
- `/explore` - Explore/discover
- `/search` - User and post search
- `/:handle` - User profile
- `/post/:id` - Thread view
- `/notifications` - Notification list
- `/settings` - User settings, theme picker, muted words
- `/auth` - Login/signup with Clerk

### Components
- `AppLayout` - Shell with sidebar/bottom nav
- `Sidebar` - Desktop navigation
- `BottomNav` - Mobile navigation
- `PostCard` - Note display with actions
- `ComposeBox` - Note composer with media upload
- `UserCard` - User preview

### Theming (6 themes)
```css
/* Theme via data-theme attribute */
[data-theme="twitter"] { --primary: #1d9bf0; }
[data-theme="vega"]    { --primary: #8b5cf6; } /* Purple */
[data-theme="nova"]    { --primary: #f97316; } /* Orange */
[data-theme="maia"]    { --primary: #4299e1; } /* Soft blue - default */
[data-theme="lyra"]    { --primary: #10b981; } /* Green */
[data-theme="mira"]    { --primary: #ec4899; } /* Pink */
```

### Mobile-First Design
- Responsive breakpoints
- Touch-friendly interactions
- Bottom navigation on mobile
- Sidebar on desktop

---

## Visual Design System

Create a Twitter/X-inspired design with clean typography, subtle interactions, and a multi-theme system. The aesthetic should feel professional, modern, and content-focused.

### Design Philosophy
- **Content-first**: UI recedes, content dominates
- **Subtle depth**: Minimal shadows, rely on borders and spacing
- **Responsive feel**: 200ms transitions, hover states everywhere
- **Twitter precision**: Match Twitter/X spacing, sizing, and proportions

### Layout Structure

Three-column Twitter layout with fixed sidebar and scrolling main content:

```
┌─────────────────────────────────────────────────────────┐
│  Left Sidebar (275px)  │  Main (600px)  │  Right (350px) │
│  ┌─────────────────┐   │  ┌──────────┐  │  ┌──────────┐  │
│  │ Logo            │   │  │ Header   │  │  │ Search   │  │
│  │ Home            │   │  │ Compose  │  │  │ Widgets  │  │
│  │ Explore         │   │  │ Posts... │  │  │ Trends   │  │
│  │ Notifications   │   │  │          │  │  │ Who to   │  │
│  │ Profile         │   │  │          │  │  │ follow   │  │
│  │ Settings        │   │  │          │  │  └──────────┘  │
│  │ [Post Button]   │   │  │          │  │                │
│  └─────────────────┘   │  └──────────┘  │                │
└─────────────────────────────────────────────────────────┘
```

Responsive behavior:
- `>1024px`: Full 3-column layout
- `768-1024px`: Hide right sidebar
- `<768px`: Hide left sidebar, show bottom navigation

### CSS Variables (Design Tokens)

All colors, spacing, and radii defined as CSS variables for theming:

```css
:root {
  /* Core colors */
  --background: #000000;
  --foreground: #E7E9EA;
  --muted: #71767B;
  --muted-foreground: #71767B;
  --border: #2F3336;
  --primary: #1D9BF0;
  --primary-foreground: #FFFFFF;
  --secondary: #16181C;
  --hover: #16181C;

  /* Semantic colors */
  --destructive: #F4212E;
  --success: #00BA7C;
  --like: #F91880;        /* Pink for likes */
  --repost: #00BA7C;      /* Green for reposts */

  /* Border radii */
  --radius: 16px;         /* Cards, media */
  --radius-sm: 8px;       /* Buttons, inputs */
  --radius-lg: 9999px;    /* Pills, avatars */

  /* Layout widths */
  --sidebar-left-width: 275px;
  --main-content-width: 600px;
  --sidebar-right-width: 350px;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'SF Mono', Monaco, Consolas, monospace;

  /* Transitions */
  --transition: all 0.2s ease;
}
```

### 6 Theme Variants

Each theme has a distinct personality through colors, radii, and spacing:

| Theme | Background | Primary | Border Radius | Character |
|-------|------------|---------|---------------|-----------|
| **twitter** | `#000000` (black) | `#1D9BF0` (blue) | 16px | Classic Twitter dark mode |
| **vega** | `#FFFFFF` (white) | `#0F172A` (slate) | 8px | Clean shadcn/ui light |
| **nova** | `#FAFAFA` (neutral) | `#18181B` (zinc) | 6px | Compact, smaller spacing |
| **maia** | `#FEFEFE` (warm white) | `#4299E1` (sky) | 16px | Soft, rounded, friendly |
| **lyra** | `#FFFFFF` (white) | `#000000` (black) | 2px | Boxy, monospace font |
| **mira** | `#FCFCFC` (gray) | `#2563EB` (blue) | 4px | Ultra-dense, minimal |

Theme applied via `data-theme` attribute on `<html>`:
```html
<html data-theme="maia">
```

### Typography Scale

Base: 15px / 20px line-height (Twitter standard)

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Post content | 15px | 400 | `--foreground` |
| Display name | 15px | 700 | `--foreground` |
| Handle | 15px | 400 | `--muted-foreground` |
| Timestamp | 15px | 400 | `--muted-foreground` |
| Page header | 20px | 800 | `--foreground` |
| Nav items | 20px | 400 (700 active) | `--foreground` |
| Buttons | 15-17px | 700 | varies |

### Component Patterns

**Post Card**
```
┌────────────────────────────────────────────┐
│ [Avatar] Display Name @handle · 2h        ⋯│
│          Post content goes here with       │
│          links and @mentions highlighted   │
│          ┌──────────────────────────────┐  │
│          │ [Media/Link Card Preview]    │  │
│          └──────────────────────────────┘  │
│          💬 12    🔁 5    ❤️ 42            │
└────────────────────────────────────────────┘
```

Spacing: 12px padding, 12px gap between avatar and content
Avatar: 48px circle (40px in compact themes)

**Action buttons**
- Default: `--muted-foreground`
- Hover: `--primary` with `--accent` background
- Liked: `--like` (#F91880) with filled heart
- Reposted: `--repost` (#00BA7C)

**Avatars**
- Standard: 48px, border-radius: 50%
- Small: 32px (in replies, notifications)
- Large: 134px (profile page, with 4px border)

**Buttons**
```css
.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: var(--radius-lg);  /* pill shape */
  padding: 8px 16px;
  font-weight: 700;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
```

### Interaction States

All interactive elements have:
1. **Hover**: Subtle background change (`--hover`)
2. **Active**: Scale or opacity reduction
3. **Focus**: 2px outline in `--primary`
4. **Disabled**: 50% opacity, `cursor: not-allowed`

Transitions: 200ms ease for all state changes

### Link Cards (URL Previews)

Twitter/X-style rich link previews:
```
┌────────────────────────────────────────┐
│ [Large image preview - 16:9 ratio]     │
├────────────────────────────────────────┤
│ 🔗 example.com                         │
│ Article Title Here                      │
│ Brief description of the linked...     │
└────────────────────────────────────────┘
```

- Border: 1px solid `--border`
- Border-radius: 16px
- Image: aspect-ratio 1.91:1
- YouTube embeds: Full 16:9 iframe

### Mobile Navigation

Bottom nav bar (53px height) with 5 items:
```
┌─────────────────────────────────────────┐
│  🏠      🔍      🔔      👤      ⚙️      │
└─────────────────────────────────────────┘
```

- Fixed to bottom with `safe-area-inset-bottom` for notched phones
- Icon size: 26px
- Notification badge: Primary-colored pill

### Page Header (Sticky)

```css
.page-header {
  position: sticky;
  top: 0;
  height: 53px;
  background: rgba(0, 0, 0, 0.65);  /* Twitter theme */
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}
```

Light themes: Solid background, no blur

### Empty States

Centered, muted text with subtle messaging:
```
┌────────────────────────────────────────┐
│                                        │
│         No posts yet                   │
│         When you post, it'll show here │
│                                        │
└────────────────────────────────────────┘
```

### Media Display

- Images: 16px border-radius, max-height 500px, object-fit cover
- Click to open modal (zoom-out cursor)
- Video: Native controls, same styling
- Multi-image: Grid layout (2x2 for 4 images)

### Compose Box

```
┌────────────────────────────────────────┐
│ [Avatar] What's happening?             │
│                                        │
│                                        │
├────────────────────────────────────────┤
│ 🖼️ 📹        [Character count]  [Post] │
└────────────────────────────────────────┘
```

- Textarea: No border, transparent background, 20px font
- Footer: Thin top border, media buttons left, post button right
- Character counter: Warning at 260 (yellow), error at 280 (red)

### Animations

```css
/* Smooth global transitions */
* {
  transition-property: background-color, border-color, color;
  transition-duration: 0.3s;
}

/* Loading spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}
```

### Icons

Use Lucide React icons throughout:
- Size: 18-26px depending on context
- Stroke width: 2
- Color: `currentColor` (inherits from parent)

Key icons:
- Home, Search, Bell, User, Settings (navigation)
- Heart, MessageSquare, Repeat2, MoreHorizontal (post actions)
- Camera, Image, X (media/modals)

---

## AI News Seeder System

Automated content generation for community bootstrapping:

### News Aggregator (`/src/services/news-aggregator.ts`)
Fetch AI/ML news from RSS feeds:
- Simon Willison's blog
- Anthropic blog
- Google AI blog
- Hugging Face blog
- Lobsters (AI tag)
- Hacker News (AI keywords, min 50 points)

### Story Processor (`/src/services/story-processor.ts`)
Use Claude to analyze stories:
- Extract summary, significance, talking points
- Score debate potential (1-10)
- Match to best personas

### Conversation Generator (`/src/services/conversation-generator.ts`)
Generate authentic discussions:
- Select lead persona based on story topic
- Generate lead post with URL
- Generate 4-6 replies with threading
- Add realistic likes (5-15 on lead, 0-5 on replies)
- Stagger timestamps realistically

### 20 Seed Personas
Each with distinct voice, expertise domains, and AI company affiliations:
- Emma Williams (Anthropic, AI safety)
- Olivia Brown (OpenAI, NLP research)
- Sarah Chen (DeepMind, Gemini)
- Alex Thompson (Claude Code, indie dev)
- Kevin Jackson (Cursor, dev tools)
- Ben Harris (Aider, CLI tools)
- Amelia Smith (Tech journalism)
- Daniel Kim (NVIDIA, GPUs)
- ... and 12 more covering diverse AI perspectives

### Endpoints
- `POST /debug/news/fetch` - Fetch without posting
- `POST /debug/news/process` - Analyze without posting
- `POST /debug/news/generate` - Full run: fetch → analyze → post → engage
- `POST /debug/generate-conversations` - Generate replies for existing posts

---

## Batching & Performance

### Critical: Avoid N+1 Queries
```typescript
// BAD - sequential reads
for (const id of userIds) {
  await env.USERS_KV.get(`user:${id}`); // N requests!
}

// GOOD - parallel batch reads
const keys = userIds.map(id => `user:${id}`);
const userMap = await batchKVGet(env, keys, 'USERS_KV', { parse: JSON.parse });
```

### Cloudflare Limits
- Concurrent subrequests: 6 (batchKVGet auto-chunks)
- Total subrequests: 1000 per request
- KV value size: 25MB
- DO request timeout: 30s

---

## Queue Fanout

On post creation:
```typescript
await env.FANOUT_QUEUE.send({
  type: 'new_post',
  postId,
  authorId,
  timestamp
});
```

Queue consumer adds post to each follower's FeedDO.

---

## Moderation

- User bans (soft-delete, can be reversed)
- Post takedowns with reason
- Block lists enforced at read time
- Muted words filter at feed render time
- Admin endpoints for management

---

## WebSocket Real-Time

- Notifications pushed instantly
- New follower alerts
- Like/reply notifications
- Connection via `/api/ws`

---

## Development

```bash
npm run dev          # Start dev server on localhost:8080
npm run typecheck    # TypeScript validation
npm test             # Unit tests
npm run test:api     # API integration tests
npm run deploy       # Deploy to Cloudflare
```

---

## File Structure

```
src/
├── index.ts                 # Worker entry, routes, queue consumer
├── constants.ts             # Limits, TTLs, scoring params
├── durable-objects/         # UserDO, PostDO, FeedDO, WebSocketDO
├── handlers/                # API route handlers
├── middleware/              # Auth, CSRF, rate-limit
├── services/                # News aggregator, story processor, conversation generator
├── types/                   # TypeScript interfaces
└── utils/                   # Batch, crypto, JWT, search index

web/
├── src/
│   ├── App.tsx              # Router
│   ├── components/          # Layout, posts, users
│   ├── pages/               # Route components
│   ├── lib/                 # API client, React Query
│   └── stores/              # Zustand (auth, theme)
└── index.html
```

---

## Success Criteria

- <50ms p95 read latency per region
- No centralized DB calls
- Fan-out completion within seconds
- Feature parity: profiles, follows, timelines, likes, replies, reposts, media, search, notifications, moderation
- Mobile-responsive SPA with theme customization
- AI-powered content seeding for community bootstrapping
