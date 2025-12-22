/**
 * Media upload handlers for The Wire
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { generateId } from '../services/snowflake';
import { requireAuth } from '../middleware/auth';

const media = new Hono<{ Bindings: Env }>();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Generate media URL for a key
 * Media is served through the Worker at /media/:key
 */
function getMediaUrl(key: string): string {
  return `/media/${key}`;
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
media.post('/upload', requireAuth, async (c) => {
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

    const url = getMediaUrl(key);

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
 * PUT /api/users/me/avatar - Upload avatar
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

    const avatarUrl = getMediaUrl(key);

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
 * PUT /api/users/me/banner - Upload banner
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

    const bannerUrl = getMediaUrl(key);

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
 * GET /media/:key - Serve media file from R2 with optional resizing
 * The key parameter is the full R2 key (e.g., "media/userid/123.jpg")
 * Query parameters: width, height, quality, fit (cover, contain, scale-down, crop, pad)
 */
media.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  
  // Parse query parameters for image resizing
  const width = c.req.query('width');
  const height = c.req.query('height');
  const quality = c.req.query('quality') || '80';
  const fit = c.req.query('fit') || 'cover';

  try {
    const object = await c.env.MEDIA_BUCKET.get(key);

    if (!object) {
      return c.json({ success: false, error: 'Media not found' }, 404);
    }

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    const isImage = contentType.startsWith('image/');

    // Use Cloudflare Image Resizing for images if parameters provided
    if (isImage && (width || height)) {
      const imageOptions: any = {
        quality: parseInt(quality, 10),
        fit,
      };

      if (width) imageOptions.width = parseInt(width, 10);
      if (height) imageOptions.height = parseInt(height, 10);

      return new Response(object.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
        },
        cf: {
          image: imageOptions,
        },
      } as ResponseInit & { cf: any });
    }

    // Return original for non-images or no resize params
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('R2 retrieval error:', error);
    return c.json({ success: false, error: 'Failed to retrieve media' }, 500);
  }
});

export default media;