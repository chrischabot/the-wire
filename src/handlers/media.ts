/**
 * Media upload handlers for The Wire
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { generateId } from '../services/snowflake';
import { requireAuth } from '../middleware/auth';
import { rateLimit, RATE_LIMITS } from '../middleware/rate-limit';

const media = new Hono<{ Bindings: Env }>();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Magic byte signatures for file type validation
 * Each entry contains an offset and the bytes to match at that offset
 */
interface MagicSignature {
  offset: number;
  bytes: number[];
}

const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
  ],
  // MP4 files have 'ftyp' at offset 4 (after 4-byte size field)
  'video/mp4': [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // 'ftyp'
  // WebM uses EBML header
  'video/webm': [{ offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }],
};

/**
 * Validate file magic bytes at correct offsets
 */
async function validateMagicBytes(file: File, mimeType: string): Promise<boolean> {
  const signatures = MAGIC_SIGNATURES[mimeType];
  if (!signatures || signatures.length === 0) return true; // No signature to check
  
  // Read enough bytes to cover all signature checks
  const maxOffset = Math.max(...signatures.map(s => s.offset + s.bytes.length));
  const buffer = await file.slice(0, Math.max(maxOffset, 16)).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Check if any signature matches
  return signatures.some((signature) => {
    const { offset, bytes: expected } = signature;
    
    // Ensure we have enough bytes
    if (bytes.length < offset + expected.length) return false;
    
    // Check each byte at the correct offset
    for (let i = 0; i < expected.length; i++) {
      if (bytes[offset + i] !== expected[i]) return false;
    }
    return true;
  });
}

/**
 * Generate media URL for a key
 * Returns absolute URL for external sharing
 */
function getMediaUrl(request: Request, key: string): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/media/${key}`;
}

/**
 * Validate file type and size
 */
function validateFile(
  file: File,
  allowedTypes: string[],
  maxSize: number
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Max size: ${Math.floor(maxSize / 1024 / 1024)}MB`,
    };
  }

  return { valid: true };
}

/**
 * POST /api/media/upload - Upload media (image or video)
 */
media.post('/upload', requireAuth, rateLimit(RATE_LIMITS.upload), async (c) => {
  const userId = c.get('userId');

  let body: any;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid multipart form data' }, 400);
  }

  const file = body['file'];
  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: 'No file provided' }, 400);
  }

  // Determine media type
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

  if (!isVideo && !isImage) {
    return c.json({
      success: false,
      error: 'Invalid file type. Only images and videos allowed',
    }, 400);
  }

  // Validate file
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  const validation = validateFile(file, allowedTypes, maxSize);

  if (!validation.valid) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Validate magic bytes to prevent file type spoofing
  const magicValid = await validateMagicBytes(file, file.type);
  if (!magicValid) {
    return c.json({ 
      success: false, 
      error: 'File content does not match declared type' 
    }, 400);
  }

  // Generate unique key
  const mediaId = generateId();
  const extension = file.name.split('.').pop() || 'bin';
  const key = `media/${userId}/${mediaId}.${extension}`;

  // Upload to R2
  try {
    await c.env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const url = getMediaUrl(c.req.raw, key);

    return c.json({
      success: true,
      data: {
        id: mediaId,
        url,
        type: isVideo ? 'video' : 'image',
        mimeType: file.type,
        size: file.size,
      },
    });
  } catch (error) {
    console.error('R2 upload error:', error);
    return c.json({ success: false, error: 'Failed to upload media' }, 500);
  }
});

/**
 * PUT /api/media/users/me/avatar - Upload avatar
 */
media.put('/users/me/avatar', requireAuth, async (c) => {
  const userId = c.get('userId');

  let body: any;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid multipart form data' }, 400);
  }

  const file = body['file'];
  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: 'No file provided' }, 400);
  }

  // Validate file (images only for avatars)
  const validation = validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
  if (!validation.valid) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Validate magic bytes
  const magicValid = await validateMagicBytes(file, file.type);
  if (!magicValid) {
    return c.json({ 
      success: false, 
      error: 'File content does not match declared type' 
    }, 400);
  }

  // Generate unique key
  const avatarId = generateId();
  const extension = file.name.split('.').pop() || 'jpg';
  const key = `avatars/${userId}/${avatarId}.${extension}`;

  // Upload to R2
  try {
    await c.env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const avatarUrl = getMediaUrl(c.req.raw, key);

    // Update user profile
    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);
    await stub.fetch('https://do.internal/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl }),
    });

    return c.json({
      success: true,
      data: {
        avatarUrl,
      },
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return c.json({ success: false, error: 'Failed to upload avatar' }, 500);
  }
});

/**
 * PUT /api/media/users/me/banner - Upload banner
 */
media.put('/users/me/banner', requireAuth, async (c) => {
  const userId = c.get('userId');

  let body: any;
  try {
    body = await c.req.parseBody();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid multipart form data' }, 400);
  }

  const file = body['file'];
  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: 'No file provided' }, 400);
  }

  // Validate file (images only for banners)
  const validation = validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
  if (!validation.valid) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  // Validate magic bytes
  const magicValid = await validateMagicBytes(file, file.type);
  if (!magicValid) {
    return c.json({ 
      success: false, 
      error: 'File content does not match declared type' 
    }, 400);
  }

  // Generate unique key
  const bannerId = generateId();
  const extension = file.name.split('.').pop() || 'jpg';
  const key = `banners/${userId}/${bannerId}.${extension}`;

  // Upload to R2
  try {
    await c.env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const bannerUrl = getMediaUrl(c.req.raw, key);

    // Update user profile
    const doId = c.env.USER_DO.idFromName(userId);
    const stub = c.env.USER_DO.get(doId);
    await stub.fetch('https://do.internal/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bannerUrl }),
    });

    return c.json({
      success: true,
      data: {
        bannerUrl,
      },
    });
  } catch (error) {
    console.error('Banner upload error:', error);
    return c.json({ success: false, error: 'Failed to upload banner' }, 500);
  }
});

/**
 * GET /media/:key - Serve media file from R2
 * The key parameter is the full R2 key (e.g., "media/userid/123.jpg")
 */
media.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');

  try {
    const object = await c.env.MEDIA_BUCKET.get(key);

    if (!object) {
      return c.json({ success: false, error: 'Media not found' }, 404);
    }

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    // Return media with proper caching headers
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.etag,
      },
    });
  } catch (error) {
    console.error('R2 retrieval error:', error);
    return c.json({ success: false, error: 'Failed to retrieve media' }, 500);
  }
});

export default media;