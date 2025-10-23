# @flowscope/client

**Chrome DevTools Network tab — inside your own app.**

Embeddable network observability for web apps. Zero-setup, framework-agnostic, production-ready.

## ✨ Features

- ✅ **Auto-instruments fetch, XHR, WebSocket** - No code changes needed
- ✅ **Beautiful floating panel** - Minimal, non-intrusive UI
- ✅ **Real-time request tracking** - See requests as they happen
- ✅ **Search & filter** - Find requests instantly
- ✅ **Performance metrics** - Timing, size, status
- ✅ **Error highlighting** - Spot issues immediately
- ✅ **Export to HAR/JSON/CSV** - Share with your team
- ✅ **Keyboard shortcuts** - `Cmd+K` to toggle
- ✅ **🔒 Production-safe** - Environment controls + access key protection
- ✅ **Framework-agnostic** - Works with React, Vue, Svelte, or vanilla JS

## 🚀 Quick Start

### Vanilla JavaScript

```html
<script type="module">
  import Flowscope from '@flowscope/client';
  
  Flowscope.init();
</script>
```

That's it! Press `Cmd+K` to open the panel.

### React

```jsx
import { useFlowscope } from '@flowscope/react';

function App() {
  useFlowscope();
  
  return <YourApp />;
}
```

### Vue 3

```vue
<script setup>
import { useFlowscope } from '@flowscope/vue';

useFlowscope();
</script>

<template>
  <YourApp />
</template>
```

### CDN (No build step)

**UMD (Global variable):**
```html
<script src="https://unpkg.com/@flowscope/client@latest/dist/index.js"></script>
<script>
  // Flowscope is available globally
  Flowscope.init();
</script>
```

**ES Module (import):**
```html
<script type="module">
  import Flowscope from 'https://unpkg.com/@flowscope/client@latest/dist/index.mjs';
  Flowscope.init();
</script>
```

> **Note:** For production, pin to a specific version instead of `@latest`:
> ```html
> <script src="https://unpkg.com/@flowscope/client@0.1.0/dist/index.js"></script>
> ```

## ⚙️ Configuration

```javascript
Flowscope.init({
  // Enable/disable interception
  enabled: true,
  
  // Panel position
  position: 'bottom-right', // 'top-right' | 'top-left' | 'bottom-left'
  
  // Theme
  theme: 'dark', // 'light' | 'auto'
  
  // Keyboard shortcut
  hotkey: 'cmd+k',
  
  // Max requests in memory
  maxRequests: 100,
  
  // Sample rate (0-1, 1 = 100%)
  sampleRate: 1.0,
  
  // Auto-redact sensitive data
  redact: {
    headers: ['authorization', 'cookie', 'x-api-key'],
    bodyPaths: ['password', 'token', 'secret'],
    queryParams: ['token', 'key', 'apiKey'],
  },
  
  // Filter requests
  includeUrls: [/api\.example\.com/],
  excludeUrls: [/analytics/, /tracking/],
  
  // Callbacks
  onRequest: (event) => console.log('Request captured:', event),
  onResponse: (event) => console.log('Response received:', event),
  onError: (event) => console.error('Request failed:', event),
});
```

## 🔒 Security & Production

### Environment-Based Activation

By default, Flowscope only runs in **development**. Control which environments it's active in:

```javascript
Flowscope.init({
  // Only active in development (default)
  environments: ['development'],
});

// Enable in dev + staging
Flowscope.init({
  environments: ['development', 'staging'],
});

// Disabled everywhere (requires manual activation)
Flowscope.init({
  environments: [],
  accessKey: process.env.FLOWSCOPE_KEY,
});
```

### Access Key Protection (Development Only)

⚠️ **IMPORTANT:** Simple access keys are **NOT secure for production** because they get bundled into your client JavaScript where anyone can view them.

**For development/internal tools only:**

```javascript
// ⚠️ Only use in dev/staging - NOT production!
Flowscope.init({
  environments: ['development'], // Limit to dev
  accessKey: 'dev-access-key-123', // Anyone can see this in source!
});
```

### Production: Backend-Verified Tokens (Secure)

**The secure way:** Use your backend to generate time-limited JWT tokens.

```javascript
// In your app (NO secrets here!)
Flowscope.init({
  environments: [],
  apiEndpoint: '/api/debug/flowscope-activate', // Your backend API
});

// User activates via console
await Flowscope.requestActivation();
// Your backend:
// 1. Verifies user authentication
// 2. Checks user role (admin/support)
// 3. Validates organization + domain
// 4. Generates time-limited JWT token
// 5. Returns token to client
// ✅ Flowscope activated! Valid for 4 hours
```

**Security features:**
- ✅ User authentication required
- ✅ Role-based access control
- ✅ Organization-scoped
- ✅ Domain verification
- ✅ Time-limited tokens (e.g., 4 hours)
- ✅ Audit trail
- ✅ Rate limiting
- ✅ No secrets in client code

**📖 Full production setup guide:** [AUTHENTICATION.md](./AUTHENTICATION.md)

