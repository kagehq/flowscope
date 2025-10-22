/**
 * FlowScope Test Script
 * Makes various HTTP requests through the FlowScope proxy
 * Watch them appear in the dashboard at http://localhost:4320
 */

const PROXY_URL = 'http://localhost:4317/proxy';

console.log('╔════════════════════════════════════════════╗');
console.log('║   FlowScope Request Test 🧪                ║');
console.log('╠════════════════════════════════════════════╣');
console.log('║   Proxy: http://localhost:4317/proxy      ║');
console.log('║   Dashboard: http://localhost:4320         ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

// Helper function to make requests
async function makeRequest(method, path, body = null, description = '') {
  console.log(`\n📤 ${description || `${method} ${path}`}`);

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FlowScope-Test/1.0',
      'X-Test-ID': Date.now().toString()
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${PROXY_URL}${path}`, options);
    const data = await response.json();

    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📦 Response:`, JSON.stringify(data).substring(0, 80) + '...');

    return { status: response.status, data };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

// Add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Run tests
async function runTests() {
  console.log('\n🚀 Starting test requests...\n');
  console.log('👀 Watch these appear in the FlowScope dashboard!');
  console.log('   Open: http://localhost:4320\n');

  await delay(1000);

  // Test 1: GET users
  await makeRequest('GET', '/api/users', null, 'Fetching user list');
  await delay(500);

  // Test 2: GET posts
  await makeRequest('GET', '/api/posts', null, 'Fetching posts');
  await delay(500);

  // Test 3: POST login
  await makeRequest('POST', '/api/login', {
    email: 'test@example.com',
    password: 'secret123'
  }, 'Login attempt with credentials');
  await delay(500);

  // Test 4: GET with query params
  await makeRequest('GET', '/api/users?page=1&limit=10', null, 'Fetching users with pagination');
  await delay(500);

  // Test 5: 404 Error
  await makeRequest('GET', '/api/not-found', null, 'Testing 404 error');
  await delay(500);

  // Test 6: 500 Error
  await makeRequest('GET', '/api/error', null, 'Testing 500 error');
  await delay(500);

  // Test 7: POST with data
  await makeRequest('POST', '/api/users', {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user'
  }, 'Creating new user');
  await delay(500);

  // Test 8: PUT request
  await makeRequest('PUT', '/api/users/1', {
    name: 'John Updated',
    email: 'john.updated@example.com'
  }, 'Updating user');
  await delay(500);

  // Test 9: DELETE request
  await makeRequest('DELETE', '/api/users/1', null, 'Deleting user');
  await delay(500);

  // Test 10: Slow request
  console.log('\n📤 Testing slow endpoint (3 second delay)');
  console.log('   ⏳ This will take 3 seconds...');
  await makeRequest('GET', '/api/slow', null, 'Slow response test');

  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║   ✅ All tests completed!                  ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log('║   Check the FlowScope dashboard to see:    ║');
  console.log('║   • All captured requests                  ║');
  console.log('║   • Request/response details               ║');
  console.log('║   • Response times                         ║');
  console.log('║   • Status codes (200, 404, 500)           ║');
  console.log('║                                            ║');
  console.log('║   🔗 http://localhost:4320                 ║');
  console.log('╚════════════════════════════════════════════╝\n');
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: This script requires Node.js 18+ for fetch API');
  console.log('   Your Node version:', process.version);
  console.log('   Please upgrade to Node.js 18 or later');
  process.exit(1);
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  console.log('\n💡 Make sure:');
  console.log('   1. Mock server is running (node test/mock-server.js)');
  console.log('   2. FlowScope server is running (npm run dev:server)');
  console.log('   3. FlowScope web is running (npm run dev:web)');
  process.exit(1);
});

