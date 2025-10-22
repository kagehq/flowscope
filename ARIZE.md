# Arize Phoenix Integration

FlowScope can automatically export LLM observability traces to [Arize Phoenix](https://phoenix.arize.com/) using OpenTelemetry.

## Features

- **Zero-code instrumentation** - Just proxy your LLM calls through FlowScope
- **Automatic LLM detection** - Supports OpenAI, Anthropic, Mistral, Cohere, Google AI, and more
- **Rich metadata extraction**:
  - Model name
  - Token usage (prompt, completion, total)
  - Cost estimation
  - Temperature, max_tokens, and other parameters
  - Finish reason
  - Full input/output messages
- **Real-time export** - Traces sent as requests complete

## Supported Providers

- OpenAI (`api.openai.com`)
- Anthropic (`api.anthropic.com`)
- Mistral AI (`api.mistral.ai`)
- Cohere (`api.cohere.ai`)
- Google AI (`generativelanguage.googleapis.com`)
- AWS Bedrock (`bedrock-runtime`)
- Together AI (`api.together.xyz`)
- Replicate (`api.replicate.com`)

## Setup

### 1. Install Dependencies

```bash
cd apps/server
npm install
```

### 2. Configure Environment Variables

Add these to your `apps/server/.env` file:

```bash
# Required: Arize Phoenix endpoint
ARIZE_ENDPOINT=http://localhost:6006/v1/traces

# Optional: For Arize Cloud
ARIZE_API_KEY=your_api_key_here
ARIZE_SPACE_ID=your_space_id
```

### 3. Run Arize Phoenix Locally (Optional)

If you want to run Phoenix locally:

```bash
# Using Docker
docker run -p 6006:6006 arizephoenix/phoenix:latest

# Or using Python
pip install arize-phoenix
python -m phoenix.server.main serve
```

Phoenix UI will be available at: http://localhost:6006

### 4. Start FlowScope

```bash
npm run dev:server
```

You should see: `✅ Arize integration enabled (endpoint: http://localhost:6006/v1/traces)`

## Usage

Just route your LLM API calls through FlowScope's proxy:

```typescript
// Before:
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
});

// After (route through FlowScope):
const response = await fetch('http://localhost:4317/proxy/https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
});
```

**That's it!** FlowScope will automatically:
1. Detect that it's an LLM call
2. Extract metadata (tokens, cost, etc.)
3. Send OpenTelemetry traces to Arize Phoenix

## View Traces in Phoenix

1. Open Phoenix UI: http://localhost:6006
2. Navigate to the "Traces" tab
3. You'll see all your LLM calls with:
   - Input prompts and output completions
   - Token usage and costs
   - Latency metrics
   - Model parameters

## Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ARIZE_ENDPOINT` | OpenTelemetry endpoint URL | - | Yes |
| `ARIZE_API_KEY` | API key for Arize Cloud | - | No |
| `ARIZE_SPACE_ID` | Space ID for organizing traces | `default` | No |

## Disabling Arize Integration

Simply remove or comment out the `ARIZE_ENDPOINT` variable:

```bash
# ARIZE_ENDPOINT=http://localhost:6006/v1/traces
```

FlowScope will log: `Arize integration disabled (no ARIZE_ENDPOINT configured)`

## Cost Tracking

FlowScope automatically calculates approximate costs for supported models:

**OpenAI:**
- GPT-4: $30/$60 per 1M tokens (input/output)
- GPT-4 Turbo: $10/$30 per 1M tokens
- GPT-3.5 Turbo: $0.50/$1.50 per 1M tokens

**Anthropic:**
- Claude 3 Opus: $15/$75 per 1M tokens
- Claude 3.5 Sonnet: $3/$15 per 1M tokens
- Claude 3 Sonnet: $3/$15 per 1M tokens
- Claude 3 Haiku: $0.25/$1.25 per 1M tokens

Costs are automatically included in the exported traces as the `llm.cost` attribute.

## Troubleshooting

### Traces not appearing in Phoenix

1. **Check FlowScope logs**: Look for `📤 Exported LLM call to Arize: ...`
2. **Verify Phoenix is running**: Visit http://localhost:6006
3. **Check endpoint URL**: Make sure `ARIZE_ENDPOINT` is correct
4. **Verify it's an LLM call**: Check that the URL contains a supported provider domain

### Performance Impact

- **Typical overhead**: 5-20ms per request
- **Async export**: Trace export happens asynchronously and doesn't block the response
- **Negligible for LLM calls**: Since LLM calls take 1-5+ seconds, FlowScope's overhead is <1%

## Advanced: Custom Providers

To add support for additional LLM providers, edit `apps/server/src/utils/llm.ts`:

```typescript
// Add domain to detection
const llmDomains = [
  'api.openai.com',
  'your-provider.com',  // Add your provider
];

// Add provider detection
if (url.includes('your-provider.com')) return 'your-provider';

// Add metadata extraction
if (provider === 'your-provider') {
  metadata.model = req?.model;
  // ... extract tokens, etc.
}
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/flowscope/issues
- Documentation: https://flowscope.dev

