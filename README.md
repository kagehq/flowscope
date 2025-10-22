# FlowScope

**Stop scrolling through terminal logs.** FlowScope is a local, ephemeral HTTP request and response viewer that captures and visualizes your API traffic in real-time. Built for developers who need to debug fast.

Find issues in **10 seconds** instead of **5 minutes of scrolling**.

## Why FlowScope?

Terminal logging is the default, but it's painful:
- ❌ Logs scroll away constantly
- ❌ No filtering or search
- ❌ Can't replay requests
- ❌ No performance insights
- ❌ Hard to compare similar requests

**FlowScope fixes this:**
- ✅ **One-click filters** - Show only errors, slow requests, or mutations
- ✅ **Fuzzy search** - Find requests across path, body, headers, status
- ✅ **Performance insights** - p50/p95/p99 stats, visual highlighting of slow requests
- ✅ **Compare view** - Side-by-side diff of any two requests
- ✅ **Replay & Export** - Re-send requests or copy as cURL
- ✅ **LLM Observability** - Auto-export AI calls to Arize Phoenix with cost tracking

## Quick Start

### Using Docker (Easiest)

```bash
git clone https://github.com/kagehq/flowscope.git
cd flowscope
docker-compose up
```

Dashboard opens at `http://localhost:4320`

### Local Development

```bash
# Clone and install
git clone https://github.com/kagehq/flowscope.git
cd flowscope
npm install

# Start everything
npm run dev
```

## Usage

Point your app to use FlowScope as a proxy:

```javascript
// Before:
fetch('http://localhost:3000/api/users')

// After:
fetch('http://localhost:4317/proxy/api/users')
```

That's it! All requests now appear in the dashboard in real-time.

### Try It Out

We've included a mock server and test script to see FlowScope in action:

```bash
# Terminal 1: Start the mock upstream server
npm run test:mock

# Terminal 2: Start FlowScope
npm run dev

# Terminal 3: Send test requests
npm run test:run
```

Watch the requests appear in the dashboard with various status codes and response times!

Or use Docker:
```bash
docker-compose --profile testing up
# Then in another terminal:
npm run test:run
```

## Features

- **One-click filters** - Show only errors (4xx/5xx), slow requests (>500ms), or mutations (POST/PUT/DELETE)
- **Fuzzy search** - Find requests across path, body, headers, and status codes
- **Performance stats** - Real-time p50/p95/p99 response times with color-coded highlighting
- **Compare view** - Side-by-side diff of any two requests
- **Request replay** - Re-send any request with one click
- **Copy as cURL** - Export requests for terminal reproduction
- **Auto-redaction** - Sensitive data (passwords, tokens, auth) automatically hidden
- **LLM observability** - Auto-export AI calls to Arize Phoenix with token/cost tracking

## Configuration

Create `apps/server/.env`:

```bash
# Required
PORT=4317                                    # Proxy server port
UPSTREAM=http://localhost:3000               # Your backend API

# Optional
DASHBOARD_ORIGIN=http://localhost:4320       # Dashboard URL (for CORS)
RING_SIZE=2000                               # Max requests to keep in memory
BODY_PREVIEW_LIMIT=4096                      # Max bytes to capture from bodies

# Optional: Arize Phoenix Integration (for LLM observability)
ARIZE_ENDPOINT=http://localhost:6006/v1/traces  # Phoenix OTLP endpoint
ARIZE_API_KEY=                               # Optional: for Arize Cloud
ARIZE_SPACE_ID=default                       # Optional: space identifier
```

See [ARIZE.md](./ARIZE.md) for detailed Arize Phoenix integration guide.

## Performance

Built for speed - won't slow down your development workflow:
- **5-20ms latency overhead** - Negligible for most use cases
- **<1% overhead on LLM calls** - LLM APIs take 1-5+ seconds, FlowScope adds ~10ms
- **Async operations** - WebSocket broadcast and Arize export don't block responses
- **Streaming** - Responses are streamed through, not buffered

Unlike other observability tools that add 100ms+ latency, FlowScope is designed to be lightweight.

## Use Cases

- **Frontend debugging** - See exactly what your API returns without scrolling logs
- **Backend testing** - Replay requests while developing endpoints
- **Performance profiling** - Find slow endpoints with p95/p99 stats at a glance
- **Integration testing** - Compare expected vs actual responses side-by-side
- **LLM development** - Track token usage, costs, and export to Arize Phoenix
- **API exploration** - Copy requests as cURL for documentation or debugging


### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build everything
npm run build

# Run tests
npm run test:mock  # Start mock server
npm run test:run   # Run test requests
```


## License

FSL-1.1-MIT - See [LICENSE](./LICENSE) for details.
