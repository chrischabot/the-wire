/**
 * SSR Meta Tag Generation for SEO
 *
 * Generates dynamic meta tags for public pages (profiles, posts)
 * to ensure proper indexing by search engines and rich previews on social media.
 */

import type { Env } from "../types/env";
import type { UserProfile } from "../types/user";
import type { PostMetadata } from "../types/post";

const SITE_NAME = "The Wire";
const SITE_URL = "https://the-wire.chabotc.workers.dev";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;
const TWITTER_SITE = "@TheWireApp";

export interface MetaTags {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  jsonLd?: object;
}

/**
 * Escape HTML entities for safe injection into HTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + "...";
}

/**
 * Generate meta tags for a user profile page
 */
export async function generateProfileMeta(
  handle: string,
  env: Env
): Promise<MetaTags | null> {
  // Fetch profile from KV
  const profileData = await env.USERS_KV.get(`profile:${handle}`);
  if (!profileData) return null;

  const profile: UserProfile = JSON.parse(profileData);

  // Check if account is private - return minimal meta if so
  const userDOId = env.USER_DO.idFromName(profile.id);
  const userDO = env.USER_DO.get(userDOId);
  const settingsResponse = await userDO.fetch(
    new Request("https://do/settings", { method: "GET" })
  );
  const settings = await settingsResponse.json() as { privateAccount?: boolean } | null;

  const isPrivate = settings?.privateAccount === true;

  const displayName = profile.displayName || `@${handle}`;
  const bio = isPrivate
    ? "This account is private."
    : (profile.bio || `Check out @${handle} on ${SITE_NAME}`);
  const title = `${displayName} (@${handle}) | ${SITE_NAME}`;
  const description = truncate(bio, 160);
  const avatarUrl = profile.avatarUrl || DEFAULT_IMAGE;
  const canonicalUrl = `${SITE_URL}/u/${handle}`;

  const ogTags: Record<string, string> = {
    "og:title": displayName,
    "og:description": description,
    "og:image": avatarUrl,
    "og:url": canonicalUrl,
    "og:type": "profile",
    "og:site_name": SITE_NAME,
    "profile:username": handle,
  };

  const twitterTags: Record<string, string> = {
    "twitter:card": "summary",
    "twitter:site": TWITTER_SITE,
    "twitter:title": displayName,
    "twitter:description": description,
    "twitter:image": avatarUrl,
  };

  // JSON-LD structured data for profiles
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    alternateName: `@${handle}`,
    description: isPrivate ? undefined : bio,
    image: avatarUrl,
    url: canonicalUrl,
    ...(profile.website && !isPrivate ? { sameAs: [profile.website] } : {}),
  };

  return {
    title,
    description,
    canonicalUrl,
    ogTags,
    twitterTags,
    jsonLd,
  };
}

/**
 * Generate meta tags for a post page
 */
