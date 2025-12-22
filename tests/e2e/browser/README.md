# Browser-Based E2E Test Suite

## Overview

This test suite provides comprehensive end-to-end testing of The Wire application using browser automation. It tests all features including authentication, posting, social interactions, and navigation.

## Test Coverage

- **Authentication:** Signup, login, logout, password reset
- **Posts:** Create, view, like, unlike, repost, reply
- **Social Graph:** Follow, unfollow, block, unblock
- **Navigation:** All pages (home, explore, notifications, profile, settings)
- **UI/UX:** Twitter design system, responsive layout
- **Real-time:** WebSocket connections, notifications

## Running Tests

### Prerequisites

1. Server must be running and publicly accessible
2. Server should be on port 8080 with `--ip 0.0.0.0` binding

```bash
cd the-wire
npx wrangler dev --ip 0.0.0.0
```

### Execution

The test scenarios are defined in `comprehensive-test.ts`. To run them:

1. **Manual Browser Testing:**
   - Follow the test specification in `full-app-test.md`
   - Execute each scenario manually
   - Document results

2. **Automated via Browser Operator:**
   - Use the test scenarios from `comprehensive-test.ts`
   - Execute via Browser Operator tool
   - Each scenario is a separate Browser Operator call

### Test Scenarios

The test suite includes 30+ scenarios covering:

1. **Auth Flow** (5 tests)
2. **Post Creation** (4 tests)
3. **Likes** (3 tests)
4. **Replies** (3 tests)
5. **Reposts** (3 tests)
6. **Follow** (4 tests)
7. **Unfollow** (2 tests)
8. **Block** (3 tests)
9. **Unblock** (2 tests)
10. **Navigation** (5 tests)
11. **Profile** (2 tests)
12. **Feed Algorithm** (3 tests)
13. **UI/UX** (3 tests)
14. **Error Handling** (3 tests)

### Expected Results

All tests should pass with:
- ✅ No 404 errors
- ✅ Proper Twitter styling
- ✅ All interactive elements functional
- ✅ Posts visible after creation
- ✅ Social interactions working
- ✅ Notifications created correctly

### Troubleshooting

**Server not accessible:**
- Ensure server bound to 0.0.0.0: `npx wrangler dev --ip 0.0.0.0`
- Check port 8080 is open
- Verify public URL resolves

**Tests failing:**
- Check server logs for errors
- Verify JWT_SECRET is configured
- Check ALLOWED_ORIGINS includes test URL
- Ensure rate limit TTL is >= 60 seconds

**CSRF errors:**
- Add test URL to ALLOWED_ORIGINS in wrangler.toml
- Restart server after configuration changes

## Maintenance

When adding new features:
1. Add test scenario to `comprehensive-test.ts`
2. Document expected behavior in `full-app-test.md`
3. Run full test suite to ensure no regressions

## Current Status

✅ All core features implemented and testable
✅ 30+ test scenarios defined
✅ Test suite successfully run on 2025-12-22
✅ All major flows verified working