/**
 * URL Unfurling Handler
 * Fetches metadata (Open Graph, Twitter Cards) from URLs to display rich previews
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

const unfurlRoutes = new Hono<{ Bindings: Env }>();

interface UnfurlResult {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  favicon?: string;
}

/**
 * Validate URL to prevent SSRF attacks
 */
function isValidExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Block private IP ranges
    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges (basic check)
    const ipParts = hostname.split('.');
    if (ipParts.length === 4) {
      const first = parseInt(ipParts[0] ?? '0');
      const second = parseInt(ipParts[1] ?? '0');
      // 10.x.x.x
      if (first === 10) return false;
      // 172.16-31.x.x
      if (first === 172 && second >= 16 && second <= 31) return false;
      // 192.168.x.x
      if (first === 192 && second === 168) return false;
      // 169.254.x.x (link-local)
      if (first === 169 && second === 254) return false;
    }

    // Block internal hostnames
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract meta tag content from HTML
 */
function extractMetaContent(html: string, property: string): string | undefined {
  // Try property attribute (og:, twitter:)
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')
  );

  if (propertyMatch) return propertyMatch[1];

  // Try name attribute (twitter:, description)
  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i')
  );

  return nameMatch?.[1];
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

/**
 * Extract favicon from HTML
 */
function extractFavicon(html: string, baseUrl: string): string | undefined {
  // Try link rel="icon" or rel="shortcut icon"
  const iconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i
  ) || html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
  );

  if (iconMatch) {
    const href = iconMatch[1];
    if (!href) return undefined;
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    if (href.startsWith('/')) return `${new URL(baseUrl).origin}${href}`;
    return `${new URL(baseUrl).origin}/${href}`;
  }

  // Default to /favicon.ico
  return `${new URL(baseUrl).origin}/favicon.ico`;
}

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${new URL(baseUrl).origin}${url}`;
  return `${new URL(baseUrl).origin}/${url}`;
}

/**
 * Unfurl a URL to extract metadata
 */
async function unfurlUrl(url: string): Promise<UnfurlResult> {
  const result: UnfurlResult = { url };

  try {
    // Fetch with timeout and proper headers
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TheWire/1.0; +https://the-wire.chabotc.workers.dev)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return result;
    }

    // Only process HTML
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return result;
    }

    // Read first 100KB of HTML (enough for meta tags in head)
    const reader = response.body?.getReader();
    if (!reader) return result;

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const maxBytes = 100 * 1024;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.length;

      // Stop if we've passed </head>
      if (html.includes('</head>')) break;
    }

    reader.cancel();

    // Extract metadata with Twitter Card fallback to Open Graph
    const title = extractMetaContent(html, 'twitter:title')
      || extractMetaContent(html, 'og:title')
      || extractTitle(html);
    if (title) result.title = title;

    const description = extractMetaContent(html, 'twitter:description')
      || extractMetaContent(html, 'og:description')
      || extractMetaContent(html, 'description');
    if (description) result.description = description;

    const rawImage = extractMetaContent(html, 'twitter:image')
      || extractMetaContent(html, 'twitter:image:src')
      || extractMetaContent(html, 'og:image');
    const image = resolveUrl(rawImage, url);
    if (image) result.image = image;

    const siteName = extractMetaContent(html, 'og:site_name')
      || extractMetaContent(html, 'twitter:site')
      || new URL(url).hostname.replace(/^www\./, '');
    if (siteName) result.siteName = siteName;

    const type = extractMetaContent(html, 'twitter:card')
      || extractMetaContent(html, 'og:type')
      || 'summary';
    if (type) result.type = type;

    const favicon = extractFavicon(html, url);
    if (favicon) result.favicon = favicon;

    // Decode HTML entities in title/description
    if (result.title) {
      const decoded = decodeHtmlEntities(result.title);
      if (decoded) result.title = decoded;
    }
    if (result.description) {
      const decoded = decodeHtmlEntities(result.description);
      if (decoded) result.description = decoded;
    }

    // Truncate description if too long
    if (result.description && result.description.length > 200) {
      result.description = result.description.substring(0, 200) + '...';
    }

  } catch (error) {
    console.error('Unfurl error:', error);
  }

  return result;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

/**
 * GET /api/unfurl?url=<url>
 * Fetch metadata for a URL
 */
unfurlRoutes.get('/', async (c) => {
  const url = c.req.query('url');

  if (!url) {
    return c.json({
      success: false,
      error: 'URL parameter required',
    }, 400);
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return c.json({
      success: false,
      error: 'Invalid URL format',
    }, 400);
  }

  // Validate URL to prevent SSRF
  if (!isValidExternalUrl(url)) {
    return c.json({ success: false, error: 'Invalid or blocked URL' }, 400);
  }

  // Check cache first
  const cacheKey = `unfurl:${url}`;
  const cached = await c.env.POSTS_KV.get(cacheKey);

  if (cached) {
    return c.json({
      success: true,
      data: JSON.parse(cached),
      cached: true,
    });
  }

  // Unfurl the URL
  const result = await unfurlUrl(url);

  // Cache for 1 hour if we got useful data
  if (result.title || result.image) {
    await c.env.POSTS_KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 3600,
    });
  }

  return c.json({
    success: true,
    data: result,
    cached: false,
  });
});

export default unfurlRoutes;
