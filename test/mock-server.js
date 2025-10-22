/**
 * Mock Upstream Server
 * This simulates your backend API that FlowScope proxies to
 */

import http from 'http';

const PORT = 3000;

const server = http.createServer((req, res) => {
  const now = new Date().toISOString();

  console.log(`[${now}] ${req.method} ${req.url}`);

  // Collect request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    // Parse the URL
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // Simulate different responses based on path
    res.setHeader('Content-Type', 'application/json');

    switch (path) {
      case '/api/users':
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          data: [
            { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
            { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
            { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'user' }
          ]
        }));
        break;

      case '/api/posts':
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          data: [
            { id: 1, title: 'First Post', content: 'Hello World!', author: 'Alice' },
            { id: 2, title: 'Second Post', content: 'Testing FlowScope', author: 'Bob' }
          ]
        }));
        break;

      case '/api/login':
        if (req.method === 'POST') {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
            user: { id: 1, email: 'test@example.com' }
          }));
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
        break;

      case '/api/error':
        res.statusCode = 500;
        res.end(JSON.stringify({
          error: 'Internal Server Error',
          message: 'Something went wrong!'
        }));
        break;

      case '/api/not-found':
        res.statusCode = 404;
        res.end(JSON.stringify({
          error: 'Not Found',
          message: 'Resource does not exist'
        }));
        break;

      case '/api/slow':
        // Simulate slow response
        setTimeout(() => {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            message: 'This response took 3 seconds'
          }));
        }, 3000);
        break;

      default:
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: 'Mock server is running',
          path: path,
          method: req.method,
          timestamp: now
        }));
    }
  });
});

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Mock Upstream Server Running! 🚀         ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║   Port: ${PORT}                              ║`);
  console.log('║   URL:  http://localhost:3000              ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log('║   Available endpoints:                     ║');
  console.log('║   GET  /api/users                          ║');
  console.log('║   GET  /api/posts                          ║');
  console.log('║   POST /api/login                          ║');
  console.log('║   GET  /api/error    (returns 500)         ║');
  console.log('║   GET  /api/not-found (returns 404)        ║');
  console.log('║   GET  /api/slow     (3s delay)            ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  console.log('✨ Ready to receive requests from FlowScope proxy!');
  console.log('');
});

