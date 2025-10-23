# Flowscope Cloud - SaaS Architecture

## 🏗️ Product Structure

```
User
 └─ Organizations (many)
     └─ Sites/Projects (many)
         ├─ Domains (many)
         ├─ Team Members (many)
         ├─ API Keys
         └─ Settings
```

---

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  email_verified BOOLEAN DEFAULT FALSE,
  status ENUM('active', 'suspended') DEFAULT 'active'
);

CREATE INDEX idx_users_email ON users(email);
```

### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
```

### Organization Members Table
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role ENUM('owner', 'admin', 'developer', 'viewer') NOT NULL,
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
```

### Sites/Projects Table
```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  status ENUM('active', 'paused', 'archived') DEFAULT 'active',
  settings JSONB DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_sites_org ON sites(organization_id);
CREATE INDEX idx_sites_status ON sites(status);
```

### Domains Table
```sql
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  environment ENUM('production', 'staging', 'development') NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(site_id, domain)
);

CREATE INDEX idx_domains_site ON domains(site_id);
CREATE INDEX idx_domains_domain ON domains(domain);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL, -- bcrypt hash of the key
  key_prefix VARCHAR(20) NOT NULL, -- e.g., 'fls_live_' for display
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  status ENUM('active', 'revoked') DEFAULT 'active'
);

CREATE INDEX idx_api_keys_site ON api_keys(site_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### Activation Sessions Table
```sql
CREATE TABLE activation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP
);

CREATE INDEX idx_activation_sessions_site ON activation_sessions(site_id);
CREATE INDEX idx_activation_sessions_token ON activation_sessions(token_hash);
CREATE INDEX idx_activation_sessions_expires ON activation_sessions(expires_at);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_site ON audit_logs(site_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### Magic Links Table
```sql
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);

CREATE INDEX idx_magic_links_token ON magic_links(token_hash);
CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);
```

---

## 🔐 Authentication Flow

### 1. Magic Link Sign Up / Sign In

```
┌─────────┐         ┌──────────────┐         ┌─────────┐
│ Browser │         │  Flowscope   │         │  Email  │
│         │         │     API      │         │ Service │
└────┬────┘         └──────┬───────┘         └────┬────┘
     │                     │                      │
     │ POST /auth/magic   │                      │
     │─────────────────────>                     │
     │                     │                      │
     │                     │ Generate token       │
     │                     │ Store in DB          │
     │                     │                      │
     │                     │ Send email           │
     │                     │─────────────────────>│
     │                     │                      │
     │ { success: true }  │                      │
     │<─────────────────────                     │
     │                     │                      │
     │                     │        📧 Email with link
     │                     │                      │
     │ Click link         │                      │
     │─────────────────────>                     │
     │ GET /auth/verify?token=xxx                │
     │                     │                      │
     │                     │ Verify token         │
     │                     │ Mark as used         │
     │                     │ Create JWT session   │
     │                     │                      │
     │ Set-Cookie: session │                     │
     │<─────────────────────                     │
     │ Redirect to dashboard                     │
```

### 2. Site Activation Flow

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│ Browser │    │ Client Site  │    │  Flowscope   │
│ Console │    │   (User's)   │    │     API      │
└────┬────┘    └──────┬───────┘    └──────┬───────┘
     │                │                    │
     │ Flowscope.requestActivation()      │
     │────────────────>│                   │
     │                │                    │
     │                │ POST /v1/activate │
     │                │ Headers:           │
     │                │  X-Site-Key: fls_xxx
     │                │  Origin: example.com
     │                │───────────────────>│
     │                │                    │
     │                │                    │ Verify:
     │                │                    │ • API key valid?
     │                │                    │ • Domain allowed?
     │                │                    │ • Site active?
     │                │                    │
     │                │                    │ Generate JWT
     │                │                    │ Log activation
     │                │                    │
     │                │ { token, expires } │
     │                │<───────────────────│
     │                │                    │
     │                │ Activate panel     │
     │<────────────────│                   │
     │ ✅ Activated!   │                   │
```

---

## 🌐 API Endpoints

### Authentication APIs

#### POST /auth/magic
```json
Request:
{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "message": "Magic link sent to your email"
}
```

#### GET /auth/verify?token=xxx
```
Response:
- Sets HTTP-only session cookie
- Redirects to /dashboard or /onboarding
```

#### POST /auth/logout
```json
Response:
{
  "success": true
}
```

### Organization APIs

#### POST /api/organizations
```json
Request:
{
  "name": "Acme Inc",
  "slug": "acme-inc"
}

Response:
{
  "id": "org_...",
  "name": "Acme Inc",
  "slug": "acme-inc",
  "plan": "free",
  "created_at": "2025-10-23T..."
}
```

#### GET /api/organizations
```json
Response:
{
  "organizations": [
    {
      "id": "org_...",
      "name": "Acme Inc",
      "role": "owner",
      "plan": "pro"
    }
  ]
}
```

#### GET /api/organizations/:orgId
```json
Response:
{
  "id": "org_...",
  "name": "Acme Inc",
  "slug": "acme-inc",
  "plan": "pro",
  "members": 5,
  "sites": 3
}
```

### Site APIs

#### POST /api/organizations/:orgId/sites
```json
Request:
{
  "name": "Marketing Website",
  "slug": "marketing-web",
  "description": "Main corporate website"
}

Response:
{
  "id": "site_...",
  "name": "Marketing Website",
  "slug": "marketing-web",
  "api_key": "fls_live_..."
}
```

#### GET /api/organizations/:orgId/sites
```json
Response:
{
  "sites": [
    {
      "id": "site_...",
      "name": "Marketing Website",
      "domains": ["example.com", "www.example.com"],
      "status": "active",
      "created_at": "2025-10-23T..."
    }
  ]
}
```

