#!/bin/bash
# Seed script for The Wire - runs all seeding phases in sequence
# Respects Cloudflare rate limits with delays between calls

BASE_URL="https://the-wire.chabotc.workers.dev"
DELAY=2 # seconds between calls

echo "🌱 Starting The Wire seed process..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Phase 1: Create users (only if needed)
echo ""
echo "📦 Phase 1: Creating users..."
curl -s -X POST "$BASE_URL/debug/seed/users" | jq -c '.log | length'
sleep $DELAY

# Phase 2: Create follows
echo ""
echo "🔗 Phase 2: Creating follow relationships..."
curl -s -X POST "$BASE_URL/debug/seed/follows" | jq -c '.log | length'
sleep $DELAY

# Phase 3: Create posts (4 batches of 5 users each = 20 users)
echo ""
echo "📝 Phase 3: Creating posts..."
for batch in 0 1 2 3; do
  echo -n "  Batch $batch: "
  curl -s -X POST "$BASE_URL/debug/seed/posts?batch=$batch" | jq -c '.log'
  sleep $DELAY
done

# Phase 4: Create comments (20 batches of 1 user each, 25 comments per user)
echo ""
echo "💬 Phase 4: Creating comments (20 batches)..."
for batch in $(seq 0 19); do
  echo -n "  User $batch: "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/comments?batch=$batch")
  echo "$result" | jq -c '.log'
  if echo "$result" | jq -e '.success == false' > /dev/null 2>&1; then
    echo "    ⚠️ Error in batch $batch, continuing..."
  fi
  sleep $DELAY
done

# Phase 5: Create likes (20 batches of 1 user each, 50 likes per user)
echo ""
echo "❤️ Phase 5: Adding likes (20 batches)..."
for batch in $(seq 0 19); do
  echo -n "  User $batch: "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/likes?batch=$batch")
  echo "$result" | jq -c '.log'
  if echo "$result" | jq -e '.success == false' > /dev/null 2>&1; then
    echo "    ⚠️ Error in batch $batch, continuing..."
  fi
  sleep $DELAY
done

# Phase 6: Create reposts (10 batches of 2 users each, 5 reposts per user)
echo ""
echo "🔄 Phase 6: Creating reposts (10 batches)..."
for batch in $(seq 0 9); do
  echo -n "  Batch $batch: "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/reposts?batch=$batch")
  echo "$result" | jq -c '.log'
  if echo "$result" | jq -e '.success == false' > /dev/null 2>&1; then
    echo "    ⚠️ Error in batch $batch, continuing..."
  fi
  sleep $DELAY
done

# Final status check
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Final status:"
curl -s "$BASE_URL/debug/status" | jq .

echo ""
echo "✅ Seeding complete!"
echo ""
echo "🔑 All seed users have password: SeedPassword123!"
echo "📧 Login with email format: <handle>@example.com"
echo "   (e.g., sarah.chen@example.com)"
