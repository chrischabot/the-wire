#!/bin/bash
# Rich media seed script for The Wire
# Creates posts with links to showcase rich preview cards
# 
# Per user (20 users total):
#   - 10 posts (60% with links = 6 posts with links, 4 organic)
#   - 20 likes
#   - 5 reposts
#
# Totals:
#   - 200 posts (120 with links)
#   - 400 likes
#   - 100 reposts

BASE_URL="https://the-wire.chabotc.workers.dev"
DELAY=3

if [ -z "$WIRE_ADMIN_TOKEN" ]; then
  echo "❌ Error: WIRE_ADMIN_TOKEN environment variable not set"
  echo ""
  echo "To get your admin token:"
  echo "  1. Login to The Wire as an admin user"
  echo "  2. Open browser dev tools → Application → Local Storage"
  echo "  3. Copy the 'token' value"
  echo "  4. Run: export WIRE_ADMIN_TOKEN='your-token-here'"
  echo ""
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $WIRE_ADMIN_TOKEN"

echo "🎨 Starting The Wire Rich Media Seed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Target: $BASE_URL"
echo ""
echo "This will create:"
echo "  📝 200 posts (120 with links for rich cards)"
echo "  ❤️  400 likes"
echo "  🔄 100 reposts"
echo ""
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

# Phase 1: Create rich posts (10 per user × 20 users = 200 posts)
echo ""
echo "📝 Phase 1: Creating rich media posts..."
echo "   Target: 10 posts per user × 20 users = 200 posts"
echo "   (60% with links for rich preview cards)"
batch=0
total_posts=0
while true; do
  echo -n "  User $batch: "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/rich-posts?batch=$batch" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json")
  
  success=$(echo "$result" | jq -r '.success')
  if [ "$success" != "true" ]; then
    error=$(echo "$result" | jq -r '.error // "unknown error"')
    echo "Error: $error"
    
    if [[ "$error" == *"Unauthorized"* ]] || [[ "$error" == *"token"* ]]; then
      echo ""
      echo "❌ Authentication failed. Your token may be expired."
      echo "   Please get a fresh token and try again."
      exit 1
    fi
    
    echo "  Retrying in 10 seconds..."
    sleep 10
    continue
  fi
  
  posts_created=$(echo "$result" | jq -r '.postsCreated // 0')
  with_links=$(echo "$result" | jq -r '.withLinks // 0')
  total_posts=$((total_posts + posts_created))
  echo "$posts_created posts ($with_links with links) - total: $total_posts"
  
  complete=$(echo "$result" | jq -r '.complete // false')
  next_batch=$(echo "$result" | jq -r '.nextBatch')
  
  if [ "$complete" = "true" ] || [ "$next_batch" = "null" ]; then
    echo "  ✓ All posts created: $total_posts"
    break
  fi
  
  batch=$next_batch
  sleep $DELAY
done

# Phase 2: Create interactions (20 likes + 5 reposts per user)
echo ""
echo "❤️ Phase 2: Creating likes and reposts..."
echo "   Target: 20 likes + 5 reposts per user × 20 users"
total_likes=0
total_reposts=0
for batch in $(seq 0 19); do
  echo -n "  User $batch: "
  result=$(curl -s -X POST "$BASE_URL/debug/seed/showcase-interactions?batch=$batch" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json")
  
  success=$(echo "$result" | jq -r '.success')
  if [ "$success" = "true" ]; then
    likes=$(echo "$result" | jq -r '.likes // 0')
    reposts=$(echo "$result" | jq -r '.reposts // 0')
    total_likes=$((total_likes + likes))
    total_reposts=$((total_reposts + reposts))
    echo "$likes likes, $reposts reposts"
  else
    echo "Error - retrying..."
    sleep 5
    result=$(curl -s -X POST "$BASE_URL/debug/seed/showcase-interactions?batch=$batch" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json")
    likes=$(echo "$result" | jq -r '.likes // 0')
    reposts=$(echo "$result" | jq -r '.reposts // 0')
    total_likes=$((total_likes + likes))
    total_reposts=$((total_reposts + reposts))
    echo "$likes likes, $reposts reposts (retry)"
  fi
  sleep $DELAY
done

# Phase 3: Rebuild explore cache to include new posts
echo ""
echo "🔄 Phase 3: Rebuilding explore cache..."
curl -s -X POST "$BASE_URL/debug/quick-explore" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | jq -r '.message // "done"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Rich media seed complete!"
echo ""
echo "Summary:"
echo "  📝 Posts created: $total_posts"
echo "  ❤️  Likes created: $total_likes"
echo "  🔄 Reposts created: $total_reposts"
echo ""
echo "🔗 New users will now see a rich feed with link preview cards!"
echo ""
