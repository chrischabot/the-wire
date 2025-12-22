// Small-scale test (10 users, 10 actions each)
const BASE_URL = 'http://localhost:8080';
const NUM_USERS = 10;
const ACTIONS_PER_USER = 10;

interface TestUser {
  handle: string;
  token: string;
  posts: string[];
}

const users: TestUser[] = [];

async function createUser(index: number): Promise<TestUser> {
  const handle = `test${index}`;
  const response = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `test${index}@test.com`,
      password: `Test${index}123`,
      handle,
    }),
  });
  const data = await response.json();
  return { handle, token: data.data.token, posts: [] };
}

async function createPost(user: TestUser): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
    },
    body: JSON.stringify({ content: `Test post from ${user.handle}` }),
  });
  const data = await response.json();
  if (data.success) user.posts.push(data.data.id);
}

async function runTest() {
  console.log(`Creating ${NUM_USERS} users...`);
  for (let i = 0; i < NUM_USERS; i++) {
    users.push(await createUser(i));
  }
  console.log('Users created. Performing actions...');
  
  for (const user of users) {
    for (let i = 0; i < ACTIONS_PER_USER; i++) {
      await createPost(user);
    }
  }
  
  console.log(`Test complete. Created ${users.length} users, ${users.reduce((sum, u) => sum + u.posts.length, 0)} posts`);
}

runTest().catch(console.error);
