/**
 * Load Testing Harness for The Wire
 * Creates 2000 users and performs 200 actions per user
 * Verifies correctness at each step
 */

const BASE_URL = 'http://localhost:8080';
const NUM_USERS = 2000;
const ACTIONS_PER_USER = 200;

interface TestUser {
  id: string;
  handle: string;
  email: string;
  password: string;
  token: string;
  following: string[];
  blocked: string[];
  posts: string[];
}

interface TestStats {
  usersCreated: number;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  errors: number;
  startTime: number;
  lastProgressTime: number;
}

const stats: TestStats = {
  usersCreated: 0,
  totalActions: 0,
  actionBreakdown: {},
  errors: 0,
  startTime: Date.now(),
  lastProgressTime: Date.now(),
};

const users: TestUser[] = [];

/**
 * Make API request
 */
async function apiRequest(endpoint: string, options: RequestInit = {}, token?: string): Promise<any> {
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

/**
 * Create a single user account
 */
async function createUser(index: number): Promise<TestUser> {
  const handle = `loaduser${index}`;
  const email = `loaduser${index}@test.com`;
  const password = `LoadTest${index}`;

  try {
    const response = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, handle }),
    });

    return {
      id: response.data.user.id,
      handle,
      email,
      password,
      token: response.data.token,
      following: [],
      blocked: [],
      posts: [],
    };
  } catch (error) {
    console.error(`Failed to create user ${handle}:`, error);
    stats.errors++;
    throw error;
  }
}

/**
 * Create all test users
 */
async function createUsers(): Promise<void> {
  console.log(`Creating ${NUM_USERS} users...`);
  const batchSize = 50;
  
  for (let i = 0; i < NUM_USERS; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, NUM_USERS); j++) {
      batch.push(createUser(j));
    }
    
    const batchUsers = await Promise.allSettled(batch);
    for (const result of batchUsers) {
      if (result.status === 'fulfilled') {
        users.push(result.value);
        stats.usersCreated++;
      } else {
        stats.errors++;
      }
    }
    
    if ((i + batchSize) % 200 === 0 || i + batchSize >= NUM_USERS) {
      console.log(`Created ${stats.usersCreated}/${NUM_USERS} users...`);
    }
  }
  
  console.log(`Successfully created ${stats.usersCreated} users`);
}

/**
 * Get random user different from current
 */
function getRandomUser(currentUser: TestUser): TestUser {
  let randomUser;
  do {
    randomUser = users[Math.floor(Math.random() * users.length)]!;
  } while (randomUser.id === currentUser.id);
  return randomUser;
}

/**
 * Perform follow action
 */
async function actionFollow(user: TestUser): Promise<void> {
  const target = getRandomUser(user);
  
  // Don't follow if already following or blocked
  if (user.following.includes(target.id) || user.blocked.includes(target.id)) {
    return;
  }

  try {
    await apiRequest(`/api/users/${target.handle}/follow`, {
      method: 'POST',
    }, user.token);
    
    user.following.push(target.id);
    stats.actionBreakdown['follow'] = (stats.actionBreakdown['follow'] || 0) + 1;
  } catch (error) {
    stats.errors++;
  }
}

/**
 * Perform unfollow action
 */
async function actionUnfollow(user: TestUser): Promise<void> {
  if (user.following.length === 0) return;
  
  const targetId = user.following[Math.floor(Math.random() * user.following.length)]!;
  const target = users.find((u) => u.id === targetId);
  if (!target) return;

  try {
    await apiRequest(`/api/users/${target.handle}/follow`, {
      method: 'DELETE',
    }, user.token);
    
    user.following = user.following.filter((id) => id !== targetId);
    stats.actionBreakdown['unfollow'] = (stats.actionBreakdown['unfollow'] || 0) + 1;
  } catch (error) {
    stats.errors++;
  }
}

/**
 * Perform block action
 */
async function actionBlock(user: TestUser): Promise<void> {
  const target = getRandomUser(user);
  
  // Don't block if already blocked
  if (user.blocked.includes(target.id)) {
    return;
  }

  try {
    await apiRequest(`/api/users/${target.handle}/block`, {
      method: 'POST',
    }, user.token);
    
    user.blocked.push(target.id);
    user.following = user.following.filter((id) => id !== target.id);
    stats.actionBreakdown['block'] = (stats.actionBreakdown['block'] || 0) + 1;
  } catch (error) {
    stats.errors++;
  }
}

/**
 * Create a post
 */
async function actionCreatePost(user: TestUser): Promise<void> {
  const content = `Load test post #${user.posts.length + 1} from ${user.handle}`;
  
  try {
    const response = await apiRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, user.token);
    
    user.posts.push(response.data.id);
    stats.actionBreakdown['create_post'] = (stats.actionBreakdown['create_post'] || 0) + 1;
  } catch (error) {
    stats.errors++;
  }
}

/**
 * Like a random post
 */
async function actionLikePost(user: TestUser): Promise<void> {
  // Get a random user who has posts
  const usersWithPosts = users.filter((u) => u.posts.length > 0);
  if (usersWithPosts.length === 0) return;
  
  const randomUser = usersWithPosts[Math.floor(Math.random() * usersWithPosts.length)]!;
  const postId = randomUser.posts[Math.floor(Math.random() * randomUser.posts.length)]!;

  try {
    await apiRequest(`/api/posts/${postId}/like`, {
      method: 'POST',
    }, user.token);
    
    stats.actionBreakdown['like_post'] = (stats.actionBreakdown['like_post'] || 0) + 1;
  } catch (error) {
    // Might fail if already liked
    stats.errors++;
  }
}

