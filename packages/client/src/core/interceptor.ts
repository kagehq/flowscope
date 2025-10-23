/**
 * Network Interceptor
 * Patches fetch, XMLHttpRequest, and WebSocket to capture all network traffic
 */

import type { NetworkEvent, CapturedRequest, CapturedResponse, HttpMethod, FlowscopeConfig } from './types';

export class NetworkInterceptor {
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send;
  private isPatched = false;

  constructor(
    private onEvent: (event: NetworkEvent) => void,
    private config: FlowscopeConfig
  ) {
    this.originalFetch = window.fetch.bind(window);
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
  }

  patch() {
    if (this.isPatched) return;

    this.patchFetch();
    this.patchXHR();
    // this.patchWebSocket(); // TODO

    this.isPatched = true;
  }

  unpatch() {
    if (!this.isPatched) return;

    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    XMLHttpRequest.prototype.send = this.originalXHRSend;

    this.isPatched = false;
  }

  private shouldCapture(url: string): boolean {
    // Check sample rate
    if (this.config.sampleRate !== undefined && Math.random() > this.config.sampleRate) {
      return false;
    }

    // Check include/exclude filters
    if (this.config.includeUrls?.length) {
      if (!this.config.includeUrls.some(pattern => pattern.test(url))) {
        return false;
      }
    }

    if (this.config.excludeUrls?.length) {
      if (this.config.excludeUrls.some(pattern => pattern.test(url))) {
        return false;
      }
    }

    return true;
  }

