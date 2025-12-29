# AI News Seeder - Project Proposal

A system to automatically aggregate AI/ML news and generate authentic conversations on The Wire, making it feel like a buzzing community discussing the latest in LLMs and agentic coding.

---

## Executive Summary

Build a scheduled job that:
1. **Aggregates** content from AI blogs, Hacker News, and curated Twitter accounts
2. **Processes** stories into conversation-worthy topics with Claude
3. **Generates** authentic posts and threaded conversations from your 20 seed users
4. **Runs every 2-4 hours** to keep content fresh and timely

The result: A feed that feels alive with real discussions about breaking AI news, complete with links to sources, diverse opinions, and engaging reply threads.

---

## Part 1: Content Sources

### Primary Sources (Reliable, Easy to Access)

| Source | Method | Content Type | Frequency |
|--------|--------|--------------|-----------|
| **Simon Willison's Blog** | RSS (`simonwillison.net/atom/everything/`) | Deep dives on LLMs, tools, prompt engineering | 2-5 posts/week |
| **Anthropic Blog** | RSS (`anthropic.com/blog/rss.xml`) | Claude updates, research, safety | Weekly |
| **OpenAI Blog** | RSS/scrape (`openai.com/blog`) | GPT updates, research, products | Weekly |
| **Hacker News** | API (`hnrss.org/newest?q=AI+OR+LLM+OR+Claude`) | Community discussions, launches | Real-time |
| **Google AI Blog** | RSS (`blog.google/technology/ai/rss`) | Gemini, DeepMind, research | Weekly |
| **Hugging Face Blog** | RSS (`huggingface.co/blog/feed.xml`) | Open source models, community | 2-3x/week |
| **The Verge AI** | RSS | Consumer AI news | Daily |
| **Ars Technica AI** | RSS | Technical AI coverage | Daily |
| **MIT Technology Review** | RSS | AI policy, ethics, research | Weekly |

### Secondary Sources (Higher Effort, High Value)

| Source | Method | Content Type | Notes |
|--------|--------|--------------|-------|
| **X/Twitter Accounts** | Scraping API | Real-time takes | Requires paid API (~$0.15/1k tweets) |
| **Lobste.rs** | RSS | Technical discussions | Good for coding tools |
| **Reddit r/LocalLLaMA** | RSS/API | Community experiments | Local model focus |
| **arXiv cs.AI** | RSS | Research papers | Academic audience |

### Key Twitter/X Accounts to Monitor

**Researchers & Scientists:**
- @ylecun (Yann LeCun - Meta AI)
- @kaboreSalomon (AI research)
- @drfeifei (Fei-Fei Li - Stanford)
- @AndrewYNg (Andrew Ng)

**Industry Leaders:**
- @sama (Sam Altman - OpenAI)
- @daboross (Dario Amodei - Anthropic)
- @jeffdean (Jeff Dean - Google)
- @kaboreSalomon (Andrej Karpathy)

**Developers & Tool Builders:**
- @simonw (Simon Willison)
- @jeremyphoward (fast.ai)
- @swyx (AI engineer, writer)
- @mitchellh (HashiCorp, coding tools)

**Company Accounts:**
- @AnthropicAI
- @OpenAI
- @GoogleAI
- @MistralAI
- @huggingface

---

