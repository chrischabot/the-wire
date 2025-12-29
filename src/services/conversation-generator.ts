/**
 * Conversation Generator Service
 *
 * Generates authentic posts and reply threads from processed stories.
 */

import type { Env } from "../types/env";
import type { ProcessedStory, PersonaProfile } from "../types/news";
import type { PostMetadata } from "../types/post";
import { generateId } from "./snowflake";
import { indexPostContent } from "../utils/search-index";
import {
  PERSONAS,
  selectLeadPersona,
  selectResponders,
} from "./story-processor";
import { logger } from "../utils/logger";

/**
 * Post generation system prompt
 */
const POST_GENERATION_PROMPT = `You are generating a social media post for a Twitter-like platform focused on AI/tech discussions.

You are SHARING NEWS - this is the FIRST post about this topic. You are NOT replying to anything.

CRITICAL RULES:
1. You MUST include the URL at the end of your post - this is mandatory, non-negotiable
2. Maximum 280 characters total (including the URL)
3. Write a STANDALONE post sharing this news - do NOT write like you're replying to someone
4. Do NOT start with "Great..." or "This is..." or any response-like phrases
5. Start with your take, opinion, or the key news, then add the URL
6. Sound like a real person sharing something interesting they found
7. No hashtags

Good examples:
- "Claude 4 just dropped and the agentic improvements are wild. Been testing for a week - the multi-step reasoning is noticeably better. https://anthropic.com/claude-4"
- "Finally someone tackled curriculum learning for game AI properly. The interpretability angle here is clever. https://example.com/paper"

Bad examples (DO NOT DO THIS):
- "Great resource!" (no context, no link, sounds like a reply)
- "This is really interesting work" (vague, no link)
- "Love seeing this kind of research" (reply-like, no substance)

Output ONLY the post text with the URL included. Nothing else.`;

/**
 * Reply generation system prompt
 */
const REPLY_GENERATION_PROMPT = `You are generating replies for a conversation thread on a Twitter-like AI/tech platform.

Generate authentic replies from different personas. Each reply should:
- Be max 280 characters
- Sound like that specific person based on their voice/expertise
- Engage meaningfully with the original post or previous replies
- Use different tones: agree enthusiastically, respectfully disagree, ask follow-up, share experience, add technical detail, make relevant joke, express skepticism, offer alternative, give encouragement

Output a JSON array where each item has:
- handle: the replier's handle
- content: the reply text (max 280 chars)
- replyToHandle: handle being replied to (null for original post)
- timeOffsetMinutes: realistic time offset (5-120 minutes from original)

Make sure some replies respond to other replies, not just the original post.
Output ONLY valid JSON, no markdown.`;

/**
 * Call Claude to generate a lead post
 */
