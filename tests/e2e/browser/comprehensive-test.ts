/**
 * Comprehensive End-to-End Browser Test Suite for The Wire
 * 
 * This test suite systematically tests all features of the application
 * using browser automation. It can be run after any code changes to
 * verify functionality remains intact.
 * 
 * Usage: Configure E2E_BASE_URL environment variable, then run test scenarios
 */

/**
 * Test Configuration
 */
const timestamp = Date.now();
const aliceSuffix = `alice_${timestamp}`;
const bobSuffix = `bob_${timestamp}`;

export const TEST_CONFIG = {
  // Base URL is configurable via environment variable
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:8080',
  device: 'Desktop Chrome' as const,
  
  // Test user credentials (generated fresh for each run with consistent suffixes)
  users: {
    alice: {
      handle: aliceSuffix,
      email: `${aliceSuffix}@test.com`,
      password: 'TestPass123!',
      displayName: 'Alice Tester',
      bio: 'Testing The Wire',
    },
    bob: {
      handle: bobSuffix,
      email: `${bobSuffix}@test.com`,
      password: 'TestPass456!',
      displayName: 'Bob Tester',
      bio: 'Also testing',
    },
  },
  
  // Test content
  posts: {
    first: 'This is my first test post!',
    second: 'Testing the feed algorithm',
    reply: 'This is a reply to test threading',
    mention: `@${aliceSuffix} Test mention functionality`,
  },
};

/**
 * Test Suite - All Scenarios
 */
