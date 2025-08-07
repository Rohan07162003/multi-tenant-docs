import { inngest } from './inngest';
import { processGitHubPushEvent, GitHubPushEvent } from './github-processor';

/**
 * Inngest function to process GitHub webhook events
 * This handles the webhook processing asynchronously with built-in retries
 */
export const githubWebhookProcessor = inngest.createFunction(
  { 
    id: 'github-webhook-processor',
    name: 'GitHub Webhook Processor',
    retries: 3,
  },
  { event: 'github/push' },
  async ({ event, step }) => {
    console.log('🚀 Processing GitHub webhook via Inngest:', {
      repository: event.data.repository?.full_name,
      commits: event.data.commits?.length,
      branch: event.data.ref
    });

    // Step 1: Validate the webhook payload
    const validationResult = await step.run('validate-webhook', async () => {
      if (!event.data.repository || !event.data.commits) {
        throw new Error('Invalid webhook payload: missing repository or commits');
      }
      
      return {
        repository: event.data.repository.full_name,
        commitsCount: event.data.commits.length,
        branch: event.data.ref,
        headCommit: event.data.head_commit
      };
    });

    // Step 2: Extract and process target files
    const processedData = await step.run('extract-target-files', async () => {
      const githubPayload = event.data as GitHubPushEvent;
      
      // Extract target files from commits using webhook-utils
      const { extractProcessableFiles, parseClientFromPath } = await import('./webhook-utils');
      const { toProcess: targetFiles } = extractProcessableFiles(githubPayload.commits);
      
      if (targetFiles.length === 0) {
        return {
          repository: githubPayload.repository,
          headCommit: githubPayload.head_commit,
          targetFiles: [] as string[],
          filesByClient: {} as Record<string, string[]>,
          hasFiles: false
        };
      }

      // Group files by client for organized processing
      const filesByClient = targetFiles.reduce((acc: Record<string, string[]>, filePath: string) => {
        const { clientFolder } = parseClientFromPath(filePath);
        const client = clientFolder || 'unknown';
        
        if (!acc[client]) {
          acc[client] = [];
        }
        acc[client].push(filePath);
        return acc;
      }, {});

      return {
        repository: githubPayload.repository,
        headCommit: githubPayload.head_commit,
        targetFiles,
        filesByClient,
        hasFiles: true
      };
    });

    // Skip processing if no files to process
    if (!processedData.hasFiles) {
      return {
        message: 'No documentation files to process',
        repository: validationResult.repository,
        result: { filesProcessed: 0, filesIndexed: 0, filesSkipped: 0, errors: [], clientsUpdated: [] }
      };
    }

    // Step 3: Process the GitHub push event
    const processingResult = await step.run('process-github-push', async () => {
      return await processGitHubPushEvent({
        repository: processedData.repository,
        headCommit: processedData.headCommit,
        targetFiles: processedData.targetFiles,
        filesByClient: processedData.filesByClient
      });
    });

    // Step 3: Log the results
    await step.run('log-results', async () => {
      console.log('✅ GitHub webhook processing completed:', {
        repository: validationResult.repository,
        filesProcessed: processingResult.filesProcessed,
        filesIndexed: processingResult.filesIndexed,
        clientsUpdated: processingResult.clientsUpdated,
        errors: processingResult.errors
      });

      return {
        success: true,
        summary: {
          repository: validationResult.repository,
          ...processingResult
        }
      };
    });

    return {
      message: 'GitHub webhook processed successfully',
      repository: validationResult.repository,
      result: processingResult
    };
  }
);

/**
 * Manual trigger function for testing GitHub webhook processing
 * You can use this to test the workflow without actual GitHub webhooks
 */
export const testGithubWebhook = inngest.createFunction(
  { 
    id: 'test-github-webhook',
    name: 'Test GitHub Webhook'
  },
  { event: 'test/github-webhook' },
  async ({ event, step }) => {
    console.log('🧪 Testing GitHub webhook processing:', event.data);

    // Send a test event to the main processor
    await step.sendEvent('trigger-webhook-processing', {
      name: 'github/push',
      data: event.data
    });

    return { message: 'Test webhook event triggered successfully' };
  }
);

// Export all functions for the Inngest serve handler
export const functions = [
  githubWebhookProcessor,
  testGithubWebhook
]; 