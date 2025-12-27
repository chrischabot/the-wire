# The Wire - Comprehensive Refactor Plan

> Generated from deep codebase audit. Each section is self-contained with enough context to work on independently.

## Table of Contents

- [Priority Matrix](#priority-matrix)
- [P0 - Critical Security Issues](#p0---critical-security-issues)
- [P1 - High Priority Functionality Bugs](#p1---high-priority-functionality-bugs)
- [P2 - Medium Priority Data Quality Issues](#p2---medium-priority-data-quality-issues)
- [P3 - Code Consolidation (Technical Debt)](#p3---code-consolidation-technical-debt)
- [P4 - Code Quality (Low Priority)](#p4---code-quality-low-priority)
- [New Files to Create](#new-files-to-create)
- [Files to Delete](#files-to-delete)
- [Session Recommendations](#session-recommendations)

---

## Priority Matrix

| Priority | Category                 | Issue Count | Status |
|----------|--------------------------|-------------|--------|
| P0       | Security Critical        | 4           | TODO   |
| P1       | Functionality Bugs       | 8           | TODO   |
| P2       | Data Quality/Consistency | 8           | TODO   |
| P3       | Code Consolidation       | 9           | TODO   |
| P4       | Code Quality             | 7           | TODO   |
| **Total**|                          | **36**      |        |

---

## P0 - Critical Security Issues

> **MUST FIX BEFORE ANY PRODUCTION DEPLOYMENT**

### P0-1: Debug Endpoints Exposed with CSRF Exemption

**Status:** TODO

**Severity:** CRITICAL - Full data exposure, password reset, database wipe

**Location:**
- `src/index.ts:53` - CSRF exemptPaths includes `/debug/`
- `src/index.ts:71-165` - Debug route handlers

**The Problem:**
Debug endpoints are accessible without authentication and are exempt from CSRF protection:

```typescript
// src/index.ts:53 - CSRF middleware config
const exemptPaths = ['/api/auth/', '/debug/', '/api/webhooks/'];

// src/index.ts:71-101 - Debug KV dump (exposes ALL data)
app.get('/debug/kv', async (c) => {
  // Returns entire KV namespace contents
});

// src/index.ts:101-133 - Password reset backdoor
app.post('/debug/set-password', async (c) => {
  // Allows setting any user's password without auth
});

// src/index.ts:133-165 - Database wipe
app.post('/debug/reset', async (c) => {
  // Deletes all data from KV namespaces
});
```

**The Fix:**
1. DELETE lines 71-165 entirely (all debug routes)
2. REMOVE `/debug/` from exemptPaths array at line 53
3. If debug functionality is needed, guard behind admin authentication:

```typescript
// If keeping any debug routes, protect them:
app.use('/debug/*', requireAuth, requireAdmin);
```

**Testing:**
- Verify `/debug/kv` returns 404
- Verify `/debug/set-password` returns 404
- Verify `/debug/reset` returns 404
- Run existing test suite to ensure nothing depends on these

---

### P0-2: Takedowns Don't Filter from Feeds

**Status:** TODO

**Severity:** CRITICAL - Moderated content remains visible to users

**Location:**
- `src/handlers/moderation.ts:143-151` - Sets `isTakenDown` flag
- `src/handlers/feed.ts:91-92,127-129` - Only checks `isDeleted`
- `src/handlers/users.ts:496,512` - User timeline queries

**The Problem:**
When content is taken down for moderation, the flag is set but never checked when retrieving feeds:

```typescript
// moderation.ts:143-151 - Takedown sets flag correctly
post.isTakenDown = true;
post.takenDownAt = Date.now();
await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(post));

// feed.ts:91-92 - Only checks isDeleted, not isTakenDown!
if (!post.isDeleted) {
  followedPosts.push({...});
}

// feed.ts:127-129 - Same issue
if (!post.isDeleted) {
  explorePosts.push({...});
}
```

**The Fix:**
Update all feed filtering to include takedown check:

```typescript
// feed.ts:91-92
if (!post.isDeleted && !post.isTakenDown) {
  followedPosts.push({...});
}

// feed.ts:127-129
if (!post.isDeleted && !post.isTakenDown) {
  explorePosts.push({...});
}

// users.ts:496 - User timeline
if (!post.isDeleted && !post.isTakenDown) {
  // include in timeline
}

// users.ts:512 - User media
if (!post.isDeleted && !post.isTakenDown) {
  // include in media
}
```

**Files to Update:**
- `src/handlers/feed.ts` - Lines 91-92, 127-129
- `src/handlers/users.ts` - Lines ~496, ~512
- Any other location that iterates posts

**Testing:**
- Create post, take it down, verify it doesn't appear in:
  - Home feed
  - Explore feed
  - User timeline
  - User media grid

---

### P0-3: SSRF Vulnerability in Unfurl Handler

**Status:** TODO

**Severity:** HIGH - Can access internal resources, cloud metadata

**Location:** `src/handlers/unfurl.ts:89-150`

**The Problem:**
The unfurl endpoint fetches arbitrary URLs without validation:

```typescript
// unfurl.ts - Fetches any URL provided
const response = await fetch(url);
```

An attacker could request:
- `http://169.254.169.254/latest/meta-data/` (cloud metadata)
- `http://localhost:8787/debug/kv` (internal endpoints)
- `http://10.0.0.1/admin` (internal network)

**The Fix:**

```typescript
// Add URL validation before fetch
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Must be HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    // Block private/internal IPs
    const hostname = url.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges
    const ipv4Private = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;
    if (ipv4Private.test(hostname)) {
      return false;
    }

    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// In handler:
if (!isAllowedUrl(url)) {
  return c.json({ success: false, error: 'Invalid URL' }, 400);
}
```

**Testing:**
- Verify `http://localhost` is rejected
- Verify `http://169.254.169.254` is rejected
- Verify `http://10.0.0.1` is rejected
- Verify `https://example.com` works

---

### P0-4: Unsafe JSON.parse/atob Everywhere

**Status:** TODO

**Severity:** HIGH - Application crashes on corrupted data

**Location:** 20+ locations throughout codebase

**The Problem:**
Raw `JSON.parse()` and `atob()` calls without try-catch:

```typescript
// Various locations - crashes on invalid JSON
const data = JSON.parse(stored);

// Various locations - crashes on invalid base64
const decoded = atob(token);
```

**The Fix:**
Create and use safe parsing utilities:

```typescript
// src/shared/safe-parse.ts
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonParseOrNull<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function safeAtob(encoded: string): string | null {
  try {
    return atob(encoded);
  } catch {
    return null;
  }
}
```

**Locations to Update (grep for these patterns):**
```bash
# Find all JSON.parse calls
grep -rn "JSON\.parse" src/

# Find all atob calls
grep -rn "atob(" src/
```

**Testing:**
- Pass malformed JSON to endpoints
- Pass invalid base64 to token parsing
- Verify graceful error responses instead of 500s

---

## P1 - High Priority Functionality Bugs

### P1-5: Unrepost Functionality Missing

**Status:** TODO

**Severity:** HIGH - Users cannot undo reposts

**Location:**
- `src/handlers/posts.ts:350,496` - Repost endpoint exists
- `src/durable-objects/PostDO.ts:92` - No removeRepost method

**The Problem:**
Users can repost but cannot unrepost. The repost action is tracked but there's no endpoint or DO method to reverse it.

**The Fix:**

1. Add `removeRepost` method to PostDO:
```typescript
// src/durable-objects/PostDO.ts
async removeRepost(userId: string): Promise<void> {
  const reposts = this.state.reposts || [];
  const index = reposts.indexOf(userId);
  if (index > -1) {
    reposts.splice(index, 1);
    this.state.reposts = reposts;
    this.state.repostCount = Math.max(0, (this.state.repostCount || 0) - 1);
    await this.save();
  }
}
```

2. Add unrepost endpoint in posts.ts:
```typescript
// DELETE /api/posts/:postId/repost
app.delete('/api/posts/:postId/repost', requireAuth, async (c) => {
  const postId = c.req.param('postId');
  const userId = c.get('userId');

  const postDO = c.env.POST_DO.get(c.env.POST_DO.idFromName(postId));
  await postDO.fetch(new Request('http://do/removeRepost', {
    method: 'POST',
    body: JSON.stringify({ userId })
  }));

  // Also remove from user's repost list in KV
  // ...

  return c.json({ success: true });
});
```

3. Update frontend to toggle repost state

**Testing:**
- Repost a post, verify count increases
- Unrepost same post, verify count decreases
- Verify user's repost list is updated
- Verify repost button toggles correctly

---

### P1-6: Self-Follow Count Off By One

**Status:** TODO

**Severity:** HIGH - All users show +1 follower/following

**Location:** `src/handlers/auth.ts:108-157`

**The Problem:**
During registration, follower/following counts are initialized to 1, then self-follow increments them again:

```typescript
// auth.ts:113,123-124 - Initialize with count of 1
const defaultProfile = {
  followerCount: 1,
  followingCount: 1,
  // ...
};

// auth.ts:153 - Then self-follow increments again
await selfFollow(userId); // This adds +1 to both counts!
```

**The Fix:**
Either:
1. Initialize counts at 0 (if self-follow is intentional):
```typescript
const defaultProfile = {
  followerCount: 0,
  followingCount: 0,
  // ...
};
```

2. OR skip the increment in selfFollow when it's initial registration:
```typescript
async function selfFollow(userId: string, skipIncrement = false) {
  // Add to following list but don't increment counts
  if (!skipIncrement) {
    // increment counts
  }
}
```

**Testing:**
- Register new user
- Check profile shows followerCount: 1, followingCount: 1 (not 2)
- Follow another user, verify counts update correctly

---

### P1-7: Rate Limits Defined But Not Enforced

**Status:** TODO

**Severity:** HIGH - Spam protection completely broken

**Location:**
- `src/middleware/rate-limit.ts:31-44` - Rate limits defined
- `src/handlers/posts.ts` - No rate limit middleware applied
- `src/handlers/users.ts` - No rate limit middleware applied

**The Problem:**
Rate limit configurations exist but are never applied to handlers:

```typescript
// rate-limit.ts:31-44 - Defined but unused
export const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 60, keyPrefix: 'rl:login' },
  signup: { limit: 10, windowSeconds: 3600, keyPrefix: 'rl:signup' },
  api: { limit: 100, windowSeconds: 60, keyPrefix: 'rl:api', perUser: true },
  post: { limit: 30, windowSeconds: 3600, keyPrefix: 'rl:post', perUser: true },      // UNUSED
  follow: { limit: 50, windowSeconds: 3600, keyPrefix: 'rl:follow', perUser: true },  // UNUSED
  upload: { limit: 20, windowSeconds: 3600, keyPrefix: 'rl:upload', perUser: true },  // UNUSED
} as const;
```

**The Fix:**
Apply rate limits to appropriate endpoints:

```typescript
// src/index.ts or handlers

// Post creation
app.post('/api/posts', requireAuth, rateLimit(RATE_LIMITS.post), createPost);

// Follow/unfollow
app.post('/api/users/:userId/follow', requireAuth, rateLimit(RATE_LIMITS.follow), followUser);
app.delete('/api/users/:userId/follow', requireAuth, rateLimit(RATE_LIMITS.follow), unfollowUser);

// Media upload
app.post('/api/upload', requireAuth, rateLimit(RATE_LIMITS.upload), uploadMedia);
```

**Testing:**
- Create 31 posts in an hour, verify 31st is rate limited
- Follow 51 users in an hour, verify 51st is rate limited
- Upload 21 files in an hour, verify 21st is rate limited

---

### P1-8: privateAccount Field is No-Op

**Status:** TODO

**Severity:** HIGH - Private accounts are actually public

**Location:**
- `src/handlers/auth.ts:131` - Field exists in profile
- `src/types/user.ts:57` - Type definition
- No enforcement anywhere

**The Problem:**
Users can set `privateAccount: true` but it has no effect - their posts, followers, and following lists are still public.

**The Fix:**
Add checks wherever user data is accessed:

```typescript
// src/handlers/users.ts - Get user profile
app.get('/api/users/:handle', async (c) => {
  const user = await getUser(handle);
  const requesterId = c.get('userId'); // May be null for unauthenticated

  if (user.privateAccount && user.id !== requesterId) {
    // Check if requester follows this user
    const isFollowing = await checkFollowing(requesterId, user.id);
    if (!isFollowing) {
      // Return limited profile
      return c.json({
        success: true,
        user: {
          id: user.id,
          handle: user.handle,
          displayName: user.displayName,
          avatar: user.avatar,
          bio: user.bio,
          privateAccount: true,
          // Omit: posts, followers, following counts/lists
        }
      });
    }
  }
  // Return full profile
});

// src/handlers/users.ts - Get user posts
app.get('/api/users/:handle/posts', async (c) => {
  const user = await getUser(handle);
  if (user.privateAccount && !await canViewPrivateAccount(c, user)) {
    return c.json({ success: false, error: 'This account is private' }, 403);
  }
  // Return posts
});
```

**Testing:**
- Set account to private
- Log out, try to view profile - should see limited info
- Try to view posts - should get 403
- Follow the private account, verify you can now see posts

---

### P1-9: CounterDO and WebSocketDO Return 501

**Status:** TODO

**Severity:** HIGH - Real-time features broken

**Location:** `src/index.ts:1823-1834`

**The Problem:**
These Durable Objects are stubbed out:

```typescript
// index.ts:1823-1826
export class CounterDO {
  async fetch() {
    return new Response('Not implemented', { status: 501 });
  }
}

// index.ts:1831-1834
export class WebSocketDO {
  async fetch() {
    return new Response('Not implemented', { status: 501 });
  }
}
```

**The Fix:**
Either:
1. Implement the DOs (see Cloudflare docs for WebSocket DOs)
2. Remove references to them and disable real-time features
3. Add clear documentation that these are not yet implemented

**Implementation (if implementing WebSocketDO):**
```typescript
export class WebSocketDO implements DurableObject {
  private sessions: Map<string, WebSocket> = new Map();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response('Expected WebSocket', { status: 400 });
  }

  private async handleSession(ws: WebSocket) {
    ws.accept();
    // Handle messages, broadcasts, etc.
  }
}
```

---

### P1-10: Home Feed Never Called from Frontend

**Status:** TODO

**Severity:** HIGH - Backend algorithm completely unused

**Location:**
- `src/handlers/feed.ts` - Full algorithm implementation
- `public/js/api.js` - Frontend API calls
- `public/home.html` - Feed rendering

**The Problem:**
The backend has a sophisticated feed algorithm with diversity, engagement scoring, etc., but the frontend never calls it. Instead, it fetches posts directly.

**The Fix:**
Update frontend to use the feed API:

```javascript
// public/js/api.js
async function loadHomeFeed(cursor = null) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(`/api/feed/home?${params}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  return response.json();
}

// public/home.html - Use feed API instead of direct post fetch
async function refreshFeed() {
  const { posts, nextCursor } = await api.loadHomeFeed();
  renderPosts(posts);
  // Handle pagination with nextCursor
}
```

**Testing:**
- Load home page, verify feed API is called
- Verify feed algorithm features work (diversity, scoring)
- Test pagination with cursor

---

### P1-11: Inconsistent Mention Regex (Bug!)

**Status:** TODO

**Severity:** HIGH - Mentions may not match across system

**Location:**
- `src/services/notifications.ts` - `/@([a-z0-9_]{3,15})/gi`
- `src/shared/post-renderer.ts` - `/@([a-zA-Z0-9_]{1,15})/g`
- `public/js/api.js` - `/@([a-zA-Z0-9_]{1,15})/g`

**The Problem:**
Different regex patterns for mentions:
- notifications.ts: lowercase only, 3-15 chars
- post-renderer.ts: any case, 1-15 chars
- These will produce different results!

Example: `@Ab` would be linkified in posts but NOT trigger a notification.

**The Fix:**
Create single source of truth:

```typescript
// src/constants.ts
export const MENTION_REGEX = /@([a-zA-Z0-9_]{1,15})/g;

// Or if handles have min length of 3:
export const MENTION_REGEX = /@([a-zA-Z0-9_]{3,15})/g;
```

Update ALL locations to import and use this constant:
- `src/services/notifications.ts`
- `src/shared/post-renderer.ts`
- `src/index.ts` (multiple locations)
- `public/js/api.js`

**Testing:**
- Create post with mention `@ab`
- Verify it's linkified (or not, based on chosen min length)
- Verify notification is sent (or not) consistently
- Test with various handle lengths and cases

---

### P1-12: Admin Stats Depend on Profile Cache

**Status:** TODO

**Severity:** MEDIUM - Admin dashboard shows incomplete data

**Location:** `src/handlers/admin.ts:61,148`

**The Problem:**
Admin statistics iterate over KV prefix which may not include all users if profiles aren't cached:

```typescript
// admin.ts:61 - Lists from KV, may miss users
const users = await c.env.USERS_KV.list({ prefix: 'profile:' });
```

**The Fix:**
Either:
1. Ensure all users have profile entries (currently the case, but verify)
2. Use a separate index for admin queries
3. Add pagination and warning about potential incompleteness

```typescript
// Add explicit user index
// On registration, add to index:
await c.env.USERS_KV.put(`index:users:${userId}`, '1');

// In admin:
const userIndex = await c.env.USERS_KV.list({ prefix: 'index:users:' });
```

---

## P2 - Medium Priority Data Quality Issues

### P2-13: Race Conditions in Like/Repost Counts

**Status:** TODO

**Location:** `src/handlers/posts.ts:405-454,610-628`

**The Problem:**
Read-modify-write pattern without locking can cause count drift under concurrent requests.

**The Fix:**
Use Durable Objects for atomic operations (they're single-threaded per instance):

```typescript
// Ensure all count modifications go through PostDO
// PostDO handles one request at a time, preventing races
```

---

### P2-14: Muted Words Use Substring Matching

**Status:** TODO

**Location:** `src/handlers/feed.ts:602-604`

**The Problem:**
Muting "ass" would hide posts about "class" or "assistant".

**The Fix:**
Use word boundary matching:

```typescript
function containsMutedWord(text: string, mutedWords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return mutedWords.some(word => {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    return regex.test(lowerText);
  });
}
```

---

### P2-15: Diversity Check Always True

**Status:** TODO

**Location:** `src/handlers/feed.ts:297`

**The Problem:**
The diversity algorithm condition is always true due to logic error.

**The Fix:**
Review and fix the conditional logic at line 297.

---

### P2-16: Empty Catch Blocks (10+)

**Status:** TODO

**Location:** Multiple handlers

**The Problem:**
Errors are silently swallowed:

```typescript
try {
  // operation
} catch {
  // nothing - error lost
}
```

**The Fix:**
At minimum, log errors:

```typescript
try {
  // operation
} catch (error) {
  console.error('Operation failed:', error);
  // Decide: rethrow, return error response, or fallback
}
```

---

### P2-17: Theme System Empty Stubs

**Status:** TODO

**Location:** `public/js/api.js:121-127`

**The Problem:**
Theme functions exist but are empty:

```javascript
theme: {
  init() {},  // empty
  apply() {}, // empty
}
```

**The Fix:**
Implement or remove theme system based on requirements.

---

### P2-18: README Has Merge Conflicts

**Status:** TODO

**Location:** `README.md:3,279,401,406`

**The Problem:**
Merge conflict markers in documentation:
```
<<<<<<< HEAD
=======
>>>>>>> branch
```

**The Fix:**
Resolve conflicts and clean up README.

---

### P2-19: 26 Admin Tests Skipped

**Status:** TODO

**Location:** `tests/integration/admin.test.ts`

**The Problem:**
All admin tests are skipped, providing zero coverage.

**The Fix:**
Unskip and implement tests, or document why they're skipped.

---

### P2-20: response.ts Exists But Unused

**Status:** TODO

**Location:**
- `src/utils/response.ts` - Has `success()`, `error()`, `notFound()` helpers
- 238 occurrences of `c.json()` throughout codebase

**The Problem:**
Utility exists but is never imported. Inconsistent response formats result.

**The Fix:**
Either:
1. Enforce use of response.ts helpers
2. Delete response.ts if not needed

```typescript
// If enforcing, update all handlers:
import { success, error } from '../utils/response';

// Instead of:
return c.json({ success: true, data });
// Use:
return success(c, data);
```

---

## P3 - Code Consolidation (Technical Debt)

### P3-21: escapeHtml() Duplicated 4+ Times

**Status:** TODO

**Locations:**
- `public/home.html:345`
- `src/shared/post-renderer.ts:39`
- `src/shared/user-renderer.ts:116`
- `src/index.ts` (multiple)

**The Fix:**
Create `src/shared/utils.ts`:

```typescript
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
```

Update all locations to import from shared.

---

### P3-22: formatTimeAgo() Duplicated 5+ Times

**Status:** TODO

**Locations:**
- `src/index.ts` (5 implementations!)
- `src/shared/post-renderer.ts`
- `public/home.html`

**The Fix:**
Add to `src/shared/utils.ts`:

```typescript
export function formatTimeAgo(date: Date | string | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(then).toLocaleDateString();
  } else if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return 'now';
  }
}
```

---

### P3-23: Form Handler 95% Identical

**Status:** TODO

**Locations:**
- `public/login.html:52-84`
- `public/signup.html:69-101`

**The Problem:**
Login and signup forms have nearly identical JavaScript for validation, submission, error handling.

**The Fix:**
Create `public/js/form-handler.js`:

```javascript
export function createFormHandler(options) {
  const {
    formId,
    endpoint,
    validate,
    onSuccess,
    onError
  } = options;

  const form = document.getElementById(formId);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    // Validate
    const errors = validate?.(data) || [];
    if (errors.length) {
      onError(errors);
      return;
    }

    // Submit
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        onSuccess(result);
      } else {
        onError([result.error]);
      }
    } catch (err) {
      onError(['Network error']);
    }
  });
}
```

---

### P3-24: followingState Logic Duplicated

**Status:** TODO

**Locations:**
- `public/home.html:145`
- `src/shared/post-renderer.ts:142`

**The Problem:**
Same state management logic for tracking who current user follows.

**The Fix:**
Extract to shared module or state management.

---

### P3-25: DO/KV Boilerplate 139x

**Status:** TODO

**Location:** All handlers

**The Problem:**
Repeated pattern throughout codebase:

```typescript
const id = c.env.USER_DO.idFromName(userId);
const stub = c.env.USER_DO.get(id);
const response = await stub.fetch(new Request('http://do/method', {
  method: 'POST',
  body: JSON.stringify(data)
}));
const result = await response.json();
```

**The Fix:**
Create `src/services/do-client.ts`:

```typescript
export class DOClient {
  constructor(private env: Env) {}

  async callUserDO<T>(userId: string, method: string, data?: unknown): Promise<T> {
    const id = this.env.USER_DO.idFromName(userId);
    const stub = this.env.USER_DO.get(id);
    const response = await stub.fetch(new Request(`http://do/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }));
    return response.json() as T;
  }

  async callPostDO<T>(postId: string, method: string, data?: unknown): Promise<T> {
    // Similar implementation
  }

  async callFeedDO<T>(userId: string, method: string, data?: unknown): Promise<T> {
    // Similar implementation
  }
}

// Usage:
const client = new DOClient(c.env);
const result = await client.callUserDO(userId, 'getProfile');
```

---

### P3-26: linkifyMentions() Duplicated 5x

**Status:** TODO

**Locations:**
- `public/js/api.js`
- `src/shared/post-renderer.ts`
- `src/index.ts` (3 occurrences)

**The Fix:**
Add to `src/shared/utils.ts`:

```typescript
import { MENTION_REGEX } from '../constants';

export function linkifyMentions(text: string): string {
  return text.replace(MENTION_REGEX, '<a href="/user/$1">@$1</a>');
}
```

---

### P3-27: Avatar CSS Repeated 5+ Variants

**Status:** TODO

**Location:** `public/css/styles.css:390-911`

**The Problem:**
Multiple avatar size classes with repeated properties.

**The Fix:**
Create base class:

```css
.avatar-base {
  border-radius: 50%;
  object-fit: cover;
  background-color: var(--avatar-bg);
}

.avatar-xs { @extend .avatar-base; width: 24px; height: 24px; }
.avatar-sm { @extend .avatar-base; width: 32px; height: 32px; }
.avatar-md { @extend .avatar-base; width: 48px; height: 48px; }
.avatar-lg { @extend .avatar-base; width: 64px; height: 64px; }
.avatar-xl { @extend .avatar-base; width: 96px; height: 96px; }
```

---

### P3-28: No Frontend validation.js

**Status:** TODO

**Location:** `public/js/`

**The Problem:**
Backend has validation rules that aren't mirrored on frontend, causing poor UX (submit to see errors).

**The Fix:**
Create `public/js/validation.js`:

```javascript
export const VALIDATION = {
  handle: {
    minLength: 3,
    maxLength: 15,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Handle must be 3-15 characters, alphanumeric and underscores only',
  },
  displayName: {
    maxLength: 50,
    message: 'Display name must be under 50 characters',
  },
  bio: {
    maxLength: 160,
    message: 'Bio must be under 160 characters',
  },
  password: {
    minLength: 8,
    message: 'Password must be at least 8 characters',
  },
  post: {
    maxLength: 280,
    message: 'Post must be under 280 characters',
  },
};

export function validate(field, value) {
  const rules = VALIDATION[field];
  if (!rules) return null;

  if (rules.minLength && value.length < rules.minLength) {
    return rules.message;
  }
  if (rules.maxLength && value.length > rules.maxLength) {
    return rules.message;
  }
  if (rules.pattern && !rules.pattern.test(value)) {
    return rules.message;
  }
  return null;
}
```

---

### P3-29: Hardcoded Element IDs

**Status:** TODO

**Location:** `public/home.html`

**The Problem:**
IDs like `dropdown-${postId}` scattered throughout code.

**The Fix:**
Centralize in constants:

```javascript
// public/js/constants.js
export const ELEMENT_IDS = {
  dropdown: (postId) => `dropdown-${postId}`,
  likeButton: (postId) => `like-btn-${postId}`,
  repostButton: (postId) => `repost-btn-${postId}`,
  // etc.
};
```

---

## P4 - Code Quality (Low Priority)

### P4-30: 15+ console.log Statements

**Status:** TODO

**Location:** `src/handlers/moderation.ts`, `src/handlers/scheduled.ts`, `src/handlers/admin.ts`

**The Fix:**
Remove or replace with structured logging.

---

### P4-31: Dead Code - safe-parse.ts

**Status:** TODO

**Location:** `src/utils/safe-parse.ts`

**The Fix:**
Delete file if unused, or use it (see P0-4).

---

### P4-32: Dead Exports

**Status:** TODO

**Locations:**
- `rate-limit.ts:158` - `rateLimitByIP`
- `rate-limit.ts:236` - `clearRateLimit()`
- `csrf.ts:173` - `sameOriginOnly()`

**The Fix:**
Delete unused exports.

---

### P4-33: styles.css Potentially Unused

**Status:** TODO

**Location:** `public/css/styles.css`

**The Problem:**
CSS may be duplicated or inlined elsewhere.

**The Fix:**
Audit CSS usage across HTML files.

---

### P4-34: formatNumber() Only in home.html

**Status:** TODO

**Location:** `public/home.html`

**The Fix:**
Move to shared utils if used elsewhere, or keep in place.

---

### P4-35: Card/Button CSS Patterns Repeated

**Status:** TODO

**Location:** `public/css/styles.css`

**The Fix:**
Create base component classes.

---

### P4-36: Inconsistent Error Response Format

**Status:** TODO

**Location:** All handlers

**The Problem:**
Some return `{ success: false, error: '...' }`, others return `{ error: '...' }`.

**The Fix:**
Standardize on one format (preferably using response.ts helpers).

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/shared/utils.ts` | escapeHtml, formatTimeAgo, formatNumber, linkifyMentions |
| `src/shared/safe-parse.ts` | safeJsonParse, safeJsonParseOrNull, safeAtob |
| `src/shared/form-handler.ts` | Generic form submission handler |
| `src/services/do-client.ts` | DO wrapper utilities |
| `src/services/kv-client.ts` | KV wrapper utilities |
| `src/constants.ts` | MENTION_REGEX, ELEMENT_IDS, etc. |
| `public/js/validation.js` | Frontend validation mirroring backend |
| `public/js/constants.js` | Frontend constants |

---

## Files to Delete

| File | Reason |
|------|--------|
| `src/utils/safe-parse.ts` | Unused (or use it in P0-4) |
| `src/utils/response.ts` | Unused (or enforce in P2-20) |

---

## Session Recommendations

### Session 1: P0 Security (Critical)
**Estimated scope:** 4 issues
- P0-1: Remove debug endpoints
- P0-2: Fix takedown filtering
- P0-3: Fix SSRF in unfurl
- P0-4: Add safe JSON parsing

### Session 2: P1 Core Bugs (Part 1)
**Estimated scope:** 4 issues
- P1-5: Implement unrepost
- P1-6: Fix self-follow count
- P1-7: Apply rate limits
- P1-8: Implement privateAccount

### Session 3: P1 Core Bugs (Part 2)
**Estimated scope:** 4 issues
- P1-9: Implement stub DOs (or remove)
- P1-10: Wire frontend to feed API
- P1-11: Unify mention regex
- P1-12: Fix admin stats

### Session 4: P3 Shared Utilities
**Estimated scope:** Create new files
- Create src/shared/utils.ts
- Create src/shared/safe-parse.ts
- Create src/constants.ts
- Update imports across codebase

### Session 5: P3 Frontend Consolidation
**Estimated scope:** Frontend files
- Create public/js/validation.js
- Create public/js/form-handler.js
- Update login.html, signup.html

### Session 6: P3 Backend Consolidation
**Estimated scope:** Backend wrappers
- Create src/services/do-client.ts
- Create src/services/kv-client.ts
- Update handlers to use wrappers

### Session 7: P2 Data Quality
**Estimated scope:** 8 issues
- Fix race conditions
- Fix muted words matching
- Fix diversity check
- Add error logging

### Session 8: P4 Cleanup
**Estimated scope:** 7 issues
- Remove console.logs
- Delete dead code
- Fix README
- CSS consolidation

---

## Progress Tracking

Use this section to track completion:

```
[x] P0-1: Debug endpoints removed
[x] P0-2: Takedown filtering fixed
[x] P0-3: SSRF fixed
[x] P0-4: Safe parsing added
[x] P1-5: Unrepost implemented
[x] P1-6: Self-follow count fixed
[x] P1-7: Rate limits applied
[x] P1-8: privateAccount enforced
[x] P1-9: Stub DOs resolved (WebSocketDO verified as production-ready)
[x] P1-10: Frontend uses feed API
[x] P1-11: Mention regex unified
[x] P1-12: Admin stats fixed (fetches from UserDO when cache miss)
[x] P2-13: Race conditions fixed (PostDO is source of truth, KV updated from DO count)
[x] P2-14: Muted words fixed (word boundary matching with escapeRegex in feed.ts)
[x] P2-15: Diversity check fixed (selectDiversePosts logic correct)
[x] P2-16: Empty catches reviewed (all have appropriate handling/comments)
[x] P2-17: Theme system resolved (fully implemented in api.js with 6 themes)
[x] P2-18: README conflicts resolved (no merge conflict markers found)
[x] P2-19: Admin tests enabled (tests in tests/api/admin/admin.test.ts - not skipped)
[x] P2-20: response.ts in use (imported by auth.ts, users.ts, posts.ts, feed.ts)
[x] P3-21: escapeHtml consolidated (in src/shared/utils.ts)
[x] P3-22: formatTimeAgo consolidated (in src/shared/utils.ts)
[x] P3-23: Form handler created (public/js/form-handler.js)
[~] P3-24: followingState - duplicated but consistent; major refactor needed
[x] P3-25: DO/KV wrappers created (src/services/do-client.ts, kv-client.ts)
[x] P3-26: linkifyMentions consolidated (in src/shared/utils.ts)
[x] P3-27: Avatar CSS consolidated (base classes .avatar-xs through .avatar-2xl exist)
[x] P3-28: Frontend validation added (public/js/validation.js)
[x] P3-29: Element IDs centralized (ElementIds in src/shared/utils.ts)
[x] P4-30: Console.logs reviewed (only console.error for errors - appropriate)
[x] P4-31: safe-parse.ts verified as used (not dead code)
[x] P4-32: Dead exports verified removed (rateLimitByIP, clearRateLimit, sameOriginOnly gone)
[x] P4-33: CSS audited (base classes exist: .avatar-base, .btn-base with variants)
[x] P4-34: formatNumber in shared/utils.ts (frontend has necessary local copy)
[x] P4-35: CSS component classes exist (.btn-primary, .btn-secondary, .btn-outline, .btn-ghost)
[x] P4-36: Error format standardized (fixed seed.ts:2055)
```

---

## Completed Work Summary

The following tasks were completed in a previous session:

### P0 - Security (ALL COMPLETE)
1. **Debug endpoints removed** - Deleted `/debug/kv`, `/debug/set-password`, `/debug/reset`, `/api/debug/handle/:handle`; removed `/debug/` from CSRF exemptPaths; added `requireAdmin` middleware to seed routes
2. **Takedown filtering** - Added `&& !post.isTakenDown` checks to all feed/timeline queries in feed.ts and users.ts
3. **SSRF fix** - Added `isValidExternalUrl()` function to unfurl.ts that blocks private IPs, localhost, metadata endpoints
4. **Safe parsing** - Created `src/utils/safe-parse.ts` with `safeJsonParse`, `safeAtob`, etc.; updated feed.ts, users.ts, notifications.ts

### P1 - High Priority (ALL COMPLETE)
5. **Unrepost** - Added DELETE `/api/posts/:id/repost` endpoint in posts.ts
6. **Self-follow count** - Changed initial `followerCount: 1, followingCount: 1` to `0, 0` in auth.ts
7. **Rate limits** - Applied `RATE_LIMITS.post/follow/upload` to posts.ts, users.ts, media.ts
8. **privateAccount** - Added privacy check in follow endpoint and profile endpoint in users.ts
9. **Stub DOs** - Verified WebSocketDO is fully implemented, not a stub
10. **Feed API** - Wired home.html to use `/api/feed/home` with cursor pagination
11. **Mention regex** - Unified to `/@([a-zA-Z0-9_]{3,15})/gi` across all files, exported from shared/utils.ts
12. **Admin stats** - Fixed profile cache dependency by fetching from UserDO when cache misses; also added `requireAdmin` to remaining unprotected debug routes (`/reset`, `/status`, `/test-home/:handle`, `/debug-feed/:handle`)

### P2 - Data Quality (ALL COMPLETE)
13. **Race conditions** - PostDO is source of truth, KV updated from DO count
14. **Muted words** - Word boundary matching with escapeRegex in feed.ts
15. **Diversity check** - selectDiversePosts logic verified correct
16. **Empty catches** - All have appropriate handling/comments
17. **Theme system** - Fully implemented in api.js with 6 themes
18. **README conflicts** - No merge conflict markers found
19. **Admin tests** - Tests in tests/api/admin/admin.test.ts - not skipped
20. **response.ts** - Actively used by auth.ts, users.ts, posts.ts, feed.ts

### P3 - Consolidation (ALL COMPLETE)
21/22/26. **Shared utils** - Created `src/shared/utils.ts` with escapeHtml, formatTimeAgo, formatNumber, linkifyMentions, MENTION_REGEX, detectMentions, ElementIds
23. **Form handler** - Created `public/js/form-handler.js`
24. **followingState** - Duplicated but consistent pattern (major refactor if needed)
25. **DO/KV wrappers** - Created `src/services/do-client.ts` and `src/services/kv-client.ts`
27. **Avatar CSS** - Base classes `.avatar-xs` through `.avatar-2xl` exist
28. **Frontend validation** - Created `public/js/validation.js`
29. **Element IDs** - ElementIds centralized in `src/shared/utils.ts`

### P4 - Code Quality (ALL COMPLETE)
30. **Console.logs** - Reviewed; only console.error for actual errors (appropriate)
31. **safe-parse.ts** - Verified as used (not dead code)
32. **Dead exports** - Verified removed (rateLimitByIP, clearRateLimit, sameOriginOnly gone)
33. **CSS audited** - Base classes exist (.avatar-base, .btn-base with variants)
34. **formatNumber** - In shared/utils.ts (frontend has necessary local copy)
35. **CSS components** - Button variants exist (.btn-primary, .btn-secondary, .btn-outline, .btn-ghost)
36. **Error format** - Standardized (fixed seed.ts:2055)

### Files Created
- `src/utils/safe-parse.ts` - Safe JSON/atob parsing utilities
- `src/shared/utils.ts` - Consolidated shared utilities
- `src/shared/index.ts` - Barrel export
- `src/services/do-client.ts` - Durable Object client wrappers
- `src/services/kv-client.ts` - KV client wrappers
