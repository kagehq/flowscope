#!/bin/sh
set -e

echo "🚀 Starting FlowScope..."
echo ""
echo "Proxy Server: http://localhost:4317"
echo "Dashboard:    http://localhost:4320"
echo ""

# Start server in background with PORT=4317
cd /app/apps/server
PORT=4317 node dist/main.js &

# Start web in foreground with PORT=4320
cd /app/apps/web
PORT=4320 node .output/server/index.mjs
