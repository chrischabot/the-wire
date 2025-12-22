#!/bin/bash

# Phase 4 Curl Tests for The Wire - Posts
# Run with: ./tests/e2e/curl/posts.sh [BASE_URL]

BASE_URL="${1:-http://localhost:8787}"

echo "=== The Wire - Phase 4 Posts Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Create test user
RAND=$(( RANDOM % 10000 ))
EMAIL="posttest${RAND}@example.com"
HANDLE="postuser${RAND}"

echo "Creating test user..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SecurePass123\",\"handle\":\"$HANDLE\"}" \
  | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."
echo ""

# 1. Create a post
echo "1. Testing POST /api/posts"
POST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from The Wire! This is my first note."}')
echo "$POST_RESPONSE" | jq .
POST_ID=$(echo "$POST_RESPONSE" | jq -r '.data.id')
echo "Post ID: $POST_ID"
echo ""

# 2. Get the post
echo "2. Testing GET /api/posts/:id"
curl -s -X GET "$BASE_URL/api/posts/$POST_ID" | jq .
echo ""

# 3. Like the post
echo "3. Testing POST /api/posts/:id/like"
curl -s -X POST "$BASE_URL/api/posts/$POST_ID/like" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 4. Verify like count updated
echo "4. Verifying like count"
curl -s -X GET "$BASE_URL/api/posts/$POST_ID" | jq '.data.likeCount'
echo ""

# 5. Unlike the post
echo "5. Testing DELETE /api/posts/:id/like"
curl -s -X DELETE "$BASE_URL/api/posts/$POST_ID/like" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 6. Verify unlike
echo "6. Verifying unlike"
curl -s -X GET "$BASE_URL/api/posts/$POST_ID" | jq '.data.likeCount'
echo ""

# 7. Create a reply
echo "7. Testing POST /api/posts (reply)"
REPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"This is a reply\",\"replyToId\":\"$POST_ID\"}")
echo "$REPLY_RESPONSE" | jq .
echo ""

# 8. Delete the post
echo "8. Testing DELETE /api/posts/:id"
curl -s -X DELETE "$BASE_URL/api/posts/$POST_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 9. Try to get deleted post
echo "9. Verifying post deletion"
curl -s -X GET "$BASE_URL/api/posts/$POST_ID" | jq .
echo ""

# 10. Test validation - empty content
echo "10. Testing POST /api/posts with empty content (should fail)"
curl -s -X POST "$BASE_URL/api/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":""}' | jq .
echo ""

# 11. Test validation - too long content
echo "11. Testing POST /api/posts with content exceeding 280 chars (should fail)"
LONG_CONTENT=$(python3 -c "print('a' * 281)")
curl -s -X POST "$BASE_URL/api/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"$LONG_CONTENT\"}" | jq .
echo ""

# 12. Test without auth
echo "12. Testing POST /api/posts without token (should fail)"
curl -s -X POST "$BASE_URL/api/posts" \
  -H "Content-Type: application/json" \
  -d '{"content":"Unauthorized post"}' | jq .
echo ""

echo "=== Tests Complete ==="