### Domain Locking

Restrict activation to specific domains:

```javascript
Flowscope.init({
  environments: [],
  accessKey: process.env.FLOWSCOPE_KEY,
  allowedDomains: ['myapp.com', 'www.myapp.com'],
});
```

**📖 Full security guide:** See [SECURITY.md](./SECURITY.md)

## 🎯 Use Cases

### Development

```javascript
// Only enable in development
if (process.env.NODE_ENV === 'development') {
  Flowscope.init();
}
```

### Production Debugging

```javascript
// Enable for admin users only
if (user.role === 'admin' || user.flags.includes('flowscope')) {
  Flowscope.init({
    sampleRate: 0.1, // Capture 10% of requests
    redact: {
      headers: ['authorization', 'cookie'],
      bodyPaths: ['password', 'creditCard', 'ssn'],
    },
  });
}
```

### LLM Cost Tracking

```javascript
// Track AI API costs
Flowscope.init({
  includeUrls: [/api\.openai\.com/, /api\.anthropic\.com/],
  onResponse: (event) => {
    if (event.response?.headers['x-ratelimit-tokens']) {
      const tokens = event.response.headers['x-ratelimit-tokens'];
      console.log(`Used ${tokens} tokens`);
    }
  },
});
```

## 📊 API Reference

### `Flowscope.init(config?)`

Initialize Flowscope with optional configuration.

### `Flowscope.toggle()`

Open/close the panel.

### `Flowscope.open()`

Open the panel.

### `Flowscope.close()`

Close the panel.

### `Flowscope.getEvents()`

Get all captured events.

```javascript
const events = Flowscope.getEvents();
console.log(events); // Array of NetworkEvent
```

### `Flowscope.clear()`

Clear all captured events.

### `Flowscope.export(format)`

Export events in various formats.

```javascript
// Export as HAR
const har = Flowscope.export('har');
downloadFile('requests.har', har);

// Export as JSON
const json = Flowscope.export('json');
console.log(JSON.parse(json));

// Export as CSV
const csv = Flowscope.export('csv');
```

### `Flowscope.setEnabled(enabled)`

Enable/disable request interception.

```javascript
// Disable temporarily
Flowscope.setEnabled(false);

// Re-enable
Flowscope.setEnabled(true);
```

## 🔒 Production Safety

Flowscope is designed to be production-safe:

- **Auto-redaction** - Sensitive headers/fields are automatically redacted
- **Sample rate** - Capture only a percentage of requests
- **Memory limits** - Automatic cleanup of old requests
- **No blocking** - All operations are non-blocking
- **Lazy loading** - UI bundle loads only when needed

### Security Best Practices

```javascript
// Production config
Flowscope.init({
  // Only capture errors
  includeUrls: [], // Empty = capture all
  
  // Aggressively redact
  redact: {
    headers: [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-session-id',
    ],
    bodyPaths: [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'email',
    ],
    queryParams: [
      'token',
      'key',
      'secret',
      'apiKey',
    ],
  },
  
  // Sample only 1% of requests
  sampleRate: 0.01,
  
  // Keep only recent requests
  maxRequests: 20,
});
```

## 🎨 Customization

### Custom Keyboard Shortcut

```javascript
Flowscope.init({
  hotkey: 'ctrl+shift+f', // Custom shortcut
});
```

### Multiple Shortcuts

```javascript
Flowscope.init({
  hotkey: 'cmd+k,ctrl+k,f12', // Multiple shortcuts
});
```

### Programmatic Control

```javascript
// Open on error
window.addEventListener('error', () => {
  Flowscope.open();
});

// Open on unhandled rejection
window.addEventListener('unhandledrejection', () => {
  Flowscope.open();
});

// Open from console
window.showFlowscope = () => Flowscope.open();
```

## 🧪 Demo

**Complete demo with all features:**

```bash
cd packages/client
open demo.html
```

**What's included:**
- 📋 List view with expandable details
- 📊 Timeline view with visual dots
- ⚠️ Error analysis with stats
- 📈 Performance metrics
- 🔄 Compare mode (select 2 requests)
- 📥 Export to HAR
- ⌨️ Keyboard shortcuts (Cmd+K)

Press `Cmd+K` to toggle the panel, then click the test buttons to see it in action!

## 📦 Bundle Size

- Core SDK: ~15KB gzipped
- UI Component: ~25KB gzipped (lazy loaded)
- Total impact: ~40KB (only when opened)

## 🤝 Integration with Backend

Flowscope works standalone, but you can connect it to a backend for:
- Persistent storage
- Team sharing
- Cross-session analytics
- Historical data

```javascript
Flowscope.init({
  backend: 'https://flowscope.yourcompany.com',
  sessionId: user.id,
  environment: 'production',
});
```

See [@flowscope/server](../server) for backend setup.

## 📄 License

MIT

## 🔗 Links

- [GitHub](https://github.com/kagehq/flowscope)
- [Documentation](https://flowscope.dev/docs)
- [Examples](https://flowscope.dev/examples)
- [Discord](https://discord.gg/flowscope)

