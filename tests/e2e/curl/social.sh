#!/bin/bash

# Phase 6 Curl Tests for The Wire - Social Graph
# Run with: ./tests/e2e/curl/social.sh [BASE_URL]

BASE_URL="${1:-http://localhost:8787}"

echo "=== The Wire - Phase 6 Social Graph Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Create two test users
RAND1=$(( RANDOM % 10000 ))
RAND2=$(( RANDOM % 10000 ))

echo "Creating test user 1..."
TOKEN1=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user${RAND1}@example.com\",\"password\":\"SecurePass123\",\"handle\":\"user${RAND1}\"}" \
  | jq -r '.data.token')
HANDLE1="user${RAND1}"

echo "Creating test user 2..."
TOKEN2=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user${RAND2}@example.com\",\"password\":\"SecurePass123\",\"handle\":\"user${RAND2}\"}" \
  | jq -r '.data.token')
HANDLE2="user${RAND2}"

echo "User 1: $HANDLE1"
echo "User 2: $HANDLE2"
echo ""

# 1. User1 follows User2
echo "1. Testing POST /api/users/:handle/follow"
curl -s -X POST "$BASE_URL/api/users/$HANDLE2/follow" \
  -H "Authorization: Bearer $TOKEN1" | jq .
echo ""

# 2. Check User1's following list
echo "2. Testing GET /api/users/:handle/following"
curl -s -X GET "$BASE_URL/api/users/$HANDLE1/following" | jq .
echo ""

# 3. Check User2's followers list
echo "3. Testing GET /api/users/:handle/followers"
curl -s -X GET "$BASE_URL/api/users/$HANDLE2/followers" | jq .
echo ""

# 4. Verify follower counts updated
echo "4. Verifying follower counts"
echo "User1 (should be following 1):"
curl -s -X GET "$BASE_URL/api/users/$HANDLE1" | jq '.data.followingCount'
echo "User2 (should have 1 follower):"
curl -s -X GET "$BASE_URL/api/users/$HANDLE2" | jq '.data.followerCount'
echo ""

# 5. User1 unfollows User2
echo "5. Testing DELETE /api/users/:handle/follow"
curl -s -X DELETE "$BASE_URL/api/users/$HANDLE2/follow" \
  -H "Authorization: Bearer $TOKEN1" | jq .
echo ""

# 6. Verify unfollow worked
echo "6. Verifying unfollow"
curl -s -X GET "$BASE_URL/api/users/$HANDLE1/following" | jq .
echo ""

# 7. User1 blocks User2
echo "7. Testing POST /api/users/:handle/block"
curl -s -X POST "$BASE_URL/api/users/$HANDLE2/block" \
  -H "Authorization: Bearer $TOKEN1" | jq .
echo ""

# 8. Check blocked users list
echo "8. Testing GET /api/users/me/blocked"
curl -s -X GET "$BASE_URL/api/users/me/blocked" \
  -H "Authorization: Bearer $TOKEN1" | jq .
echo ""

# 9. Try to follow while blocked (should fail)
echo "9. Testing follow after block (should fail)"
curl -s -X POST "$BASE_URL/api/users/$HANDLE1/follow" \
  -H "Authorization: Bearer $TOKEN2" | jq .
echo ""

# 10. Unblock user
echo "10. Testing DELETE /api/users/:handle/block"
curl -s -X DELETE "$BASE_URL/api/users/$HANDLE2/block" \
  -H "Authorization: Bearer $TOKEN1" | jq .
echo ""

# 11. Test follow without auth
echo "11. Testing POST /api/users/:handle/follow without token (should fail)"
curl -s -X POST "$BASE_URL/api/users/$HANDLE2/follow" | jq .
echo ""

# 12. Test self-follow (should fail)
echo "12. Testing POST /api/users/:handle/follow on self (should fail)"
curl -s -X POST "$BASE_URL/api/users/$HANDLE1/follow" \
  -H "Authorization: Bearer $TOKEN1" | jq .
echo ""

echo "=== Tests Complete ==="