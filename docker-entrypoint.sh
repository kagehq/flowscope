#!/bin/sh
set -e

echo "🚀 Starting FlowScope..."
echo ""
echo "Proxy Server: http://localhost:4317"
echo "Dashboard:    http://localhost:4320"
echo ""

# Start server in background
cd /app/apps/server
node dist/main.js &

# Start web in foreground
cd /app/apps/web
node .output/server/index.mjs

