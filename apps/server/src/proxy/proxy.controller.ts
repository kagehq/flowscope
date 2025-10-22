import { Controller, All, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createProxyServer } from 'http-proxy';
import { v4 as uuid } from 'uuid';
import { CaptureStore } from '../store/capture.store';
import { EventsGateway } from '../events/events.gateway';
import { ArizeService } from '../arize/arize.service';
import { redactHeaders, redactJson } from '../utils/redact';
import { CapturedEvent, HttpMethod, BodyEncoding } from '@flowscope/shared';

const proxy = createProxyServer({ selfHandleResponse: true });

@Controller('proxy')
export class ProxyController {
  constructor(
    private store: CaptureStore,
    private events: EventsGateway,
    private arize: ArizeService,
  ) {
    proxy.on('error', (_err, _req: any, res: any) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy error');
    });
  }

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const id = uuid();
    const upstream = process.env.UPSTREAM || 'http://localhost:3000';

    // Debug logging
    console.log('[Proxy] req.originalUrl:', req.originalUrl);
    console.log('[Proxy] req.path:', req.path);
    console.log('[Proxy] req.url:', req.url);

    // Extract the path after /proxy
    const targetPath = (req.url || req.originalUrl).replace(/^\/proxy/, '');
    const targetUrl = upstream + targetPath;

    console.log('[Proxy] Target Path:', targetPath);
    console.log('[Proxy] Target URL:', targetUrl);

    const started = Date.now();

    const reqChunks: Buffer[] = [];
    req.on('data', (chunk: any) => reqChunks.push(Buffer.from(chunk)));

    const headers = redactHeaders(req.headers as any);
    const capturedReq: CapturedEvent['req'] = {
      id,
      ts: started,
      method: req.method as HttpMethod,
      url: targetUrl,
      path: targetPath.split('?')[0] || '/',
      query: req.query as any,
      headers: Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, String(v)])
      ),
      bodyBytes: 0,
      bodyPreview: undefined,
      encoding: undefined,
    };

    req.on('end', () => {
      const body = Buffer.concat(reqChunks);
      capturedReq.bodyBytes = body.length;
      const contentType = (req.headers['content-type'] || '').toString();
      const limit = Number(process.env.BODY_PREVIEW_LIMIT || 4096);

      if (body.length) {
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(body.toString('utf8'));
            capturedReq.bodyPreview = JSON.stringify(redactJson(json)).slice(0, limit);
            capturedReq.encoding = 'json';
          } catch {
            capturedReq.bodyPreview = body.toString('utf8').slice(0, limit);
            capturedReq.encoding = 'text';
          }
        } else {
          capturedReq.bodyPreview = body.toString('utf8').slice(0, limit);
          capturedReq.encoding = 'text';
        }
      }

      this.store.add({ id, req: capturedReq });
    });

    proxy.web(req, res, { target: targetUrl, changeOrigin: true });

    proxy.once('proxyRes', (proxyRes) => {
      const chunks: Buffer[] = [];

      // Debug logging
      console.log(`[Proxy] Received status ${proxyRes.statusCode} from upstream for ${targetUrl}`);

      // Forward status code and headers to client immediately
      if (!res.headersSent) {
        console.log(`[Proxy] Forwarding status ${proxyRes.statusCode} to client`);
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      } else {
        console.log('[Proxy] Headers already sent, cannot forward status code');
      }

      proxyRes.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
        if (!res.finished) {
          res.write(chunk); // Forward data to client
        }
      });

      proxyRes.on('end', () => {
        if (!res.finished) {
          res.end(); // Complete the client response
        }

        const body = Buffer.concat(chunks);
        const finished = Date.now();
        const contentType = (proxyRes.headers['content-type'] || '').toString();
        const limit = Number(process.env.BODY_PREVIEW_LIMIT || 4096);

        let bodyPreview: string | undefined;
        let encoding: BodyEncoding | undefined;

        if (body.length) {
          if (contentType.includes('application/json')) {
            try {
              const json = JSON.parse(body.toString('utf8'));
              bodyPreview = JSON.stringify(redactJson(json)).slice(0, limit);
              encoding = 'json';
            } catch {
              bodyPreview = body.toString('utf8').slice(0, limit);
              encoding = 'text';
            }
          } else {
            bodyPreview = body.toString('utf8').slice(0, limit);
            encoding = 'text';
          }
        }

        this.store.updateResponse(id, {
          id,
          ts: finished,
          status: proxyRes.statusCode || 0,
          headers: Object.fromEntries(
            Object.entries(proxyRes.headers).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join('; ') : String(v),
            ])
          ),
          bodyPreview,
          bodyBytes: body.length,
          durationMs: finished - started,
        });

        const event = this.store.get(id);
        console.log('[Proxy] Event stored:', event?.req.method, event?.req.path, 'Status:', event?.res?.status);
        if (event) {
          console.log('[Proxy] Emitting event to websocket');
          this.events.emitNew(event);

          // Export to Arize if it's an LLM call
          this.arize.exportEvent(event).catch(err => {
            console.error('[Proxy] Failed to export to Arize:', err);
          });
        } else {
          console.log('[Proxy] WARNING: Event not found in store!');
        }
      });
    });
  }
}