## Part 2: System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CRON TRIGGER (every 2h)                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    1. CONTENT AGGREGATOR                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ RSS      │  │ HN API   │  │ Twitter  │  │ Stored   │            │
│  │ Fetcher  │  │ Client   │  │ Scraper  │  │ Backlog  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       └─────────────┴─────────────┴─────────────┘                   │
│                           │                                          │
│                           ▼                                          │
│               ┌───────────────────────┐                             │
│               │   Deduplication &     │                             │
│               │   Freshness Filter    │                             │
│               │   (KV: seen:{hash})   │                             │
│               └───────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    2. CONTENT PROCESSOR (Claude)                     │
│                                                                      │
│  Input: Raw articles, tweets, HN discussions                        │
│                                                                      │
│  Output per story:                                                   │
│  - Summary (1-2 sentences)                                          │
│  - Key talking points (3-5 bullets)                                 │
│  - Controversy/debate potential (1-10)                              │
│  - Suggested angles for different personas                          │
│  - Relevant links to include                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    3. CONVERSATION GENERATOR                         │
│                                                                      │
│  For each processed story (pick 3-5 per run):                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  a) Select Lead Poster (matches story to persona)            │   │
│  │     - emmawilliams (Anthropic PM) → Claude/safety news       │   │
│  │     - oliviabrown (OpenAI researcher) → GPT/research news    │   │
│  │     - alexthompson (indie hacker) → coding tools news        │   │
│  │     - ameliasmith (tech journalist) → breaking news          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  b) Generate Initial Post                                    │   │
│  │     - Written in persona's voice                             │   │
│  │     - Includes link to source                                │   │
│  │     - Hot take / observation / question format               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  c) Generate Reply Thread (3-8 replies)                      │   │
│  │     - Pick responders with relevant expertise                │   │
│  │     - Mix of agree/disagree/question/add-context             │   │
│  │     - Some replies reply to other replies (nested)           │   │
│  │     - Natural timing spread (5min - 2hr gaps)                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  d) Generate Engagement                                      │   │
│  │     - 5-20 likes distributed across thread                   │   │
│  │     - 1-3 reposts (if story is significant)                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    4. PERSISTENCE LAYER                              │
│                                                                      │
│  - Create posts via existing handlers                               │
│  - Queue fanout to follower feeds                                   │
│  - Update KV caches                                                 │
│  - Mark stories as "used" to prevent repeats                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Persona-Story Matching

### Enhanced Seed User Profiles

The 20 seed users should be mapped to content domains:

| Handle | Domain Expertise | Likely to Post About | Voice/Tone |
|--------|------------------|---------------------|------------|
| `emmawilliams` | Anthropic PM, AI safety | Claude updates, safety research, responsible AI | Thoughtful, measured |
| `oliviabrown` | OpenAI researcher | GPT updates, NLP research, scaling laws | Academic, precise |
| `jessicadavis` | Mistral DevRel | Open source models, Mistral releases, EU AI | Enthusiastic, community-focused |
| `davidanderson` | Hugging Face ML Eng | Open source, model releases, transformers | Helpful, technical |
| `alexthompson` | Indie hacker, Claude Code | Coding tools, productivity, Claude Code tips | Casual, practical |
| `kevinjackson` | Cursor Tech Lead | AI editors, Cursor, developer experience | Technical, insider perspective |
| `benharris` | Backend eng, AI tools | Aider, CLI tools, vim + AI workflows | Opinionated, experienced |
| `ameliasmith` | Tech journalist | Breaking news, industry analysis, launches | News-focused, balanced |
| `sarahchen` | DeepMind ML Eng | Research breakthroughs, Gemini, DeepMind | Research-oriented |
| `marcusjohnson` | Ex-Google SWE | Infrastructure, MLOps, engineering challenges | Practical, engineering |
| `jameswright` | Startup founder | Business of AI, fundraising, market trends | Entrepreneurial |
| `sophiepatel` | Microsoft DevRel | Azure AI, Copilot, enterprise AI | Helpful, tutorial-style |
| `rachelgreen` | Meta AI/ML Manager | PyTorch, Meta AI, team building | Leadership, scaling |
| `michaelwilson` | PhD candidate | Academic papers, new research, theory | Academic, curious |
| `danielkim` | NVIDIA Staff Eng | GPUs, CUDA, hardware, inference optimization | Deep technical |
| `chrismartinez` | Indie dev, SaaS builder | Real-world AI applications, building with AI | Maker, practical |
| `ryanlee` | Vercel Principal Eng | AI infrastructure, deployment, edge AI | Infrastructure |
| `laurataylor` | VP Engineering | Scaling AI teams, enterprise adoption | Strategic, leadership |
| `hannahmoore` | AI Safety Researcher | Alignment, safety, ethics | Thoughtful, cautious |
| `nataliewhite` | Healthcare AI founder | AI in healthcare, regulation, real-world impact | Mission-driven |