/**
 * View home feed
 */
async function actionViewFeed(user: TestUser): Promise<void> {
  try {
    const response = await apiRequest('/api/feed/home?limit=20', {}, user.token);
    
    // Verify response structure
    if (!response.success || !Array.isArray(response.data.posts)) {
      throw new Error('Invalid feed response');
    }
    
    stats.actionBreakdown['view_feed'] = (stats.actionBreakdown['view_feed'] || 0) + 1;
  } catch (error) {
    stats.errors++;
  }
}

/**
 * Get profile
 */
async function actionViewProfile(user: TestUser): Promise<void> {
  const target = getRandomUser(user);
  
  try {
    const response = await apiRequest(`/api/users/${target.handle}`);
    
    // Verify response structure
    if (!response.success || !response.data.id) {
      throw new Error('Invalid profile response');
    }
    
    stats.actionBreakdown['view_profile'] = (stats.actionBreakdown['view_profile'] || 0) + 1;
  } catch (error) {
    stats.errors++;
  }
}

/**
 * Perform random action
 */
async function performRandomAction(user: TestUser): Promise<void> {
  const actions = [
    { fn: actionFollow, weight: 15 },
    { fn: actionUnfollow, weight: 5 },
    { fn: actionBlock, weight: 2 },
    { fn: actionCreatePost, weight: 30 },
    { fn: actionLikePost, weight: 25 },
    { fn: actionViewFeed, weight: 15 },
    { fn: actionViewProfile, weight: 8 },
  ];

  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const action of actions) {
    random -= action.weight;
    if (random <= 0) {
      await action.fn(user);
      break;
    }
  }
  
  stats.totalActions++;
}

/**
 * Perform actions for a single user
 */
async function performUserActions(user: TestUser, numActions: number): Promise<void> {
  for (let i = 0; i < numActions; i++) {
    await performRandomAction(user);
    
    // Progress report every 1000 actions
    if (stats.totalActions % 1000 === 0) {
      const elapsed = (Date.now() - stats.lastProgressTime) / 1000;
      stats.lastProgressTime = Date.now();
      console.log(`Progress: ${stats.totalActions} total actions (${(1000 / elapsed).toFixed(0)} actions/sec)`);
    }
  }
}

/**
 * Verify system correctness
 */
async function verifySystemCorrectness(): Promise<void> {
  console.log('\nVerifying system correctness...');
  let verificationsPassed = 0;
  let verificationsFailed = 0;

  // Sample 100 random users to verify
  const sampleSize = Math.min(100, users.length);
  const sampleIndices = new Set<number>();
  
  while (sampleIndices.size < sampleSize) {
    sampleIndices.add(Math.floor(Math.random() * users.length));
  }

  for (const index of sampleIndices) {
    const user = users[index]!;
    
    try {
      // Verify follower count matches
      const followingResp = await apiRequest(`/api/users/${user.handle}/following`);
      if (followingResp.data.count === user.following.length) {
        verificationsPassed++;
      } else {
        console.error(`Follower count mismatch for ${user.handle}: expected ${user.following.length}, got ${followingResp.data.count}`);
        verificationsFailed++;
      }

      // Verify posts exist
      for (const postId of user.posts.slice(0, 5)) { // Check first 5 posts
        const postResp = await apiRequest(`/api/posts/${postId}`);
        if (postResp.success) {
          verificationsPassed++;
        } else {
          verificationsFailed++;
        }
      }
    } catch (error) {
      console.error(`Verification failed for user ${user.handle}:`, error);
      verificationsFailed++;
    }
  }

  console.log(`Verification: ${verificationsPassed} passed, ${verificationsFailed} failed`);
}

/**
 * Main test execution
 */
async function runLoadTest(): Promise<void> {
  console.log('=== The Wire Load Testing Harness ===\n');
  console.log(`Configuration:`);
  console.log(`  Users: ${NUM_USERS}`);
  console.log(`  Actions per user: ${ACTIONS_PER_USER}`);
  console.log(`  Total actions: ${NUM_USERS * ACTIONS_PER_USER}\n`);

  try {
    // Phase 1: Create users
    await createUsers();
    console.log(`\n✅ User creation complete: ${stats.usersCreated}/${NUM_USERS}\n`);

    // Phase 2: Perform actions
    console.log('Performing actions...\n');
    
    const concurrency = 10; // Process 10 users concurrently
    for (let i = 0; i < users.length; i += concurrency) {
      const batch = users.slice(i, i + concurrency);
      await Promise.all(
        batch.map((user) => performUserActions(user, ACTIONS_PER_USER))
      );
    }

    // Phase 3: Verify correctness
    await verifySystemCorrectness();

    // Final statistics
    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log('\n=== Load Test Complete ===');
    console.log(`Total time: ${totalTime.toFixed(2)}s`);
    console.log(`Total actions: ${stats.totalActions}`);
    console.log(`Actions/second: ${(stats.totalActions / totalTime).toFixed(2)}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Error rate: ${((stats.errors / stats.totalActions) * 100).toFixed(2)}%`);
    console.log('\nAction breakdown:');
    for (const [action, count] of Object.entries(stats.actionBreakdown)) {
      console.log(`  ${action}: ${count} (${((count / stats.totalActions) * 100).toFixed(1)}%)`);
    }
  } catch (error) {
    console.error('Load test failed:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLoadTest().catch(console.error);
}

export { runLoadTest, createUsers, performUserActions, verifySystemCorrectness };