import { Injectable, OnModuleInit } from '@nestjs/common';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { CapturedEvent } from '@flowscope/shared';
import { isLLMCall, extractLLMMetadata, LLMMetadata } from '../utils/llm';

@Injectable()
export class ArizeService implements OnModuleInit {
  private tracer: any;
  private provider: BasicTracerProvider | null = null;
  private enabled: boolean = false;

  onModuleInit() {
    const arizeEndpoint = process.env.ARIZE_ENDPOINT;
    const arizeApiKey = process.env.ARIZE_API_KEY;
    const arizeSpaceId = process.env.ARIZE_SPACE_ID;

    if (!arizeEndpoint) {
      console.log('Arize integration disabled (no ARIZE_ENDPOINT configured)');
      return;
    }

    try {
      // Create resource with service information
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'flowscope',
          [SemanticResourceAttributes.SERVICE_VERSION]: '0.0.1',
          'arize.space.id': arizeSpaceId || 'default',
        }),
      );

      // Create OTLP exporter
      const exporter = new OTLPTraceExporter({
        url: arizeEndpoint,
        headers: arizeApiKey
          ? {
              Authorization: `Bearer ${arizeApiKey}`,
            }
          : {},
      });

      // Create tracer provider
      this.provider = new BasicTracerProvider({ resource });
      this.provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      this.provider.register();

      this.tracer = trace.getTracer('flowscope', '0.0.1');
      this.enabled = true;

      console.log(`✅ Arize integration enabled (endpoint: ${arizeEndpoint})`);
    } catch (err) {
      console.error('Failed to initialize Arize integration:', err);
      this.enabled = false;
    }
  }

  async exportEvent(event: CapturedEvent): Promise<void> {
    if (!this.enabled || !event.res) return;

    try {
      // Only export LLM calls
      if (!isLLMCall(event.req.url)) return;

      const llmMetadata = extractLLMMetadata(
        event.req.url,
        event.req.bodyPreview,
        event.res.bodyPreview,
      );

      if (!llmMetadata) return;

      // Create span for this LLM call
      const span = this.tracer.startSpan('llm.call', {
        startTime: event.req.ts,
        attributes: {
          // HTTP attributes
          'http.method': event.req.method,
          'http.url': event.req.url,
          'http.status_code': event.res.status,

          // LLM attributes (OpenInference semantic conventions)
          'llm.provider': llmMetadata.provider,
          'llm.model_name': llmMetadata.model || 'unknown',
          'llm.input_messages': this.extractMessages(event.req.bodyPreview, llmMetadata.provider),
          'llm.output_messages': this.extractOutputMessages(event.res.bodyPreview, llmMetadata.provider),

          // Token usage
          ...(llmMetadata.promptTokens && { 'llm.token_count.prompt': llmMetadata.promptTokens }),
          ...(llmMetadata.completionTokens && { 'llm.token_count.completion': llmMetadata.completionTokens }),
          ...(llmMetadata.totalTokens && { 'llm.token_count.total': llmMetadata.totalTokens }),

          // Cost
          ...(llmMetadata.cost && { 'llm.cost': llmMetadata.cost }),

          // Parameters
          ...(llmMetadata.temperature !== undefined && { 'llm.temperature': llmMetadata.temperature }),
          ...(llmMetadata.maxTokens && { 'llm.max_tokens': llmMetadata.maxTokens }),
          ...(llmMetadata.finishReason && { 'llm.finish_reason': llmMetadata.finishReason }),

          // FlowScope attributes
          'flowscope.event_id': event.id,
          'flowscope.duration_ms': event.res.durationMs,
        },
      });

      // Set span status
      if (event.res.status >= 200 && event.res.status < 400) {
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${event.res.status}`,
        });
      }

      // End span
      span.end(event.res.ts);

      console.log(`📤 Exported LLM call to Arize: ${llmMetadata.provider} ${llmMetadata.model}`);
    } catch (err) {
      console.error('Failed to export event to Arize:', err);
    }
  }

  private extractMessages(body: any, provider: string): string {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;

      if (provider === 'openai' && parsed?.messages) {
        return JSON.stringify(parsed.messages);
      }

      if (provider === 'anthropic' && parsed?.messages) {
        return JSON.stringify(parsed.messages);
      }

      return '';
    } catch {
      return '';
    }
  }

  private extractOutputMessages(body: any, provider: string): string {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;

      if (provider === 'openai' && parsed?.choices) {
        return JSON.stringify(parsed.choices.map((c: any) => c.message));
      }

      if (provider === 'anthropic' && parsed?.content) {
        return JSON.stringify(parsed.content);
      }

      return '';
    } catch {
      return '';
    }
  }

  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      console.log('Arize integration shutdown');
    }
  }
}

