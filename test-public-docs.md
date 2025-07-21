# Public Documentation Routing Test

This document explains the new public documentation routing functionality that has been added to the fumadocs setup.

## What was Added

### 1. Public Folder Structure
```
content/docs/public/
├── v1/
│   ├── index.mdx
│   ├── meta.json
│   ├── quick-start.mdx
│   └── api-reference.mdx
└── v2/
    ├── index.mdx
    ├── meta.json
    ├── quick-start.mdx
    └── api-reference.mdx
```

### 2. Middleware Updates
- Updated `middleware.ts` to detect `docs.localhost` (or `docs.domain`) pattern
- When detected, routes to the `public` folder instead of client-specific folders
- Special case: `docs.localhost` → `clientFolder: 'public'`

### 3. Routing Logic
- `http://docs.localhost:3000/docs` → Shows **public v2** (latest version)
- `http://public.v1.docs.localhost:3000/docs` → Shows **public v1** (explicit version)
- `http://public.v2.docs.localhost:3000/docs` → Shows **public v2** (explicit latest)

## Test URLs

### Version 2 (Latest) - Default
- `http://docs.localhost:3000/docs` → Public v2.0 Home
- `http://docs.localhost:3000/docs/quick-start` → Quick Start Guide v2.0
- `http://docs.localhost:3000/docs/api-reference` → API Reference v2.0

### Version 1 (Legacy) - Explicit
- `http://public.v1.docs.localhost:3000/docs` → Public v1.0 Home
- `http://public.v1.docs.localhost:3000/docs/quick-start` → Quick Start Guide v1.0
- `http://public.v1.docs.localhost:3000/docs/api-reference` → API Reference v1.0

### Version 2 (Latest) - Explicit
- `http://public.v2.docs.localhost:3000/docs` → Public v2.0 Home (same as docs.localhost)

## Content Differences

### v1.0 Features
- Basic API documentation
- Simple getting started guides
- Essential developer resources
- Basic REST API with simple endpoints

### v2.0 Features (Enhanced)
- Enhanced API documentation with interactive examples
- Advanced developer tools and SDKs
- Real-time API testing capabilities
- Batch operations and webhooks
- OAuth 2.0 support
- GraphQL API support
- Expanded tutorial content
- Community contributions section

## Testing Commands

```bash
# Test v2 (default/latest)
curl -s "http://docs.localhost:3000/docs" | grep -o '<title>.*</title>'
# Expected: <title>Public Documentation v2.0</title>

# Test v1 (explicit)
curl -s "http://public.v1.docs.localhost:3000/docs" | grep -o '<title>.*</title>'
# Expected: <title>Public Documentation v1.0</title>

# Test specific pages
curl -s "http://docs.localhost:3000/docs/api-reference" | grep -o '<title>.*</title>'
# Expected: <title>API Reference v2.0</title>

curl -s "http://public.v1.docs.localhost:3000/docs/api-reference" | grep -o '<title>.*</title>'
# Expected: <title>API Reference v1.0</title>
```

## hosts File Entries Required

Add these to your `/etc/hosts` file:

```
127.0.0.1 docs.localhost
127.0.0.1 public.v1.docs.localhost
```

## File Changes Made

### 1. middleware.ts
- Added special case for `docs.localhost` pattern
- Routes to `public` folder when pattern matches

### 2. content/docs/public/
- Created complete v1 and v2 documentation structures
- Added comprehensive example content showing version differences

### 3. API Route Fixes
- Fixed TypeScript errors in `app/api/users/[id]/route.ts` for Next.js 15 compatibility

## Usage in Production

In production, this would work with real domains:

- `https://docs.yourdomain.com/docs` → Public v2 documentation
- `https://public.v1.docs.yourdomain.com/docs` → Public v1 documentation
- `https://public.v2.docs.yourdomain.com/docs` → Public v2 documentation (explicit)

This provides a clean way to serve public documentation while maintaining the existing client-specific subdomain routing for private/client-specific docs. 