#### POST /api/sites/:siteId/domains
```json
Request:
{
  "domain": "example.com",
  "environment": "production"
}

Response:
{
  "id": "dom_...",
  "domain": "example.com",
  "environment": "production",
  "verified": false,
  "verification_token": "flowscope-verify-abc123"
}
```

#### POST /api/sites/:siteId/api-keys
```json
Request:
{
  "name": "Production Key",
  "expires_at": "2026-12-31T23:59:59Z"
}

Response:
{
  "id": "key_...",
  "key": "fls_live_abc123...", // Only shown once!
  "name": "Production Key",
  "prefix": "fls_live_abc1...",
  "created_at": "2025-10-23T..."
}
```

### Activation API (Public)

#### POST /v1/activate
```json
Request Headers:
X-Site-Key: fls_live_abc123...
Origin: https://example.com

Request Body:
{
  "user_email": "admin@example.com" // Optional, for audit
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 14400, // seconds (4 hours)
  "expires_at": "2025-10-23T18:00:00Z"
}

Token Payload (JWT):
{
  "sub": "site_...",
  "org": "org_...",
  "domain": "example.com",
  "permissions": ["network.read", "network.export"],
  "iat": 1234567890,
  "exp": 1234581290
}
```

---

## 💻 Client SDK Integration

### Installation

```bash
npm install @flowscope/client
```

### Configuration

```javascript
// In your app initialization
import Flowscope from '@flowscope/client';

Flowscope.init({
  siteKey: 'fls_live_abc123...', // From Flowscope dashboard
  environment: 'production', // or 'staging', 'development'
});
```

### How It Works

```javascript
// User opens console and runs:
await Flowscope.requestActivation();

// Behind the scenes:
// 1. Client sends request to Flowscope Cloud API
// 2. Flowscope verifies:
//    - Site key is valid
//    - Domain matches site's allowed domains
//    - Site is active
// 3. Flowscope generates JWT token
// 4. Token sent back to client
// 5. Client activates panel with token
```

### Advanced Usage

```javascript
Flowscope.init({
  siteKey: process.env.FLOWSCOPE_SITE_KEY,
  environment: process.env.NODE_ENV,
  
  // Auto-activate for specific users
  autoActivate: user.role === 'admin',
  
  // Custom activation UI
  onActivationRequired: () => {
    showCustomActivationModal();
  },
  
  // Track who's debugging
  userContext: {
    id: user.id,
    email: user.email,
    role: user.role,
  },
});
```

---

## 📱 Dashboard Features

### 1. Dashboard Home
- List of organizations
- Quick access to sites
- Recent activity
- Usage metrics

### 2. Organization Settings
- Team members management
- Billing & subscription
- Audit logs
- Organization settings

### 3. Site Management
- Site configuration
- Domain management
- API keys
- Team permissions
- Usage statistics

### 4. Live Sessions
- See active debugging sessions
- Who's debugging where
- Session duration
- Revoke access

### 5. Analytics
- Activation history
- Usage by site
- Most active domains
- Team activity

---

## 🎯 User Onboarding Flow

```
Step 1: Sign Up
├─ Enter email
├─ Receive magic link
└─ Click link → authenticated

Step 2: Create Organization
├─ Organization name
├─ Choose slug (URL-friendly)
└─ Select plan (Free/Pro/Enterprise)

Step 3: Create First Site
├─ Site name (e.g., "Marketing Website")
├─ Add domains
│   ├─ example.com
│   └─ www.example.com
└─ Generate API key

Step 4: Install Client
├─ Copy installation command
├─ Copy site key
└─ Add to your app

Step 5: Verify Installation
├─ Test activation
└─ ✅ Ready to debug!
```

---

## 💰 Pricing Tiers

### Free Tier
- 1 organization
- 2 sites
- 5 team members
- 100 activations/month
- 7-day session history

### Pro Tier ($29/month)
- Unlimited organizations
- Unlimited sites
- Unlimited team members
- Unlimited activations
- 90-day session history
- Priority support

### Enterprise Tier (Custom)
- Everything in Pro
- Custom data retention
- SSO/SAML
- Dedicated support
- Custom SLAs
- On-premise option

---

## 🔒 Security Considerations

### API Key Security
- Keys stored as bcrypt hashes
- Prefix shown for identification
- Full key only shown once at creation
- Automatic rotation options
- Rate limiting per key

### Token Security
- JWT tokens with 4-hour expiry
- Domain-locked in token payload
- Revocable from dashboard
- Audit trail of all activations

### Domain Verification
- TXT record verification
- Automatic revalidation
- Alert on domain changes

### Team Security
- Role-based access control
- 2FA available for Pro/Enterprise
- Session management
- Activity monitoring

---

## 📊 Metrics & Monitoring

### Track
- Activations per site
- Active sessions
- API key usage
- Error rates
- Response times

### Alerts
- Unusual activation patterns
- Failed verification attempts
- API key compromise indicators
- High error rates

---

## 🚀 Next Steps

1. **Backend Development**
   - Set up database
   - Build authentication APIs
   - Create dashboard APIs
   - Implement activation API

2. **Frontend Dashboard**
   - Build signup/login flow
   - Organization management UI
   - Site configuration UI
   - Live sessions view

3. **Client SDK Updates**
   - Add Flowscope Cloud integration
   - Implement activation flow
   - Add user context tracking

4. **Infrastructure**
   - Deploy API servers
   - Set up database
   - Configure email service
   - Set up monitoring

5. **Launch**
   - Beta testing
   - Documentation
   - Marketing website
   - Public launch

This transforms Flowscope from a tool into a **complete SaaS platform**! 🎉

