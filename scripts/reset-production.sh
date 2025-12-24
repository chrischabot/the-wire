#!/bin/bash

# Reset all production data for The Wire
# This script clears all KV namespaces

set -e

echo "=== The Wire Production Reset Script ==="
echo ""

# Get all KV namespaces
echo "Fetching KV namespace IDs..."
NAMESPACES=$(wrangler kv namespace list --json 2>/dev/null)

if [ -z "$NAMESPACES" ] || [ "$NAMESPACES" = "[]" ]; then
    echo "No KV namespaces found. Make sure you're logged in: wrangler login"
    exit 1
fi

echo "Found namespaces:"
echo "$NAMESPACES" | jq -r '.[] | "  - \(.title): \(.id)"'
echo ""

# Function to clear a namespace
clear_namespace() {
    local ns_id=$1
    local ns_name=$2

    echo "Clearing $ns_name ($ns_id)..."

    # List all keys
    KEYS=$(wrangler kv key list --namespace-id="$ns_id" --json 2>/dev/null || echo "[]")
    KEY_COUNT=$(echo "$KEYS" | jq 'length')

    if [ "$KEY_COUNT" = "0" ]; then
        echo "  No keys found in $ns_name"
        return
    fi

    echo "  Found $KEY_COUNT keys, deleting..."

    # Delete each key
    echo "$KEYS" | jq -r '.[].name' | while read -r key; do
        if [ -n "$key" ]; then
            wrangler kv key delete --namespace-id="$ns_id" "$key" --force 2>/dev/null && echo "  Deleted: $key" || echo "  Failed to delete: $key"
        fi
    done

    echo "  Done with $ns_name"
}

# Find and clear each namespace by title pattern
for title in "USERS_KV" "POSTS_KV" "SESSIONS_KV" "FEEDS_KV"; do
    NS_ID=$(echo "$NAMESPACES" | jq -r ".[] | select(.title | contains(\"$title\")) | .id" | head -1)
    if [ -n "$NS_ID" ] && [ "$NS_ID" != "null" ]; then
        clear_namespace "$NS_ID" "$title"
    else
        echo "Namespace $title not found, skipping..."
    fi
done

echo ""
echo "=== KV Reset Complete ==="
echo ""
echo "Note: Durable Objects retain their state until accessed."
echo "The next signup will create fresh DO instances."
