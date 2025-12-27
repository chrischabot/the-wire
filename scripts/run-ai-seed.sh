#!/bin/bash
# AI-powered seed script for The Wire
# Uses Claude API to generate realistic, diverse posts and replies
# Respects Cloudflare rate limits with delays between calls

BASE_URL="https://the-wire.chabotc.workers.dev"
DELAY=3 # seconds between calls

echo "🌱 Starting The Wire AI seed process..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  This will CLEAR ALL existing posts and generate new AI content"
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

# Phase 0: Cleanup
echo ""
echo "🧹 Phase 0: Cleaning up existing posts..."
batch=0
while true; do
  result=$(curl -s -X POST "$BASE_URL/debug/cleanup?batch=$batch")
  echo "  Batch $batch: $(echo "$result" | jq -r '.log[0] // "processing..."')"

  complete=$(echo "$result" | jq -r '.complete')
  if [ "$complete" = "true" ]; then
    echo "  ✓ Cleanup complete"
    break
  fi

  batch=$((batch + 1))
  sleep $DELAY
done

# Phase 1: Ensure users exist
echo ""
echo "👥 Phase 1: Creating/verifying users..."
curl -s -X POST "$BASE_URL/debug/seed/users" | jq -c '.log | length as $n | "\($n) users processed"'
sleep $DELAY

# Phase 2: Follow relationships
echo ""
echo "🔗 Phase 2: Creating follow relationships..."
curl -s -X POST "$BASE_URL/debug/seed/follows" | jq -c '.log | length as $n | "\($n) follow operations"'
sleep $DELAY

# Phase 3: AI-generated posts (20 users × 4 sub-batches × 10 posts = 800 posts)
echo ""
echo "📝 Phase 3: Generating AI posts..."
echo "   Target: ~40 posts per user × 20 users = ~800 posts"
echo "   (4 API calls per user, 10 posts each)"
batch=0
sub=0
total_posts=0
while true; do
  echo -n "  User $batch (sub $sub): "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/ai-posts?batch=$batch&sub=$sub")

  success=$(echo "$result" | jq -r '.success')
  if [ "$success" != "true" ]; then
    error=$(echo "$result" | jq -r '.error // "unknown error"')
    echo "Error: $error"
    echo "  Retrying in 10 seconds..."
    sleep 10
    continue
  fi

  posts_created=$(echo "$result" | jq -r '.postsCreated // 0')
  total_posts=$((total_posts + posts_created))
  echo "$posts_created posts (total: $total_posts)"

  next_batch=$(echo "$result" | jq -r '.nextBatch')
  next_sub=$(echo "$result" | jq -r '.nextSub')

  if [ "$next_batch" = "null" ] || [ "$next_batch" -ge 20 ]; then
    echo "  ✓ All posts created: $total_posts"
    break
  fi

  batch=$next_batch
  sub=$next_sub
  sleep $DELAY
done

# Phase 4: Likes and reposts
echo ""
echo "❤️ Phase 4: Creating likes and reposts..."
for batch in $(seq 0 19); do
  echo -n "  User $batch: "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/interactions?batch=$batch")
  success=$(echo "$result" | jq -r '.success')
  if [ "$success" = "true" ]; then
    echo "$(echo "$result" | jq -r '.log[0]')"
  else
    echo "Error - retrying..."
    sleep 5
    curl -s -X POST "$BASE_URL/debug/seed/interactions?batch=$batch" | jq -r '.log[0]'
  fi
  sleep $DELAY
done

# Phase 5: AI-generated replies (20 users × 5 sub-batches × 10 replies = 1000 replies)
echo ""
echo "💬 Phase 5: Generating AI replies..."
echo "   Target: ~50 replies per user × 20 users = ~1000 replies"
echo "   (5 API calls per user, 10 replies each)"
batch=0
sub=0
total_replies=0
while true; do
  echo -n "  User $batch (sub $sub): "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/ai-replies?batch=$batch&sub=$sub")

  success=$(echo "$result" | jq -r '.success')
  if [ "$success" != "true" ]; then
    error=$(echo "$result" | jq -r '.error // "unknown error"')
    echo "Error: $error"
    echo "  Retrying in 10 seconds..."
    sleep 10
    continue
  fi

  replies_created=$(echo "$result" | jq -r '.repliesCreated // 0')
  total_replies=$((total_replies + replies_created))
  echo "$replies_created replies (total: $total_replies)"

  next_batch=$(echo "$result" | jq -r '.nextBatch')
  next_sub=$(echo "$result" | jq -r '.nextSub')

  if [ "$next_batch" = "null" ] || [ "$next_batch" -ge 20 ]; then
    echo "  ✓ All replies created: $total_replies"
    break
  fi

  batch=$next_batch
  sub=$next_sub
  sleep $DELAY
done

# Final status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Final status:"
curl -s "$BASE_URL/debug/status" | jq .

echo ""
echo "✅ AI seeding complete!"
echo ""
echo "Summary:"
echo "  - Posts created: $total_posts"
echo "  - Replies created: $total_replies"
echo ""
echo "🔑 All seed users have password: SeedPassword123!"
echo "📧 Login with email format: <handle>@example.com"
echo "   (e.g., sarah.chen@example.com)"
