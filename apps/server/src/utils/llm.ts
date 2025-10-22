export interface LLMMetadata {
  provider: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
  temperature?: number;
  maxTokens?: number;
  finishReason?: string;
}

// LLM Provider detection
export function isLLMCall(url: string): boolean {
  const llmDomains = [
    'api.openai.com',
    'api.anthropic.com',
    'api.mistral.ai',
    'api.cohere.ai',
    'generativelanguage.googleapis.com', // Google AI
    'bedrock-runtime', // AWS Bedrock
    'api.together.xyz',
    'api.replicate.com',
  ];

  return llmDomains.some(domain => url.includes(domain));
}

export function detectProvider(url: string): string {
  if (url.includes('api.openai.com')) return 'openai';
  if (url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('api.mistral.ai')) return 'mistral';
  if (url.includes('api.cohere.ai')) return 'cohere';
  if (url.includes('generativelanguage.googleapis.com')) return 'google';
  if (url.includes('bedrock-runtime')) return 'bedrock';
  if (url.includes('api.together.xyz')) return 'together';
  if (url.includes('api.replicate.com')) return 'replicate';
  return 'unknown';
}

// Cost calculation (approximate, per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 30, output: 60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Find matching pricing (handle model variants like gpt-4-0125-preview)
  const pricingKey = Object.keys(PRICING).find(key => model.includes(key));
  if (!pricingKey) return 0;

  const pricing = PRICING[pricingKey];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

// Extract LLM metadata from request/response
export function extractLLMMetadata(
  url: string,
  reqBody: any,
  resBody: any,
): LLMMetadata | null {
  const provider = detectProvider(url);
  if (provider === 'unknown') return null;

  const metadata: LLMMetadata = { provider };

  try {
    // Parse bodies if they're strings
    const req = typeof reqBody === 'string' ? JSON.parse(reqBody) : reqBody;
    const res = typeof resBody === 'string' ? JSON.parse(resBody) : resBody;

    // Extract common fields based on provider
    if (provider === 'openai') {
      metadata.model = req?.model || res?.model;
      metadata.temperature = req?.temperature;
      metadata.maxTokens = req?.max_tokens;

      if (res?.usage) {
        metadata.promptTokens = res.usage.prompt_tokens;
        metadata.completionTokens = res.usage.completion_tokens;
        metadata.totalTokens = res.usage.total_tokens;
      }

      if (res?.choices?.[0]?.finish_reason) {
        metadata.finishReason = res.choices[0].finish_reason;
      }
    }
    else if (provider === 'anthropic') {
      metadata.model = req?.model || res?.model;
      metadata.temperature = req?.temperature;
      metadata.maxTokens = req?.max_tokens;

      if (res?.usage) {
        metadata.promptTokens = res.usage.input_tokens;
        metadata.completionTokens = res.usage.output_tokens;
        metadata.totalTokens = (res.usage.input_tokens || 0) + (res.usage.output_tokens || 0);
      }

      if (res?.stop_reason) {
        metadata.finishReason = res.stop_reason;
      }
    }
    // Add more providers as needed

    // Calculate cost if we have token counts and model
    if (metadata.model && metadata.promptTokens && metadata.completionTokens) {
      metadata.cost = calculateCost(
        metadata.model,
        metadata.promptTokens,
        metadata.completionTokens,
      );
    }
  } catch (err) {
    // If parsing fails, return what we have
    console.error('Failed to extract LLM metadata:', err);
  }

  return metadata;
}