---

## Part 4: Content Generation Prompts

### Story Processor Prompt

```
You are analyzing AI/ML news for a social network discussion. Given this article/tweet/post:

<content>
{raw_content}
</content>

Extract:
1. **Core News**: What happened? (1 sentence)
2. **Why It Matters**: Significance for AI practitioners (1-2 sentences)
3. **Talking Points**: 3-5 angles people might discuss
4. **Debate Potential**: 1-10 (10 = highly controversial)
5. **Best Personas**: Which of these users would naturally engage?
   {list of 20 personas with domains}
6. **Key Links**: URLs to include in posts

Output as JSON.
```

### Initial Post Generator Prompt

```
You are {persona_name}, {persona_bio}.

Write a tweet-length post (max 280 chars) about this news:
{story_summary}

Your voice: {persona_voice_description}

Rules:
- Sound like a real person, not a press release
- Include the link naturally
- Pick ONE angle (hot take, question, observation, celebration, concern)
- No hashtags
- Optionally @mention another user if contextually relevant

The post should feel like something you'd actually tweet after reading this news.
```

### Reply Thread Generator Prompt

```
Generate a realistic reply thread for this post:

Original post by @{author}:
"{post_content}"

Context: {story_summary}

Generate {n} replies from these users: {selected_responders}

For each reply:
1. Pick a responder and their perspective
2. Write their reply (max 280 chars) in their voice
3. Decide if they're replying to the original or another reply
4. Assign a realistic time offset (5min to 2hr from original)

Reply types to mix:
- Agree enthusiastically with personal experience
- Respectfully disagree with reasoning
- Ask clarifying question
- Add technical context/nuance
- Share related resource
- Make relevant joke
- Express healthy skepticism
- Offer alternative perspective

Make sure replies feel like a real conversation - people reference each other,
build on points, occasionally disagree. No generic praise.

Output as JSON array.
```

---

## Part 5: Implementation Plan

### Phase 1: RSS Aggregator (2-3 files)

**New files:**
- `src/services/news-aggregator.ts` - RSS fetching, parsing, deduplication
- `src/handlers/news-seed.ts` - Endpoints and cron handler

**Key functionality:**
```typescript
interface NewsItem {
  id: string;           // Hash of URL
  source: string;       // 'simonwillison' | 'anthropic' | 'hn' | etc.
  title: string;
  url: string;
  content: string;      // Full text or summary
  publishedAt: Date;
  fetchedAt: Date;
}

async function fetchAllSources(): Promise<NewsItem[]> {
  const sources = [
    fetchRSS('https://simonwillison.net/atom/everything/', 'simonwillison'),
    fetchRSS('https://anthropic.com/blog/rss.xml', 'anthropic'),
    fetchHN('AI OR LLM OR Claude OR GPT'),
    // ... more sources
  ];

  const items = await Promise.all(sources);
  return deduplicateAndFilter(items.flat());
}
```

**KV storage:**
- `news:seen:{hash}` - Track processed stories (TTL: 7 days)
- `news:queue` - Stories ready for conversation generation
- `news:last-run` - Timestamp of last aggregation

### Phase 2: Story Processor (Claude Integration)

**Enhance existing Claude integration:**
```typescript
async function processStory(item: NewsItem): Promise<ProcessedStory> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{
      role: 'user',
      content: STORY_PROCESSOR_PROMPT.replace('{raw_content}', item.content)
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

### Phase 3: Conversation Generator

**Extend existing seed.ts patterns:**
```typescript
async function generateConversation(
  story: ProcessedStory,
  env: Env
): Promise<void> {
  // 1. Select lead poster based on story domain
  const leadPoster = selectBestPersona(story.bestPersonas);

  // 2. Generate initial post
  const post = await generatePost(leadPoster, story, env);

  // 3. Create post via existing handler
  const postId = await createPost(post, leadPoster, env);

  // 4. Generate reply thread
  const replies = await generateReplies(post, story, env);

  // 5. Create replies with realistic timing
  for (const reply of replies) {
    await createReply(reply, postId, env);
  }

  // 6. Generate likes/reposts
  await generateEngagement(postId, replies, env);
}
```

### Phase 4: Scheduled Trigger

**Add to `src/handlers/scheduled.ts`:**
```typescript
// New cron: every 2 hours
// Pattern: 0 */2 * * *

