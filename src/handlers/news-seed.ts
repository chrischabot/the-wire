/**
 * News Seed Handler
 *
 * Endpoints for the AI News Seeder system:
 * - Manual triggers for testing
 * - Status monitoring
 * - Scheduled execution entry point
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import { requireAdmin } from "../middleware/auth";
import { DEFAULT_NEWS_CONFIG } from "../types/news";
import { logger } from "../utils/logger";
import {
  fetchAllNews,
  markItemSeen,
  getAggregationStats,
  recordAggregationRun,
} from "../services/news-aggregator";
import { processStories, selectTopStories } from "../services/story-processor";
import { generateConversations } from "../services/conversation-generator";

const newsSeed = new Hono<{ Bindings: Env }>();

// All endpoints require admin
newsSeed.use("*", requireAdmin);

/**
 * GET /debug/news/status
 * Get current status of the news seeder
 */
newsSeed.get("/status", async (c) => {
  try {
    const stats = await getAggregationStats(c.env);

    return c.json({
      success: true,
      data: {
        seenStoriesCount: stats.seenCount,
        lastRun: stats.lastRun,
        config: DEFAULT_NEWS_CONFIG,
      },
    });
  } catch (error) {
    logger.error("News status error", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * POST /debug/news/fetch
 * Manually trigger news fetching (does not generate conversations)
 */
newsSeed.post("/fetch", async (c) => {
  try {
    const items = await fetchAllNews(
      c.env,
      DEFAULT_NEWS_CONFIG.maxStoryAgeHours,
    );

    return c.json({
      success: true,
      data: {
        itemsFound: items.length,
        items: items.slice(0, 20).map((item) => ({
          id: item.id,
          source: item.source,
          title: item.title,
          url: item.url,
          publishedAt: new Date(item.publishedAt).toISOString(),
          score: item.score,
        })),
      },
    });
  } catch (error) {
    logger.error("News fetch error", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * POST /debug/news/process
 * Manually trigger story processing (analyzes but doesn't post)
 */
newsSeed.post("/process", async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { success: false, error: "ANTHROPIC_API_KEY not configured" },
      500,
    );
  }

  try {
    // Fetch news
    const items = await fetchAllNews(
      c.env,
      DEFAULT_NEWS_CONFIG.maxStoryAgeHours,
    );

    if (items.length === 0) {
      return c.json({
        success: true,
        data: { message: "No new stories to process", processed: [] },
      });
    }

    // Process top stories
    const toProcess = items.slice(0, DEFAULT_NEWS_CONFIG.storiesPerRun);
    const processed = await processStories(c.env.ANTHROPIC_API_KEY, toProcess);

    // Select best for conversations
    const selected = selectTopStories(
      processed,
      DEFAULT_NEWS_CONFIG.conversationsPerRun,
      DEFAULT_NEWS_CONFIG.minDebateScore,
    );

    return c.json({
      success: true,
      data: {
        totalFetched: items.length,
        processed: processed.length,
        selected: selected.map((s) => ({
          title: s.item.title,
          source: s.item.source,
          debatePotential: s.debatePotential,
          summary: s.summary,
          suggestedPersonas: s.suggestedPersonas,
        })),
      },
    });
  } catch (error) {
    logger.error("News process error", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * POST /debug/news/generate
 * Full run: fetch, process, and generate conversations
 */
newsSeed.post("/generate", async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { success: false, error: "ANTHROPIC_API_KEY not configured" },
      500,
    );
  }

  try {
    console.log("Starting news seeder run...");

    // 1. Fetch news
    const items = await fetchAllNews(
      c.env,
      DEFAULT_NEWS_CONFIG.maxStoryAgeHours,
    );
    console.log(`Fetched ${items.length} news items`);

    if (items.length === 0) {
      await recordAggregationRun(c.env);
      return c.json({
        success: true,
        data: {
          message: "No new stories to process",
          conversations: [],
        },
      });
    }

    // 2. Process stories
    const toProcess = items.slice(0, DEFAULT_NEWS_CONFIG.storiesPerRun);
    const processed = await processStories(c.env.ANTHROPIC_API_KEY, toProcess);
    console.log(`Processed ${processed.length} stories`);

    // 3. Select best stories
    const selected = selectTopStories(
      processed,
      DEFAULT_NEWS_CONFIG.conversationsPerRun,
      DEFAULT_NEWS_CONFIG.minDebateScore,
    );
    console.log(`Selected ${selected.length} stories for conversations`);

    if (selected.length === 0) {
      await recordAggregationRun(c.env);
      return c.json({
        success: true,
        data: {
          message: "No stories met debate threshold",
          totalFetched: items.length,
          processed: processed.length,
          conversations: [],
        },
      });
    }

    // 4. Generate conversations
    const results = await generateConversations(
      c.env,
      c.env.ANTHROPIC_API_KEY,
      selected,
      DEFAULT_NEWS_CONFIG.repliesPerConversation,
    );
    console.log(`Generated ${results.length} conversations`);

    // 5. Mark stories as seen
    for (const story of selected) {
      await markItemSeen(c.env, story.item.id);
    }

    // 6. Record run
    await recordAggregationRun(c.env);

    return c.json({
      success: true,
      data: {
        totalFetched: items.length,
        processed: processed.length,
        selected: selected.length,
        conversations: results,
      },
    });
  } catch (error) {
    logger.error("News generate error", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * POST /debug/news/clear
 * Clear seen stories cache (allows re-processing)
 */
newsSeed.post("/clear", async (c) => {
  try {
    // List and delete all seen entries
    let cursor: string | undefined;
    let deleted = 0;

    do {
      const list = await c.env.SESSIONS_KV.list({
        prefix: "news:",
        limit: 100,
        cursor: cursor ?? null,
      });

      for (const key of list.keys) {
        await c.env.SESSIONS_KV.delete(key.name);
        deleted++;
      }

      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return c.json({
      success: true,
      data: {
        message: "News cache cleared",
        entriesDeleted: deleted,
      },
    });
  } catch (error) {
    logger.error("News clear error", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export default newsSeed;

/**
 * Scheduled handler for news seeding
 * Called by the cron trigger
 */
export async function runNewsSeeder(env: Env): Promise<void> {
  if (!env.ANTHROPIC_API_KEY) {
    logger.error("News seeder: ANTHROPIC_API_KEY not configured");
    return;
  }

  console.log("News seeder: Starting scheduled run...");

  try {
    // 1. Fetch news
    const items = await fetchAllNews(env, DEFAULT_NEWS_CONFIG.maxStoryAgeHours);
    console.log(`News seeder: Fetched ${items.length} items`);

    if (items.length === 0) {
      await recordAggregationRun(env);
      console.log("News seeder: No new stories");
      return;
    }

    // 2. Process stories
    const toProcess = items.slice(0, DEFAULT_NEWS_CONFIG.storiesPerRun);
    const processed = await processStories(env.ANTHROPIC_API_KEY, toProcess);
    console.log(`News seeder: Processed ${processed.length} stories`);

    // 3. Select best stories
    const selected = selectTopStories(
      processed,
      DEFAULT_NEWS_CONFIG.conversationsPerRun,
      DEFAULT_NEWS_CONFIG.minDebateScore,
    );
    console.log(`News seeder: Selected ${selected.length} stories`);

    if (selected.length === 0) {
      await recordAggregationRun(env);
      console.log("News seeder: No stories met threshold");
      return;
    }

    // 4. Generate conversations
    const results = await generateConversations(
      env,
      env.ANTHROPIC_API_KEY,
      selected,
      DEFAULT_NEWS_CONFIG.repliesPerConversation,
    );
    console.log(`News seeder: Generated ${results.length} conversations`);

    // 5. Mark stories as seen
    for (const story of selected) {
      await markItemSeen(env, story.item.id);
    }

    // 6. Record run
    await recordAggregationRun(env);

    console.log("News seeder: Run complete", {
      fetched: items.length,
      processed: processed.length,
      conversations: results.length,
    });
  } catch (error) {
    logger.error("News seeder error", error);
    throw error;
  }
}
