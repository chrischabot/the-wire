/**
 * Story Processor Service
 *
 * Uses Claude to analyze news items and extract discussion-worthy content.
 */

import type { NewsItem, ProcessedStory, PersonaProfile } from "../types/news";
import { logger } from "../utils/logger";

/**
 * Persona profiles for content matching
 */
export const PERSONAS: PersonaProfile[] = [
  {
    handle: "emmawilliams",
    displayName: "Emma Williams",
    domains: ["anthropic", "ai_safety", "ethics", "claude"],
    voice: "Thoughtful, measured, focuses on responsible AI development",
    expertise: ["AI safety", "product management", "Claude", "Anthropic"],
  },
  {
    handle: "oliviabrown",
    displayName: "Olivia Brown",
    domains: ["openai", "nlp", "research", "gpt"],
    voice: "Academic, precise, research-oriented",
    expertise: ["NLP", "language models", "OpenAI", "research papers"],
  },
  {
    handle: "jessicadavis",
    displayName: "Jessica Davis",
    domains: ["mistral", "open_source", "eu_ai"],
    voice: "Enthusiastic, community-focused, developer advocate",
    expertise: ["Mistral", "open source models", "developer experience"],
  },
  {
    handle: "davidanderson",
    displayName: "David Anderson",
    domains: ["huggingface", "transformers", "open_source"],
    voice: "Helpful, technical, open source advocate",
    expertise: ["Hugging Face", "transformers", "model fine-tuning"],
  },
  {
    handle: "alexthompson",
    displayName: "Alex Thompson",
    domains: ["coding_tools", "claude_code", "productivity", "indie"],
    voice: "Casual, practical, builder mindset",
    expertise: ["Claude Code", "AI coding assistants", "indie development"],
  },
  {
    handle: "kevinjackson",
    displayName: "Kevin Jackson",
    domains: ["cursor", "ai_editors", "developer_tools"],
    voice: "Technical, insider perspective, product-focused",
    expertise: ["Cursor", "AI code editors", "developer tools"],
  },
  {
    handle: "benharris",
    displayName: "Ben Harris",
    domains: ["aider", "cli_tools", "vim", "backend"],
    voice: "Opinionated, experienced, prefers terminal workflows",
    expertise: ["Aider", "CLI tools", "Vim", "backend development"],
  },
  {
    handle: "ameliasmith",
    displayName: "Amelia Smith",
    domains: ["news", "industry", "launches", "analysis"],
    voice: "News-focused, balanced, journalistic",
    expertise: ["Tech journalism", "industry analysis", "AI trends"],
  },
  {
    handle: "sarahchen",
    displayName: "Sarah Chen",
    domains: ["deepmind", "google", "gemini", "research"],
    voice: "Research-oriented, technical, academic",
    expertise: ["DeepMind", "Gemini", "ML research", "computer vision"],
  },
  {
    handle: "marcusjohnson",
    displayName: "Marcus Johnson",
    domains: ["infrastructure", "mlops", "engineering"],
    voice: "Practical, engineering-focused, experience-driven",
    expertise: ["MLOps", "infrastructure", "Google", "scaling ML"],
  },
  {
    handle: "jameswright",
    displayName: "James Wright",
    domains: ["startup", "business", "fundraising", "yc"],
    voice: "Entrepreneurial, business-minded, visionary",
    expertise: ["AI startups", "YC", "business strategy", "fundraising"],
  },
  {
    handle: "sophiepatel",
    displayName: "Sophie Patel",
    domains: ["microsoft", "azure", "copilot", "enterprise"],
    voice: "Helpful, tutorial-style, developer advocate",
    expertise: ["Microsoft", "Azure AI", "Copilot", "enterprise AI"],
  },
  {
    handle: "rachelgreen",
    displayName: "Rachel Green",
    domains: ["meta", "pytorch", "team_building", "management"],
    voice: "Leadership perspective, scaling focus, practical",
    expertise: ["Meta AI", "PyTorch", "engineering management"],
  },
  {
    handle: "michaelwilson",
    displayName: "Michael Wilson",
    domains: ["academic", "papers", "theory", "phd"],
    voice: "Academic, curious, theoretical",
    expertise: ["AI research", "reasoning", "agents", "academic papers"],
  },
  {
    handle: "danielkim",
    displayName: "Daniel Kim",
    domains: ["nvidia", "gpu", "cuda", "inference", "hardware"],
    voice: "Deep technical, hardware-focused, optimization expert",
    expertise: ["NVIDIA", "GPUs", "CUDA", "inference optimization"],
  },
  {
    handle: "chrismartinez",
    displayName: "Chris Martinez",
    domains: ["indie", "saas", "building", "practical"],
    voice: "Maker mindset, practical, real-world focused",
    expertise: ["SaaS", "indie development", "practical AI applications"],
  },
  {
    handle: "ryanlee",
    displayName: "Ryan Lee",
    domains: ["vercel", "edge", "infrastructure", "deployment"],
    voice: "Infrastructure-focused, edge computing expert",
    expertise: ["Vercel", "edge AI", "deployment", "infrastructure"],
  },
  {
    handle: "laurataylor",
    displayName: "Laura Taylor",
    domains: ["leadership", "enterprise", "scaling", "strategy"],
    voice: "Strategic, leadership perspective, enterprise focus",
    expertise: ["Engineering leadership", "scaling AI", "enterprise adoption"],
  },
  {
    handle: "hannahmoore",
    displayName: "Hannah Moore",
    domains: ["safety", "alignment", "ethics", "beneficial_ai"],
    voice: "Thoughtful, cautious, ethics-focused",
    expertise: ["AI safety", "alignment", "ethics", "beneficial AI"],
  },
  {
    handle: "nataliewhite",
    displayName: "Natalie White",
    domains: ["healthcare", "regulation", "real_world", "startup"],
    voice: "Mission-driven, practical, domain expert",
    expertise: ["Healthcare AI", "regulation", "real-world impact"],
  },
];