  private patchFetch() {
    const self = this;

    window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
      const [resource, init] = args;
      const url = typeof resource === 'string' ? resource : resource.url;
      const method = (init?.method || 'GET').toUpperCase() as HttpMethod;

      if (!self.shouldCapture(url)) {
        return self.originalFetch(...args);
      }

      const id = self.generateId();
      const timestamp = Date.now();
      const startTime = performance.now();

      // Capture request
      const request: CapturedRequest = {
        id,
        timestamp,
        method,
        url,
        headers: self.extractHeaders(init?.headers),
        body: await self.extractBody(init?.body),
        bodySize: self.getBodySize(init?.body),
      };

      const event: NetworkEvent = {
        id,
        type: 'fetch',
        request,
        completed: false,
      };

      self.onEvent(event);
      self.config.onRequest?.(event);

      try {
        const response = await self.originalFetch(...args);
        const endTime = performance.now();

        // Clone response to read body without consuming it
        const clonedResponse = response.clone();

        const responseData: CapturedResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: self.extractResponseHeaders(response.headers),
          body: await self.readResponseBody(clonedResponse),
          bodySize: parseInt(response.headers.get('content-length') || '0', 10),
          duration: Math.round(endTime - startTime),
        };

        event.response = responseData;
        event.completed = true;

        self.onEvent(event);
        self.config.onResponse?.(event);

        return response;
      } catch (error) {
        const endTime = performance.now();

        event.error = error instanceof Error ? error.message : String(error);
        event.completed = true;
        event.response = {
          status: 0,
          statusText: 'Network Error',
          headers: {},
          duration: Math.round(endTime - startTime),
        };

        self.onEvent(event);
        self.config.onError?.(event);

        throw error;
      }
    };
  }

  private patchXHR() {
    const self = this;

    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      const urlStr = url.toString();

      if (self.shouldCapture(urlStr)) {
        (this as any)._flowscopeCapture = {
          id: self.generateId(),
          timestamp: Date.now(),
          method: method.toUpperCase() as HttpMethod,
          url: urlStr,
          headers: {} as Record<string, string>,
          startTime: 0,
        };
      }

      return self.originalXHROpen.call(this, method, url, async ?? true, username, password);
    };

    // Intercept setRequestHeader to capture headers
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header: string, value: string) {
      if ((this as any)._flowscopeCapture) {
        (this as any)._flowscopeCapture.headers[header] = value;
      }
      return originalSetRequestHeader.call(this, header, value);
    };

    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const captureData = (this as any)._flowscopeCapture;

      if (!captureData) {
        return self.originalXHRSend.call(this, body);
      }

      captureData.startTime = performance.now();

      const request: CapturedRequest = {
        id: captureData.id,
        timestamp: captureData.timestamp,
        method: captureData.method,
        url: captureData.url,
        headers: captureData.headers,
        body: self.stringifyBody(body),
        bodySize: self.getBodySize(body),
      };

      const event: NetworkEvent = {
        id: captureData.id,
        type: 'xhr',
        request,
        completed: false,
      };

      self.onEvent(event);
      self.config.onRequest?.(event);

      // Listen for completion
      this.addEventListener('loadend', () => {
        const endTime = performance.now();

        const responseData: CapturedResponse = {
          status: this.status,
          statusText: this.statusText,
          headers: self.parseResponseHeaders(this.getAllResponseHeaders()),
          body: this.responseText,
          bodySize: this.responseText?.length || 0,
          duration: Math.round(endTime - captureData.startTime),
        };

        event.response = responseData;
        event.completed = true;

        if (this.status === 0) {
          event.error = 'Network Error';
          self.config.onError?.(event);
        } else {
          self.config.onResponse?.(event);
        }

        self.onEvent(event);
      });

      return self.originalXHRSend.call(this, body);
    };
  }

  // Helper methods

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractHeaders(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};

    if (!headers) return result;

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = this.redactIfNeeded(key, value);
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key] = this.redactIfNeeded(key, value);
      });
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        result[key] = this.redactIfNeeded(key, value);
      });
    }

    return result;
  }

  private extractResponseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private parseResponseHeaders(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    headerString.split('\r\n').forEach(line => {
      const [key, value] = line.split(': ');
      if (key && value) {
        headers[key.toLowerCase()] = value;
      }
    });
    return headers;
  }

  private async extractBody(body?: BodyInit | null): Promise<string | null> {
    if (!body) return null;

    try {
      if (typeof body === 'string') {
        return body;
      }

      if (body instanceof FormData) {
        const obj: Record<string, any> = {};
        body.forEach((value, key) => {
          obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
        });
        return JSON.stringify(obj);
      }

      if (body instanceof URLSearchParams) {
        return body.toString();
      }

      if (body instanceof Blob) {
        return `[Blob: ${body.size} bytes, ${body.type}]`;
      }

      if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        return `[Binary: ${body.byteLength} bytes]`;
      }

      return String(body);
    } catch (error) {
      return '[Unable to capture body]';
    }
  }

  private stringifyBody(body?: Document | XMLHttpRequestBodyInit | null): string | null {
    if (!body) return null;

    try {
      if (typeof body === 'string') {
        return body;
      }

      if (body instanceof FormData) {
        const obj: Record<string, any> = {};
        body.forEach((value, key) => {
          obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
        });
        return JSON.stringify(obj);
      }

      if (body instanceof URLSearchParams) {
        return body.toString();
      }

      return String(body);
    } catch {
      return '[Unable to capture body]';
    }
  }

  private getBodySize(body?: any): number {
    if (!body) return 0;

    if (typeof body === 'string') {
      return new Blob([body]).size;
    }

    if (body instanceof Blob) {
      return body.size;
    }

    if (body instanceof ArrayBuffer) {
      return body.byteLength;
    }

    if (ArrayBuffer.isView(body)) {
      return body.byteLength;
    }

    return 0;
  }

  private async readResponseBody(response: Response): Promise<string | null> {
    try {
      const contentType = response.headers.get('content-type') || '';

      // Handle JSON
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return JSON.stringify(json, null, 2);
      }

      // Handle text
      if (contentType.includes('text/') || contentType.includes('application/xml')) {
        return await response.text();
      }

      // Handle binary
      const blob = await response.blob();
      return `[Binary: ${blob.size} bytes, ${blob.type}]`;
    } catch (error) {
      return '[Unable to read response body]';
    }
  }

  private redactIfNeeded(key: string, value: string): string {
    const redactHeaders = this.config.redact?.headers || [];

    if (redactHeaders.some(h => h.toLowerCase() === key.toLowerCase())) {
      return '[REDACTED]';
    }

    return value;
  }
}

