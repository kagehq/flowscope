// Test script to verify POST/PUT body handling
const http = require('http');

// Start a simple test server
const testServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    console.log('[Test Server] Received:', {
      method: req.method,
      path: req.url,
      body: body,
      bodyLength: body.length
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      received: body,
      length: body.length,
      parsed: body ? JSON.parse(body) : null
    }));
  });
});

testServer.listen(3000, () => {
  console.log('[Test Server] Running on :3000\n');
  
  // Wait a moment for server to be ready, then test
  setTimeout(() => {
    runTests();
  }, 500);
});

async function runTests() {
  console.log('🧪 Testing POST/PUT body handling through proxy...\n');
  
  // Test 1: POST with JSON body
  console.log('Test 1: POST with JSON body');
  await testRequest('POST', {
    name: 'Alice',
    email: 'alice@example.com',
    role: 'admin'
  });
  
  // Test 2: PUT with JSON body
  console.log('\nTest 2: PUT with JSON body');
  await testRequest('PUT', {
    id: 123,
    status: 'active',
    metadata: { foo: 'bar', nested: { deep: true } }
  });
  
  // Test 3: POST with large JSON body
  console.log('\nTest 3: POST with large body (1000 items)');
  const largeData = {
    items: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random()
    }))
  };
  await testRequest('POST', largeData);
  
  console.log('\n✅ All tests completed!');
  console.log('Check http://localhost:4320 to see captured requests\n');
  
  testServer.close();
  process.exit(0);
}

function testRequest(method, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 4317,
      path: '/proxy/test',
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(responseBody);
          const success = response.length === body.length;
          
          console.log(`  ✓ Sent ${body.length} bytes`);
          console.log(`  ✓ Received ${response.length} bytes`);
          console.log(`  ${success ? '✅' : '❌'} Body ${success ? 'matched!' : 'MISMATCH!'}`);
          
          if (!success) {
            console.log('  Expected:', body.substring(0, 100));
            console.log('  Received:', response.received.substring(0, 100));
          }
          
          resolve();
        } catch (err) {
          console.log(`  ❌ Failed to parse response: ${err.message}`);
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`  ❌ Request failed: ${err.message}`);
      reject(err);
    });
    
    req.write(body);
    req.end();
  });
}

