#!/bin/bash

# FlowScope Quick Test Script
# This script runs a quick test to verify everything is working

echo "╔════════════════════════════════════════════╗"
echo "║   FlowScope Quick Test 🧪                  ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if servers are running
echo "🔍 Checking if FlowScope servers are running..."
echo ""

# Check server
if curl -s http://localhost:4317/healthz > /dev/null 2>&1; then
    echo "✅ FlowScope Server: Running on port 4317"
else
    echo "❌ FlowScope Server: Not running"
    echo "   Start it with: npm run dev:server"
    exit 1
fi

# Check web
if curl -s http://localhost:4320 > /dev/null 2>&1; then
    echo "✅ FlowScope Web: Running on port 4320"
else
    echo "❌ FlowScope Web: Not running"
    echo "   Start it with: npm run dev:web"
    exit 1
fi

# Check mock server
if curl -s http://localhost:3000/api/users > /dev/null 2>&1; then
    echo "✅ Mock Server: Running on port 3000"
else
    echo "⚠️  Mock Server: Not running"
    echo "   Start it with: npm run test:mock"
    echo ""
    echo "   Starting mock server now..."
    node test/mock-server.js &
    MOCK_PID=$!
    sleep 2
fi

echo ""
echo "🚀 All systems ready! Starting test..."
echo ""
echo "📊 Open the dashboard to watch requests:"
echo "   👉 http://localhost:4320"
echo ""
echo "⏳ Running tests in 3 seconds..."
sleep 3

# Run the tests
node test/test-requests.js

# Cleanup
if [ ! -z "$MOCK_PID" ]; then
    echo ""
    echo "🧹 Cleaning up mock server..."
    kill $MOCK_PID 2>/dev/null
fi

echo ""
echo "✨ Test complete!"

