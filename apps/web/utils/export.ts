import type { CapturedEvent } from '@flowscope/shared';

// Export as HAR (HTTP Archive) format
export function exportAsHAR(events: CapturedEvent[]): string {
  const har = {
    log: {
      version: '1.2',
      creator: {
        name: 'FlowScope',
        version: '1.0.0',
      },
      entries: events.map(event => ({
        startedDateTime: new Date(event.req.ts).toISOString(),
        time: event.res?.durationMs || 0,
        request: {
          method: event.req.method,
          url: event.req.url,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(event.req.headers).map(([name, value]) => ({ name, value })),
          queryString: Object.entries(event.req.query || {}).map(([name, value]) => ({
            name,
            value: Array.isArray(value) ? value.join(',') : String(value),
          })),
          cookies: [],
          headersSize: -1,
          bodySize: event.req.bodyBytes || 0,
          postData: event.req.bodyPreview ? {
            mimeType: event.req.headers['content-type'] || 'text/plain',
            text: event.req.bodyPreview,
          } : undefined,
        },
        response: event.res ? {
          status: event.res.status,
          statusText: '',
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(event.res.headers).map(([name, value]) => ({ name, value })),
          cookies: [],
          content: {
            size: event.res.bodyBytes || 0,
            mimeType: event.res.headers['content-type'] || 'text/plain',
            text: event.res.bodyPreview || '',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: event.res.bodyBytes || 0,
        } : {
          status: 0,
          statusText: '',
          httpVersion: 'HTTP/1.1',
          headers: [],
          cookies: [],
          content: { size: 0, mimeType: 'text/plain' },
          redirectURL: '',
          headersSize: -1,
          bodySize: 0,
        },
        cache: {},
        timings: {
          send: 0,
          wait: event.res?.durationMs || 0,
          receive: 0,
        },
      })),
    },
  };
  
  return JSON.stringify(har, null, 2);
}

// Export as Postman Collection
export function exportAsPostman(events: CapturedEvent[]): string {
  const collection = {
    info: {
      name: 'FlowScope Collection',
      description: `Captured ${events.length} requests`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: events.map(event => ({
      name: `${event.req.method} ${event.req.path}`,
      request: {
        method: event.req.method,
        header: Object.entries(event.req.headers).map(([key, value]) => ({
          key,
          value,
          type: 'text',
        })),
        body: event.req.bodyPreview ? {
          mode: 'raw',
          raw: event.req.bodyPreview,
          options: {
            raw: {
              language: event.req.encoding === 'json' ? 'json' : 'text',
            },
          },
        } : undefined,
        url: {
          raw: event.req.url,
          protocol: event.req.url.startsWith('https') ? 'https' : 'http',
          host: [new URL(event.req.url).hostname],
          path: event.req.path.split('/').filter(Boolean),
          query: Object.entries(event.req.query || {}).map(([key, value]) => ({
            key,
            value: Array.isArray(value) ? value.join(',') : String(value),
          })),
        },
      },
      response: [],
    })),
  };
  
  return JSON.stringify(collection, null, 2);
}

// Export as CSV
export function exportAsCSV(events: CapturedEvent[]): string {
  const headers = ['Timestamp', 'Method', 'URL', 'Status', 'Duration (ms)', 'Request Size', 'Response Size', 'LLM Cost'];
  const rows = events.map(event => [
    new Date(event.req.ts).toISOString(),
    event.req.method,
    event.req.url,
    event.res?.status || '',
    event.res?.durationMs || '',
    event.req.bodyBytes || 0,
    event.res?.bodyBytes || 0,
    event.llm?.cost ? `$${event.llm.cost.toFixed(4)}` : '',
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma
      const stringCell = String(cell);
      if (stringCell.includes(',') || stringCell.includes('"')) {
        return `"${stringCell.replace(/"/g, '""')}"`;
      }
      return stringCell;
    }).join(',')),
  ].join('\n');
  
  return csvContent;
}

// Download file helper
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

