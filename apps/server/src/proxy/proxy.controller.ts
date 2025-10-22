import { Controller, All, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { v4 as uuid } from 'uuid';
import { CaptureStore } from '../store/capture.store';
import { EventsGateway } from '../events/events.gateway';
import { ArizeService } from '../arize/arize.service';
import { redactHeaders, redactJson } from '../utils/redact';
import { CapturedEvent, HttpMethod, BodyEncoding } from '@flowscope/shared';

@Controller('proxy')
export class ProxyController {
  constructor(
    private store: CaptureStore,
    private events: EventsGateway,
    private arize: ArizeService,
  ) {}

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const id = uuid();
    const upstream = process.env.UPSTREAM || 'http://localhost:3000';

    // Extract the path after /proxy
    const targetPath = (req.url || req.originalUrl).replace(/^\/proxy/, '');
    const targetUrl = upstream + targetPath;

    console.log('[Proxy] Target URL:', targetUrl);

    const started = Date.now();

    // Buffer the request body
    const reqChunks: Buffer[] = [];
    req.on('data', (chunk: any) => reqChunks.push(Buffer.from(chunk)));

    await new Promise<void>((resolve) => {
      req.on('end', () => resolve());
    });

    const reqBody = Buffer.concat(reqChunks);
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
      bodyBytes: reqBody.length,
      bodyPreview: undefined,
      encoding: undefined,
    };

    // Capture request body
    const contentType = (req.headers['content-type'] || '').toString();
    const limit = Number(process.env.BODY_PREVIEW_LIMIT || 4096);

    if (reqBody.length) {
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(reqBody.toString('utf8'));
          capturedReq.bodyPreview = JSON.stringify(redactJson(json)).slice(0, limit);
          capturedReq.encoding = 'json';
        } catch {
          capturedReq.bodyPreview = reqBody.toString('utf8').slice(0, limit);
          capturedReq.encoding = 'text';
        }
      } else {
        capturedReq.bodyPreview = reqBody.toString('utf8').slice(0, limit);
        capturedReq.encoding = 'text';
      }
    }

    this.store.add({ id, req: capturedReq });

    // Make the proxied request
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    // Prepare headers for proxied request
    const proxyHeaders = { ...req.headers };
    delete proxyHeaders['host']; // Remove original host
    proxyHeaders['host'] = parsedUrl.host;
    proxyHeaders['content-length'] = String(reqBody.length);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: proxyHeaders,
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      const resChunks: Buffer[] = [];

      console.log(`[Proxy] Received status ${proxyRes.statusCode} from upstream`);

      // Forward status and headers to client
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

      proxyRes.on('data', (chunk) => {
        resChunks.push(Buffer.from(chunk));
        res.write(chunk);
      });

      proxyRes.on('end', () => {
        res.end();

        const resBody = Buffer.concat(resChunks);
        const finished = Date.now();
        const resContentType = (proxyRes.headers['content-type'] || '').toString();

        let bodyPreview: string | undefined;
        let encoding: BodyEncoding | undefined;

        if (resBody.length) {
          if (resContentType.includes('application/json')) {
            try {
              const json = JSON.parse(resBody.toString('utf8'));
              bodyPreview = JSON.stringify(redactJson(json)).slice(0, limit);
              encoding = 'json';
            } catch {
              bodyPreview = resBody.toString('utf8').slice(0, limit);
              encoding = 'text';
            }
          } else {
            bodyPreview = resBody.toString('utf8').slice(0, limit);
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
          bodyBytes: resBody.length,
          durationMs: finished - started,
        });

        const event = this.store.get(id);
        console.log('[Proxy] Event stored:', event?.req.method, event?.req.path, 'Status:', event?.res?.status);
        if (event) {
          this.events.emitNew(event);
          this.arize.exportEvent(event).catch(() => {});
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      if (!res.finished) {
        res.end('Proxy error');
      }
    });

    // Send the request body
    if (reqBody.length > 0) {
      proxyReq.write(reqBody);
    }
    proxyReq.end();
  }
}
