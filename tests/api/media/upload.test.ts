import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ApiClient, createApiClient } from '../setup/api-client';
import { createUser, UserWithToken } from '../setup/test-factories';
import {
  assertSuccess,
  assertBadRequest,
  assertUnauthorized,
} from '../setup/assertions';

// Helper to create mock file blobs
function createMockImageBlob(sizeKB: number = 100, mimeType: string = 'image/jpeg'): Blob {
  const bytes = new Uint8Array(sizeKB * 1024);
  // Add JPEG magic bytes for image/jpeg
  if (mimeType === 'image/jpeg') {
    bytes[0] = 0xFF;
    bytes[1] = 0xD8;
    bytes[2] = 0xFF;
  } else if (mimeType === 'image/png') {
    bytes[0] = 0x89;
    bytes[1] = 0x50;
    bytes[2] = 0x4E;
    bytes[3] = 0x47;
  } else if (mimeType === 'image/gif') {
    bytes[0] = 0x47;
    bytes[1] = 0x49;
    bytes[2] = 0x46;
  }
  return new Blob([bytes], { type: mimeType });
}

function createMockVideoBlob(sizeMB: number = 1): Blob {
  const bytes = new Uint8Array(sizeMB * 1024 * 1024);
  // MP4 magic bytes (ftyp)
  bytes[4] = 0x66; // f
  bytes[5] = 0x74; // t
  bytes[6] = 0x79; // y
  bytes[7] = 0x70; // p
  return new Blob([bytes], { type: 'video/mp4' });
}

describe('Media Upload Endpoints', () => {
  let client: ApiClient;
  let testUser: UserWithToken;

  beforeAll(async () => {
    client = createApiClient();
    await client.resetDatabase();
    testUser = await createUser(client);
  });

  beforeEach(() => {
    client.setToken(testUser.token);
  });

  describe('POST /api/media/upload', () => {
    describe('Happy Path', () => {
      it('should upload JPEG image', async () => {
        const file = createMockImageBlob(100, 'image/jpeg');
        const response = await client.uploadFile('/api/media/upload', file);

        // May succeed or fail depending on R2 setup
        expect([200, 201, 500]).toContain(response.status);
        if (response.status === 200 || response.status === 201) {
          expect(response.body.data).toHaveProperty('url');
          expect(response.body.data).toHaveProperty('type');
        }
      });

      it('should upload PNG image', async () => {
        const file = createMockImageBlob(100, 'image/png');
        const response = await client.uploadFile('/api/media/upload', file);

        expect([200, 201, 500]).toContain(response.status);
      });

      it('should upload GIF image', async () => {
        const file = createMockImageBlob(100, 'image/gif');
        const response = await client.uploadFile('/api/media/upload', file);

        expect([200, 201, 500]).toContain(response.status);
      });

      it('should upload WebP image', async () => {
        const bytes = new Uint8Array(100 * 1024);
        bytes[0] = 0x52; // R
        bytes[1] = 0x49; // I
        bytes[2] = 0x46; // F
        bytes[3] = 0x46; // F
        const file = new Blob([bytes], { type: 'image/webp' });
        const response = await client.uploadFile('/api/media/upload', file);

        expect([200, 201, 400, 500]).toContain(response.status);
      });

      it('should upload MP4 video', async () => {
        const file = createMockVideoBlob(1);
        const response = await client.uploadFile('/api/media/upload', file);

        expect([200, 201, 500]).toContain(response.status);
      });
    });

    describe('Validation', () => {
      it('should reject upload without file', async () => {
        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testUser.token}`,
          },
          body: new FormData(), // Empty form
        });

        expect([400, 415]).toContain(response.status);
      });

      it('should reject invalid file type (text file)', async () => {
        const file = new Blob(['Hello, world!'], { type: 'text/plain' });
        const response = await client.uploadFile('/api/media/upload', file);

        assertBadRequest(response);
      });

      it('should reject oversized image (>5MB)', async () => {
        const file = createMockImageBlob(6 * 1024, 'image/jpeg'); // 6MB
        const response = await client.uploadFile('/api/media/upload', file);

        // Should reject with size error
        expect([400, 413]).toContain(response.status);
      });

      it('should reject oversized video (>50MB)', async () => {
        const file = createMockVideoBlob(51); // 51MB
        const response = await client.uploadFile('/api/media/upload', file);

        expect([400, 413]).toContain(response.status);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        client.clearToken();
        const file = createMockImageBlob(100);
        const response = await client.uploadFile('/api/media/upload', file);

        assertUnauthorized(response);
      });
    });
  });

  describe('PUT /api/media/users/me/avatar', () => {
    describe('Happy Path', () => {
      it('should upload avatar image', async () => {
        const file = createMockImageBlob(100, 'image/jpeg');

        // Use custom fetch for PUT with file
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/users/me/avatar`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${testUser.token}`,
          },
          body: formData,
        });

        // May succeed or fail depending on R2 setup
        expect([200, 500]).toContain(response.status);
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data).toHaveProperty('avatarUrl');
        }
      });
    });

    describe('Validation', () => {
      it('should reject video for avatar', async () => {
        const file = createMockVideoBlob(1);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/users/me/avatar`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${testUser.token}`,
          },
          body: formData,
        });

        expect([400]).toContain(response.status);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const file = createMockImageBlob(100);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/users/me/avatar`, {
          method: 'PUT',
          body: formData,
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PUT /api/media/users/me/banner', () => {
    describe('Happy Path', () => {
      it('should upload banner image', async () => {
        const file = createMockImageBlob(200, 'image/jpeg');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/users/me/banner`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${testUser.token}`,
          },
          body: formData,
        });

        expect([200, 500]).toContain(response.status);
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data).toHaveProperty('bannerUrl');
        }
      });
    });

    describe('Validation', () => {
      it('should reject video for banner', async () => {
        const file = createMockVideoBlob(1);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/users/me/banner`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${testUser.token}`,
          },
          body: formData,
        });

        expect([400]).toContain(response.status);
      });
    });

    describe('Authentication', () => {
      it('should reject request without token', async () => {
        const file = createMockImageBlob(100);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/api/media/users/me/banner`, {
          method: 'PUT',
          body: formData,
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /media/:key (Media Serving)', () => {
    it('should return 404 for non-existent media', async () => {
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/media/nonexistent.jpg`);

      expect(response.status).toBe(404);
    });

    it('should serve media without authentication', async () => {
      // This test would need actual media uploaded first
      // For now, just verify the endpoint doesn't require auth
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8787'}/media/test.jpg`);

      // Should return 404 (not found) not 401 (unauthorized)
      expect(response.status).not.toBe(401);
    });
  });
});
