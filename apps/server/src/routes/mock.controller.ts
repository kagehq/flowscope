import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CaptureStore } from '../store/capture.store';
import { CapturedEvent } from '@flowscope/shared';

@Controller('mock')
export class MockController {
  constructor(private store: CaptureStore) {}

  @Get('generate')
  generateMockServer(
    @Query('since') since?: string,
    @Query('format') format: 'js' | 'ts' = 'js',
    @Res() res?: Response,
  ) {
    const sinceTs = since ? parseInt(since) : Date.now() - 24 * 60 * 60 * 1000;
    const events = this.store.list({ sinceTs });

    // Group events by route pattern
    const routeMap = new Map<string, CapturedEvent[]>();
    for (const event of events) {
      if (!event.res) continue;
      
      const route = `${event.req.method} ${event.req.path}`;
      if (!routeMap.has(route)) {
        routeMap.set(route, []);
      }
      routeMap.get(route)!.push(event);
    }

    // Generate mock server code
    const mockCode = this.generateMockCode(routeMap, format);

    if (res) {
      res.setHeader('Content-Type', format === 'ts' ? 'text/typescript' : 'text/javascript');
      res.setHeader('Content-Disposition', `attachment; filename="mock-server.${format}"`);
      res.send(mockCode);
    }

    return mockCode;
  }

  private generateMockCode(routeMap: Map<string, CapturedEvent[]>, format: 'js' | 'ts'): string {
    const isTypeScript = format === 'ts';
    
    let code = `// Mock server generated from FlowScope captured traffic
// Generated at: ${new Date().toISOString()}

`;

    if (isTypeScript) {
      code += `import express, { Request, Response } from 'express';
`;
    } else {
      code += `const express = require('express');
`;
    }

    code += `
const app = express();
app.use(express.json());

// Route handlers
`;

    // Generate handlers for each route
    for (const [route, events] of routeMap.entries()) {
      const [method, path] = route.split(' ');
      const expressMethod = method.toLowerCase();
      
      // Calculate p50, p95 response times
      const durations = events
        .map(e => e.res?.durationMs || 0)
        .filter(d => d > 0)
        .sort((a, b) => a - b);
      
      const p50 = durations[Math.floor(durations.length * 0.5)] || 100;
      const p95 = durations[Math.floor(durations.length * 0.95)] || 200;
      
      // Sample responses (success and errors)
      const successResponses = events.filter(e => e.res?.status && e.res.status < 400);
      const errorResponses = events.filter(e => e.res?.status && e.res.status >= 400);
      
      const sampleSuccess = successResponses[0];
      const sampleError = errorResponses[0];

      code += `
app.${expressMethod}('${path}', (req${isTypeScript ? ': Request' : ''}, res${isTypeScript ? ': Response' : ''}) => {
  // Realistic timing: p50=${p50}ms, p95=${p95}ms
  const delay = Math.random() < 0.95 ? ${p50} : ${p95};
  
  setTimeout(() => {
`;

      // Error rate simulation
      if (errorResponses.length > 0) {
        const errorRate = (errorResponses.length / events.length * 100).toFixed(1);
        code += `    // Simulate ${errorRate}% error rate from real traffic
    if (Math.random() < ${(errorResponses.length / events.length).toFixed(3)}) {
      return res.status(${sampleError?.res?.status || 500}).json(${this.formatBody(sampleError?.res?.bodyPreview)});
    }
    
`;
      }

      code += `    // Success response
    res.status(${sampleSuccess?.res?.status || 200}).json(${this.formatBody(sampleSuccess?.res?.bodyPreview)});
  }, delay);
});
`;
    }

    code += `
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Mock server running on port \${PORT}\`);
  console.log(\`Generated from \${${routeMap.size}} captured routes\`);
});
`;

    return code;
  }

  private formatBody(bodyPreview?: string): string {
    if (!bodyPreview) return '{}';
    
    try {
      const parsed = JSON.parse(bodyPreview);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return JSON.stringify({ message: bodyPreview.substring(0, 100) });
    }
  }
}

