// Re-export all setup utilities for easy imports
export { ApiClient, createApiClient, api } from './api-client';
export type { ApiResponse } from './api-client';

export {
  createUserData,
  createUser,
  createUsers,
  createUniqueEmail,
  createUniqueHandle,
  createValidPassword,
  createPostData,
  createPost,
  createPosts,
  createPostContent,
  createUserWithPosts,
  wait,
  INVALID_EMAILS,
  INVALID_PASSWORDS,
  INVALID_HANDLES,
  VALID_EDGE_CASE_EMAILS,
  VALID_EDGE_CASE_HANDLES,
  VALID_EDGE_CASE_PASSWORDS,
  CONTENT_LENGTHS,
} from './test-factories';
export type { SignupData, UserWithToken, PostData, Post } from './test-factories';

export {
  assertSuccess,
  assertError,
  assertBadRequest,
  assertUnauthorized,
  assertForbidden,
  assertNotFound,
  assertConflict,
  assertUserProfile,
  assertPost,
  assertNotification,
  assertPaginatedResponse,
  assertAuthToken,
  assertArrayContains,
  assertArrayNotContains,
  assertCountChanged,
} from './assertions';
