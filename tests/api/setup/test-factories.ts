import { ApiClient } from './api-client';

// Counter for unique IDs
let counter = 0;

function getUniqueId(): string {
  counter++;
  return `${Date.now()}_${counter}_${Math.random().toString(36).substring(2, 8)}`;
}

// User creation types
export interface SignupData {
  email: string;
  password: string;
  handle: string;
}

export interface UserWithToken {
  id: string;
  email: string;
  handle: string;
  token: string;
}

// Generate unique email
export function createUniqueEmail(): string {
  return `test_${getUniqueId()}@example.com`;
}

// Generate unique handle
export function createUniqueHandle(): string {
  const id = getUniqueId().replace(/_/g, '').substring(0, 10);
  return `user_${id}`;
}

// Generate valid password
export function createValidPassword(): string {
  return 'TestPass123!';
}

// Create valid user signup data
export function createUserData(overrides?: Partial<SignupData>): SignupData {
  return {
    email: createUniqueEmail(),
    password: createValidPassword(),
    handle: createUniqueHandle(),
    ...overrides,
  };
}

// Create user and return with token
export async function createUser(
  client: ApiClient,
  overrides?: Partial<SignupData>
): Promise<UserWithToken> {
  const userData = createUserData(overrides);
  const response = await client.post<{
    user: { id: string; email: string; handle: string };
    token: string;
  }>('/api/auth/signup', userData);

  if (response.status !== 201 || !response.body.success) {
    throw new Error(`Failed to create user: ${response.body.error || 'Unknown error'}`);
  }

  return {
    id: response.body.data!.user.id,
    email: response.body.data!.user.email,
    handle: response.body.data!.user.handle,
    token: response.body.data!.token,
  };
}

// Create multiple users
export async function createUsers(
  client: ApiClient,
  count: number
): Promise<UserWithToken[]> {
  const users: UserWithToken[] = [];
  for (let i = 0; i < count; i++) {
    const user = await createUser(client);
    users.push(user);
  }
  return users;
}

// Post creation types
export interface PostData {
  content: string;
  mediaUrls?: string[];
  replyToId?: string;
  quoteOfId?: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorHandle: string;
  content: string;
  createdAt: number;
  likeCount: number;
  replyCount: number;
  repostCount: number;
}

// Generate valid post content
export function createPostContent(length: number = 50): string {
  const id = getUniqueId();
  const base = `Test post ${id}`;
  if (base.length >= length) {
    return base.substring(0, length);
  }
  return base + ' '.repeat(length - base.length);
}

// Create valid post data
export function createPostData(overrides?: Partial<PostData>): PostData {
  return {
    content: createPostContent(),
    ...overrides,
  };
}

// Create a post
export async function createPost(
  client: ApiClient,
  overrides?: Partial<PostData>
): Promise<Post> {
  const postData = createPostData(overrides);
  const response = await client.post<Post>('/api/posts', postData);

  if (response.status !== 201 || !response.body.success) {
    throw new Error(`Failed to create post: ${response.body.error || 'Unknown error'}`);
  }

  return response.body.data!;
}

// Create multiple posts
export async function createPosts(
  client: ApiClient,
  count: number,
  overrides?: Partial<PostData>
): Promise<Post[]> {
  const posts: Post[] = [];
  for (let i = 0; i < count; i++) {
    const post = await createPost(client, overrides);
    posts.push(post);
  }
  return posts;
}

// Create a user with posts
export async function createUserWithPosts(
  client: ApiClient,
  postCount: number = 5
): Promise<{ user: UserWithToken; posts: Post[] }> {
  const user = await createUser(client);
  client.setToken(user.token);
  const posts = await createPosts(client, postCount);
  return { user, posts };
}

// Test data for validation testing
export const INVALID_EMAILS = [
  '', // empty
  '   ', // whitespace only
  'notanemail', // no @
  'user@', // no domain
  '@domain.com', // no local part
  'user@domain', // no TLD
  'user name@domain.com', // space in local
  'user@dom ain.com', // space in domain
  'a'.repeat(255) + '@example.com', // too long
];

export const INVALID_PASSWORDS = [
  '', // empty
  'short', // too short
  'alllowercase1', // no uppercase
  'ALLUPPERCASE1', // no lowercase
  'NoNumbersHere', // no number
  'a'.repeat(129), // too long
];

export const INVALID_HANDLES = [
  '', // empty
  'ab', // too short (< 3)
  'a'.repeat(16), // too long (> 15)
  'user-name', // hyphen not allowed
  'user.name', // period not allowed
  'user name', // space not allowed
  '_username', // starts with underscore
  'admin', // reserved
  'root', // reserved
  'api', // reserved
  'system', // reserved
];

export const VALID_EDGE_CASE_EMAILS = [
  'user+tag@example.com', // plus addressing
  'user@sub.domain.com', // subdomain
  'USER@EXAMPLE.COM', // uppercase (should be normalized)
];

export const VALID_EDGE_CASE_HANDLES = [
  'abc', // minimum length (3)
  'a'.repeat(15), // maximum length (15)
  'user_name_123', // underscores allowed
];

export const VALID_EDGE_CASE_PASSWORDS = [
  'Aa1bbbbb', // exactly 8 chars
  'A'.repeat(64) + 'a'.repeat(63) + '1', // close to max (128)
];

// Content overflow tests
export const CONTENT_LENGTHS = {
  EMPTY: '',
  MIN: 'a',
  NORMAL: 'This is a normal post content for testing.',
  MAX: 'a'.repeat(280), // exactly 280
  OVERFLOW: 'a'.repeat(281), // 281 - should fail
};

// Helper to wait for async operations
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
