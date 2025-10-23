# @flowscope/client

> Chrome DevTools Network panel — inside your app. Zero setup, framework-agnostic, production-ready.

Embeddable network observability for debugging, monitoring, and LLM cost tracking.

## Install

```bash
npm install @flowscope/client
```

## Quick Start

### Vanilla JS

```html
<script type="module">
  import Flowscope from '@flowscope/client';
  Flowscope.init();
</script>
```

### React

```jsx
import { useFlowscope } from '@flowscope/client/react';

function App() {
  useFlowscope();
  return <YourApp />;
}
```

### Vue 3

```vue
<script setup>
import { useFlowscope } from '@flowscope/client/vue';
useFlowscope();
</script>
```

Press `Cmd+K` to open the panel. That's it! 🎉

## Features

- **Auto-instruments** fetch, XHR, WebSocket — no code changes needed
- **Beautiful DevTools-style panel** — resizable, dockable, minimal
- **Search & filter** — find requests instantly
- **Performance metrics** — timing, errors, costs
- **Export** — HAR, JSON, CSV formats
- **Production-safe** — environment controls + auto-redaction
- **Framework-agnostic** — works everywhere

## Configuration

```javascript
Flowscope.init({
  enabled: true,                    // Enable/disable
  hotkey: 'cmd+k',                  // Keyboard shortcut
  maxRequests: 100,                 // Memory limit
  
  // Auto-redact sensitive data
  redact: {
    headers: ['authorization', 'cookie'],
    bodyPaths: ['password', 'token'],
  },
  
  // Filter requests
  includeUrls: [/api\.example\.com/],
  excludeUrls: [/analytics/],
  
  // Callbacks
  onRequest: (event) => console.log(event),
});
```

## Security & Production

**Development:** Enabled by default in `NODE_ENV !== 'production'`

**Production:** Disabled by default. Enable securely:

```javascript
// ❌ DON'T: Client-side access keys (anyone can see in source)
Flowscope.init({
  accessKey: 'secret-123' // This is visible to everyone!
});

// ✅ DO: Backend-verified JWT tokens
Flowscope.init({
  environments: [],
  apiEndpoint: '/api/debug/activate',
});

// User activates via console:
await Flowscope.requestActivation(); 
// Your backend verifies auth, generates time-limited JWT
```

**📖 Full security guide:** [SECURITY.md](./SECURITY.md)

## API Reference

```javascript
Flowscope.init(config)        // Initialize with config
Flowscope.toggle()            // Open/close panel
Flowscope.open()              // Open panel
Flowscope.close()             // Close panel
Flowscope.getEvents()         // Get captured events
Flowscope.clear()             // Clear all events
Flowscope.export('har')       // Export as HAR/JSON/CSV
Flowscope.setEnabled(bool)    // Enable/disable interception
```

## CDN (No build step)

```html
<!-- ES Module -->
<script type="module">
  import Flowscope from 'https://unpkg.com/@flowscope/client@latest/dist/index.mjs';
  Flowscope.init();
</script>

<!-- UMD (Global) -->
<script src="https://unpkg.com/@flowscope/client@latest/dist/index.js"></script>
<script>
  Flowscope.init();
</script>
```

**⚠️ Production tip:** Pin to a specific version (`@0.1.0` instead of `@latest`)

## Bundle Size

- Core: ~15KB gzipped
- UI: ~25KB gzipped (lazy loaded on first open)
- **Total impact:** ~40KB

## Demo

```bash
cd packages/client
open demo.html
```

Features: Request list, timeline view, error analysis, performance metrics, export, keyboard shortcuts.

## Use Cases

- 🐛 **Debug production issues** — inspect live requests
- 💰 **Track LLM costs** — monitor OpenAI/Anthropic tokens
- 🚀 **Performance profiling** — find slow endpoints
- 🔍 **API exploration** — discover what your app is calling
- 👥 **Support debugging** — share HAR files with users

## Backend Integration

Connect to [@flowscope/server](../server) for persistent storage, team sharing, and analytics:

```javascript
Flowscope.init({
  backend: 'https://flowscope.yourcompany.com',
  sessionId: user.id,
});
```

## Learn More

- 📖 [Security Guide](./SECURITY.md) — Production authentication & access control
- 🔗 [GitHub](https://github.com/kagehq/flowscope)
- 💬 [Discord](https://discord.gg/flowscope)

## License

MIT