export async function generatePostMeta(
  postId: string,
  env: Env
): Promise<MetaTags | null> {
  // Fetch post from KV
  const postData = await env.POSTS_KV.get(`post:${postId}`);
  if (!postData) return null;

  const post: PostMetadata = JSON.parse(postData);

  // Don't generate meta for deleted or taken down posts
  if (post.isDeleted || post.isTakenDown) return null;

  // For reposts, use the original post's content
  const displayPost = post.originalPost || post;
  const authorHandle = displayPost.authorHandle || post.authorHandle;
  const authorDisplayName = displayPost.authorDisplayName || post.authorDisplayName;
  const content = displayPost.content || "";
  const mediaUrls = displayPost.mediaUrls || [];
  const authorAvatar = displayPost.authorAvatarUrl || post.authorAvatarUrl || DEFAULT_IMAGE;

  const truncatedContent = truncate(content, 100);
  const title = `${authorDisplayName}: "${truncatedContent}" | ${SITE_NAME}`;
  const description = truncate(content, 160);
  const canonicalUrl = `${SITE_URL}/post/${postId}`;

  // Use first media image if available, otherwise author avatar
  const hasMedia = mediaUrls.length > 0 && !!mediaUrls[0];
  const imageUrl = hasMedia ? mediaUrls[0]! : authorAvatar;
  const cardType = hasMedia ? "summary_large_image" : "summary";

  const createdAt = displayPost.createdAt || post.createdAt;
  const publishedTime = new Date(createdAt).toISOString();

  const ogTags: Record<string, string> = {
    "og:title": `${authorDisplayName} on ${SITE_NAME}`,
    "og:description": description,
    "og:image": imageUrl,
    "og:url": canonicalUrl,
    "og:type": "article",
    "og:site_name": SITE_NAME,
    "article:author": authorDisplayName,
    "article:published_time": publishedTime,
  };

  const twitterTags: Record<string, string> = {
    "twitter:card": cardType,
    "twitter:site": TWITTER_SITE,
    "twitter:creator": `@${authorHandle}`,
    "twitter:title": `${authorDisplayName} on ${SITE_NAME}`,
    "twitter:description": description,
    "twitter:image": imageUrl,
  };

  // JSON-LD structured data for posts
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: truncatedContent,
    articleBody: content,
    author: {
      "@type": "Person",
      name: authorDisplayName,
      alternateName: `@${authorHandle}`,
      image: authorAvatar,
    },
    datePublished: publishedTime,
    url: canonicalUrl,
    ...(hasMedia ? { image: mediaUrls } : {}),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likeCount || 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.replyCount || 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ShareAction",
        userInteractionCount: post.repostCount || 0,
      },
    ],
  };

  return {
    title,
    description,
    canonicalUrl,
    ogTags,
    twitterTags,
    jsonLd,
  };
}

/**
 * Generate meta tags for the explore page
 */
export function generateExploreMeta(): MetaTags {
  const title = `Explore | ${SITE_NAME}`;
  const description = "Discover trending posts and conversations on The Wire.";
  const canonicalUrl = `${SITE_URL}/explore`;

  return {
    title,
    description,
    canonicalUrl,
    ogTags: {
      "og:title": title,
      "og:description": description,
      "og:image": DEFAULT_IMAGE,
      "og:url": canonicalUrl,
      "og:type": "website",
      "og:site_name": SITE_NAME,
    },
    twitterTags: {
      "twitter:card": "summary",
      "twitter:site": TWITTER_SITE,
      "twitter:title": title,
      "twitter:description": description,
      "twitter:image": DEFAULT_IMAGE,
    },
  };
}

/**
 * Generate default meta tags for pages without specific data
 */
export function generateDefaultMeta(): MetaTags {
  const title = SITE_NAME;
  const description = "Join the conversation on The Wire - a modern social platform.";
  const canonicalUrl = SITE_URL;

  return {
    title,
    description,
    canonicalUrl,
    ogTags: {
      "og:title": title,
      "og:description": description,
      "og:image": DEFAULT_IMAGE,
      "og:url": canonicalUrl,
      "og:type": "website",
      "og:site_name": SITE_NAME,
    },
    twitterTags: {
      "twitter:card": "summary",
      "twitter:site": TWITTER_SITE,
      "twitter:title": title,
      "twitter:description": description,
      "twitter:image": DEFAULT_IMAGE,
    },
  };
}

/**
 * Render meta tags as HTML string for injection into the page
 */
export function renderMetaTags(meta: MetaTags): string {
  const lines: string[] = [];

  // Basic meta
  lines.push(`<title>${escapeHtml(meta.title)}</title>`);
  lines.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  lines.push(`<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`);

  // Open Graph tags
  for (const [property, content] of Object.entries(meta.ogTags)) {
    lines.push(`<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`);
  }

  // Twitter Card tags
  for (const [name, content] of Object.entries(meta.twitterTags)) {
    lines.push(`<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`);
  }

  // JSON-LD structured data
  if (meta.jsonLd) {
    lines.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`);
  }

  return lines.join("\n    ");
}

/**
 * Inject meta tags into HTML template by replacing the placeholder
 */
export function injectMetaTags(html: string, meta: MetaTags): string {
  const metaHtml = renderMetaTags(meta);

  // Replace the placeholder comment with actual meta tags
  // Also replace the default title
  let result = html.replace("<!-- SSR_META_PLACEHOLDER -->", metaHtml);
  result = result.replace(/<title>The Wire<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);

  return result;
}
