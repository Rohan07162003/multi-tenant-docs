# GitHub Webhook Integration Setup

This guide walks you through setting up automatic documentation indexing when commits are pushed to your GitHub repositories.

## Overview

The GitHub webhook integration automatically:
1. Receives push notifications from GitHub
2. Fetches changed `.md`/`.mdx` files from target directories
3. Processes and indexes them using Gemini embeddings
4. Stores them in client-specific Firestore collections
5. Makes them available for search in your multi-query RAG system

## Prerequisites

Before setting up the GitHub webhook integration, ensure you have:

- ✅ Firestore database configured and running
- ✅ Gemini API key configured (`GEMINI_API_KEY`)
- ✅ GitHub repository with documentation files
- ✅ GitHub account with repository access
- ✅ Server/hosting platform that can receive webhooks

## Step 1: Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# GitHub Integration (Required)
GITHUB_ACCESS_TOKEN=ghp_your_github_personal_access_token_here
GITHUB_WEBHOOK_SECRET=your_secure_random_secret_here

# GitHub Integration (Optional - with defaults)
GITHUB_ALLOWED_EVENTS=push
GITHUB_TARGET_BRANCHES=main,master
GITHUB_TARGET_DIRECTORIES=content/docs/,docs/,documentation/
GITHUB_FILE_EXTENSIONS=.md,.mdx
GITHUB_ALLOWED_REPOSITORIES=your-org/*,your-org/specific-repo
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_ACCESS_TOKEN` | GitHub Personal Access Token with repo permissions | `ghp_1234567890abcdef` |
| `GITHUB_WEBHOOK_SECRET` | Secure secret for webhook signature verification | `your-random-secret-here` |

### Optional Variables (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_ALLOWED_EVENTS` | `push` | Comma-separated list of GitHub events to process |
| `GITHUB_TARGET_BRANCHES` | `main,master` | Branches that trigger indexing |
| `GITHUB_TARGET_DIRECTORIES` | `content/docs/,docs/,documentation/` | Directories to monitor for changes |
| `GITHUB_FILE_EXTENSIONS` | `.md,.mdx` | File extensions to process |
| `GITHUB_ALLOWED_REPOSITORIES` | (none - all allowed) | Repository patterns to allow |

## Step 2: Create GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set expiration and select scopes:
   - ✅ `repo` (Full repository access)
   - ✅ `read:org` (if using organization repositories)
4. Click "Generate token"
5. **Important**: Copy the token immediately and save it securely
6. Add it to your `.env.local` as `GITHUB_ACCESS_TOKEN`

## Step 3: Generate Webhook Secret

Create a secure random secret for webhook signature verification:

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add this secret to your `.env.local` as `GITHUB_WEBHOOK_SECRET`.

## Step 4: Deploy Your Application

Deploy your application to a platform that can receive webhooks:

- **Vercel**: Automatic HTTPS and global edge network
- **Netlify**: Built-in webhook handling
- **Railway**: Simple deployment with HTTPS
- **Your VPS**: Ensure HTTPS is configured

Note your webhook URL: `https://your-domain.com/api/github-webhook`

## Step 5: Configure GitHub Webhook

### Option A: Using GitHub Web Interface

1. Go to your repository on GitHub
2. Click **Settings** > **Webhooks** > **Add webhook**
3. Configure the webhook:
   - **Payload URL**: `https://your-domain.com/api/github-webhook`
   - **Content type**: `application/json`
   - **Secret**: The same secret from your `GITHUB_WEBHOOK_SECRET`
   - **Events**: Select "Just the push event"
   - **Active**: ✅ Checked
4. Click **Add webhook**

### Option B: Using GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Add webhook using CLI
gh api repos/YOUR_USERNAME/YOUR_REPO/hooks \
  --method POST \
  --field name='web' \
  --field active=true \
  --field config.url='https://your-domain.com/api/github-webhook' \
  --field config.content_type='application/json' \
  --field config.secret='your_webhook_secret_here' \
  --field events[]='push'
```

### Option C: Using curl

```bash
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/hooks \
  -d '{
    "name": "web",
    "active": true,
    "events": ["push"],
    "config": {
      "url": "https://your-domain.com/api/github-webhook",
      "content_type": "application/json",
      "secret": "your_webhook_secret_here"
    }
  }'
```

## Step 6: Test the Integration

### Test 1: Health Check

Test that the webhook endpoint is accessible:

```bash
curl https://your-domain.com/api/github-webhook
```

Expected response:
```json
{
  "message": "GitHub Webhook Handler",
  "status": "ready",
  "supportedEvents": ["push"],
  "requiredHeaders": ["x-github-event", "x-hub-signature-256"],
  "targetDirectories": ["content/docs/", "docs/", "documentation/"],
  "fileTypes": [".md", ".mdx"]
}
```

### Test 2: Make a Documentation Change

1. Add or modify a `.md` or `.mdx` file in your target directory:

```markdown
---
title: Test Document
description: Testing automatic indexing
---

# Test Document

This is a test document to verify that the GitHub webhook integration is working correctly.

The system should automatically:
1. Detect this file change
2. Fetch the content from GitHub
3. Process and chunk the content
4. Generate embeddings using Gemini
5. Store in Firestore
6. Make it available for search
```

2. Commit and push to your main branch:

```bash
git add content/docs/test-document.md
git commit -m "Add test document for webhook integration"
git push origin main
```

3. Check your application logs for processing activity
4. Verify the document appears in search results

## Directory Structure and Client Mapping

The system automatically maps file paths to client collections:

```
content/docs/acme-corp/v1/api-guide.md
└── Client: acme-corp
    └── Version: v1
    └── Collection: acme-corp_chunks

content/docs/public/v2/quick-start.md
└── Client: public
    └── Version: v2
    └── Collection: public_chunks

docs/globaldyne-industries/warehouse-ops.md
└── Client: globaldyne-industries
    └── Version: (none)
    └── Collection: globaldyne-industries_chunks
```

## Monitoring and Troubleshooting

### Check Webhook Deliveries

1. Go to your GitHub repository
2. Click **Settings** > **Webhooks**
3. Click on your webhook
4. Review **Recent Deliveries** tab for:
   - ✅ Successful deliveries (200 status)
   - ❌ Failed deliveries with error details

### Common Issues

#### Webhook Returns 401 Unauthorized
- **Cause**: Invalid webhook secret
- **Fix**: Ensure `GITHUB_WEBHOOK_SECRET` matches GitHub webhook configuration

#### Webhook Returns 500 Internal Server Error
- **Cause**: Missing environment variables or API errors
- **Fix**: Check logs for specific error messages

#### Files Not Being Indexed
- **Cause**: Files not in target directories or wrong extensions
- **Fix**: Verify file paths match `GITHUB_TARGET_DIRECTORIES` and `GITHUB_FILE_EXTENSIONS`

#### GitHub API Rate Limits
- **Cause**: Too many requests to GitHub API
- **Fix**: The system includes automatic rate limiting, but check your GitHub token limits

### Debug Commands

Check GitHub API rate limits:
```bash
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

Test file content fetching:
```bash
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  "https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/contents/content/docs/your-file.md"
```

## Security Considerations

1. **Webhook Secret**: Always use a strong, random secret for webhook signature verification
2. **GitHub Token**: Use minimal required permissions (repo access only)
3. **Environment Variables**: Never commit secrets to version control
4. **HTTPS**: Always use HTTPS for webhook URLs
5. **Repository Restrictions**: Configure `GITHUB_ALLOWED_REPOSITORIES` to limit access

## Performance Optimization

The system includes several optimizations:

1. **Rate Limiting**: Automatic delays between API requests
2. **Batch Processing**: Processes multiple files efficiently
3. **Deduplication**: Avoids processing unchanged content
4. **Client-Specific Collections**: Optimized search performance

## Multiple Repositories

To set up webhooks for multiple repositories:

1. **Option A**: Configure each repository individually with the same webhook URL
2. **Option B**: Use GitHub organization webhooks for all repositories
3. **Option C**: Use `GITHUB_ALLOWED_REPOSITORIES` to control access

Example for organization webhook:
```bash
gh api orgs/YOUR_ORG/hooks \
  --method POST \
  --field name='web' \
  --field active=true \
  --field config.url='https://your-domain.com/api/github-webhook' \
  --field config.content_type='application/json' \
  --field config.secret='your_webhook_secret_here' \
  --field events[]='push'
```

## Next Steps

After successful setup:

1. **Monitor Performance**: Check Firestore for indexed documents
2. **Test Search**: Verify documents appear in search results
3. **Scale**: Add more repositories as needed
4. **Customize**: Adjust target directories and file patterns
5. **Analytics**: Monitor webhook delivery success rates

## Support

If you encounter issues:

1. Check the **Recent Deliveries** in GitHub webhook settings
2. Review application logs for error messages
3. Verify all environment variables are correctly set
4. Test the GitHub API token permissions
5. Ensure Firestore collections are accessible

For additional help, check the application logs and GitHub webhook delivery details for specific error messages. 