export const TEST_SCENARIOS = [
  // ========================================
  // SCENARIO 1: Authentication Flow
  // ========================================
  {
    name: '1.1 - Landing Page Loads',
    goal: 'Verify landing page displays correctly with branding and CTA',
    plan: 'Navigate to base URL, check for logo, heading, signup button',
    url: `${TEST_CONFIG.baseUrl}/`,
    endCriteria: 'Landing page visible with "Join today" or similar CTA',
    outputs: 'Screenshot of landing page',
  },
  
  {
    name: '1.2 - User Signup - Alice',
    goal: 'Create first test user (Alice)',
    plan: `Click signup, fill form with ${TEST_CONFIG.users.alice.handle}/${TEST_CONFIG.users.alice.email}, submit, verify redirect to home`,
    url: `${TEST_CONFIG.baseUrl}/signup`,
    endCriteria: 'Account created successfully, redirected to /home',
    outputs: 'Screenshot of successful signup, confirmation of home page reached',
  },
  
  {
    name: '1.3 - User Logout',
    goal: 'Test logout functionality',
    plan: 'Navigate to settings, click logout, verify redirect to landing page',
    url: `${TEST_CONFIG.baseUrl}/settings`,
    endCriteria: 'Logged out successfully, back at landing page',
    outputs: 'Confirmation of logout',
  },
  
  {
    name: '1.4 - User Login',
    goal: 'Test login with Alice credentials',
    plan: `Navigate to login, enter ${TEST_CONFIG.users.alice.email}/password, submit, verify home page`,
    url: `${TEST_CONFIG.baseUrl}/login`,
    endCriteria: 'Logged in successfully, home page displayed',
    outputs: 'Screenshot of home page after login',
  },
  
  {
    name: '1.5 - User Signup - Bob',
    goal: 'Create second test user (Bob) for social interactions',
    plan: `Logout, go to signup, create Bob account with ${TEST_CONFIG.users.bob.handle}`,
    url: `${TEST_CONFIG.baseUrl}/signup`,
    endCriteria: 'Bob account created successfully',
    outputs: 'Confirmation of Bob signup',
  },
  
  // ========================================
  // SCENARIO 2: Post Creation & Viewing
  // ========================================
  {
    name: '2.1 - Create First Post (Alice)',
    goal: 'Test post creation functionality',
    plan: `Login as Alice, compose post: "${TEST_CONFIG.posts.first}", click Post button, verify success message`,
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Post created successfully, confirmation message shown',
    outputs: 'Screenshot of post creation success',
  },
  
  {
    name: '2.2 - View Post on Profile',
    goal: 'Verify post appears on user profile timeline',
    plan: `Navigate to Alice profile, check Posts tab, verify post is listed`,
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Post visible in profile timeline with correct content',
    outputs: 'Screenshot of profile showing the post',
  },
  
  {
    name: '2.3 - View Single Post',
    goal: 'Test single post view page',
    plan: 'Click on a post to view its dedicated page, verify post content, author, timestamp',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Post view page loads, shows full post with actions (reply, repost, like)',
    outputs: 'Screenshot of single post view',
  },
  
  {
    name: '2.4 - Character Counter',
    goal: 'Test character counter in compose box',
    plan: 'Start composing a post, type characters, verify counter updates, test 280 limit',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Counter shows correct count, warning at 260+ chars, prevents >280',
    outputs: 'Screenshot of character counter states',
  },
  
  // ========================================
  // SCENARIO 3: Social Interactions - Likes
  // ========================================
  {
    name: '3.1 - Like a Post (Bob likes Alice)',
    goal: 'Test liking functionality',
    plan: `Login as Bob, navigate to Alice profile (${TEST_CONFIG.users.alice.handle}), like her post, verify count increments`,
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Like count increments, heart icon turns red/pink',
    outputs: 'Screenshot before and after liking',
  },
  
  {
    name: '3.2 - Unlike a Post',
    goal: 'Test unliking functionality',
    plan: 'Click like button again to unlike, verify count decrements',
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Like count decrements, heart icon returns to gray',
    outputs: 'Screenshot of unliked state',
  },
  
  {
    name: '3.3 - Like Notification',
    goal: 'Verify like notification is created',
    plan: 'Login as Alice, check notifications page, verify like notification from Bob',
    url: `${TEST_CONFIG.baseUrl}/notifications`,
    endCriteria: 'Notification showing "Bob liked your post" is visible',
    outputs: 'Screenshot of like notification',
  },
  
  // ========================================
  // SCENARIO 4: Social Interactions - Replies
  // ========================================
  {
    name: '4.1 - Create Reply (Bob replies to Alice)',
    goal: 'Test reply creation',
    plan: `View Alice post, use reply composer, submit reply: "${TEST_CONFIG.posts.reply}", verify it appears`,
    url: `${TEST_CONFIG.baseUrl}/post/:id`,
    endCriteria: 'Reply created, appears in thread below main post, reply count increments',
    outputs: 'Screenshot of thread with reply',
  },
  
  {
    name: '4.2 - Reply Notification',
    goal: 'Verify reply notification created',
    plan: 'Login as Alice, check notifications for reply from Bob',
    url: `${TEST_CONFIG.baseUrl}/notifications`,
    endCriteria: 'Reply notification visible',
    outputs: 'Screenshot of reply notification',
  },
  
  {
    name: '4.3 - Nested Reply',
    goal: 'Test replying to a reply',
    plan: 'Click on Bob reply to view it, create reply to that reply',
    url: `${TEST_CONFIG.baseUrl}/post/:replyId`,
    endCriteria: 'Nested reply created, thread depth works',
    outputs: 'Screenshot of nested thread',
  },
  
  // ========================================
  // SCENARIO 5: Social Interactions - Reposts
  // ========================================
  {
    name: '5.1 - Repost a Post (Bob reposts Alice)',
    goal: 'Test repost functionality',
    plan: 'View Alice post, click repost button, verify repost created',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Repost count increments, repost appears in Bob timeline',
    outputs: 'Screenshot showing repost count increased',
  },
  
  {
    name: '5.2 - Duplicate Repost Prevention',
    goal: 'Verify cannot repost same post twice',
    plan: 'Try to repost the same post again, verify 409 error',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Error message shown: "You have already reposted this"',
    outputs: 'Screenshot of duplicate repost error',
  },
  
  {
    name: '5.3 - Repost Notification',
    goal: 'Verify repost notification created',
    plan: 'Login as Alice, check notifications for repost from Bob',
    url: `${TEST_CONFIG.baseUrl}/notifications`,
    endCriteria: 'Repost notification visible',
    outputs: 'Screenshot of repost notification',
  },
  
  // ========================================
  // SCENARIO 6: Social Graph - Follow
  // ========================================
  {
    name: '6.1 - Follow User (Bob follows Alice)',
    goal: 'Test follow functionality',
    plan: `Login as Bob, navigate to Alice profile (${TEST_CONFIG.users.alice.handle}), click Follow button`,
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Button changes to "Following", follower count on Alice increments',
    outputs: 'Screenshot showing Following button state',
  },
  
  {
    name: '6.2 - Following Count Update',
    goal: 'Verify Bob following count updated',
    plan: 'Navigate to Bob profile, check following count shows 1',
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.bob.handle}`,
    endCriteria: 'Following count = 1',
    outputs: 'Screenshot of Bob profile stats',
  },
  
  {
    name: '6.3 - Follow Notification',
    goal: 'Verify follow notification created',
    plan: 'Login as Alice, check notifications for follow from Bob',
    url: `${TEST_CONFIG.baseUrl}/notifications`,
    endCriteria: 'Follow notification visible',
    outputs: 'Screenshot of follow notification',
  },
  
  {
    name: '6.4 - Followed User Posts in Feed',
    goal: 'Verify Bob sees Alice posts in his feed after following',
    plan: 'Login as Bob, check home feed, verify Alice post appears',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Alice post visible in Bob home feed',
    outputs: 'Screenshot of Bob feed showing Alice post',
  },
  
  // ========================================
  // SCENARIO 7: Social Graph - Unfollow
  // ========================================
  {
    name: '7.1 - Unfollow User (Bob unfollows Alice)',
    goal: 'Test unfollow functionality',
    plan: 'Navigate to Alice profile, click Following button to unfollow',
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Button changes back to "Follow", counts updated',
    outputs: 'Screenshot showing Follow button state after unfollow',
  },
  
  {
    name: '7.2 - Unfollowed Posts No Longer in Feed',
    goal: 'Verify Alice posts removed from Bob feed after unfollow',
    plan: 'Check Bob home feed, verify Alice posts no longer appear',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Feed does not show Alice posts',
    outputs: 'Screenshot of Bob feed without Alice posts',
  },
  
  // ========================================
  // SCENARIO 8: Social Graph - Block
  // ========================================
  {
    name: '8.1 - Block User (Alice blocks Bob)',
    goal: 'Test block functionality',
    plan: 'Login as Alice, navigate to Bob profile, click Block button',
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.bob.handle}`,
    endCriteria: 'User blocked successfully, confirmation shown',
    outputs: 'Screenshot confirming block action',
  },
  
  {
    name: '8.2 - Blocked User Cannot Follow',
    goal: 'Verify Bob cannot follow Alice after being blocked',
    plan: 'Login as Bob, try to follow Alice, verify error or prevention',
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Cannot follow blocked user, appropriate message shown',
    outputs: 'Screenshot of follow prevention',
  },
  
  {
    name: '8.3 - Blocked User Posts Hidden',
    goal: 'Verify Bob posts not in Alice feed after blocking',
    plan: 'Login as Alice, check home feed, verify no Bob posts',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Bob posts not visible in Alice feed',
    outputs: 'Screenshot of clean feed',
  },
  
  // ========================================
  // SCENARIO 9: Social Graph - Unblock
  // ========================================
  {
    name: '9.1 - Unblock User (Alice unblocks Bob)',
    goal: 'Test unblock functionality',
    plan: 'Navigate to blocked users list, unblock Bob',
    url: `${TEST_CONFIG.baseUrl}/settings`,
    endCriteria: 'Bob successfully unblocked',
    outputs: 'Screenshot confirming unblock',
  },
  
  {
    name: '9.2 - Can Follow After Unblock',
    goal: 'Verify Bob can follow Alice again after unblock',
    plan: 'Login as Bob, navigate to Alice profile, verify Follow button clickable',
    url: `${TEST_CONFIG.baseUrl}/u/${TEST_CONFIG.users.alice.handle}`,
    endCriteria: 'Can click Follow button successfully',
    outputs: 'Screenshot of successful follow after unblock',
  },
  
  // ========================================
  // SCENARIO 10: Navigation - All Pages
  // ========================================
  {
    name: '10.1 - Home Page Navigation',
    goal: 'Verify home page loads and displays correctly',
    plan: 'Click Home in nav, verify feed loads, compose box present',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Home page displays with feed and compose box',
    outputs: 'Screenshot of home page',
  },
  
  {
    name: '10.2 - Explore Page Navigation',
    goal: 'Verify explore page loads and displays correctly',
    plan: 'Click Explore in nav, verify page loads with tabs',
    url: `${TEST_CONFIG.baseUrl}/explore`,
    endCriteria: 'Explore page displays with For you/Trending tabs',
    outputs: 'Screenshot of explore page',
  },
  
  {
    name: '10.3 - Notifications Page Navigation',
    goal: 'Verify notifications page loads and displays correctly',
    plan: 'Click Notifications in nav, verify notifications list',
    url: `${TEST_CONFIG.baseUrl}/notifications`,
    endCriteria: 'Notifications page displays with All/Mentions tabs',
    outputs: 'Screenshot of notifications page',
  },
  
  {
    name: '10.4 - Profile Page Navigation',
    goal: 'Verify profile page loads and displays correctly',
    plan: 'Click Profile in nav, verify own profile loads',
    url: `${TEST_CONFIG.baseUrl}/u/me`,
    endCriteria: 'Profile page displays with banner, avatar, posts',
    outputs: 'Screenshot of profile page',
  },
  
  {
    name: '10.5 - Settings Page Navigation',
    goal: 'Verify settings page loads and displays correctly',
    plan: 'Click Settings in nav, verify settings form loads',
    url: `${TEST_CONFIG.baseUrl}/settings`,
    endCriteria: 'Settings page displays with profile form, avatar/banner upload',
    outputs: 'Screenshot of settings page',
  },
  
  // ========================================
  // SCENARIO 11: Profile Management
  // ========================================
  {
    name: '11.1 - Update Display Name',
    goal: 'Test profile update functionality',
    plan: `In settings, change display name to "${TEST_CONFIG.users.alice.displayName}", save, verify update on profile`,
    url: `${TEST_CONFIG.baseUrl}/settings`,
    endCriteria: 'Display name updated successfully',
    outputs: 'Screenshot of updated profile',
  },
  
  {
    name: '11.2 - Update Bio',
    goal: 'Test bio update',
    plan: `Update bio to "${TEST_CONFIG.users.alice.bio}", save, verify on profile page`,
    url: `${TEST_CONFIG.baseUrl}/settings`,
    endCriteria: 'Bio updated and displayed on profile',
    outputs: 'Screenshot showing new bio',
  },
  
  // ========================================
  // SCENARIO 12: Feed Algorithm
  // ========================================
  {
    name: '12.1 - Own Posts in Feed',
    goal: 'Verify user sees own posts in home feed',
    plan: 'Login as Alice, check home feed for Alice posts',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Alice posts visible in her own feed',
    outputs: 'Screenshot of feed with own posts',
  },
  
  {
    name: '12.2 - Followed User Posts in Feed',
    goal: 'Verify followed users posts appear in feed',
    plan: 'Bob follows Alice, check Bob feed shows Alice posts',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Alice posts appear in Bob feed after following',
    outputs: 'Screenshot of Bob feed with Alice post',
  },
  
  {
    name: '12.3 - Blocked User Posts Not in Feed',
    goal: 'Verify blocked users posts dont appear',
    plan: 'Alice blocks Bob, check Alice feed has no Bob posts',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Bob posts not visible in Alice feed',
    outputs: 'Screenshot of clean feed without blocked user',
  },
  
  // ========================================
  // SCENARIO 13: UI/UX Verification
  // ========================================
  {
    name: '13.1 - Twitter Layout - Home',
    goal: 'Verify Twitter 3-column layout on home page',
    plan: 'Check home page has left nav sidebar, center feed, right trending sidebar',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: '3 columns visible, proper widths (275px, 600px, 350px)',
    outputs: 'Screenshot verifying layout',
  },
  
  {
    name: '13.2 - Twitter Colors',
    goal: 'Verify Twitter color scheme used throughout',
    plan: 'Check various elements for Twitter blue (#1D9BF0), borders (#EFF3F4)',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Colors match Twitter design system',
    outputs: 'Screenshot showing color consistency',
  },
  
  {
    name: '13.3 - Interactive States',
    goal: 'Verify hover states and interactive elements',
    plan: 'Hover over nav items, buttons, posts, verify hover effects',
    url: `${TEST_CONFIG.baseUrl}/home`,
    endCriteria: 'Hover states show proper background colors and transitions',
    outputs: 'Description of interactive behavior',
  },
  
  // ========================================
  // SCENARIO 14: Error Handling
  // ========================================
  {
    name: '14.1 - 404 Page',
    goal: 'Verify 404 page displays for invalid routes',
    plan: 'Navigate to /invalid-route, check for 404 page',
    url: `${TEST_CONFIG.baseUrl}/invalid-route`,
    endCriteria: '404 page displays with link back to home',
    outputs: 'Screenshot of 404 page',
  },
  
  {
    name: '14.2 - Invalid Login Credentials',
    goal: 'Test error handling for bad login',
    plan: 'Try to login with wrong password, verify error message',
    url: `${TEST_CONFIG.baseUrl}/login`,
    endCriteria: 'Error message shown: "Invalid credentials"',
    outputs: 'Screenshot of login error',
  },
  
  {
    name: '14.3 - Rate Limiting',
    goal: 'Verify rate limiting shows proper messages',
    plan: 'Make multiple rapid login attempts, trigger rate limit',
    url: `${TEST_CONFIG.baseUrl}/login`,
    endCriteria: 'Rate limit message shown with retry-after time',
    outputs: 'Screenshot of rate limit error',
  },
];