/**
 * System prompt for story analysis
 */
const STORY_ANALYSIS_PROMPT = `You are analyzing AI/ML news for a social network discussion platform. Your job is to extract key information that will help generate authentic conversations.

Analyze the provided news item and output a JSON object with these fields:
- summary: A one-sentence summary of what happened (max 100 characters)
- significance: Why this matters for AI practitioners (1-2 sentences, max 200 characters)
- talkingPoints: Array of 3-5 discussion angles people might take
- debatePotential: Number 1-10 (10 = highly controversial/debate-worthy)
- suggestedPersonas: Array of 3-5 handles from the provided persona list who would naturally engage with this topic
- links: Array of relevant URLs to include in posts (usually just the source URL)

Consider:
- Breaking news about major AI labs gets high debate potential
- Technical deep-dives appeal to specific personas
- Open source vs closed source is always debatable
- AI safety topics engage safety researchers
- Coding tool news engages developers

Output ONLY valid JSON, no markdown formatting.`;

/**
 * Call Claude API to analyze a story
 */
async function callClaudeForAnalysis(
  apiKey: string,
  item: NewsItem,
): Promise<Omit<ProcessedStory, "item">> {
  const personaList = PERSONAS.map(
    (p) => `${p.handle}: ${p.expertise.join(", ")}`,
  ).join("\n");

  const userPrompt = `News item to analyze:

Title: ${item.title}
Source: ${item.source}
URL: ${item.url}
Published: ${new Date(item.publishedAt).toISOString()}

Content:
${item.content.slice(0, 1500)}

Available personas to suggest:
${personaList}

Analyze this and return JSON.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: STORY_ANALYSIS_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const text = data.content[0]?.text || "{}";

  // Parse JSON (handle potential markdown wrapping)
  let jsonText = text;
  if (text.includes("```json")) {
    jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  } else if (text.includes("```")) {
    jsonText = text.replace(/```\n?/g, "");
  }

  try {
    return JSON.parse(jsonText.trim());
  } catch {
    // Return defaults if parsing fails
    return {
      summary: item.title.slice(0, 100),
      significance: "A notable development in the AI space.",
      talkingPoints: ["Interesting development", "Worth watching"],
      debatePotential: 5,
      suggestedPersonas: ["ameliasmith", "alexthompson"],
      links: [item.url],
    };
  }
}

/**
 * Process a batch of news items into stories ready for conversation generation
 */
export async function processStories(
  apiKey: string,
  items: NewsItem[],
): Promise<ProcessedStory[]> {
  const results: ProcessedStory[] = [];

  // Process sequentially to respect rate limits
  for (const item of items) {
    try {
      const analysis = await callClaudeForAnalysis(apiKey, item);
      results.push({
        item,
        summary: analysis.summary || item.title.slice(0, 100),
        significance:
          analysis.significance || "A notable development in the AI space.",
        talkingPoints: analysis.talkingPoints || ["Interesting development"],
        debatePotential: analysis.debatePotential || 5,
        suggestedPersonas: analysis.suggestedPersonas || ["ameliasmith"],
        links: analysis.links || [item.url],
      });

      // Small delay between API calls
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      logger.error("Failed to process story", error, { title: item.title });
      // Include with defaults on failure
      results.push({
        item,
        summary: item.title.slice(0, 100),
        significance: "A notable development in the AI space.",
        talkingPoints: ["Interesting development"],
        debatePotential: 5,
        suggestedPersonas: ["ameliasmith"],
        links: [item.url],
      });
    }
  }

  return results;
}

/**
 * Select the best stories for conversation generation
 */
export function selectTopStories(
  stories: ProcessedStory[],
  count: number,
  minDebateScore: number = 4,
): ProcessedStory[] {
  return stories
    .filter((s) => s.debatePotential >= minDebateScore)
    .sort((a, b) => {
      // Prioritize by debate potential, then recency
      if (b.debatePotential !== a.debatePotential) {
        return b.debatePotential - a.debatePotential;
      }
      return b.item.publishedAt - a.item.publishedAt;
    })
    .slice(0, count);
}

/**
 * Match a story to the best lead persona
 */
export function selectLeadPersona(story: ProcessedStory): PersonaProfile {
  // Use Claude's suggestion if valid
  if (story.suggestedPersonas.length > 0) {
    const suggested = story.suggestedPersonas[0];
    const persona = PERSONAS.find((p) => p.handle === suggested);
    if (persona) return persona;
  }

  // Fallback: match by source
  const sourceMapping: Record<string, string> = {
    anthropic: "emmawilliams",
    openai: "oliviabrown",
    google_ai: "sarahchen",
    huggingface: "davidanderson",
    hackernews: "ameliasmith",
    lobsters: "benharris",
    simonwillison: "alexthompson",
  };

  const mappedHandle = sourceMapping[story.item.source];
  if (mappedHandle) {
    const persona = PERSONAS.find((p) => p.handle === mappedHandle);
    if (persona) return persona;
  }

  // Default to journalist
  return PERSONAS.find((p) => p.handle === "ameliasmith")!;
}

/**
 * Select responders for a thread
 */
export function selectResponders(
  story: ProcessedStory,
  leadHandle: string,
  count: number,
): PersonaProfile[] {
  const candidates = PERSONAS.filter((p) => p.handle !== leadHandle);

  // Prioritize suggested personas
  const suggested = story.suggestedPersonas
    .filter((h) => h !== leadHandle)
    .map((h) => candidates.find((p) => p.handle === h))
    .filter((p): p is PersonaProfile => p !== undefined);

  // Fill remaining with diverse selection
  const remaining = candidates.filter(
    (p) => !suggested.some((s) => s.handle === p.handle),
  );

  // Shuffle remaining
  const shuffled = remaining.sort(() => Math.random() - 0.5);

  return [...suggested, ...shuffled].slice(0, count);
}
