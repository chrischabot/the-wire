/**
 * Seed data handler for The Wire
 * Uses Claude API to generate realistic, contextual content
 *
 * Endpoints (call via live deployment with delays):
 * 1. POST /debug/cleanup - Clear all posts, likes, reposts, comments
 * 2. POST /debug/seed/users - Create 20 users (idempotent)
 * 3. POST /debug/seed/follows - Create follow relationships
 * 4. POST /debug/seed/ai-posts?batch=N - Generate posts using Claude API
 * 5. POST /debug/seed/interactions?batch=N - Create likes and reposts
 * 6. POST /debug/seed/ai-replies?batch=N - Generate contextual replies using Claude
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { AuthUser, UserProfile, UserSettings } from '../types/user';
import type { Post, PostMetadata } from '../types/post';
import { generateSalt, hashPassword } from '../utils/crypto';
import { generateId } from '../services/snowflake';
import { indexPostContent, indexUser } from '../utils/search-index';
import { requireAdmin } from '../middleware/auth';

const seed = new Hono<{ Bindings: Env }>();

// Note: We apply requireAdmin selectively below to allow bootstrap endpoint

// 20 realistic UK/US users with AI/tech backgrounds
const SEED_USERS = [
  {
    handle: 'sarahchen',
    displayName: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    bio: 'ML Engineer @DeepMind | Stanford CS | Building the future of AI one model at a time',
    location: 'London, UK',
    website: 'https://sarahchen.dev',
    avatarUrl: 'https://randomuser.me/api/portraits/women/1.jpg',
  },
  {
    handle: 'marcusjohnson',
    displayName: 'Marcus Johnson',
    email: 'marcus.j@example.com',
    bio: 'Senior Software Engineer | AI enthusiast | Previously @Google | OSS contributor',
    location: 'San Francisco, CA',
    website: 'https://marcusjohnson.io',
    avatarUrl: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
  {
    handle: 'emmawilliams',
    displayName: 'Emma Williams',
    email: 'emma.w@example.com',
    bio: 'Product Manager @Anthropic | Ex-Stripe | Passionate about AI safety and ethics',
    location: 'New York, NY',
    website: 'https://emmawilliams.com',
    avatarUrl: 'https://randomuser.me/api/portraits/women/3.jpg',
  },
  {
    handle: 'jameswright',
    displayName: 'James Wright',
    email: 'james.wright@example.com',
    bio: 'Founder & CTO @AIStartup | YC W23 | Using LLMs to transform developer productivity',
    location: 'Austin, TX',
    website: 'https://jameswright.tech',
    avatarUrl: 'https://randomuser.me/api/portraits/men/4.jpg',
  },
  {
    handle: 'oliviabrown',
    displayName: 'Olivia Brown',
    email: 'olivia.brown@example.com',
    bio: 'Research Scientist @OpenAI | PhD in NLP | Working on language understanding',
    location: 'Seattle, WA',
    website: 'https://oliviabrown.ai',
    avatarUrl: 'https://randomuser.me/api/portraits/women/5.jpg',
  },
  {
    handle: 'danielkim',
    displayName: 'Daniel Kim',
    email: 'daniel.kim@example.com',
    bio: 'Staff Engineer @NVIDIA | GPU optimization | Making AI training faster',
    location: 'Santa Clara, CA',
    website: '',
    avatarUrl: 'https://randomuser.me/api/portraits/men/6.jpg',
  },
  {
    handle: 'sophiepatel',
    displayName: 'Sophie Patel',
    email: 'sophie.p@example.com',
    bio: 'AI Developer Advocate @Microsoft | Teaching developers to build with AI',
    location: 'Manchester, UK',
    website: 'https://sophiepatel.dev',
    avatarUrl: 'https://randomuser.me/api/portraits/women/7.jpg',
  },
  {
    handle: 'alexthompson',
    displayName: 'Alex Thompson',
    email: 'alex.t@example.com',
    bio: 'Full-stack dev using Claude Code daily | Building AI-powered tools | Indie hacker',
    location: 'Denver, CO',
    website: 'https://alexthompson.dev',
    avatarUrl: 'https://randomuser.me/api/portraits/men/8.jpg',
  },
  {
    handle: 'rachelgreen',
    displayName: 'Rachel Green',
    email: 'rachel.g@example.com',
    bio: 'Engineering Manager @Meta | Leading AI/ML platform teams | Hiring!',
    location: 'Menlo Park, CA',
    website: '',
    avatarUrl: 'https://randomuser.me/api/portraits/women/9.jpg',
  },
  {
    handle: 'michaelwilson',
    displayName: 'Michael Wilson',
    email: 'michael.w@example.com',
    bio: 'AI Researcher | PhD candidate @ Cambridge | Interested in reasoning and agents',
    location: 'Cambridge, UK',
    website: 'https://mwilson.research.uk',
    avatarUrl: 'https://randomuser.me/api/portraits/men/10.jpg',
  },
  {
    handle: 'jessicadavis',
    displayName: 'Jessica Davis',
    email: 'jessica.d@example.com',
    bio: 'DevRel Engineer @Mistral | Helping developers build amazing AI applications',
    location: 'Paris, France',
    website: 'https://jessicadavis.io',
    avatarUrl: 'https://randomuser.me/api/portraits/women/11.jpg',
  },
  {
    handle: 'chrismartinez',
    displayName: 'Chris Martinez',
    email: 'chris.m@example.com',
    bio: 'Indie developer | Built my SaaS with Claude | Sharing my AI coding journey',
    location: 'Miami, FL',
    website: 'https://chrismartinez.co',
    avatarUrl: 'https://randomuser.me/api/portraits/men/12.jpg',
  },
  {
    handle: 'ameliasmith',
    displayName: 'Amelia Smith',
    email: 'amelia.s@example.com',
    bio: 'Tech journalist covering AI | Previously @Wired | Writing about the future',
    location: 'London, UK',
    website: 'https://ameliasmith.press',
    avatarUrl: 'https://randomuser.me/api/portraits/women/13.jpg',
  },
  {
    handle: 'ryanlee',
    displayName: 'Ryan Lee',
    email: 'ryan.lee@example.com',
    bio: 'Principal Engineer @Vercel | AI infrastructure | Edge computing enthusiast',
    location: 'Brooklyn, NY',
    website: 'https://ryanlee.dev',
    avatarUrl: 'https://randomuser.me/api/portraits/men/14.jpg',
  },
  {
    handle: 'laurataylor',
    displayName: 'Laura Taylor',
    email: 'laura.t@example.com',
    bio: 'VP Engineering @AIUnicorn | Scaling AI systems | Speaker & mentor',
    location: 'Boston, MA',
    website: 'https://laurataylor.tech',
    avatarUrl: 'https://randomuser.me/api/portraits/women/15.jpg',
  },
  {
    handle: 'davidanderson',
    displayName: 'David Anderson',
    email: 'david.a@example.com',
    bio: 'Senior ML Engineer @Hugging Face | Transformer models | Open source advocate',
    location: 'Berlin, Germany',
    website: 'https://davidanderson.ml',
    avatarUrl: 'https://randomuser.me/api/portraits/men/16.jpg',
  },
  {
    handle: 'hannahmoore',
    displayName: 'Hannah Moore',
    email: 'hannah.m@example.com',
    bio: 'AI Safety Researcher | Alignment | Making AI beneficial for humanity',
    location: 'Oxford, UK',
    website: 'https://hannahmoore.ai',
    avatarUrl: 'https://randomuser.me/api/portraits/women/17.jpg',
  },
  {
    handle: 'kevinjackson',
    displayName: 'Kevin Jackson',
    email: 'kevin.j@example.com',
    bio: 'Tech Lead @Cursor | Building AI-powered code editors | Future of development',
    location: 'San Francisco, CA',
    website: 'https://kevinjackson.io',
    avatarUrl: 'https://randomuser.me/api/portraits/men/18.jpg',
  },
  {
    handle: 'nataliewhite',
    displayName: 'Natalie White',
    email: 'natalie.w@example.com',
    bio: 'Startup founder | Using AI to revolutionize healthcare | Stanford MBA',
    location: 'Palo Alto, CA',
    website: 'https://nataliewhite.com',
    avatarUrl: 'https://randomuser.me/api/portraits/women/19.jpg',
  },
  {
    handle: 'benharris',
    displayName: 'Ben Harris',
    email: 'ben.h@example.com',
    bio: 'Backend engineer obsessed with AI coding assistants | Vim + Claude',
    location: 'Edinburgh, UK',
    website: 'https://benharris.dev',
    avatarUrl: 'https://randomuser.me/api/portraits/men/20.jpg',
  },
];

const PASSWORD = 'SeedPassword123!';

/**
 * Call Claude API to generate content
 */
