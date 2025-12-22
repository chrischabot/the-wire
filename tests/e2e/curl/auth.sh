#!/bin/bash

# Phase 2 Curl Tests for The Wire - Authentication
# Run with: ./tests/e2e/curl/auth.sh [BASE_URL]

BASE_URL="${1:-http://localhost:8787}"

echo "=== The Wire - Phase 2 Authentication Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Generate unique email and handle using short random suffix
RAND=$(( RANDOM % 10000 ))
EMAIL="test${RAND}@example.com"
HANDLE="user${RAND}"

# 1. Signup
echo "1. Testing POST /api/auth/signup"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SecurePass123\",\"handle\":\"$HANDLE\"}")
echo "$SIGNUP_RESPONSE" | jq .
TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. Login
echo "2. Testing POST /api/auth/login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SecurePass123\"}")
echo "$LOGIN_RESPONSE" | jq .
echo ""

# 3. Get current user
echo "3. Testing GET /api/auth/me"
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 4. Refresh token
echo "4. Testing POST /api/auth/refresh"
curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 5. Test without auth
echo "5. Testing GET /api/auth/me without token (should fail)"
curl -s -X GET "$BASE_URL/api/auth/me" | jq .
echo ""

# 6. Test with invalid token
echo "6. Testing GET /api/auth/me with invalid token (should fail)"
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer invalid-token" | jq .
echo ""

# 7. Test invalid login
echo "7. Testing POST /api/auth/login with wrong password (should fail)"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword123\"}" | jq .
echo ""

# 8. Test validation - invalid email
echo "8. Testing POST /api/auth/signup with invalid email (should fail)"
curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"SecurePass123","handle":"newuser"}' | jq .
echo ""

# 9. Test validation - weak password
echo "9. Testing POST /api/auth/signup with weak password (should fail)"
curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"weak@example.com","password":"weak","handle":"weakuser"}' | jq .
echo ""

# 10. Logout
echo "10. Testing POST /api/auth/logout"
curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "=== Tests Complete ==="