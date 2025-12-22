#!/bin/bash

# Phase 3 Curl Tests for The Wire - User Profiles
# Run with: ./tests/e2e/curl/users.sh [BASE_URL]

BASE_URL="${1:-http://localhost:8787}"

echo "=== The Wire - Phase 3 User Profile Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Generate unique test user
RAND=$(( RANDOM % 10000 ))
EMAIL="test${RAND}@example.com"
HANDLE="user${RAND}"

# Create and login user
echo "Setting up test user..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SecurePass123\",\"handle\":\"$HANDLE\"}" \
  | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."
echo ""

# 1. Get user profile by handle
echo "1. Testing GET /api/users/:handle"
curl -s -X GET "$BASE_URL/api/users/$HANDLE" | jq .
echo ""

# 2. Update own profile
echo "2. Testing PUT /api/users/me"
curl -s -X PUT "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Test User","bio":"Testing The Wire","location":"San Francisco"}' | jq .
echo ""

# 3. Get updated profile
echo "3. Verifying profile update"
curl -s -X GET "$BASE_URL/api/users/$HANDLE" | jq .
echo ""

# 4. Get user settings
echo "4. Testing GET /api/users/me/settings"
curl -s -X GET "$BASE_URL/api/users/me/settings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 5. Update settings
echo "5. Testing PUT /api/users/me/settings"
curl -s -X PUT "$BASE_URL/api/users/me/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emailNotifications":false,"mutedWords":["spam","bot"]}' | jq .
echo ""

# 6. Verify settings update
echo "6. Verifying settings update"
curl -s -X GET "$BASE_URL/api/users/me/settings" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 7. Test nonexistent user
echo "7. Testing GET /api/users/nonexistent (should fail)"
curl -s -X GET "$BASE_URL/api/users/nonexistentuser" | jq .
echo ""

# 8. Test update without auth
echo "8. Testing PUT /api/users/me without token (should fail)"
curl -s -X PUT "$BASE_URL/api/users/me" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Hacker"}' | jq .
echo ""

echo "=== Tests Complete ==="