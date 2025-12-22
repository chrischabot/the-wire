# The Wire - Comprehensive End-to-End Browser Test Suite

## Test Specification

This document outlines all test scenarios for browser-based E2E testing of The Wire application.

### Test Environment
- **URL:** https://s4eyzk1ft4bh3qve.preview.maestro.igent.ai (or production URL)
- **Browser:** Desktop Chrome
- **Test Users:** Generated dynamically for each test run

---

## Test Scenarios

### 1. Authentication Flow
- [ ] Landing page loads with proper branding
- [ ] Signup form validation works
- [ ] User can create account with valid credentials
- [ ] Duplicate signup prevented (409 error shown)
- [ ] User can log in with credentials
- [ ] Invalid login shows error message
- [ ] Logout redirects to landing page
- [ ] Password reset request works
- [ ] Password reset confirmation works

### 2. Post Creation & Viewing
- [ ] User can create a text post
- [ ] Post appears in own profile timeline
- [ ] Post appears in home feed
- [ ] Character counter works (280 limit)
- [ ] Post timestamp displays correctly
- [ ] Single post view loads correctly
- [ ] Post content displays properly (HTML escaped)

### 3. Social Interactions - Likes
- [ ] User can like a post
- [ ] Like count increments
- [ ] Like button shows liked state (red heart)
- [ ] User can unlike a post
- [ ] Like count decrements
- [ ] Like notification created for post author

### 4. Social Interactions - Replies
- [ ] Reply composer appears on post view
- [ ] User can create a reply
- [ ] Reply appears in thread view
- [ ] Reply count updates on parent post
- [ ] Reply notification created for parent author
- [ ] Nested replies work (reply to reply)

### 5. Social Interactions - Reposts
- [ ] User can repost a post
- [ ] Repost count increments
- [ ] Duplicate repost prevented (409 error)
- [ ] Repost appears in timeline
- [ ] Repost notification created for original author

### 6. Social Graph - Follow
- [ ] User can follow another user
- [ ] Following count increments
- [ ] Follower count increments on target
- [ ] Follow button changes to "Following"
- [ ] Followed user's posts appear in home feed
- [ ] Follow notification created

### 7. Social Graph - Unfollow
- [ ] User can unfollow a user
- [ ] Following count decrements
- [ ] Follower count decrements on target
- [ ] Button changes back to "Follow"
- [ ] Unfollowed user's posts no longer in feed

### 8. Social Graph - Block
- [ ] User can block another user
- [ ] Blocked user's posts don't appear in feed
- [ ] Cannot follow blocked user
- [ ] Block automatically unfollows

### 9. Social Graph - Unblock
- [ ] User can unblock a user
- [ ] Can follow again after unblock
- [ ] Blocked user's new posts can appear

### 10. Navigation - Home
- [ ] Home page loads
- [ ] Feed displays posts from followed users
- [ ] Feed displays user's own posts
- [ ] Compose box functional
- [ ] Timeline scrollable

### 11. Navigation - Explore
- [ ] Explore page loads
- [ ] Tabs functional (For you, Trending, etc.)
- [ ] No 404 errors

### 12. Navigation - Notifications
- [ ] Notifications page loads
- [ ] Notifications list displays correctly
- [ ] Different notification types shown (like, reply, follow, mention, repost)
- [ ] Unread notifications highlighted
- [ ] Can mark notification as read
- [ ] Can mark all as read

### 13. Navigation - Profile
- [ ] Profile page loads for any user
- [ ] /u/me redirects to own profile
- [ ] Banner image displays
- [ ] Avatar displays
- [ ] Bio, location, website display
- [ ] Follower/following counts correct
- [ ] Posts tab shows user's posts
- [ ] Follow/unfollow button works

### 14. Navigation - Settings
- [ ] Settings page loads
- [ ] Can update display name
- [ ] Can update bio
- [ ] Can update location
- [ ] Can update website
- [ ] Can upload avatar
- [ ] Can upload banner
- [ ] Logout button works

### 15. Feed Algorithm
- [ ] Home feed shows chronological posts from followed users
- [ ] Feed includes user's own posts
- [ ] Feed respects blocked users (their posts don't show)
- [ ] Feed respects muted words
- [ ] FoF posts appear in feed (if algorithm enabled)

### 16. Real-time Features
- [ ] WebSocket connection establishes
- [ ] New posts appear in real-time
- [ ] Notifications appear in real-time
- [ ] Like counts update in real-time

### 17. Media Upload
- [ ] Can upload image for post
- [ ] Can upload avatar
- [ ] Can upload banner
- [ ] Invalid file types rejected
- [ ] File size limits enforced

### 18. Error Handling
- [ ] Rate limiting shows proper message
- [ ] CSRF protection doesn't block valid requests
- [ ] 404 page shows for invalid routes
- [ ] Network errors handled gracefully

### 19. UI/UX - Twitter Design
- [ ] 3-column layout on all main pages
- [ ] Left sidebar navigation consistent
- [ ] Twitter color scheme maintained
- [ ] Proper spacing and typography
- [ ] Hover states work on interactive elements
- [ ] Mobile responsive (if implemented)

### 20. Security
- [ ] Banned users cannot access features
- [ ] Admin can ban users
- [ ] Admin can takedown posts
- [ ] CSRF protection active
- [ ] Rate limiting active