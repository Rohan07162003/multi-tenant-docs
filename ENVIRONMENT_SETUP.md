# Environment Variables Setup

Copy the environment variables below to your `.env.local` file and replace the placeholder values with your actual credentials.

## Required Environment Variables

```bash
# =============================================================================
# CORE CONFIGURATION
# =============================================================================

# Next.js Environment
NODE_ENV=development

# =============================================================================
# GEMINI AI CONFIGURATION (Required)
# =============================================================================

# Gemini API Key for embeddings and LLM
# Get from: https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key_here

# =============================================================================
# FIREBASE/FIRESTORE CONFIGURATION (Required)
# =============================================================================

# Firebase Project ID
FIREBASE_PROJECT_ID=your_firebase_project_id_here

# Firebase Service Account Key (JSON format, optional if using default credentials)
# For local development, create a service account key and paste the JSON here
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your_project","private_key_id":"..."}

# =============================================================================
# GITHUB WEBHOOK INTEGRATION (Required for automatic indexing)
# =============================================================================

# GitHub Personal Access Token with repo permissions
# Get from: https://github.com/settings/tokens
GITHUB_ACCESS_TOKEN=ghp_your_github_personal_access_token_here

# Secure secret for webhook signature verification
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GITHUB_WEBHOOK_SECRET=your_secure_random_secret_here

# =============================================================================
# INNGEST CONFIGURATION (For Production Webhooks - Optional)
# =============================================================================

# Inngest Event Key for sending events (get from https://app.inngest.com/)
# Only needed if using Inngest for production webhook processing
INNGEST_EVENT_KEY=your_inngest_event_key_here

# Inngest Signing Key for webhook verification (get from https://app.inngest.com/)
# Used to verify Inngest webhook requests in production
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
```

## Optional Environment Variables (with defaults)

```bash
# =============================================================================
# GITHUB WEBHOOK CONFIGURATION (Optional - with sensible defaults)
# =============================================================================

# Events to process (comma-separated)
# Default: push
GITHUB_ALLOWED_EVENTS=push

# Branches that trigger indexing (comma-separated)  
# Default: main,master
GITHUB_TARGET_BRANCHES=main,master

# Directories to monitor for documentation changes (comma-separated)
# Default: content/docs/,docs/,documentation/
GITHUB_TARGET_DIRECTORIES=content/docs/,docs/,documentation/

# File extensions to process (comma-separated)
# Default: .md,.mdx
GITHUB_FILE_EXTENSIONS=.md,.mdx

# Repository patterns to allow (comma-separated, supports wildcards)
# Leave empty to allow all repositories
# Examples: your-org/*,your-org/specific-repo,user/repo
GITHUB_ALLOWED_REPOSITORIES=

# =============================================================================
# APPLICATION CONFIGURATION (Optional)
# =============================================================================

# Base URL for display URLs (used in development)
# Default: http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Production domain for display URLs
# Example: https://docs.yourdomain.com
NEXT_PUBLIC_PRODUCTION_DOMAIN=https://docs.yourdomain.com
```

## Setup Instructions

1. **Copy to .env.local**: Create a `.env.local` file in your project root and copy the above variables
2. **Replace Placeholders**: Update all `your_*_here` values with your actual credentials
3. **Secure Storage**: Never commit `.env.local` to version control
4. **Restart Application**: Restart your Next.js application after making changes

## Getting the Required Values

### Gemini API Key
1. Go to [Google AI Studio](https://ai.google.dev/)
2. Create a new API key
3. Copy the key to `GEMINI_API_KEY`

### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create or select your project
3. Get the Project ID for `FIREBASE_PROJECT_ID`
4. For service account key: Go to Project Settings > Service Accounts > Generate new private key

### GitHub Access Token
1. Go to [GitHub Settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select `repo` scope for repository access
4. Copy the token to `GITHUB_ACCESS_TOKEN`

### GitHub Webhook Secret
Generate a secure random secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `GITHUB_WEBHOOK_SECRET`.

## Validation

After setting up environment variables, you can test the configuration:

```bash
# Test Gemini API connection
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'

# Test GitHub API connection
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/user

# Test Firebase connection (if using service account)
# This requires the Firebase Admin SDK to be initialized in your app
```

## Security Notes

- **Never commit** `.env.local` or any environment files to version control
- **Use strong secrets** for webhook verification
- **Limit GitHub token permissions** to only what's needed (repo access)
- **Rotate tokens regularly** as a security best practice
- **Use HTTPS** for all webhook URLs in production 