/**
 * Test Execution Summary Template
 */
export interface TestResult {
  scenario: string;
  passed: boolean;
  timestamp: Date;
  screenshots: string[];
  errors: string[];
  notes: string;
}

/**
 * Generate test report
 */
export function generateTestReport(results: TestResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return `
# The Wire - E2E Test Report

**Date:** ${new Date().toISOString()}
**Base URL:** ${TEST_CONFIG.baseUrl}
**Total Tests:** ${results.length}
**Passed:** ${passed}
**Failed:** ${failed}
**Success Rate:** ${((passed / results.length) * 100).toFixed(1)}%

## Test Results

${results.map(r => `
### ${r.scenario}
- **Status:** ${r.passed ? '✅ PASS' : '❌ FAIL'}
- **Time:** ${r.timestamp.toLocaleTimeString()}
${r.errors.length > 0 ? `- **Errors:**\n${r.errors.map(e => `  - ${e}`).join('\n')}` : ''}
${r.notes ? `- **Notes:** ${r.notes}` : ''}
`).join('\n')}

## Summary

${failed === 0 ? 
  '✅ All tests passed! The application is working correctly.' : 
  `⚠️ ${failed} test(s) failed. Review errors above.`}

## Configuration

- **Test Users:**
  - Alice: ${TEST_CONFIG.users.alice.handle} (${TEST_CONFIG.users.alice.email})
  - Bob: ${TEST_CONFIG.users.bob.handle} (${TEST_CONFIG.users.bob.email})
  `;
}