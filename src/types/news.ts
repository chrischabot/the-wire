/**
 * Types for the AI News Seeder system
 */

/**
 * Raw news item fetched from a source
 */
export interface NewsItem {
  /** Unique ID (hash of URL) */
  id: string;
  /** Source identifier */
  source: NewsSource;
  /** Article/post title */
  title: string;
  /** Source URL */
  url: string;
  /** Full content or summary */
  content: string;
  /** When the item was published */
  publishedAt: number;
  /** When we fetched it */
  fetchedAt: number;
  /** Optional: HN score or engagement metric */
  score?: number;
  /** Optional: Number of comments */
  commentCount?: number;
}

/**
 * Supported news sources
 */
export type NewsSource =
  | "simonwillison"
  | "anthropic"
  | "openai"
  | "google_ai"
  | "huggingface"
  | "hackernews"
  | "lobsters"
  | "verge"
  | "arstechnica";

/**
 * Processed story ready for conversation generation
 */
export interface ProcessedStory {
  /** Original news item */
  item: NewsItem;
  /** One-sentence summary */
  summary: string;
  /** Why this matters for AI practitioners */
  significance: string;
  /** Angles for discussion */
  talkingPoints: string[];
  /** Controversy/debate potential (1-10) */
  debatePotential: number;
  /** Best personas to engage with this story */
  suggestedPersonas: string[];
  /** Key links to include */
  links: string[];
}

/**
 * Persona mapping for content matching
 */
export interface PersonaProfile {
  handle: string;
  displayName: string;
  domains: string[];
  voice: string;
  expertise: string[];
}

/**
 * Generated conversation thread
 */
export interface GeneratedConversation {
  /** The main post */
  leadPost: {
    authorHandle: string;
    content: string;
    links: string[];
  };
  /** Reply thread */
  replies: Array<{
    authorHandle: string;
    content: string;
    /** Handle of post being replied to (null = replies to lead post) */
    replyToHandle: string | null;
    /** Time offset in minutes from lead post */
    timeOffsetMinutes: number;
  }>;
  /** Engagement to generate */
  engagement: {
    /** Handles of users who should like the lead post */
    likesOnLead: string[];
    /** Handles of users who should repost */
    reposts: string[];
    /** Map of reply index to handles who should like it */
    likesOnReplies: Map<number, string[]>;
  };
}

/**
 * News seeder configuration
 */
export interface NewsSeederConfig {
  /** Number of stories to process per run */
  storiesPerRun: number;
  /** Number of conversations to generate per run */
  conversationsPerRun: number;
  /** Minimum debate potential score to include */
  minDebateScore: number;
  /** Maximum age of stories to consider (hours) */
  maxStoryAgeHours: number;
  /** Number of replies per conversation */
  repliesPerConversation: number;
}

/**
 * Default configuration
 * Conservative settings to stay under Cloudflare subrequest limits
 */
export const DEFAULT_NEWS_CONFIG: NewsSeederConfig = {
  storiesPerRun: 5,
  conversationsPerRun: 3,
  minDebateScore: 3,
  maxStoryAgeHours: 48,
  repliesPerConversation: 4,
};

/**
 * RSS feed configuration
 */
export interface RSSFeedConfig {
  url: string;
  source: NewsSource;
  /** How to extract content from the feed */
  contentField?: "content" | "summary" | "description";
}

/**
 * News sources configuration
 */
export const NEWS_SOURCES: RSSFeedConfig[] = [
  {
    url: "https://simonwillison.net/atom/everything/",
    source: "simonwillison",
    contentField: "content",
  },
  {
    url: "https://www.anthropic.com/rss.xml",
    source: "anthropic",
    contentField: "description",
  },
  {
    url: "https://blog.google/technology/ai/rss/",
    source: "google_ai",
    contentField: "description",
  },
  {
    url: "https://huggingface.co/blog/feed.xml",
    source: "huggingface",
    contentField: "content",
  },
  {
    url: "https://lobste.rs/t/ai.rss",
    source: "lobsters",
    contentField: "description",
  },
];

/**
 * HN API configuration for AI-related stories
 */
export const HN_CONFIG = {
  /** Keywords to search for */
  keywords: ["AI", "LLM", "Claude", "GPT", "Anthropic", "OpenAI", "Gemini"],
  /** Minimum score to include */
  minScore: 50,
  /** Maximum stories to fetch */
  maxStories: 20,
};
