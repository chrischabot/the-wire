#!/bin/bash

# Phase 1 Curl Tests for The Wire
# Run with: ./tests/e2e/curl/health.sh [BASE_URL]

BASE_URL="${1:-http://localhost:8787}"

echo "=== The Wire - Phase 1 Endpoint Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Health check
echo "1. Testing GET /health"
curl -s -X GET "$BASE_URL/health" | jq .
echo ""

# Landing page
echo "2. Testing GET / (Landing Page)"
curl -s -X GET "$BASE_URL/" -o /dev/null -w "Status: %{http_code}, Content-Type: %{content_type}\n"
echo ""

# API info
echo "3. Testing GET /api"
curl -s -X GET "$BASE_URL/api" | jq .
echo ""

# 404 handling
echo "4. Testing 404 response"
curl -s -X GET "$BASE_URL/nonexistent" | jq .
echo ""

echo "=== Tests Complete ==="