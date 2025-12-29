/**
 * News Aggregator Service
 *
 * Fetches AI/ML news from RSS feeds and Hacker News API,
 * deduplicates, and filters for freshness.
 */

import type { Env } from "../types/env";
import type { NewsItem, NewsSource, RSSFeedConfig } from "../types/news";
import { NEWS_SOURCES, HN_CONFIG } from "../types/news";
import { logger } from "../utils/logger";

/**
 * Hash a string to create a unique ID
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Parse RSS/Atom feed XML
 */
function parseRSSFeed(
  xml: string,
  source: NewsSource,
  contentField: string = "description",
): NewsItem[] {
  const items: NewsItem[] = [];
  const now = Date.now();

  // Handle both RSS and Atom formats
  const isAtom = xml.includes("<feed");

  if (isAtom) {
    // Atom format
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1] ?? "";

      const title = entry.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
      const link =
        entry.match(/<link[^>]*href="([^"]*)"[^>]*\/>/)?.[1] ??
        entry.match(/<link[^>]*>([^<]*)<\/link>/)?.[1] ??
        "";
      const content =
        entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ??
        entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ??
        "";
      const published =
        entry.match(/<published>([^<]*)<\/published>/)?.[1] ??
        entry.match(/<updated>([^<]*)<\/updated>/)?.[1] ??
        "";

      if (title && link) {
        items.push({
          id: hashString(link),
          source,
          title: decodeHTMLEntities(title),
          url: link,
          content: stripHTML(decodeHTMLEntities(content)).slice(0, 2000),
          publishedAt: published ? new Date(published).getTime() : now,
          fetchedAt: now,
        });
      }
    }
  } else {
    // RSS format
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1] ?? "";

      const title = item.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
      const link = item.match(/<link[^>]*>([^<]*)<\/link>/)?.[1] ?? "";

      let content = "";
      if (contentField === "content") {
        content =
          item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1] ??
          "";
      }
      if (!content) {
        content =
          item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "";
      }

      const pubDate = item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] ?? "";

      if (title && link) {
        items.push({
          id: hashString(link),
          source,
          title: decodeHTMLEntities(title),
          url: link,
          content: stripHTML(decodeHTMLEntities(content)).slice(0, 2000),
          publishedAt: pubDate ? new Date(pubDate).getTime() : now,
          fetchedAt: now,
        });
      }
    }
  }

  return items;
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/**
 * Strip HTML tags from content
 */
function stripHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch a single RSS feed
 */
async function fetchRSSFeed(config: RSSFeedConfig): Promise<NewsItem[]> {
  try {
    const response = await fetch(config.url, {
      headers: {
        "User-Agent": "TheWire-NewsBot/1.0",
        Accept: "application/rss+xml, application/atom+xml, application/xml",
      },
    });

    if (!response.ok) {
      logger.error("RSS fetch failed", undefined, {
        source: config.source,
        status: response.status,
      });
      return [];
    }

    const xml = await response.text();
    return parseRSSFeed(xml, config.source, config.contentField);
  } catch (error) {
    logger.error("RSS fetch error", error, { source: config.source });
    return [];
  }
}

/**
 * Fetch top AI stories from Hacker News using hnrss.org
 */
async function fetchHackerNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  const now = Date.now();

  try {
    // Use hnrss.org for filtered AI content
    const keywords = HN_CONFIG.keywords.join("+OR+");
    const url = `https://hnrss.org/newest?q=${encodeURIComponent(keywords)}&points=${HN_CONFIG.minScore}&count=${HN_CONFIG.maxStories}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "TheWire-NewsBot/1.0",
        Accept: "application/rss+xml",
      },
    });

    if (!response.ok) {
      logger.error("HN fetch failed", undefined, { status: response.status });
      return [];
    }

    const xml = await response.text();

    // Parse HN RSS feed
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1] ?? "";

      const title = item.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
      const link = item.match(/<link>([^<]*)<\/link>/)?.[1] ?? "";
      const description =
        item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "";
      const pubDate = item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] ?? "";

      // Extract HN score and comment count from description
      const pointsMatch = description.match(/Points:\s*(\d+)/);
      const commentsCountMatch = description.match(/Comments:\s*(\d+)/);

      const score = pointsMatch?.[1] ? parseInt(pointsMatch[1], 10) : undefined;
      const commentCount = commentsCountMatch?.[1]
        ? parseInt(commentsCountMatch[1], 10)
        : undefined;

      if (title && link) {
        const newsItem: NewsItem = {
          id: hashString(link),
          source: "hackernews",
          title: decodeHTMLEntities(title),
          url: link,
          content: stripHTML(decodeHTMLEntities(description)).slice(0, 500),
          publishedAt: pubDate ? new Date(pubDate).getTime() : now,
          fetchedAt: now,
        };
        if (score !== undefined) newsItem.score = score;
        if (commentCount !== undefined) newsItem.commentCount = commentCount;
        items.push(newsItem);
      }
    }

    return items;
  } catch (error) {
    logger.error("HN fetch error", error);
    return [];
  }
}

/**
 * Check if a news item has already been processed
 */
async function isSeenItem(env: Env, itemId: string): Promise<boolean> {
  const seen = await env.SESSIONS_KV.get(`news:seen:${itemId}`);
  return seen !== null;
}

/**
 * Mark a news item as processed
 */
export async function markItemSeen(env: Env, itemId: string): Promise<void> {
  // TTL of 7 days
  await env.SESSIONS_KV.put(`news:seen:${itemId}`, "1", {
    expirationTtl: 7 * 24 * 60 * 60,
  });
}

/**
 * Fetch all news sources and return deduplicated, fresh items
 */
export async function fetchAllNews(
  env: Env,
  maxAgeHours: number = 48,
): Promise<NewsItem[]> {
  const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

  // Fetch sources sequentially to avoid hitting subrequest limits
  const allItems: NewsItem[] = [];

  // Fetch RSS feeds one at a time
  for (const config of NEWS_SOURCES) {
    try {
      const items = await fetchRSSFeed(config);
      allItems.push(...items);
    } catch (error) {
      logger.error("Failed to fetch RSS", error, { source: config.source });
    }
  }

  // Fetch HN
  try {
    const hnItems = await fetchHackerNews();
    allItems.push(...hnItems);
  } catch (error) {
    logger.error("Failed to fetch HN", error);
  }

  // Deduplicate
  const seenIds = new Set<string>();
  const uniqueItems: NewsItem[] = [];

  for (const item of allItems) {
    // Skip duplicates
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    // Skip old items
    if (item.publishedAt < cutoffTime) continue;

    // Skip already processed items
    if (await isSeenItem(env, item.id)) continue;

    uniqueItems.push(item);
  }

  // Sort by recency
  uniqueItems.sort((a, b) => b.publishedAt - a.publishedAt);

  return uniqueItems;
}

/**
 * Get aggregation stats for monitoring
 */
export async function getAggregationStats(
  env: Env,
): Promise<{ seenCount: number; lastRun: string | null }> {
  const lastRun = await env.SESSIONS_KV.get("news:last-run");

  // Count seen items (approximate - list first 100)
  const seenList = await env.SESSIONS_KV.list({
    prefix: "news:seen:",
    limit: 100,
  });

  return {
    seenCount: seenList.keys.length,
    lastRun,
  };
}

/**
 * Record that the aggregator ran
 */
export async function recordAggregationRun(env: Env): Promise<void> {
  await env.SESSIONS_KV.put("news:last-run", new Date().toISOString(), {
    expirationTtl: 7 * 24 * 60 * 60,
  });
}
