#!/bin/bash
# Cleanup script for axiom8-mcp Docker containers
# This script helps clean up orphaned containers that Claude Desktop doesn't properly terminate

echo "🧹 Cleaning up axiom8-mcp containers..."

# Stop all running axiom8-mcp containers
echo "Stopping running axiom8-mcp containers..."
docker stop $(docker ps -q --filter "ancestor=axiom8-mcp:latest" 2>/dev/null) 2>/dev/null || echo "No running containers found"

# Remove all axiom8-mcp containers
echo "Removing axiom8-mcp containers..."
docker rm $(docker ps -aq --filter "ancestor=axiom8-mcp:latest" 2>/dev/null) 2>/dev/null || echo "No containers to remove"

# Clean up any orphaned containers
echo "Cleaning up orphaned containers..."
docker container prune -f

echo "✅ Cleanup completed!"
echo ""
echo "💡 Tip: Run this script periodically to clean up containers that Claude Desktop doesn't properly terminate."
echo "📋 To see running containers: docker ps --filter \"ancestor=axiom8-mcp:latest\""