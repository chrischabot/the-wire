import { describe, it, expect } from 'vitest';
import {
  success,
  error,
  notFound,
  unauthorized,
  forbidden,
  serverError,
  redirect,
  html,
} from '../../src/utils/response';

describe('Response Helpers', () => {
  describe('success', () => {
    it('should return 200 status by default', async () => {
      const response = success({ message: 'ok' });
      expect(response.status).toBe(200);
    });

    it('should return custom status code', async () => {
      const response = success({ id: '123' }, 201);
      expect(response.status).toBe(201);
    });

    it('should return JSON content type', async () => {
      const response = success({ data: 'test' });
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should include success: true in body', async () => {
      const response = success({ foo: 'bar' });
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ foo: 'bar' });
    });
  });

  describe('error', () => {
    it('should return 400 status by default', async () => {
      const response = error('Bad request');
      expect(response.status).toBe(400);
    });

    it('should return custom status code', async () => {
      const response = error('Custom error', 422);
      expect(response.status).toBe(422);
    });

    it('should include success: false in body', async () => {
      const response = error('Something went wrong');
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Something went wrong');
    });
  });

  describe('notFound', () => {
    it('should return 404 status', async () => {
      const response = notFound();
      expect(response.status).toBe(404);
    });

    it('should use default message', async () => {
      const response = notFound();
      const body = await response.json();
      expect(body.error).toBe('Not found');
    });

    it('should use custom message', async () => {
      const response = notFound('User not found');
      const body = await response.json();
      expect(body.error).toBe('User not found');
    });
  });

  describe('unauthorized', () => {
    it('should return 401 status', async () => {
      const response = unauthorized();
      expect(response.status).toBe(401);
    });
  });

  describe('forbidden', () => {
    it('should return 403 status', async () => {
      const response = forbidden();
      expect(response.status).toBe(403);
    });
  });

  describe('serverError', () => {
    it('should return 500 status', async () => {
      const response = serverError();
      expect(response.status).toBe(500);
    });
  });

  describe('redirect', () => {
    it('should return 302 status by default', () => {
      const response = redirect('https://example.com');
      expect(response.status).toBe(302);
    });

    it('should return custom redirect status', () => {
      const response = redirect('https://example.com', 301);
      expect(response.status).toBe(301);
    });

    it('should set Location header', () => {
      const response = redirect('https://example.com/path');
      expect(response.headers.get('Location')).toBe('https://example.com/path');
    });
  });

  describe('html', () => {
    it('should return HTML content type', () => {
      const response = html('<h1>Hello</h1>');
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should return 200 status by default', () => {
      const response = html('<p>Test</p>');
      expect(response.status).toBe(200);
    });
  });
});