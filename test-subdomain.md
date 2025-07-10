# Testing Version-Based Subdomain Documentation

This document explains how to test the version-based subdomain documentation system locally.

## Local Testing Setup

### 1. Update /etc/hosts

Add these entries to your `/etc/hosts` file to test subdomains locally:

```
# Latest version (v2) - default when no version specified
127.0.0.1 acme-corp.docs.localhost
127.0.0.1 techflow-solutions.docs.localhost  
127.0.0.1 globaldyne-industries.docs.localhost

# Version 1 (legacy)
127.0.0.1 acme-corp.v1.docs.localhost
127.0.0.1 techflow-solutions.v1.docs.localhost
127.0.0.1 globaldyne-industries.v1.docs.localhost

# Version 2 (latest) - explicit version
127.0.0.1 acme-corp.v2.docs.localhost
127.0.0.1 techflow-solutions.v2.docs.localhost
127.0.0.1 globaldyne-industries.v2.docs.localhost
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test URLs

#### Main Documentation (All Content)
- `http://localhost:3000/docs` - Shows all documentation for all clients and versions

#### Client-Specific Documentation (Latest Version - v2)
- `http://acme-corp.docs.localhost:3000/docs` - Shows only Acme Corp v2.0 content (latest)
- `http://techflow-solutions.docs.localhost:3000/docs` - Shows only TechFlow Solutions v2.0 content (latest)
- `http://globaldyne-industries.docs.localhost:3000/docs` - Shows only GlobalDyne Industries v2.0 content (latest)

#### Client-Specific Documentation (Version 1 - Legacy)
- `http://acme-corp.v1.docs.localhost:3000/docs` - Shows only Acme Corp v1.0 content (legacy)
- `http://techflow-solutions.v1.docs.localhost:3000/docs` - Shows only TechFlow Solutions v1.0 content (legacy)
- `http://globaldyne-industries.v1.docs.localhost:3000/docs` - Shows only GlobalDyne Industries v1.0 content (legacy)

#### Client-Specific Documentation (Version 2 - Explicit Latest)
- `http://acme-corp.v2.docs.localhost:3000/docs` - Shows only Acme Corp v2.0 content (explicit latest)
- `http://techflow-solutions.v2.docs.localhost:3000/docs` - Shows only TechFlow Solutions v2.0 content (explicit latest)
- `http://globaldyne-industries.v2.docs.localhost:3000/docs` - Shows only GlobalDyne Industries v2.0 content (explicit latest)

## Version Differences

### v1.0 (Legacy)
- **Acme Corp**: 3 pages (basic manufacturing processes)
- **TechFlow Solutions**: 3 pages (basic development standards)
- **GlobalDyne Industries**: 3 pages (basic logistics operations)

### v2.0 (Latest)
- **Acme Corp**: 5 pages (advanced manufacturing, API reference)
- **TechFlow Solutions**: 4 pages (modern architecture, deployment procedures)
- **GlobalDyne Industries**: 5 pages (IoT tracking, supplier portal)

## Production URL Structure

In production, the URLs would follow this pattern:

### Latest Version (Default)
- `https://acme-corp.docs.yourdomain.com/docs` → Shows v2.0 content
- `https://techflow-solutions.docs.yourdomain.com/docs` → Shows v2.0 content
- `https://globaldyne-industries.docs.yourdomain.com/docs` → Shows v2.0 content

### Specific Versions
- `https://acme-corp.v1.docs.yourdomain.com/docs` → Shows v1.0 content
- `https://acme-corp.v2.docs.yourdomain.com/docs` → Shows v2.0 content
- `https://techflow-solutions.v1.docs.yourdomain.com/docs` → Shows v1.0 content
- `https://techflow-solutions.v2.docs.yourdomain.com/docs` → Shows v2.0 content

## How It Works

1. **Middleware Detection**: The middleware parses the subdomain to extract:
   - Client name (e.g., `acme-corp`)
   - Version (e.g., `v1`, `v2`, or defaults to `v2` if not specified)
   - Docs identifier (`docs`)

2. **Content Filtering**: The source configuration filters documentation to show only:
   - Content from the specified client folder
   - Content from the specified version subfolder

3. **URL Transformation**: URLs are transformed to remove the client and version prefixes:
   - `/acme-corp/v1/production-systems` becomes `/production-systems` on `acme-corp.v1.docs.domain`
   - `/acme-corp/v2/api-reference` becomes `/api-reference` on `acme-corp.docs.domain`

## Domain Structure

The system now uses the pattern: `clientName.version.docs.domainname`

### Examples:
- **Latest**: `acme-corp.docs.localhost` (no version = latest)
- **Specific**: `acme-corp.v1.docs.localhost` (explicit version)
- **Production**: `acme-corp.v2.docs.yourdomain.com`

## Testing Checklist

- [ ] Main domain shows all content
- [ ] Client subdomains without version show latest (v2) content
- [ ] Client subdomains with v1 show legacy content  
- [ ] Client subdomains with v2 show latest content
- [ ] Navigation tree shows only relevant pages
- [ ] URLs are clean (no client/version prefixes)
- [ ] Page metadata is correct for each version
- [ ] Version toggle appears and works correctly 