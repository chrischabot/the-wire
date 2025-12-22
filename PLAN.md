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
| Scale test: 1000 users | ⚠️ Partial | Harness configured for 2000 users |
| Random follow graphs | ✅ Implemented | In load harness |
| Posts, likes, replies | ✅ Implemented | |
| Media uploads in tests | ❌ Missing | |
| Load simulation | ✅ Implemented | |
| Feed correctness verification | ✅ Implemented | |
| Muted/blocks propagation test | ❌ Missing | |

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

---

## Implementation Roadmap

### P0 - Immediate (Security Critical)

- [x] **Rate Limiting Middleware**
  - KV-based rate limiter
  - 5 login attempts per IP per minute
  - 10 signups per IP per hour
  - 100 API requests per user per minute

- [x] **CSRF Protection**
  - Origin header validation
  - SameSite cookie configuration

- [x] **Cron Handlers**
  - Implement `scheduled()` export
  - FoF ranking updates (every 15 min)
  - Feed cleanup (hourly)
  - KV compaction (daily)

- [x] **Fix Media Serving**
  - Remove non-functional image resizing params
  - Generate absolute URLs
  - Add magic byte validation

### P1 - Short-term (Feature Completion)

- [x] **Feed Algorithm**
  - Implement FoF post fetching
  - Round-robin merge (2 followed + 1 FoF)
  - Hacker News-style ranking for FoF

- [x] **Moderation System**
  - Admin roles and permissions
  - User ban functionality
  - Post takedown capability
  - Global ban enforcement

- [x] **Repost/Retweet**
  - POST /api/posts/:id/repost endpoint
  - Fan-out reposts to followers
  - Display reposts in feed

- [x] **Password Reset**
  - Handle + email verification
  - Time-limited reset tokens (15 min TTL)
  - One-time use tokens

- [x] **WebSocket Real-time**
  - Implement WebSocketDO with connection management
  - Live feed updates via WebSocket broadcasts
  - Real-time notifications delivery
  - Connection state management per user

- [x] **Notifications System**
  - KV-based storage with 30-day TTL
  - @mention detection in posts
  - Like/reply/follow/mention/repost notification triggers
  - Notification API endpoints (fetch, mark read, unread count)
  - Real-time notification delivery via WebSocket

### P2 - Medium-term (Enhancement)

- [x] **User Timeline Endpoint**
  - GET /api/users/:handle/posts
  - Pagination support
  - Include replies option

- [x] **Reply Thread View**
  - GET /api/posts/:id/thread
  - Recursive reply fetching
  - Thread pagination

---

## Summary

| Category | Complete | Partial | Missing |
|----------|----------|---------|---------|
| Core Infrastructure | 5 | 1 | 1 |
| Authentication | 5 | 0 | 0 |
| User/Profile | 11 | 1 | 2 |
| Posts | 9 | 1 | 0 |
| Media | 5 | 1 | 0 |
| Feed System | 5 | 0 | 4 |
| Fan-out | 3 | 1 | 0 |
| Moderation | 2 | 0 | 3 |
| Real-time | 0 | 0 | 3 |
| Testing | 5 | 1 | 2 |

**Overall Completion: ~70%**

The foundation is solid, but differentiating features (smart feed algorithm, real-time, moderation) are missing. Security hardening is required before production deployment.