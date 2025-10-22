import { Controller, Post, Param, Query } from '@nestjs/common';
import fetch from 'node-fetch';
import { CaptureStore } from '../store/capture.store';

@Controller('replay')
export class ReplayController {
  constructor(private store: CaptureStore) {}

  @Post(':id')
  async replay(
    @Param('id') id: string,
    @Query('dangerHeaders') dangerHeaders?: string
  ) {
    const event = this.store.get(id);
    if (!event) return { ok: false, error: 'not_found' };

    const headers: Record<string, string> = {};
    Object.entries(event.req.headers || {}).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (dangerHeaders === '1') {
        headers[lowerKey] = value as string;
      } else if (!['authorization', 'cookie'].includes(lowerKey)) {
        headers[lowerKey] = value as string;
      }
    });

    const response = await fetch(event.req.url, {
      method: event.req.method,
      headers,
      body: event.req.bodyPreview,
    });

    const text = await response.text();
    return {
      ok: true,
      status: response.status,
      bodyPreview: text.slice(0, 4096),
    };
  }
}

