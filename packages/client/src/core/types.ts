/**
 * Core types for Flowscope Client SDK
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';

export interface CapturedRequest {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string | null;
  bodySize?: number;
}

export interface CapturedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string | null;
  bodySize?: number;
  duration: number;
}

export interface NetworkEvent {
  id: string;
  type: 'fetch' | 'xhr' | 'websocket';
  request: CapturedRequest;
  response?: CapturedResponse;
  error?: string;
  completed: boolean;
}

export interface FlowscopeConfig {
  /** Enable automatic network interception */
  enabled?: boolean;

  /** Environments where Flowscope should be active (default: ['development']) */
  environments?: string[];

  /** Access key required for production activation */
  accessKey?: string;

  /** Domain restriction for access key (optional, for extra security) */
  allowedDomains?: string[];

  /** Position of the floating panel */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

  /** Theme */
  theme?: 'dark' | 'light' | 'auto';

  /** Keyboard shortcut to toggle panel */
  hotkey?: string;

  /** Backend URL for Pro features */
  backend?: string;

  /** Session ID for grouping requests */
  sessionId?: string;

  /** Max requests to keep in memory */
  maxRequests?: number;

  /** Fields to redact from capture */
  redact?: {
    headers?: string[];
    bodyPaths?: string[];
    queryParams?: string[];
  };

  /** Request sampling rate (0-1, 1 = 100%) */
  sampleRate?: number;

  /** Filter: only capture requests matching these patterns */
  includeUrls?: RegExp[];

  /** Filter: exclude requests matching these patterns */
  excludeUrls?: RegExp[];

  /** Callback when new request is captured */
  onRequest?: (event: NetworkEvent) => void;

  /** Callback when request completes */
  onResponse?: (event: NetworkEvent) => void;

  /** Callback when request fails */
  onError?: (event: NetworkEvent) => void;
}

export interface FlowscopeAPI {
  /** Initialize Flowscope */
  init(config?: FlowscopeConfig): void;

  /** Activate in production with access key */
  activate(accessKey: string): boolean;

  /** Check if currently active */
  isActive(): boolean;

  /** Enable/disable interception */
  setEnabled(enabled: boolean): void;

  /** Open/close the panel */
  toggle(): void;
  open(): void;
  close(): void;

  /** Get all captured events */
  getEvents(): NetworkEvent[];

  /** Clear all events */
  clear(): void;

  /** Export events in various formats */
  export(format: 'har' | 'json' | 'csv'): string;

  /** Get current config */
  getConfig(): FlowscopeConfig;

  /** Update config */
  updateConfig(config: Partial<FlowscopeConfig>): void;
}