async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 300
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return data.content[0]?.text || '';
}

/**
 * Helper to get all user data from KV
 */
async function getAllUsers(env: Env): Promise<Array<{
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  location: string;
}>> {
  const users: Array<{
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    location: string;
  }> = [];

  for (const userData of SEED_USERS) {
    const userId = await env.USERS_KV.get(`handle:${userData.handle.toLowerCase()}`);
    if (userId) {
      users.push({
        userId,
        handle: userData.handle.toLowerCase(),
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl,
        bio: userData.bio,
        location: userData.location,
      });
    }
  }

  return users;
}

/**
 * Helper to get posts (limited to avoid subrequest limits)
 */
async function getTopLevelPosts(env: Env, limit: number = 50): Promise<Array<PostMetadata>> {
  const posts: PostMetadata[] = [];
  let cursor: string | null = null;
  let done = false;

  while (!done && posts.length < limit) {
    const list: KVNamespaceListResult<unknown, string> = await env.POSTS_KV.list({ prefix: 'post:', cursor, limit: 100 });
    for (const key of list.keys) {
      if (posts.length >= limit) break;
      const postData = await env.POSTS_KV.get(key.name);
      if (postData) {
        const post = JSON.parse(postData) as PostMetadata;
        if (!post.isDeleted && !post.replyToId && !post.repostOfId) {
          posts.push(post);
        }
      }
    }
    if (list.list_complete) {
      done = true;
    } else {
      cursor = list.cursor;
    }
  }

  return posts;
}

/**
 * CLEANUP: Clear all posts, likes, reposts, comments (keep users and follows)
 */
/**
 * Reset database for testing - requires admin authentication
 * POST /debug/reset
 */