async function generateLeadPost(
  apiKey: string,
  story: ProcessedStory,
  persona: PersonaProfile,
): Promise<string> {
  const url = story.links[0] || story.item.url;

  const userPrompt = `You are ${persona.displayName} (@${persona.handle})
Bio: ${persona.expertise.join(", ")}
Voice: ${persona.voice}

Share this news with your followers:
Title: ${story.item.title}
What it's about: ${story.significance}
URL you MUST include: ${url}

Possible angles (pick one):
${story.talkingPoints.map((p) => `- ${p}`).join("\n")}

Write your post. Remember: include the URL, and don't start with "Great" or sound like a reply.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: POST_GENERATION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  let content = data.content[0]?.text?.trim() || "";

  // Validate: If URL is missing, append it
  if (!content.includes("http")) {
    // Truncate content to make room for URL if needed
    const maxContentLength = 280 - url.length - 2; // -2 for space and buffer
    if (content.length > maxContentLength) {
      content = content.slice(0, maxContentLength - 3) + "...";
    }
    content = `${content} ${url}`;
  }

  // Final length check
  if (content.length > 280) {
    content = content.slice(0, 277) + "...";
  }

  return content;
}

/**
 * Call Claude to generate replies
 */
async function generateReplies(
  apiKey: string,
  story: ProcessedStory,
  leadPost: { handle: string; content: string },
  responders: PersonaProfile[],
  replyCount: number,
): Promise<
  Array<{
    handle: string;
    content: string;
    replyToHandle: string | null;
    timeOffsetMinutes: number;
  }>
> {
  const responderInfo = responders
    .map((r) => `@${r.handle} (${r.displayName}): ${r.voice}`)
    .join("\n");

  const userPrompt = `Original post by @${leadPost.handle}:
"${leadPost.content}"

Context: ${story.significance}
Talking points: ${story.talkingPoints.join("; ")}

Generate ${replyCount} replies from these personas:
${responderInfo}

Create an engaging thread where people discuss, sometimes disagree, ask questions, and build on each other's points. Some replies should respond to other replies (use replyToHandle).

Output JSON array only:`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: REPLY_GENERATION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const text = data.content[0]?.text || "[]";

  // Parse JSON
  let jsonText = text;
  if (text.includes("```json")) {
    jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  } else if (text.includes("```")) {
    jsonText = text.replace(/```\n?/g, "");
  }

  try {
    const replies = JSON.parse(jsonText.trim());
    // Validate and normalize
    return replies
      .filter(
        (r: unknown): r is { handle: string; content: string } =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as Record<string, unknown>).handle === "string" &&
          typeof (r as Record<string, unknown>).content === "string",
      )
      .map(
        (r: {
          handle: string;
          content: string;
          replyToHandle?: string;
          timeOffsetMinutes?: number;
        }) => ({
          handle: r.handle.replace("@", ""),
          content: r.content.slice(0, 280),
          replyToHandle: r.replyToHandle?.replace("@", "") || null,
          timeOffsetMinutes:
            r.timeOffsetMinutes || Math.floor(Math.random() * 90) + 5,
        }),
      )
      .slice(0, replyCount);
  } catch {
    return [];
  }
}

/**
 * Get user ID from handle
 */
async function getUserIdFromHandle(
  env: Env,
  handle: string,
): Promise<string | null> {
  return await env.USERS_KV.get(`handle:${handle.toLowerCase()}`);
}

/**
 * Create a post in the system
 */
async function createPost(
  env: Env,
  authorId: string,
  authorHandle: string,
  content: string,
  timestamp: number,
  replyToId?: string,
): Promise<string> {
  const postId = generateId();

  // Get author profile from UserDO (more reliable than KV cache)
  let displayName = authorHandle;
  let avatarUrl = "";

  try {
    const userDoId = env.USER_DO.idFromName(authorId);
    const userStub = env.USER_DO.get(userDoId);
    const profileResp = await userStub.fetch("https://do.internal/profile");
    if (profileResp.ok) {
      const profile = (await profileResp.json()) as {
        displayName?: string;
        avatarUrl?: string;
      };
      displayName = profile.displayName || authorHandle;
      avatarUrl = profile.avatarUrl || "";
    }
  } catch {
    // Fall back to KV cache
    const profileData = await env.USERS_KV.get(
      `profile:${authorHandle.toLowerCase()}`,
    );
    if (profileData) {
      const profile = JSON.parse(profileData);
      displayName = profile.displayName || authorHandle;
      avatarUrl = profile.avatarUrl || "";
    }
  }

  const post: PostMetadata = {
    id: postId,
    content,
    authorId,
    authorHandle,
    authorDisplayName: displayName,
    authorAvatarUrl: avatarUrl,
    createdAt: timestamp,
    mediaUrls: [],
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
    ...(replyToId ? { replyToId } : {}),
  };

  // Store in PostDO
  const postDoId = env.POST_DO.idFromName(postId);
  const postStub = env.POST_DO.get(postDoId);
  await postStub.fetch("https://do.internal/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post }),
  });

  // Store in KV
  await env.POSTS_KV.put(`post:${postId}`, JSON.stringify(post));

  // Update user's posts index
  const userPostsKey = `user-posts:${authorId}`;
  const existingPosts = await env.POSTS_KV.get(userPostsKey);
  const postIds: string[] = existingPosts ? JSON.parse(existingPosts) : [];
  postIds.unshift(postId);
  await env.POSTS_KV.put(userPostsKey, JSON.stringify(postIds.slice(0, 1000)));

  // Update UserDO post count
  const userDoId = env.USER_DO.idFromName(authorId);
  const userStub = env.USER_DO.get(userDoId);
  await userStub.fetch("https://do.internal/increment-posts", {
    method: "POST",
  });

  // Index for search
  await indexPostContent(env, postId, content, timestamp);

  // If it's a reply, update parent's reply count and index
  if (replyToId) {
    const repliesKey = `replies:${replyToId}`;
    const existingReplies = await env.POSTS_KV.get(repliesKey);
    const replyIds: string[] = existingReplies
      ? JSON.parse(existingReplies)
      : [];
    replyIds.push(postId);
    await env.POSTS_KV.put(repliesKey, JSON.stringify(replyIds));

    // Update parent post's reply count
    const parentData = await env.POSTS_KV.get(`post:${replyToId}`);
    if (parentData) {
      const parentPost = JSON.parse(parentData);
      parentPost.replyCount = (parentPost.replyCount || 0) + 1;
      await env.POSTS_KV.put(`post:${replyToId}`, JSON.stringify(parentPost));
    }
  }

  // Queue fanout
  await env.FANOUT_QUEUE.send({
    type: "new_post",
    postId,
    authorId,
    timestamp,
  });

  return postId;
}

/**
 * Add a like to a post
 */
async function addLike(
  env: Env,
  postId: string,
  userId: string,
): Promise<void> {
  // Update PostDO
  const postDoId = env.POST_DO.idFromName(postId);
  const postStub = env.POST_DO.get(postDoId);
  await postStub.fetch("https://do.internal/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  // Update UserDO liked posts
  const userDoId = env.USER_DO.idFromName(userId);
  const userStub = env.USER_DO.get(userDoId);
  await userStub.fetch("https://do.internal/add-liked-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId }),
  });

  // Update KV cache
  const postData = await env.POSTS_KV.get(`post:${postId}`);
  if (postData) {
    const post = JSON.parse(postData);
    post.likeCount = (post.likeCount || 0) + 1;
    await env.POSTS_KV.put(`post:${postId}`, JSON.stringify(post));
  }
}

/**
 * Generate a full conversation from a processed story
 */
export async function generateConversation(
  env: Env,
  apiKey: string,
  story: ProcessedStory,
  replyCount: number = 6,
): Promise<{ postId: string; replyCount: number; likeCount: number }> {
  // Select lead persona
  const leadPersona = selectLeadPersona(story);
  const leadUserId = await getUserIdFromHandle(env, leadPersona.handle);

  if (!leadUserId) {
    throw new Error(`Lead persona not found: ${leadPersona.handle}`);
  }

  // Generate lead post
  const leadContent = await generateLeadPost(apiKey, story, leadPersona);
  if (!leadContent) {
    throw new Error("Failed to generate lead post");
  }

  // Create lead post with recent timestamp (within last hour)
  const baseTimestamp = Date.now() - Math.floor(Math.random() * 60 * 60 * 1000);
  const leadPostId = await createPost(
    env,
    leadUserId,
    leadPersona.handle,
    leadContent,
    baseTimestamp,
  );

  // Select responders and generate replies
  const responders = selectResponders(story, leadPersona.handle, replyCount);

  const replies = await generateReplies(
    apiKey,
    story,
    { handle: leadPersona.handle, content: leadContent },
    responders,
    replyCount,
  );

  // Create replies with realistic timing
  const replyPostIds: string[] = [];
  const handleToPostId: Map<string, string> = new Map();
  handleToPostId.set(leadPersona.handle, leadPostId);

  for (const reply of replies) {
    const replyUserId = await getUserIdFromHandle(env, reply.handle);
    if (!replyUserId) continue;

    // Determine what this reply is responding to
    let replyToId = leadPostId;
    if (reply.replyToHandle && handleToPostId.has(reply.replyToHandle)) {
      replyToId = handleToPostId.get(reply.replyToHandle)!;
    }

    const replyTimestamp = baseTimestamp + reply.timeOffsetMinutes * 60 * 1000;
    const replyPostId = await createPost(
      env,
      replyUserId,
      reply.handle,
      reply.content,
      replyTimestamp,
      replyToId,
    );

    replyPostIds.push(replyPostId);
    handleToPostId.set(reply.handle, replyPostId);

    // Small delay between posts
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Generate engagement (likes)
  const engagementPersonas = PERSONAS.filter(
    (p) => p.handle !== leadPersona.handle,
  );
  let totalLikes = 0;

  // Lead post gets more likes (5-15)
  const leadLikeCount = Math.floor(Math.random() * 11) + 5;
  const shuffledForLead = [...engagementPersonas].sort(
    () => Math.random() - 0.5,
  );

  for (let i = 0; i < Math.min(leadLikeCount, shuffledForLead.length); i++) {
    const likerId = await getUserIdFromHandle(env, shuffledForLead[i]!.handle);
    if (likerId) {
      await addLike(env, leadPostId, likerId);
      totalLikes++;
    }
  }

  // Replies get 0-5 likes each
  for (const replyId of replyPostIds) {
    const replyLikeCount = Math.floor(Math.random() * 6);
    const shuffledForReply = [...engagementPersonas].sort(
      () => Math.random() - 0.5,
    );

    for (
      let i = 0;
      i < Math.min(replyLikeCount, shuffledForReply.length);
      i++
    ) {
      const likerId = await getUserIdFromHandle(
        env,
        shuffledForReply[i]!.handle,
      );
      if (likerId) {
        await addLike(env, replyId, likerId);
        totalLikes++;
      }
    }
  }

  return {
    postId: leadPostId,
    replyCount: replyPostIds.length,
    likeCount: totalLikes,
  };
}

/**
 * Generate multiple conversations from stories
 */
export async function generateConversations(
  env: Env,
  apiKey: string,
  stories: ProcessedStory[],
  repliesPerThread: number = 6,
): Promise<
  Array<{
    story: string;
    postId: string;
    replyCount: number;
    likeCount: number;
  }>
> {
  const results: Array<{
    story: string;
    postId: string;
    replyCount: number;
    likeCount: number;
  }> = [];

  for (const story of stories) {
    try {
      const result = await generateConversation(
        env,
        apiKey,
        story,
        repliesPerThread,
      );
      results.push({
        story: story.item.title,
        ...result,
      });

      // Delay between conversations
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      logger.error("Failed to generate conversation", err, {
        title: story.item.title,
      });
    }
  }

  return results;
}
