import { expect } from 'vitest';
import type { ApiResponse } from './api-client';

// Assert successful response
export function assertSuccess<T>(response: ApiResponse<T>, expectedStatus: number = 200): T {
  expect(response.status).toBe(expectedStatus);
  expect(response.body.success).toBe(true);
  expect(response.body.data).toBeDefined();
  return response.body.data!;
}

// Assert error response
export function assertError(
  response: ApiResponse,
  expectedStatus: number,
  expectedErrorContains?: string
): void {
  expect(response.status).toBe(expectedStatus);
  expect(response.body.success).toBe(false);
  if (expectedErrorContains) {
    expect(response.body.error?.toLowerCase()).toContain(expectedErrorContains.toLowerCase());
  }
}

// Assert 400 Bad Request
export function assertBadRequest(response: ApiResponse, errorContains?: string): void {
  assertError(response, 400, errorContains);
}

// Assert 401 Unauthorized
export function assertUnauthorized(response: ApiResponse, errorContains?: string): void {
  assertError(response, 401, errorContains);
}

// Assert 403 Forbidden
export function assertForbidden(response: ApiResponse, errorContains?: string): void {
  assertError(response, 403, errorContains);
}

// Assert 404 Not Found
export function assertNotFound(response: ApiResponse, errorContains?: string): void {
  assertError(response, 404, errorContains);
}

// Assert 409 Conflict
export function assertConflict(response: ApiResponse, errorContains?: string): void {
  assertError(response, 409, errorContains);
}

// Assert user profile shape
export function assertUserProfile(user: unknown): void {
  expect(user).toMatchObject({
    id: expect.any(String),
    handle: expect.any(String),
    displayName: expect.any(String),
    bio: expect.any(String),
    joinedAt: expect.any(Number),
    followerCount: expect.any(Number),
    followingCount: expect.any(Number),
    postCount: expect.any(Number),
  });
}

// Assert post shape
export function assertPost(post: unknown): void {
  expect(post).toMatchObject({
    id: expect.any(String),
    authorId: expect.any(String),
    authorHandle: expect.any(String),
    content: expect.any(String),
    createdAt: expect.any(Number),
    likeCount: expect.any(Number),
    replyCount: expect.any(Number),
    repostCount: expect.any(Number),
  });
}

// Assert notification shape
export function assertNotification(notification: unknown): void {
  expect(notification).toMatchObject({
    id: expect.any(String),
    type: expect.stringMatching(/^(like|reply|follow|mention|repost|quote)$/),
    actorId: expect.any(String),
    actorHandle: expect.any(String),
    createdAt: expect.any(Number),
    read: expect.any(Boolean),
  });
}

// Assert paginated response
export function assertPaginatedResponse<T>(
  response: ApiResponse<{ posts?: T[]; users?: T[]; notifications?: T[]; cursor?: string | null; hasMore?: boolean }>,
  options?: { minItems?: number; hasMore?: boolean }
): void {
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const data = response.body.data!;
  const items = data.posts || data.users || data.notifications || [];

  expect(Array.isArray(items)).toBe(true);

  if (options?.minItems !== undefined) {
    expect(items.length).toBeGreaterThanOrEqual(options.minItems);
  }

  if (options?.hasMore !== undefined) {
    expect(data.hasMore).toBe(options.hasMore);
  }
}

// Assert token shape
export function assertAuthToken(data: { token?: string; expiresAt?: number }): void {
  expect(data.token).toBeDefined();
  expect(typeof data.token).toBe('string');
  expect(data.token!.length).toBeGreaterThan(0);
  expect(data.expiresAt).toBeDefined();
  expect(data.expiresAt).toBeGreaterThan(Date.now());
}

// Assert array contains item matching predicate
export function assertArrayContains<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): T {
  const found = array.find(predicate);
  expect(found, message).toBeDefined();
  return found!;
}

// Assert array does not contain item matching predicate
export function assertArrayNotContains<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const found = array.find(predicate);
  expect(found, message).toBeUndefined();
}

// Assert count changed by delta
export function assertCountChanged(
  before: number,
  after: number,
  delta: number,
  message?: string
): void {
  expect(after - before, message).toBe(delta);
}
