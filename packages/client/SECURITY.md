# Security & Environment Configuration

Flowscope Client includes built-in security features to control when and where it's active, especially important for production deployments.

## ⚠️ CRITICAL: Production Security

**The simple access key approach is NOT secure for production!**

If you put an access key in your client code:
```javascript
// ❌ INSECURE - Access key gets bundled into your JavaScript!
Flowscope.init({
  accessKey: process.env.VITE_FLOWSCOPE_KEY // Anyone can view source and find this!
});
```

Anyone can view your JavaScript bundle and extract the key.

### ✅ For Production: Use Backend Authentication

**The secure approach:** Generate time-limited JWT tokens from your backend.

👉 **See [AUTHENTICATION.md](./AUTHENTICATION.md) for the secure production setup.**

### When to Use Simple Access Keys

Simple access keys are acceptable for:
- ✅ Development environments (localhost)
- ✅ Internal tools (behind VPN)
- ✅ Testing/staging environments
- ❌ **NOT for production websites**

## 🔒 Environment-Based Activation

### Default Behavior

By default, Flowscope only activates in **development** environments:

```javascript
// Only active in development (default)
Flowscope.init();
```

### Custom Environments

Specify which environments should have Flowscope enabled:

```javascript
Flowscope.init({
  environments: ['development', 'staging'], // Not in production
});
```

```javascript
Flowscope.init({
  environments: ['development', 'staging', 'production'], // Everywhere
});
```

```javascript
Flowscope.init({
  environments: [], // Disabled everywhere (require manual activation)
});
```

### Environment Detection

Flowscope automatically detects the environment:

| Condition | Detected Environment |
|-----------|---------------------|
| `process.env.NODE_ENV` set | Uses that value |
| `localhost` or `127.0.0.1` | `development` |
| Domain contains `staging` or `dev` | `staging` |
| Otherwise | `production` |

---

## 🔑 Access Key Protection

Require an access key to activate Flowscope in production. This prevents unauthorized users from accessing sensitive network data.

### Setup with Access Key

```javascript
// In your app initialization
Flowscope.init({
  environments: [], // Disabled by default
  accessKey: 'your-secret-key-here', // Generate a strong key
});
```

### Generate a Secure Access Key

```bash
# Generate a random access key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output:
```
a7f3c9e1b4d2f8a6c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9
```

### Activate in Production

Users with the access key can activate Flowscope in the browser console:

```javascript
// In production, open console and run:
Flowscope.activate('a7f3c9e1b4d2f8a6c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9')
```

If successful:
```
✅ Flowscope activated successfully! Press Cmd+K to toggle.
```

If failed:
```
🚫 Flowscope: Invalid access key. Attempt 1/5
```

### Rate Limiting

To prevent brute-force attacks, activation is rate-limited:
- **Maximum attempts:** 5 per page load
- **After 5 failed attempts:** User must reload the page to try again

---

## 🌍 Domain Restrictions

Add an extra layer of security by restricting which domains can use the access key:

```javascript
Flowscope.init({
  environments: [],
  accessKey: 'your-secret-key',
  allowedDomains: ['myapp.com', 'www.myapp.com'], // Only works on these domains
});
```

Even with the correct access key, activation will fail on unauthorized domains:

```
🚫 Flowscope: Access key not valid for domain: attacker.com
```

---

## 📋 Configuration Examples

### Example 1: Development Only (Default)

```javascript
// Simple - only works in development
Flowscope.init();
```

### Example 2: Dev + Staging, No Production

```javascript
Flowscope.init({
  environments: ['development', 'staging'],
});
```

### Example 3: Production with Access Key

```javascript
Flowscope.init({
  environments: [], // Disabled by default
  accessKey: process.env.FLOWSCOPE_KEY, // Store in environment variable
});