async function generateNewsConversations(env: Env): Promise<void> {
  // 1. Fetch new content
  const newsItems = await fetchAllSources(env);

  // 2. Filter to unseen items
  const newItems = await filterSeen(newsItems, env);

  // 3. Process top 5-10 stories
  const processed = await Promise.all(
    newItems.slice(0, 10).map(item => processStory(item))
  );

  // 4. Generate 3-5 conversations (most debate-worthy)
  const topStories = processed
    .sort((a, b) => b.debatePotential - a.debatePotential)
    .slice(0, 5);

  for (const story of topStories) {
    await generateConversation(story, env);
  }

  // 5. Mark stories as used
  await markStoriesUsed(topStories, env);
}
```

**wrangler.toml addition:**
```toml
[triggers]
crons = [
  "*/15 * * * *",  # Existing: rankings, cleanup
  "0 */2 * * *"    # New: news conversations
]
```

### Phase 5: Twitter/X Integration (Optional Enhancement)

If you want real-time Twitter content, options:

**Option A: TwitterAPI.io ($0.15/1k tweets)**
```typescript
async function fetchTwitterContent(): Promise<NewsItem[]> {
  const accounts = ['@AnthropicAI', '@OpenAI', '@simonw', /* ... */];

  const response = await fetch('https://api.twitterapi.io/twitter/user/tweets', {
    headers: { 'X-API-Key': env.TWITTER_API_KEY },
    body: JSON.stringify({ username: 'simonw', limit: 10 })
  });

  return transformToNewsItems(await response.json());
}
```

**Option B: bird.makeup (Free, less reliable)**
- RSS proxy for Twitter: `https://bird.makeup/{username}/rss`
- Less reliable, may go offline

**Recommendation**: Start without Twitter, add later if RSS sources aren't enough.

---

## Part 6: Example Output

### Scenario: Claude 4 Opus Release

**Aggregated content:**
- Anthropic blog post announcing Claude 4 Opus
- Simon Willison's detailed analysis
- HN discussion with 500+ comments
- Twitter reactions from @karpathy, @sama

**Generated conversation:**

**@emmawilliams** (2:15 PM)
> Huge day - Claude 4 Opus just dropped. The agentic improvements are real. Been testing internally for weeks and the multi-step reasoning is noticeably better. Pricing is aggressive too.
>
> https://anthropic.com/claude-4-opus

**@oliviabrown** (2:23 PM) *replying to @emmawilliams*
> The benchmark numbers are impressive but I'm most interested in the safety evaluations. Did they publish the full model card? Would love to see the red-teaming results.

**@alexthompson** (2:31 PM) *replying to @emmawilliams*
> Just switched Claude Code to Opus. The diff is immediately noticeable on complex refactors. It's understanding entire codebases now, not just files.

**@hannahmoore** (2:45 PM) *replying to @oliviabrown*
> Model card is here: [link]. The jailbreak resistance improvements are significant. Though I wish they'd share more about the RLHF process.

**@benharris** (2:52 PM) *replying to @alexthompson*
> Interesting. How's the latency? Sonnet has been my go-to for code because it's faster. Curious if the quality jump is worth the wait.

**@kevinjackson** (3:08 PM) *replying to @emmawilliams*
> We're already testing Cursor integration. The tool use is much more reliable - fewer hallucinated function calls. This is going to change our roadmap.

**@jessicadavis** (3:15 PM)
> Competition is good for everyone. Congrats to the Anthropic team. Now let's see what this pushes the rest of us to build 😤