seed.post('/reset', requireAdmin, async (c) => {
  // This endpoint is for testing only - cleanup all data
  try {
    const log: string[] = [];

    // Delete all posts
    let postCursor: string | undefined;
    let postsDeleted = 0;
    do {
      const postList = await c.env.POSTS_KV.list({
        prefix: 'post:',
        limit: 1000,
        cursor: postCursor ?? null,
      });

      const deletePromises = postList.keys.map((key) => c.env.POSTS_KV.delete(key.name));
      await Promise.all(deletePromises);
      postsDeleted += postList.keys.length;

      postCursor = postList.list_complete ? undefined : postList.cursor;
    } while (postCursor);

    // Delete all users and profiles
    let userCursor: string | undefined;
    let usersDeleted = 0;
    do {
      const userList = await c.env.USERS_KV.list({
        limit: 1000,
        cursor: userCursor ?? null,
      });

      const deletePromises = userList.keys.map((key) => c.env.USERS_KV.delete(key.name));
      await Promise.all(deletePromises);
      usersDeleted += userList.keys.length;

      userCursor = userList.list_complete ? undefined : userList.cursor;
    } while (userCursor);

    // Delete all rate limit keys (stored in SESSIONS_KV with 'rl:' prefix)
    let rateLimitCursor: string | undefined;
    let rateLimitsDeleted = 0;
    do {
      const rateLimitList = await c.env.SESSIONS_KV.list({
        prefix: 'rl:',
        limit: 1000,
        cursor: rateLimitCursor ?? null,
      });

      const deletePromises = rateLimitList.keys.map((key) => c.env.SESSIONS_KV.delete(key.name));
      await Promise.all(deletePromises);
      rateLimitsDeleted += rateLimitList.keys.length;

      rateLimitCursor = rateLimitList.list_complete ? undefined : rateLimitList.cursor;
    } while (rateLimitCursor);

    log.push(`Deleted ${postsDeleted} posts`);
    log.push(`Deleted ${usersDeleted} user records`);
    log.push(`Deleted ${rateLimitsDeleted} rate limit records`);

    return c.json({
      success: true,
      message: 'Database reset complete',
      log,
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    return c.json({ success: false, error: 'Failed to reset database' }, 500);
  }
});

seed.post('/cleanup', requireAdmin, async (c) => {
  const batch = parseInt(c.req.query('batch') || '0');
  const log: string[] = [];

  try {
    let cursor: string | null = null;
    let deletedCount = 0;
    let batchesProcessed = 0;
    const maxBatchesPerCall = 5; // Process 5 KV list batches per call

    // Skip to the right starting point
    for (let i = 0; i < batch * maxBatchesPerCall && cursor !== null; i++) {
      const skipList: KVNamespaceListResult<unknown, string> = await c.env.POSTS_KV.list({ prefix: 'post:', cursor, limit: 100 });
      if (skipList.list_complete) break;
      cursor = skipList.cursor;
    }

    // Delete posts in this batch
    while (batchesProcessed < maxBatchesPerCall) {
      const deleteList: KVNamespaceListResult<unknown, string> = await c.env.POSTS_KV.list({ prefix: 'post:', cursor, limit: 100 });
      batchesProcessed++;

      for (const key of deleteList.keys) {
        await c.env.POSTS_KV.delete(key.name);
        deletedCount++;
      }

      if (deleteList.list_complete) {
        // Also delete reply indexes
        let replyCursor: string | null = null;
        let replyDone = false;
        while (!replyDone) {
          const replyList: KVNamespaceListResult<unknown, string> = await c.env.POSTS_KV.list({ prefix: 'replies:', cursor: replyCursor, limit: 100 });
          for (const key of replyList.keys) {
            await c.env.POSTS_KV.delete(key.name);
          }
          if (replyList.list_complete) {
            replyDone = true;
          } else {
            replyCursor = replyList.cursor;
          }
        }

        // Clear all user feeds
        const users = await getAllUsers(c.env);
        for (const user of users) {
          const feedDoId = c.env.FEED_DO.idFromName(user.userId);
          const feedStub = c.env.FEED_DO.get(feedDoId);
          await feedStub.fetch('https://do.internal/clear', { method: 'POST' });

          // Reset user post count
          const userDoId = c.env.USER_DO.idFromName(user.userId);
          const userStub = c.env.USER_DO.get(userDoId);
          await userStub.fetch('https://do.internal/posts/reset', { method: 'POST' });
        }

        log.push(`Cleanup complete! Deleted ${deletedCount} posts total.`);
        return c.json({ success: true, complete: true, deletedCount, log });
      }

      cursor = deleteList.cursor;
    }

    log.push(`Batch ${batch}: Deleted ${deletedCount} posts`);
    return c.json({
      success: true,
      complete: false,
      batch,
      nextBatch: batch + 1,
      deletedCount,
      log
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

/**
 * Phase 1: Create users (idempotent)
 */
seed.post('/seed/users', requireAdmin, async (c) => {
  const log: string[] = [];

  try {
    for (const userData of SEED_USERS) {
      const existing = await c.env.USERS_KV.get(`handle:${userData.handle.toLowerCase()}`);
      if (existing) {
        log.push(`User ${userData.handle} already exists, skipping`);
        continue;
      }

      const userId = generateId();
      const salt = generateSalt();
      const passwordHash = await hashPassword(PASSWORD, salt);
      const now = Date.now();

      const authUser: AuthUser = {
        id: userId,
        email: userData.email,
        handle: userData.handle.toLowerCase(),
        passwordHash,
        salt,
        createdAt: now,
        lastLogin: now,
      };

      await c.env.USERS_KV.put(`user:${userId}`, JSON.stringify(authUser));
      await c.env.USERS_KV.put(`email:${userData.email.toLowerCase()}`, userId);
      await c.env.USERS_KV.put(`handle:${userData.handle.toLowerCase()}`, userId);

      const profile: UserProfile = {
        id: userId,
        handle: userData.handle.toLowerCase(),
        displayName: userData.displayName,
        bio: userData.bio,
        location: userData.location,
        website: userData.website,
        avatarUrl: userData.avatarUrl,
        bannerUrl: '',
        joinedAt: now,
        followerCount: 1,
        followingCount: 1,
        postCount: 0,
        isVerified: false,
        isBanned: false,
        isAdmin: false,
      };

      const settings: UserSettings = {
        emailNotifications: true,
        privateAccount: false,
        mutedWords: [],
      };

      const doId = c.env.USER_DO.idFromName(userId);
      const stub = c.env.USER_DO.get(doId);

      await stub.fetch('https://do.internal/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, settings }),
      });

      // Self-follow
      await stub.fetch('https://do.internal/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      await stub.fetch('https://do.internal/add-follower', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      log.push(`Created user: ${userData.handle}`);
    }

    return c.json({ success: true, phase: 'users', log });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

/**
 * Phase 2: Create follow relationships
 */
seed.post('/seed/follows', requireAdmin, async (c) => {
  const log: string[] = [];

  try {
    const users = await getAllUsers(c.env);
    if (users.length === 0) {
      return c.json({ success: false, error: 'No users found. Run /seed/users first.' }, 400);
    }

    for (const user of users) {
      const numToFollow = 8 + Math.floor(Math.random() * 8); // 8-15 follows
      const others = users.filter(u => u.userId !== user.userId);
      const shuffled = [...others].sort(() => Math.random() - 0.5);

      let followCount = 0;
      for (let i = 0; i < Math.min(numToFollow, shuffled.length); i++) {
        const target = shuffled[i];
        if (!target) continue;

        const followerDoId = c.env.USER_DO.idFromName(user.userId);
        const followerStub = c.env.USER_DO.get(followerDoId);
        await followerStub.fetch('https://do.internal/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: target.userId }),
        });

        const followedDoId = c.env.USER_DO.idFromName(target.userId);
        const followedStub = c.env.USER_DO.get(followedDoId);
        await followedStub.fetch('https://do.internal/add-follower', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.userId }),
        });

        followCount++;
      }

      log.push(`${user.handle} followed ${followCount} users`);
    }

    return c.json({ success: true, phase: 'follows', log });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

// Post type templates for variety
const POST_TYPES = [
  'hot_take', 'question', 'tip', 'observation', 'announcement', 'rant',
  'celebration', 'recommendation', 'meme_reference', 'industry_news',
  'personal_update', 'debate_starter', 'lesson_learned', 'unpopular_opinion'
];

const TOPICS = [
  'Claude and Anthropic', 'GPT-4 and OpenAI', 'local LLMs and Ollama',
  'AI coding assistants', 'prompt engineering', 'RAG and embeddings',
  'fine-tuning models', 'AI safety and alignment', 'GPU costs and NVIDIA',
  'Cursor IDE', 'GitHub Copilot', 'AI agents', 'context windows',
  'hallucinations in AI', 'AI in production', 'developer productivity',
  'code review with AI', 'testing AI code', 'TypeScript', 'Rust',
  'Python for ML', 'startup life', 'remote work', 'tech interviews',
  'open source AI', 'Hugging Face', 'Mistral', 'tech Twitter drama',
  'conference talks', 'side projects', 'burnout', 'learning new tech'
];

/**
 * Phase 3: Generate AI posts (1 user per batch, generates 10 posts per call)
 */
seed.post('/seed/ai-posts', requireAdmin, async (c) => {
  const batch = parseInt(c.req.query('batch') || '0');
  const subBatch = parseInt(c.req.query('sub') || '0');
  const log: string[] = [];

  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ success: false, error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  try {
    const users = await getAllUsers(c.env);
    if (users.length === 0) {
      return c.json({ success: false, error: 'No users found.' }, 400);
    }

    if (batch >= users.length) {
      return c.json({ success: true, message: 'All users complete', log });
    }

    const user = users[batch];
    if (!user) {
      return c.json({ success: false, error: `User at index ${batch} not found` }, 400);
    }
    const totalSubBatches = 4; // 4 sub-batches × 10 posts = 40 posts per user

    if (subBatch >= totalSubBatches) {
      return c.json({
        success: true,
        message: `User ${user.handle} complete`,
        nextBatch: batch + 1,
        nextSub: 0,
        log
      });
    }

    // Get other users for mentions
    const otherUsers = users.filter(u => u.userId !== user.userId);
    const mentionHandles = otherUsers.map(u => `@${u.handle}`).join(', ');

    // Select random post types and topics for this batch
    const shuffledTypes = [...POST_TYPES].sort(() => Math.random() - 0.5).slice(0, 10);
    const shuffledTopics = [...TOPICS].sort(() => Math.random() - 0.5).slice(0, 10);

    const systemPrompt = `You generate social media posts for "The Wire", a Twitter-like network for AI/tech professionals.

CRITICAL RULES:
- Each post MUST be completely different in structure, tone, and topic
- NEVER start multiple posts the same way
- NEVER use "I just spent X hours" or similar time-spent phrases
- NEVER start with "Just" for more than one post
- Mix: questions, opinions, jokes, observations, tips, rants, celebrations
- Some posts should be funny/sarcastic, some serious, some vulnerable
- Length varies: some very short (20-50 chars), some medium (100-150), some longer (200-270)
- Occasionally @mention other users: ${mentionHandles}
- NO hashtags ever
- Sound like real humans on Twitter, not corporate or AI-generated

Output format: Return exactly 10 posts, each on its own line, numbered 1-10. Nothing else.`;

    const postSpecs = shuffledTypes.map((type, i) => `${i + 1}. Type: ${type}, Topic: ${shuffledTopics[i] ?? 'general tech'}`).join('\n');

    const userPrompt = `Generate 10 posts as ${user.displayName} (@${user.handle})

Bio: "${user.bio}"
Location: ${user.location}

Generate one post for each specification:
${postSpecs}

Remember: Each post must feel authentic to this person's role/expertise. Vary sentence starters, lengths, and tones dramatically. Some can be just 3-5 words, others can be mini-threads.`;

    const response = await callClaude(c.env.ANTHROPIC_API_KEY, systemPrompt, userPrompt, 1500);

    // Parse the numbered posts
    const lines = response.split('\n').filter(line => line.trim());
    const posts: string[] = [];

    for (const line of lines) {
      // Match lines starting with number and period/colon
      const match = line.match(/^\d+[\.\):]\s*(.+)/);
      if (match && match[1]) {
        const content = match[1].trim();
        if (content.length >= 10 && content.length <= 280) {
          posts.push(content);
        }
      }
    }

    if (posts.length === 0) {
      log.push(`No valid posts parsed for ${user.handle}`);
      return c.json({ success: false, error: 'Failed to parse posts', log }, 500);
    }

    // Create each post
    for (const content of posts) {
      const postId = generateId();
      const timeOffset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
      const now = Date.now() - timeOffset;

      const post: Post = {
        id: postId,
        authorId: user.userId,
        content: content.slice(0, 280),
        mediaUrls: [],
        createdAt: now,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
        isDeleted: false,
      };

      const doId = c.env.POST_DO.idFromName(postId);
      const stub = c.env.POST_DO.get(doId);
      await stub.fetch('https://do.internal/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post }),
      });

      const metadata: PostMetadata = {
        id: postId,
        authorId: user.userId,
        authorHandle: user.handle,
        authorDisplayName: user.displayName,
        authorAvatarUrl: user.avatarUrl,
        content: content.slice(0, 280),
        mediaUrls: [],
        createdAt: now,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
      };

      await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

      const userDoId = c.env.USER_DO.idFromName(user.userId);
      const userStub = c.env.USER_DO.get(userDoId);
      await userStub.fetch('https://do.internal/posts/increment', { method: 'POST' });

      log.push(`${user.handle}: "${content.slice(0, 40)}..."`);
    }

    return c.json({
      success: true,
      batch,
      subBatch,
      postsCreated: posts.length,
      nextBatch: subBatch + 1 >= totalSubBatches ? batch + 1 : batch,
      nextSub: subBatch + 1 >= totalSubBatches ? 0 : subBatch + 1,
      log,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

/**
 * Phase 4: Create likes and reposts (1 user per batch)
 */
seed.post('/seed/interactions', requireAdmin, async (c) => {
  const batch = parseInt(c.req.query('batch') || '0');
  const log: string[] = [];

  try {
    const users = await getAllUsers(c.env);
    const posts = await getTopLevelPosts(c.env, 100);

    if (users.length === 0 || posts.length === 0) {
      return c.json({ success: false, error: 'No users or posts found.' }, 400);
    }

    if (batch >= users.length) {
      return c.json({ success: true, message: 'All interactions complete', log });
    }

    const user = users[batch];
    if (!user) {
      return c.json({ success: false, error: `User at index ${batch} not found` }, 400);
    }

    // Likes: 30-50 per user
    const numLikes = 30 + Math.floor(Math.random() * 21);
    const shuffledForLikes = [...posts].sort(() => Math.random() - 0.5);
    const postsToLike = shuffledForLikes.slice(0, numLikes);

    let likeCount = 0;
    for (const post of postsToLike) {
      const doId = c.env.POST_DO.idFromName(post.id);
      const stub = c.env.POST_DO.get(doId);

      const response = await stub.fetch('https://do.internal/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId }),
      });

      if (response.ok) {
        const { likeCount: newCount } = await response.json() as { likeCount: number };
        post.likeCount = newCount;
        await c.env.POSTS_KV.put(`post:${post.id}`, JSON.stringify(post));
        likeCount++;
      }
    }

    // Reposts: 3-8 per user
    const numReposts = 3 + Math.floor(Math.random() * 6);
    const otherPosts = posts.filter(p => p.authorId !== user.userId);
    const shuffledForReposts = [...otherPosts].sort(() => Math.random() - 0.5);
    const postsToRepost = shuffledForReposts.slice(0, numReposts);

    let repostCount = 0;
    for (const originalPost of postsToRepost) {
      // Check if already reposted
      const originalDoId = c.env.POST_DO.idFromName(originalPost.id);
      const originalStub = c.env.POST_DO.get(originalDoId);
      const hasRepostedResp = await originalStub.fetch(`https://do.internal/has-reposted?userId=${user.userId}`);
      const { hasReposted } = await hasRepostedResp.json() as { hasReposted: boolean };
      if (hasReposted) continue;

      const repostId = generateId();
      const now = Date.now();

      const repost: Post = {
        id: repostId,
        authorId: user.userId,
        content: '',
        mediaUrls: [],
        repostOfId: originalPost.id,
        createdAt: now,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
        isDeleted: false,
      };

      const doId = c.env.POST_DO.idFromName(repostId);
      const stub = c.env.POST_DO.get(doId);
      await stub.fetch('https://do.internal/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: repost }),
      });

      const metadata = {
        id: repostId,
        authorId: user.userId,
        authorHandle: user.handle,
        authorDisplayName: user.displayName,
        authorAvatarUrl: user.avatarUrl,
        content: '',
        mediaUrls: [],
        repostOfId: originalPost.id,
        originalPost: {
          id: originalPost.id,
          authorHandle: originalPost.authorHandle,
          authorDisplayName: originalPost.authorDisplayName,
          authorAvatarUrl: originalPost.authorAvatarUrl || '',
          content: originalPost.content,
          mediaUrls: originalPost.mediaUrls,
        },
        createdAt: now,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
      };

      await c.env.POSTS_KV.put(`post:${repostId}`, JSON.stringify(metadata));

      // Track repost on original
      const repostResp = await originalStub.fetch('https://do.internal/repost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId }),
      });

      if (repostResp.ok) {
        const { repostCount: newCount } = await repostResp.json() as { repostCount: number };
        originalPost.repostCount = newCount;
        await c.env.POSTS_KV.put(`post:${originalPost.id}`, JSON.stringify(originalPost));
      }

      // Increment user's post count
      const userDoId = c.env.USER_DO.idFromName(user.userId);
      const userStub = c.env.USER_DO.get(userDoId);
      await userStub.fetch('https://do.internal/posts/increment', { method: 'POST' });

      repostCount++;
    }

    log.push(`${user.handle}: ${likeCount} likes, ${repostCount} reposts`);

    return c.json({
      success: true,
      batch,
      nextBatch: batch + 1 < users.length ? batch + 1 : null,
      log,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

// Reply tone types for variety
const REPLY_TONES = [
  'agree enthusiastically', 'politely disagree', 'ask follow-up question',
  'share related experience', 'add technical detail', 'make a joke',
  'express skepticism', 'offer alternative view', 'give encouragement',
  'share a resource/link idea', 'play devil\'s advocate', 'express surprise'
];

/**
 * Phase 5: Generate AI replies (1 user per batch, 10 replies per sub-batch)
 */
seed.post('/seed/ai-replies', requireAdmin, async (c) => {
  const batch = parseInt(c.req.query('batch') || '0');
  const subBatch = parseInt(c.req.query('sub') || '0');
  const log: string[] = [];

  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ success: false, error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  try {
    const users = await getAllUsers(c.env);
    const posts = await getTopLevelPosts(c.env, 100);

    if (users.length === 0 || posts.length === 0) {
      return c.json({ success: false, error: 'No users or posts found.' }, 400);
    }

    if (batch >= users.length) {
      return c.json({ success: true, message: 'All replies complete', log });
    }

    const user = users[batch];
    if (!user) {
      return c.json({ success: false, error: `User at index ${batch} not found` }, 400);
    }
    const repliesPerSubBatch = 10;
    const totalSubBatches = 5; // 5 sub-batches × 10 = 50 replies per user

    if (subBatch >= totalSubBatches) {
      return c.json({
        success: true,
        message: `User ${user.handle} replies complete`,
        nextBatch: batch + 1,
        nextSub: 0,
        log
      });
    }

    // Get posts to reply to (not own posts), shuffle for variety
    const otherPosts = posts.filter(p => p.authorId !== user.userId);
    const shuffledPosts = [...otherPosts].sort(() => Math.random() - 0.5);
    const postsToReplyTo = shuffledPosts.slice(0, repliesPerSubBatch);

    // Build context for batch reply generation
    const postContexts: string[] = [];
    const postMap: Map<number, PostMetadata> = new Map();
    const replyIndexMap: Map<number, string[]> = new Map();

    for (let i = 0; i < postsToReplyTo.length; i++) {
      const originalPost = postsToReplyTo[i];
      if (!originalPost) continue;
      postMap.set(i + 1, originalPost);

      // Get existing replies for context
      const replyIndexKey = `replies:${originalPost.id}`;
      const existingRepliesData = await c.env.POSTS_KV.get(replyIndexKey);
      const existingReplies: string[] = existingRepliesData ? JSON.parse(existingRepliesData) : [];
      replyIndexMap.set(i + 1, existingReplies);

      // Fetch up to 2 existing replies for context
      const replyContents: string[] = [];
      for (const replyId of existingReplies.slice(0, 2)) {
        const replyData = await c.env.POSTS_KV.get(`post:${replyId}`);
        if (replyData) {
          const reply = JSON.parse(replyData) as PostMetadata;
          replyContents.push(`  - @${reply.authorHandle}: "${reply.content}"`);
        }
      }

      const tone = REPLY_TONES[Math.floor(Math.random() * REPLY_TONES.length)];
      postContexts.push(`POST ${i + 1} by @${originalPost.authorHandle}: "${originalPost.content}"
${replyContents.length > 0 ? `Existing replies:\n${replyContents.join('\n')}` : '(No replies yet)'}
YOUR TONE: ${tone}`);
    }

    const systemPrompt = `You generate replies for "The Wire", a Twitter-like network for AI/tech professionals.

CRITICAL RULES:
- Each reply MUST directly reference the specific post content
- Vary reply lengths: some short (15-40 chars), some medium (50-120), some longer
- NEVER start multiple replies the same way
- Mix tones as specified: questions, jokes, agreements, disagreements, insights
- Can @mention the original poster or others
- NO hashtags
- Sound like real tech Twitter replies - casual, authentic, sometimes snarky

Output: Return exactly ${postsToReplyTo.length} replies, numbered to match the posts. One per line.`;

    const userPrompt = `Generate replies as ${user.displayName} (@${user.handle})
Bio: "${user.bio}"

Reply to each post with the specified tone:

${postContexts.join('\n\n')}

Remember: Each reply must be contextually relevant to THAT specific post. Don't be generic.`;

    const response = await callClaude(c.env.ANTHROPIC_API_KEY, systemPrompt, userPrompt, 2000);

    // Parse the numbered replies
    const lines = response.split('\n').filter(line => line.trim());
    const repliesCreated: Array<{ postNum: number; content: string }> = [];

    for (const line of lines) {
      const match = line.match(/^(?:POST\s*)?(\d+)[\.\):]\s*(.+)/i);
      if (match && match[1] && match[2]) {
        const postNum = parseInt(match[1]);
        const content = match[2].trim();
        if (content.length >= 5 && content.length <= 280 && postMap.has(postNum)) {
          repliesCreated.push({ postNum, content });
        }
      }
    }

    // Create each reply
    for (const { postNum, content } of repliesCreated) {
      const originalPost = postMap.get(postNum)!;
      const existingReplies = replyIndexMap.get(postNum) || [];

      const postId = generateId();
      const now = Date.now() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000);

      const replyPost: Post = {
        id: postId,
        authorId: user.userId,
        content: content.slice(0, 280),
        mediaUrls: [],
        replyToId: originalPost.id,
        createdAt: now,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
        isDeleted: false,
      };

      const doId = c.env.POST_DO.idFromName(postId);
      const stub = c.env.POST_DO.get(doId);
      await stub.fetch('https://do.internal/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: replyPost }),
      });

      const metadata: PostMetadata = {
        id: postId,
        authorId: user.userId,
        authorHandle: user.handle,
        authorDisplayName: user.displayName,
        authorAvatarUrl: user.avatarUrl,
        content: content.slice(0, 280),
        mediaUrls: [],
        replyToId: originalPost.id,
        createdAt: now,
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        quoteCount: 0,
      };

      await c.env.POSTS_KV.put(`post:${postId}`, JSON.stringify(metadata));

      // Update reply index
      const replyIndexKey = `replies:${originalPost.id}`;
      existingReplies.push(postId);
      await c.env.POSTS_KV.put(replyIndexKey, JSON.stringify(existingReplies));

      // Increment parent's reply count
      const parentDoId = c.env.POST_DO.idFromName(originalPost.id);
      const parentStub = c.env.POST_DO.get(parentDoId);
      await parentStub.fetch('https://do.internal/replies/increment', { method: 'POST' });

      originalPost.replyCount = (originalPost.replyCount || 0) + 1;
      await c.env.POSTS_KV.put(`post:${originalPost.id}`, JSON.stringify(originalPost));

      // Increment user's post count
      const userDoId = c.env.USER_DO.idFromName(user.userId);
      const userStub = c.env.USER_DO.get(userDoId);
      await userStub.fetch('https://do.internal/posts/increment', { method: 'POST' });

      log.push(`${user.handle} replied to @${originalPost.authorHandle}: "${content.slice(0, 40)}..."`);
    }

    return c.json({
      success: true,
      batch,
      subBatch,
      repliesCreated: repliesCreated.length,
      nextBatch: subBatch + 1 >= totalSubBatches ? batch + 1 : batch,
      nextSub: subBatch + 1 >= totalSubBatches ? 0 : subBatch + 1,
      log,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

/**
 * Status endpoint - requires admin authentication
 */
seed.get('/status', requireAdmin, async (c) => {
  let userCount = 0;
  let postCount = 0;
  let replyCount = 0;
  let cursor: string | null = null;
  let done = false;

  while (!done) {
    const userList: KVNamespaceListResult<unknown, string> = await c.env.USERS_KV.list({ prefix: 'user:', cursor, limit: 1000 });
    userCount += userList.keys.length;
    if (userList.list_complete) {
      done = true;
    } else {
      cursor = userList.cursor;
    }
  }

  cursor = null;
  done = false;
  while (!done) {
    const postList: KVNamespaceListResult<unknown, string> = await c.env.POSTS_KV.list({ prefix: 'post:', cursor, limit: 1000 });
    for (const key of postList.keys) {
      const data = await c.env.POSTS_KV.get(key.name);
      if (data) {
        const post = JSON.parse(data);
        if (post.replyToId) {
          replyCount++;
        } else {
          postCount++;
        }
      }
    }
    if (postList.list_complete) {
      done = true;
    } else {
      cursor = postList.cursor;
    }
  }

  return c.json({
    success: true,
    data: { users: userCount, posts: postCount, replies: replyCount },
  });
});

/**
 * Backfill search index for existing posts
 * Call with ?batch=0, then ?batch=1, etc. until complete
 */
seed.post('/backfill/posts', requireAdmin, async (c) => {
  const batch = parseInt(c.req.query('batch') || '0');
  const log: string[] = [];
  const postsPerBatch = 50;

  try {
    let cursor: string | null = null;
    let skipped = 0;
    let indexed = 0;

    // Skip to the right batch
    for (let i = 0; i < batch; i++) {
      const skipList: KVNamespaceListResult<unknown, string> = await c.env.POSTS_KV.list({ prefix: 'post:', limit: postsPerBatch, cursor });
      if (skipList.list_complete) {
        return c.json({ success: true, complete: true, message: 'All posts already indexed', log });
      }
      cursor = skipList.cursor;
    }

    // Get posts for this batch
    const batchList: KVNamespaceListResult<unknown, string> = await c.env.POSTS_KV.list({ prefix: 'post:', limit: postsPerBatch, cursor });

    for (const key of batchList.keys) {
      const postData = await c.env.POSTS_KV.get(key.name);
      if (!postData) continue;

      const post = JSON.parse(postData) as PostMetadata;
      if (post.isDeleted || !post.content) {
        skipped++;
        continue;
      }

      // Index the post
      await indexPostContent(c.env, post.id, post.content, post.createdAt);
      indexed++;
    }

    log.push(`Batch ${batch}: Indexed ${indexed} posts, skipped ${skipped}`);

    if (batchList.list_complete) {
      return c.json({
        success: true,
        complete: true,
        batch,
        indexed,
        skipped,
        log,
      });
    }

    return c.json({
      success: true,
      complete: false,
      batch,
      nextBatch: batch + 1,
      indexed,
      skipped,
      log,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

/**
 * Backfill search index for existing users
 * Single call indexes all users (usually fewer than posts)
 */
seed.post('/backfill/users', requireAdmin, async (c) => {
  const log: string[] = [];

  try {
    let cursor: string | null = null;
    let indexed = 0;
    let done = false;

    while (!done) {
      const userList: KVNamespaceListResult<unknown, string> = await c.env.USERS_KV.list({ prefix: 'user:', limit: 100, cursor });

      for (const key of userList.keys) {
        const userData = await c.env.USERS_KV.get(key.name);
        if (!userData) continue;

        const user = JSON.parse(userData) as AuthUser;
        const userId = user.id;

        // Get user profile from DO
        try {
          const doId = c.env.USER_DO.idFromName(userId);
          const stub = c.env.USER_DO.get(doId);
          const profileResp = await stub.fetch('https://do.internal/profile');

          if (profileResp.ok) {
            const profile = await profileResp.json() as UserProfile;
            await indexUser(c.env, userId, profile.handle, profile.displayName);
            indexed++;
            log.push(`Indexed user: @${profile.handle}`);
          }
        } catch (err) {
          log.push(`Failed to index user ${userId}: ${err}`);
        }
      }

      if (userList.list_complete) {
        done = true;
      } else {
        cursor = userList.cursor;
      }
    }

    return c.json({
      success: true,
      complete: true,
      indexed,
      log,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    log.push(`Error: ${err}`);
    return c.json({ success: false, error: err, log }, 500);
  }
});

/**
 * Bootstrap admin privileges for a user by handle
 * POST /debug/bootstrap-admin/:handle
 *
 * This is a one-time bootstrap endpoint for setting up the initial admin.
 * In production, this should be disabled or protected.
 */
seed.post('/bootstrap-admin/:handle', async (c) => {
  const handle = c.req.param('handle').toLowerCase();

  // Look up user ID from handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Set admin status via UserDO
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);

  await userStub.fetch('https://do.internal/set-admin', {
    method: 'POST',
    body: JSON.stringify({ isAdmin: true }),
    headers: { 'Content-Type': 'application/json' },
  });

  return c.json({
    success: true,
    message: `User @${handle} has been granted admin privileges`,
  });
});

/**
 * Make a user follow all other users
 * POST /debug/follow-all/:handle
 */
seed.post('/follow-all/:handle', requireAdmin, async (c) => {
  const handle = c.req.param('handle').toLowerCase();
  const log: string[] = [];

  // Look up user ID from handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  log.push(`Found user @${handle} with ID ${userId}`);

  // Get all users by scanning handle: keys
  const allHandles: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const listResult = await c.env.USERS_KV.list({
      prefix: 'handle:',
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });

    for (const key of listResult.keys) {
      const h = key.name.replace('handle:', '');
      if (h !== handle) {
        allHandles.push(h);
      }
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  log.push(`Found ${allHandles.length} other users to follow`);

  // Get user's current following list
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const followingResp = await userStub.fetch('https://do.internal/following');
  const followingData = await followingResp.json() as { following: string[] };
  const alreadyFollowing = new Set(followingData.following || []);

  let followed = 0;
  let skipped = 0;

  for (const targetHandle of allHandles) {
    const targetUserId = await c.env.USERS_KV.get(`handle:${targetHandle}`);
    if (!targetUserId) continue;

    if (alreadyFollowing.has(targetUserId)) {
      skipped++;
      continue;
    }

    // Follow via UserDO
    await userStub.fetch('https://do.internal/follow', {
      method: 'POST',
      body: JSON.stringify({ userId: targetUserId }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Increment follower count for target
    const targetDoId = c.env.USER_DO.idFromName(targetUserId);
    const targetStub = c.env.USER_DO.get(targetDoId);
    await targetStub.fetch('https://do.internal/followers/increment', {
      method: 'POST',
    });

    followed++;
  }

  log.push(`Followed ${followed} users, skipped ${skipped} already following`);

  // Sync the following count in the profile
  await userStub.fetch('https://do.internal/sync-counts', { method: 'POST' });

  return c.json({
    success: true,
    message: `@${handle} is now following ${followed} new users`,
    log,
    stats: { followed, skipped, total: allHandles.length },
  });
});

/**
 * Sync follow counts for a user (fix mismatched counts)
 * POST /debug/sync-counts/:handle
 */
seed.post('/sync-counts/:handle', requireAdmin, async (c) => {
  const handle = c.req.param('handle').toLowerCase();

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);

  await userStub.fetch('https://do.internal/sync-counts', { method: 'POST' });

  // Fetch updated profile
  const profileResp = await userStub.fetch('https://do.internal/profile');
  const profile = await profileResp.json();

  return c.json({
    success: true,
    message: `Synced counts for @${handle}`,
    profile,
  });
});

/**
 * Backfill a user's FeedDO with posts from users they follow
 * POST /debug/backfill-feed/:handle
 */
seed.post('/backfill-feed/:handle', requireAdmin, async (c) => {
  const handle = c.req.param('handle').toLowerCase();
  const log: string[] = [];

  // Look up user ID from handle
  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Get user's following list
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const followingResp = await userStub.fetch('https://do.internal/following');
  const followingData = await followingResp.json() as { following: string[] };
  const followingIds = followingData.following || [];

  log.push(`User @${handle} follows ${followingIds.length} users`);

  // Get the user's FeedDO
  const feedDoId = c.env.FEED_DO.idFromName(userId);
  const feedStub = c.env.FEED_DO.get(feedDoId);

  const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  let totalAdded = 0;

  // First, collect all posts from followed users (single scan through KV)
  const postsByAuthor = new Map<string, PostMetadata[]>();
  const followingSet = new Set(followingIds);
  let postCursor: string | undefined;
  let scannedBatches = 0;
  const maxBatches = 20; // Limit total batches to avoid timeout

  while (scannedBatches < maxBatches) {
    const listResult = await c.env.POSTS_KV.list({
      prefix: 'post:',
      limit: 100,
      ...(postCursor ? { cursor: postCursor } : {}),
    });
    scannedBatches++;

    for (const key of listResult.keys) {
      const postData = await c.env.POSTS_KV.get(key.name);
      if (!postData) continue;

      const post = JSON.parse(postData) as PostMetadata;

      if (followingSet.has(post.authorId) &&
          !post.isDeleted &&
          post.createdAt > cutoffTime) {
        const existing = postsByAuthor.get(post.authorId) || [];
        if (existing.length < 20) { // Max 20 posts per user
          existing.push(post);
          postsByAuthor.set(post.authorId, existing);
        }
      }
    }

    if (listResult.list_complete) break;
    postCursor = listResult.cursor;
  }

  log.push(`Scanned ${scannedBatches} batches, found posts from ${postsByAuthor.size} users`);

  // Now add all collected posts to the feed
  for (const [authorId, posts] of postsByAuthor) {
    for (const post of posts) {
      await feedStub.fetch('https://do.internal/add-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: {
            postId: post.id,
            authorId: post.authorId,
            timestamp: post.createdAt,
            source: post.authorId === userId ? 'own' : 'follow',
          },
        }),
      });
      totalAdded++;
    }
    log.push(`Added ${posts.length} posts from user ${authorId}`);
  }

  log.push(`Total posts added to feed: ${totalAdded}`);

  return c.json({
    success: true,
    message: `Backfilled ${totalAdded} posts to @${handle}'s feed`,
    log,
  });
});

/**
 * Rebuild explore cache with full post data
 * POST /debug/rebuild-explore
 */
seed.post('/rebuild-explore', requireAdmin, async (c) => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const scoredPosts: Array<{ post: PostMetadata; score: number }> = [];

  let cursor: string | undefined;
  let batchCount = 0;
  const maxBatches = 25; // Limit to avoid timeout

  while (batchCount < maxBatches) {
    const listResult = await c.env.POSTS_KV.list({
      prefix: 'post:',
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    batchCount++;

    // Use Promise.all for concurrent fetches (like scheduled.ts does)
    const batchPromises = listResult.keys.map(async (key) => {
      const postData = await c.env.POSTS_KV.get(key.name);
      if (!postData) return null;

      const post = JSON.parse(postData) as PostMetadata;
      if (post.isDeleted || post.createdAt < sevenDaysAgo) return null;

      const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
      const points = (post.likeCount || 0) + (post.replyCount || 0) * 2 + (post.repostCount || 0) * 1.5;
      const score = points / Math.pow(ageHours + 2, 1.8);

      return { post, score };
    });

    const results = await Promise.all(batchPromises);
    for (const result of results) {
      if (result) scoredPosts.push(result);
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  scoredPosts.sort((a, b) => b.score - a.score);

  // Apply diversity
  const result: PostMetadata[] = [];
  const pending = [...scoredPosts];

  while (pending.length > 0 && result.length < 500) {
    let added = false;
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      if (!item) continue;
      const windowStart = Math.max(0, result.length - 4);
      const window = result.slice(windowStart);
      const authorCount = window.filter(p => p.authorId === item.post.authorId).length;

      if (authorCount < 2) {
        result.push(item.post);
        pending.splice(i, 1);
        added = true;
        break;
      }
    }
    if (!added && pending.length > 0) {
      const first = pending.shift();
      if (first) result.push(first.post);
    }
  }

  await c.env.FEEDS_KV.put('explore:ranked', JSON.stringify(result), {
    expirationTtl: 900,
  });

  return c.json({
    success: true,
    message: `Rebuilt explore cache with ${result.length} posts`,
  });
});

/**
 * Build author posts index for a specific user by handle
 * POST /debug/build-author-index/:handle
 * This makes profile page posts load instantly
 */
seed.post('/build-author-index/:handle', requireAdmin, async (c) => {
  const handle = c.req.param('handle').toLowerCase();

  const userId = await c.env.USERS_KV.get(`handle:${handle}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const postIds: Array<{ id: string; createdAt: number }> = [];
  let cursor: string | undefined;
  let scannedBatches = 0;

  while (scannedBatches < 30) {
    const listResult = await c.env.POSTS_KV.list({
      prefix: 'post:',
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    scannedBatches++;

    for (const key of listResult.keys) {
      const postData = await c.env.POSTS_KV.get(key.name);
      if (!postData) continue;

      const post = JSON.parse(postData) as PostMetadata;
      if (post.isDeleted) continue;
      if (post.authorId === userId) {
        postIds.push({ id: post.id, createdAt: post.createdAt });
      }
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  // Sort by createdAt descending
  postIds.sort((a, b) => b.createdAt - a.createdAt);
  const ids = postIds.map(p => p.id).slice(0, 1000);

  await c.env.POSTS_KV.put(`user-posts:${userId}`, JSON.stringify(ids));

  return c.json({
    success: true,
    message: `Built index for @${handle} with ${ids.length} posts`,
    scannedBatches,
  });
});

/**
 * Build author posts index for all users (batched)
 * POST /debug/build-all-author-indexes
 */
seed.post('/build-all-author-indexes', requireAdmin, async (c) => {
  // Get all user handles
  const handles: string[] = [];
  let userCursor: string | undefined;

  while (true) {
    const listResult = await c.env.USERS_KV.list({
      prefix: 'handle:',
      limit: 100,
      ...(userCursor ? { cursor: userCursor } : {}),
    });

    for (const key of listResult.keys) {
      handles.push(key.name.replace('handle:', ''));
    }

    if (listResult.list_complete) break;
    userCursor = listResult.cursor;
  }

  // For each user, collect their posts and build index
  const results: string[] = [];

  for (const handle of handles) {
    const userId = await c.env.USERS_KV.get(`handle:${handle}`);
    if (!userId) continue;

    const postIds: Array<{ id: string; createdAt: number }> = [];
    let cursor: string | undefined;
    let scanned = 0;

    // Quick scan - limit batches per user
    while (scanned < 10) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: 'post:',
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      scanned++;

      for (const key of listResult.keys) {
        const postData = await c.env.POSTS_KV.get(key.name);
        if (!postData) continue;
        const post = JSON.parse(postData) as PostMetadata;
        if (!post.isDeleted && post.authorId === userId) {
          postIds.push({ id: post.id, createdAt: post.createdAt });
        }
      }

      if (listResult.list_complete) break;
      cursor = listResult.cursor;
    }

    if (postIds.length > 0) {
      postIds.sort((a, b) => b.createdAt - a.createdAt);
      const ids = postIds.map(p => p.id).slice(0, 1000);
      await c.env.POSTS_KV.put(`user-posts:${userId}`, JSON.stringify(ids));
      results.push(`@${handle}: ${ids.length} posts`);
    }
  }

  return c.json({
    success: true,
    message: `Built indexes for ${results.length} users`,
    users: results,
  });
});

// Debug feed algorithm
/**
 * Quick rebuild explore cache - lightweight version that limits batches
 * POST /debug/quick-explore
 */
seed.post('/quick-explore', requireAdmin, async (c) => {
  try {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allPosts: PostMetadata[] = [];

  let cursor: string | undefined;
  let batchCount = 0;

  // Limit to 5 batches of 100 = 500 posts max (stay under subrequest limits)
  while (batchCount < 5) {
    const listResult = await c.env.POSTS_KV.list({
      prefix: 'post:',
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    batchCount++;

    // Fetch posts in parallel
    const postPromises = listResult.keys.map(key => c.env.POSTS_KV.get(key.name));
    const postDatas = await Promise.all(postPromises);

    for (const postData of postDatas) {
      if (!postData) continue;
      const post: PostMetadata = JSON.parse(postData);
      if (post.isDeleted || post.createdAt < sevenDaysAgo) continue;
      allPosts.push(post);
    }

    if (listResult.list_complete) break;
    cursor = listResult.cursor;
  }

  // Score posts
  const scoredPosts = allPosts.map(post => {
    const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
    const points = (post.likeCount || 0) + (post.replyCount || 0) * 2 + (post.repostCount || 0) * 1.5;
    const score = points / Math.pow(ageHours + 2, 1.8);
    return { post, score };
  });

  scoredPosts.sort((a, b) => b.score - a.score);

  // Apply diversity
  const result: PostMetadata[] = [];
  const pending = [...scoredPosts];

  while (pending.length > 0 && result.length < 200) {
    let added = false;
    for (let i = 0; i < Math.min(pending.length, 20); i++) {
      const item = pending[i];
      if (!item) continue;
      const windowStart = Math.max(0, result.length - 4);
      const window = result.slice(windowStart);
      const authorCount = window.filter(p => p.authorId === item.post.authorId).length;

      if (authorCount < 2) {
        result.push(item.post);
        pending.splice(i, 1);
        added = true;
        break;
      }
    }
    if (!added && pending.length > 0) {
      const first = pending.shift();
      if (first) result.push(first.post);
    }
  }

  await c.env.FEEDS_KV.put('explore:ranked', JSON.stringify(result), {
    expirationTtl: 900,
  });

  return c.json({
    success: true,
    message: `Built explore cache with ${result.length} posts from ${allPosts.length} total`,
  });
  } catch (err) {
    console.error('quick-explore error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

/**
 * Rebuild user search index for all users
 * POST /debug/rebuild-user-index
 */
seed.post('/rebuild-user-index', requireAdmin, async (c) => {
  try {
    let cursor: string | undefined;
    let indexed = 0;
    let batchCount = 0;
    const maxBatches = 10;

    while (batchCount < maxBatches) {
      const listResult = await c.env.USERS_KV.list({
        prefix: 'user:',
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      batchCount++;

      for (const key of listResult.keys) {
        // Skip non-user keys
        if (!key.name.startsWith('user:')) continue;

        const userData = await c.env.USERS_KV.get(key.name);
        if (!userData) continue;

        try {
          const user = JSON.parse(userData);
          if (!user.handle) continue;

          // Get profile for display name
          const userDoId = c.env.USER_DO.idFromName(user.id);
          const userStub = c.env.USER_DO.get(userDoId);
          const profileResp = await userStub.fetch('https://do.internal/profile');

          if (profileResp.ok) {
            const profile = await profileResp.json() as { handle: string; displayName?: string };
            await indexUser(c.env, user.id, profile.handle, profile.displayName || profile.handle);
            indexed++;
          }
        } catch (err) {
          console.error('Error indexing user:', key.name, err);
        }
      }

      if (listResult.list_complete) break;
      cursor = listResult.cursor;
    }

    return c.json({
      success: true,
      message: `Indexed ${indexed} users for search`,
    });
  } catch (err) {
    console.error('rebuild-user-index error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

/**
 * Test home feed for a user - requires admin authentication
 * GET /debug/test-home/:handle
 */
seed.get('/test-home/:handle', requireAdmin, async (c) => {
  const handle = c.req.param('handle');
  const userId = await c.env.USERS_KV.get(`handle:${handle.toLowerCase()}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Get user's following list
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const followingResp = await userStub.fetch('https://do.internal/following');
  const followingData = await followingResp.json() as { following: string[] };
  const followingIds = followingData.following || [];

  // Get FeedDO entries (followed posts)
  const feedDoId = c.env.FEED_DO.idFromName(userId);
  const feedStub = c.env.FEED_DO.get(feedDoId);
  const feedResp = await feedStub.fetch('https://do.internal/feed?limit=20');
  const feedData = await feedResp.json() as { entries: any[] };

  // Get explore posts
  const exploreData = await c.env.FEEDS_KV.get('explore:ranked');
  let explorePosts: any[] = [];
  if (exploreData) {
    const rawPosts = JSON.parse(exploreData);
    const followedIds = new Set(feedData.entries?.map((e: any) => e.postId) || []);
    for (const post of rawPosts.slice(0, 30)) {
      if (explorePosts.length >= 10) break;
      if (followedIds.has(post.id)) continue;
      if (post.authorId === userId) continue;
      explorePosts.push({
        id: post.id,
        author: post.authorHandle,
        content: post.content?.substring(0, 50),
        source: 'explore',
      });
    }
  }

  // Fetch followed posts details from FeedDO
  const followedPosts: any[] = [];
  const seenPostIds = new Set<string>();
  let followSourceCount = 0;

  for (const entry of (feedData.entries || []).slice(0, 20)) {
    const postData = await c.env.POSTS_KV.get(`post:${entry.postId}`);
    if (postData) {
      const post = JSON.parse(postData);
      followedPosts.push({
        id: post.id,
        author: post.authorHandle,
        content: post.content?.substring(0, 50),
        source: entry.source,
      });
      seenPostIds.add(post.id);
      if (entry.source === 'follow') followSourceCount++;
    }
  }

  // FALLBACK: If not enough "follow" posts OR lack of author diversity, scan for posts from followed users
  const followAuthors = new Set(followedPosts.filter(p => p.source === 'follow').map(p => p.author));
  const needMoreDiversity = followAuthors.size < Math.min(3, followingIds.length);
  const needMoreFollowContent = followSourceCount < 10;

  // Debug: track what we're finding
  const debugInfo: any = {
    followingIdsCount: followingIds.length,
    followingSetSize: 0,
    scannedPosts: 0,
    matchedByAuthor: {} as Record<string, number>,
    sampleAuthorIds: [] as string[],
  };

  if ((needMoreDiversity || needMoreFollowContent) && followingIds.length > 0) {
    // Filter out null values from followingIds
    const cleanFollowingIds = followingIds.filter((id): id is string => id !== null && id !== undefined);
    const followingSet = new Set(cleanFollowingIds);
    debugInfo.followingSetSize = followingSet.size;
    let postCursor: string | undefined;
    let scannedBatches = 0;

    while (followedPosts.length < 60 && scannedBatches < 20) {
      const listResult = await c.env.POSTS_KV.list({
        prefix: 'post:',
        limit: 100,
        ...(postCursor ? { cursor: postCursor } : {}),
      });
      scannedBatches++;

      for (const key of listResult.keys) {
        const postData = await c.env.POSTS_KV.get(key.name);
        if (!postData) continue;

        const post = JSON.parse(postData) as PostMetadata;
        debugInfo.scannedPosts++;

        // Track sample author IDs for debugging
        if (debugInfo.sampleAuthorIds.length < 20) {
          debugInfo.sampleAuthorIds.push(post.authorId);
        }

        if (followingSet.has(post.authorId) &&
            !post.isDeleted &&
            !seenPostIds.has(post.id) &&
            post.authorId !== userId) {
          // Track which authors we're matching
          const authorKey = post.authorHandle || post.authorId;
          debugInfo.matchedByAuthor[authorKey] = (debugInfo.matchedByAuthor[authorKey] || 0) + 1;

          followedPosts.push({
            id: post.id,
            author: post.authorHandle,
            content: post.content?.substring(0, 50),
            source: 'follow-scan',
          });
          seenPostIds.add(post.id);
        }
      }

      if (listResult.list_complete) break;
      postCursor = listResult.cursor;
    }
  }

  // Count sources
  const sourceBreakdown = {
    own: followedPosts.filter(p => p.source === 'own').length,
    follow: followedPosts.filter(p => p.source === 'follow').length,
    'follow-scan': followedPosts.filter(p => p.source === 'follow-scan').length,
  };

  return c.json({
    userId,
    handle,
    followingCount: followingIds.length,
    followAuthorsCount: followAuthors.size,
    needMoreDiversity,
    followedPostsCount: followedPosts.length,
    sourceBreakdown,
    debugInfo,
    followedPosts: followedPosts.slice(0, 20),
    explorePosts,
    note: 'Home feed should merge followed + explore posts',
  });
});

seed.get('/debug-feed/:handle', requireAdmin, async (c) => {
  const handle = c.req.param('handle');

  // Get user ID
  const userId = await c.env.USERS_KV.get(`handle:${handle.toLowerCase()}`);
  if (!userId) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Get following list
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const followingResp = await userStub.fetch('https://do.internal/following');
  const followingData = await followingResp.json() as { following: string[] };
  const followingIds = followingData.following || [];

  // Get FeedDO entries
  const feedDoId = c.env.FEED_DO.idFromName(userId);
  const feedStub = c.env.FEED_DO.get(feedDoId);
  const feedResp = await feedStub.fetch('https://do.internal/feed?limit=50');
  const feedData = await feedResp.json() as { entries: any[] };

  // Get explore cache
  const exploreData = await c.env.FEEDS_KV.get('explore:ranked');
  let exploreCount = 0;
  let exploreSample: any[] = [];
  if (exploreData) {
    const posts = JSON.parse(exploreData);
    exploreCount = posts.length;
    exploreSample = posts.slice(0, 5).map((p: any) => ({
      id: p.id,
      author: p.authorHandle,
      content: p.content?.substring(0, 50),
    }));
  }

  return c.json({
    userId,
    followingCount: followingIds.length,
    followingIds: followingIds.slice(0, 10),
    feedDoEntries: feedData.entries?.length || 0,
    feedDoSample: feedData.entries?.slice(0, 5),
    exploreCount,
    exploreSample,
  });
});

export default seed;
