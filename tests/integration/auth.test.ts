import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index';

// Mock environment with KV
const createMockEnv = () => {
  const kvStore = new Map<string, string>();
  const doStore = new Map<string, any>();
  
  return {
    ENVIRONMENT: 'test',
    JWT_SECRET: 'test-secret-key-for-integration-tests',
    JWT_EXPIRY_HOURS: '24',
    MAX_NOTE_LENGTH: '280',
    FEED_PAGE_SIZE: '20',
    USERS_KV: {
      get: async (key: string) => kvStore.get(key) || null,
      put: async (key: string, value: string) => {
        kvStore.set(key, value);
      },
      delete: async (key: string) => {
        kvStore.delete(key);
      },
    },
    SESSIONS_KV: {
      get: async (key: string) => kvStore.get(`session:${key}`) || null,
      put: async (key: string, value: string) => {
        kvStore.set(`session:${key}`, value);
      },
      delete: async (key: string) => {
        kvStore.delete(`session:${key}`);
      },
    },
    USER_DO: {
      idFromName: (name: string) => ({} as DurableObjectId),
      get: (id: DurableObjectId) => ({
        fetch: async (url: string | Request, init?: RequestInit) => {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        },
      } as DurableObjectStub),
    },
  };
};

describe('Auth API', () => {
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user', async () => {
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123',
            handle: 'testuser',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe('test@example.com');
      expect(body.data.user.handle).toBe('testuser');
      expect(body.data.token).toBeTruthy();
    });

    it('should reject invalid email', async () => {
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'invalid-email',
            password: 'SecurePass123',
            handle: 'testuser',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject weak password', async () => {
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'weak',
            handle: 'testuser',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject duplicate email', async () => {
      // First signup
      await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123',
            handle: 'testuser1',
          }),
        },
        mockEnv
      );

      // Second signup with same email
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SecurePass123',
            handle: 'testuser2',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('Email already registered');
    });

    it('should reject duplicate handle', async () => {
      // First signup
      await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test1@example.com',
            password: 'SecurePass123',
            handle: 'testuser',
          }),
        },
        mockEnv
      );

      // Second signup with same handle
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test2@example.com',
            password: 'SecurePass123',
            handle: 'testuser',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('Handle already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'login@example.com',
            password: 'SecurePass123',
            handle: 'loginuser',
          }),
        },
        mockEnv
      );
    });

    it('should login with valid credentials', async () => {
      const res = await app.request(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'login@example.com',
            password: 'SecurePass123',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.token).toBeTruthy();
    });

    it('should reject invalid password', async () => {
      const res = await app.request(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'login@example.com',
            password: 'WrongPassword123',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await app.request(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'SecurePass123',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'me@example.com',
            password: 'SecurePass123',
            handle: 'meuser',
          }),
        },
        mockEnv
      );
      const body = await res.json();
      authToken = body.data.token;
    });

    it('should return user info with valid token', async () => {
      const res = await app.request(
        '/api/auth/me',
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('me@example.com');
      expect(body.data.handle).toBe('meuser');
    });

    it('should reject request without token', async () => {
      const res = await app.request('/api/auth/me', {}, mockEnv);

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await app.request(
        '/api/auth/me',
        {
          headers: { Authorization: 'Bearer invalid-token' },
        },
        mockEnv
      );

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let authToken: string;

    beforeEach(async () => {
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'refresh@example.com',
            password: 'SecurePass123',
            handle: 'refreshuser',
          }),
        },
        mockEnv
      );
      const body = await res.json();
      authToken = body.data.token;
    });

    it('should return a new token', async () => {
      const res = await app.request(
        '/api/auth/refresh',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.token).toBeTruthy();
      expect(body.data.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      const res = await app.request(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'logout@example.com',
            password: 'SecurePass123',
            handle: 'logoutuser',
          }),
        },
        mockEnv
      );
      const body = await res.json();
      authToken = body.data.token;
    });

    it('should logout successfully', async () => {
      const res = await app.request(
        '/api/auth/logout',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});