**Engagement:**
- 18 likes distributed across thread
- 3 reposts (emmawilliams' original, alexthompson's take, jessicadavis' response)

---

## Part 7: Cost Estimation

### Per-Run Costs (every 2 hours)

| Component | API Calls | Est. Tokens | Cost |
|-----------|-----------|-------------|------|
| Story processing (10 stories) | 10 | ~20k input, ~5k output | ~$0.15 |
| Post generation (5 posts) | 5 | ~3k input, ~1k output | ~$0.03 |
| Reply generation (5 threads × 6 replies) | 5 | ~15k input, ~5k output | ~$0.12 |

**Per run: ~$0.30**
**Daily (12 runs): ~$3.60**
**Monthly: ~$108**

### Optional: Twitter API
- 1000 tweets/day: $0.15
- Monthly: ~$4.50

**Total monthly estimate: ~$110-115**

---

## Part 8: Configuration

### Environment Variables

```toml
# wrangler.toml
[vars]
NEWS_SOURCES = "simonwillison,anthropic,openai,hn,huggingface,googleai"
NEWS_CONVERSATIONS_PER_RUN = "5"
NEWS_REPLIES_PER_THREAD = "6"
NEWS_MIN_DEBATE_SCORE = "4"

# Secrets (wrangler secret put)
ANTHROPIC_API_KEY = "..."
TWITTER_API_KEY = "..."  # Optional
```

### Admin Controls

New endpoints in `/debug/`:
- `POST /debug/news/fetch` - Manual trigger aggregation
- `POST /debug/news/generate` - Manual trigger conversation generation
- `GET /debug/news/queue` - View pending stories
- `POST /debug/news/clear` - Clear news queue
- `GET /debug/news/stats` - Aggregation statistics

---

## Part 9: Success Metrics

### Quality Indicators

1. **Content freshness**: Average age of discussed topics < 24 hours
2. **Source diversity**: No single source > 30% of content
3. **Conversation depth**: Average 5+ replies per news thread
4. **Engagement distribution**: Likes spread across multiple users
5. **No duplicates**: Same story not discussed twice

### User Experience Goals

- New user sees 5-10 recent AI news discussions in first scroll
- Conversations feel natural, not AI-generated
- Links to primary sources always included
- Mix of serious analysis and casual takes
- Different personas have distinct voices

---

## Part 10: Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RSS feeds change/break | Content stops flowing | Monitor feed health, fallback sources |
| Claude generates repetitive content | Feels fake | Vary prompts, temperature, enforce diversity |
| Stories get stale | Outdated discussions | Strict freshness filter (< 48h) |
| Cost overruns | Budget exceeded | Hard limits per run, monitoring |
| API rate limits | Generation fails | Retry logic, backoff, queue system |
| Twitter API becomes unavailable | Lose real-time takes | RSS-first architecture, Twitter is optional |

---

## Part 11: Future Enhancements

### V2 Ideas

1. **User-triggered discussions**: "Generate a thread about X"
2. **Trending detection**: Auto-boost stories getting HN/Twitter attention
3. **Cross-thread references**: Users reference earlier discussions
4. **Weekly roundups**: Automated "This week in AI" compilation posts
5. **Live event coverage**: Conference live-tweeting simulation
6. **Paper discussions**: arXiv paper deep-dives with researcher personas

### V3 Ideas

1. **Real user seeding**: Mix AI-generated with curated human posts
2. **Conversation continuation**: AI users reply to real user replies
3. **Personalized news selection**: Different news for different user interests

---

## Summary

This system transforms The Wire from a static demo into a living, breathing AI community by:

1. **Aggregating** real AI news from authoritative sources (blogs, HN, optionally Twitter)
2. **Processing** stories to extract discussion-worthy angles
3. **Generating** authentic conversations matching personas to topics
4. **Running automatically** every 2 hours to keep content fresh

The architecture builds on your existing seeding infrastructure, adds RSS/API integrations, and uses Claude to generate contextually appropriate content. Total cost is roughly $100-115/month for continuous operation.

**Recommended starting point**: Phase 1-3 with RSS sources only (no Twitter), then add Twitter API if more real-time content is needed.