// In production console:
// Flowscope.activate('your-key-here')
```

### Example 4: Maximum Security

```javascript
Flowscope.init({
  environments: [], // Disabled everywhere by default
  accessKey: process.env.FLOWSCOPE_KEY, // Secure key from env
  allowedDomains: ['myapp.com'], // Domain-locked
});

// Only works on myapp.com with the correct key
```

### Example 5: Time-Limited Production Access

```javascript
// Server-side: Generate time-limited keys
const crypto = require('crypto');
const generateTimedKey = (secret, timestamp) => {
  return crypto.createHash('sha256')
    .update(secret + Math.floor(timestamp / 3600000)) // Valid for 1 hour
    .digest('hex');
};

// Client-side
Flowscope.init({
  environments: [],
  accessKey: 'dynamic-from-server', // Would need backend integration
});
```

---

## 🛡️ Best Practices

### 1. **Never Hardcode Access Keys**

❌ Bad:
```javascript
Flowscope.init({
  accessKey: 'my-secret-key-123',
});
```

✅ Good:
```javascript
Flowscope.init({
  accessKey: process.env.FLOWSCOPE_ACCESS_KEY,
});
```

### 2. **Use Environment Variables**

```bash
# .env.local (not committed to git)
FLOWSCOPE_ACCESS_KEY=a7f3c9e1b4d2f8a6c3e5b7d9f1a3c5e7
```

```javascript
// In your app
Flowscope.init({
  accessKey: import.meta.env.FLOWSCOPE_ACCESS_KEY,
});
```

### 3. **Rotate Keys Regularly**

Generate a new access key every few months:

```bash
# Generate new key
openssl rand -hex 32
```

### 4. **Document Access for Your Team**

Create a secure document (1Password, LastPass, etc.) with:
- Access key for production debugging
- Instructions: "Run `Flowscope.activate('key')` in console"
- Expiration date (if rotating keys)

### 5. **Consider Backend Integration**

For enterprise use, integrate with your auth system:

```javascript
// Request key from your API
const response = await fetch('/api/debug/flowscope-key', {
  headers: { 'Authorization': 'Bearer ' + userToken }
});
const { key } = await response.json();

// Activate with server-provided key
Flowscope.activate(key);
```

---

## 🚨 Security Considerations

### What Access Key Protects

✅ **Prevents:**
- Unauthorized users from seeing network traffic
- Competitors from inspecting your API calls
- Accidental exposure in production

❌ **Does NOT Prevent:**
- Determined attackers with JavaScript access
- Browser DevTools inspection
- Network-level monitoring

### When to Use Access Keys

| Scenario | Recommendation |
|----------|---------------|
| Public website | **Required** - Use access keys |
| Internal tools | Optional - Environment filtering may be enough |
| B2B SaaS | **Required** - Use access keys + domain restrictions |
| Mobile web apps | **Required** - High security risk |
| Development only | Not needed - Default is fine |

### Additional Security Layers

1. **Content Security Policy (CSP)**
   ```html
   <meta http-equiv="Content-Security-Policy" 
         content="script-src 'self' https://unpkg.com">
   ```

2. **Subresource Integrity (SRI)**
   ```html
   <script src="https://unpkg.com/@flowscope/client@0.1.0/dist/index.js"
           integrity="sha384-..."
           crossorigin="anonymous"></script>
   ```

3. **Remove in Production Build**
   ```javascript
   // Only include in development builds
   if (process.env.NODE_ENV === 'development') {
     import('@flowscope/client').then(({ default: Flowscope }) => {
       Flowscope.init();
     });
   }
   ```

---

## 🔍 Checking Activation Status

```javascript
// Check if Flowscope is currently active
if (Flowscope.isActive()) {
  console.log('Flowscope is monitoring network traffic');
} else {
  console.log('Flowscope is inactive');
}
```

---

## 📞 Support

If you have security concerns or questions:
- Open an issue: https://github.com/kagehq/flowscope/issues
- Email: security@flowscope.dev
- Discord: https://discord.gg/KqdBcqRk5E

