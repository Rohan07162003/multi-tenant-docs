import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { processGitHubPushEvent, GitHubPushEvent } from '@/lib/github-processor';

// Verify GitHub webhook signature
function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const expectedSignature = 'sha256=' + hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Extract file paths that should be processed (only .md/.mdx files in target directories)
function extractTargetFiles(commits: GitHubPushEvent['commits']): string[] {
  const targetFiles = new Set<string>();
  
  // Target directories for documentation
  const targetDirs = ['content/docs/', 'docs/', 'documentation/'];
  
  commits.forEach(commit => {
    // Process added and modified files
    [...commit.added, ...commit.modified].forEach(filePath => {
      // Check if file is in target directory and is markdown
      const isInTargetDir = targetDirs.some(dir => filePath.startsWith(dir));
      const isMarkdown = /\.(md|mdx)$/i.test(filePath);
      
      if (isInTargetDir && isMarkdown) {
        targetFiles.add(filePath);
      }
    });
  });
  
  return Array.from(targetFiles);
}

// Parse client folder from file path
function parseClientFromPath(filePath: string): { clientFolder?: string; version?: string } {
  // Match patterns like: content/docs/client-name/v1/filename.mdx
  const match = filePath.match(/(?:content\/docs|docs|documentation)\/([^\/]+)\/?(v\d+)?/);
  
  if (match) {
    return {
      clientFolder: match[1],
      version: match[2] || undefined
    };
  }
  
  return {};
}

export async function POST(request: NextRequest) {
  try {
    // Verify this is a GitHub webhook
    const githubEvent = request.headers.get('x-github-event');
    const githubSignature = request.headers.get('x-hub-signature-256');
    
    if (!githubEvent) {
      return NextResponse.json(
        { error: 'Missing GitHub event header' },
        { status: 400 }
      );
    }

    // Get webhook secret from environment
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('GITHUB_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get request body
    const body = await request.text();
    
    // Verify signature
    if (!verifyGitHubSignature(body, githubSignature, webhookSecret)) {
      console.error('Invalid GitHub webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the payload - GitHub can send as JSON or form-encoded
    let payload: GitHubPushEvent;
    try {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // GitHub sends form-encoded data with JSON in 'payload' field
        const formData = new URLSearchParams(body);
        const payloadStr = formData.get('payload');
        if (!payloadStr) {
          throw new Error('No payload field in form data');
        }
        payload = JSON.parse(payloadStr);
      } else {
        // Assume JSON content
        payload = JSON.parse(body);
      }
    } catch (error) {
      console.error('Invalid payload format:', error);
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 }
      );
    }

    // Only process push events to main/master branch
    if (githubEvent !== 'push') {
      console.log(`Ignoring ${githubEvent} event`);
      return NextResponse.json({ message: `Ignored ${githubEvent} event` });
    }

    const branch = payload.ref.replace('refs/heads/', '');
    const defaultBranch = payload.repository.default_branch || 'main';
    
    if (branch !== defaultBranch) {
      console.log(`Ignoring push to ${branch} branch (not ${defaultBranch})`);
      return NextResponse.json({ 
        message: `Ignored push to ${branch} branch` 
      });
    }

    console.log('GitHub webhook - Processing push event:', {
      repository: payload.repository.full_name,
      branch,
      commits: payload.commits.length,
      headCommit: payload.head_commit?.id?.substring(0, 7)
    });

    // Extract target files from all commits
    const targetFiles = extractTargetFiles(payload.commits);
    
    if (targetFiles.length === 0) {
      console.log('No markdown files in target directories found');
      return NextResponse.json({ 
        message: 'No documentation files to process' 
      });
    }

    console.log('GitHub webhook - Found target files:', targetFiles);

    // Group files by client for organized processing
    const filesByClient = targetFiles.reduce((acc, filePath) => {
      const { clientFolder } = parseClientFromPath(filePath);
      const client = clientFolder || 'unknown';
      
      if (!acc[client]) {
        acc[client] = [];
      }
      acc[client].push(filePath);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('GitHub webhook - Files grouped by client:', 
      Object.keys(filesByClient).map(client => `${client}: ${filesByClient[client].length} files`)
    );

    // Process the push event
    const result = await processGitHubPushEvent({
      repository: payload.repository,
      headCommit: payload.head_commit,
      targetFiles,
      filesByClient
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully processed GitHub push event',
      result
    });

  } catch (error) {
    console.error('GitHub webhook error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false 
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    message: 'GitHub Webhook Handler',
    status: 'ready',
    supportedEvents: ['push'],
    requiredHeaders: ['x-github-event', 'x-hub-signature-256'],
    targetDirectories: ['content/docs/', 'docs/', 'documentation/'],
    fileTypes: ['.md', '.mdx']
  });
} 