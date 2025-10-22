/**
 * FlowScope Shared Types
 * Common TypeScript types shared across server and web packages
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type BodyEncoding = 'json' | 'text' | 'buffer';

export interface CapturedRequest {
  id: string;
  ts: number;
  method: HttpMethod;
  url: string;
  path: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string>;
  bodyPreview?: string;
  bodyBytes?: number;
  encoding?: BodyEncoding;
}

export interface CapturedResponse {
  id: string;
  ts: number;
  status: number;
  headers: Record<string, string>;
  bodyPreview?: string;
  bodyBytes?: number;
  durationMs?: number;
}

export interface CapturedEvent {
  id: string;
  req: CapturedRequest;
  res?: CapturedResponse;
}

export interface CaptureFilter {
  method?: HttpMethod[];
  status?: number[];
  pathIncludes?: string;
  q?: string;
  sinceTs?: number;
}

