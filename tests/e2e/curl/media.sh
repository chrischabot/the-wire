#!/bin/bash

# Phase 5 Curl Tests for The Wire - Media Storage
# Run with: ./tests/e2e/curl/media.sh [BASE_URL]
# Note: This script tests endpoint availability. Actual file uploads require test images.

BASE_URL="${1:-http://localhost:8787}"

echo "=== The Wire - Phase 5 Media Storage Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Create test user
RAND=$(( RANDOM % 10000 ))
EMAIL="mediatest${RAND}@example.com"
HANDLE="mediauser${RAND}"

echo "Creating test user..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SecurePass123\",\"handle\":\"$HANDLE\"}" \
  | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."
echo ""

# 1. Test media upload endpoint without file (should fail)
echo "1. Testing POST /api/media/upload without file (should fail)"
curl -s -X POST "$BASE_URL/api/media/upload" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 2. Test avatar upload endpoint without file (should fail)
echo "2. Testing PUT /api/users/me/avatar without file (should fail)"
curl -s -X PUT "$BASE_URL/api/users/me/avatar" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 3. Test banner upload endpoint without file (should fail)
echo "3. Testing PUT /api/users/me/banner without file (should fail)"
curl -s -X PUT "$BASE_URL/api/users/me/banner" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 4. Test media upload without auth (should fail)
echo "4. Testing POST /api/media/upload without token (should fail)"
curl -s -X POST "$BASE_URL/api/media/upload" | jq .
echo ""

# 5. Test nonexistent media retrieval (should fail)
echo "5. Testing GET /media/nonexistent.jpg (should fail)"
curl -s -X GET "$BASE_URL/media/nonexistent.jpg" | jq .
echo ""

echo "=== Tests Complete ==="
echo ""
echo "Note: To test actual file uploads, run:"
echo "  # Create a test image"
echo "  convert -size 100x100 xc:blue test.jpg"
echo "  # Upload media"
echo "  curl -X POST $BASE_URL/api/media/upload \\"
echo "    -H 'Authorization: Bearer \$TOKEN' \\"
echo "    -F 'file=@test.jpg'"