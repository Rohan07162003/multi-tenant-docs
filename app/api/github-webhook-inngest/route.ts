import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest';
import { verifyWebhookSignature, isValidEventType, isValidBranch } from '@/lib/webhook-utils';
import { GitHubPushEvent } from '@/lib/github-processor';

/**
 * Inngest-powered GitHub Webhook Handler
 * Receives GitHub webhooks and sends them to Inngest for async processing
 */
export async function POST(request: NextRequest) {
  console.log('📥 GitHub webhook received (Inngest version)');

  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');

    // Verify webhook signature
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      console.error('GITHUB_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    if (!verifyWebhookSignature(body, signature, secret)) {
      console.error('Invalid GitHub webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Validate event type
    if (!isValidEventType(event || '', ['push'])) {
      console.log(`Ignoring ${event} event (not in allowed events)`);
      return NextResponse.json({ 
        message: `Event ${event} ignored` 
      });
    }

    // Parse the payload
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
        // Assume JSON payload
        payload = JSON.parse(body);
      }
    } catch (error) {
      console.error('Invalid webhook payload:', error);
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 }
      );
    }

    // Validate branch
    const branch = payload.ref?.replace('refs/heads/', '') || '';
    if (!isValidBranch(branch, ['main', 'master', 'v2'])) {
      console.log(`Ignoring push to ${branch} branch`);
      return NextResponse.json({ 
        message: `Ignored push to ${branch} branch` 
      });
    }

    console.log('✅ GitHub webhook validated, sending to Inngest:', {
      repository: payload.repository.full_name,
      branch,
      commits: payload.commits.length,
      headCommit: payload.head_commit?.id?.substring(0, 7)
    });

    // Send event to Inngest for async processing
    await inngest.send({
      name: 'github/push',
      data: payload,
      user: {
        external_id: payload.repository.full_name,
        email: payload.head_commit?.author?.email,
      },
    });

    return NextResponse.json({
      message: 'Webhook received and queued for processing',
      repository: payload.repository.full_name,
      commits: payload.commits.length,
      status: 'queued'
    });

  } catch (error) {
    console.error('GitHub webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for webhook testing
 */
export async function GET() {
  return NextResponse.json({
    message: 'GitHub Webhook Handler (Inngest-powered)',
    status: 'ready',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: '/api/github-webhook-inngest',
      inngest: '/api/inngest'
    }
  });
} 