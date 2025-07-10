# Testing Subdomain-Based Documentation

This document explains how to test the subdomain-based documentation system locally.

## Local Testing Setup

### 1. Update /etc/hosts

Add these entries to your `/etc/hosts` file to test subdomains locally:

```
127.0.0.1 acme-corp.localhost
127.0.0.1 techflow-solutions.localhost
127.0.0.1 globaldyne-industries.localhost
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test URLs

#### Main Documentation (All Content)
- `http://localhost:3000/docs` - Shows all documentation

#### Client-Specific Documentation
- `http://acme-corp.localhost:3000/docs` - Shows only Acme Corp content
- `http://techflow-solutions.localhost:3000/docs` - Shows only TechFlow Solutions content  
- `http://globaldyne-industries.localhost:3000/docs` - Shows only GlobalDyne Industries content

## How It Works

### Subdomain = Folder Name
The system now uses a simple 1:1 mapping where the subdomain directly corresponds to the folder name in `content/docs/`:

- `acme-corp.domain.com` → `content/docs/acme-corp/`
- `techflow-solutions.domain.com` → `content/docs/techflow-solutions/`
- `globaldyne-industries.domain.com` → `content/docs/globaldyne-industries/`

### URL Structure
When accessing client-specific subdomains, the URLs are clean:
- `acme-corp.localhost:3000/docs/production-systems` (instead of `/docs/acme-corp/production-systems`)
- `techflow-solutions.localhost:3000/docs/development-standards`
- `globaldyne-industries.localhost:3000/docs/warehouse-operations`

### Navigation
Each subdomain shows only the content for that specific client in the navigation sidebar.

## Production Setup

For production, set up DNS records:
- `acme-corp.yourdomain.com` → Your server
- `techflow-solutions.yourdomain.com` → Your server
- `globaldyne-industries.yourdomain.com` → Your server

The middleware will automatically handle routing based on the subdomain. 