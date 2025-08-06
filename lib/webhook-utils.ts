import * as crypto from 'crypto';

/**
 * GitHub Webhook Security and Validation Utilities
 */

export interface WebhookConfig {
  secret: string;
  allowedEvents: string[];
  allowedRepositories?: string[];
  targetBranches: string[];
  targetDirectories: string[];
  fileExtensions: string[];
}

/**
 * Default webhook configuration
 */
export const DEFAULT_WEBHOOK_CONFIG: Omit<WebhookConfig, 'secret'> = {
  allowedEvents: ['push'],
  targetBranches: ['main', 'master', 'v2'],
  targetDirectories: ['content/docs/', 'docs/', 'documentation/'],
  fileExtensions: ['.md', '.mdx'],
};

/**
 * Verify GitHub webhook signature using HMAC SHA-256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // GitHub sends signature in format: "sha256=<hash>"
  if (!signature.startsWith('sha256=')) {
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

/**
 * Validate webhook event type
 */
export function isValidEventType(
  eventType: string,
  allowedEvents: string[] = DEFAULT_WEBHOOK_CONFIG.allowedEvents
): boolean {
  return allowedEvents.includes(eventType);
}

/**
 * Validate repository against allowed list (if configured)
 */
export function isValidRepository(
  repository: string,
  allowedRepositories?: string[]
): boolean {
  if (!allowedRepositories || allowedRepositories.length === 0) {
    return true; // Allow all repositories if none specified
  }
  
  return allowedRepositories.some(allowed => {
    // Support exact match or wildcard patterns
    if (allowed.includes('*')) {
      const regex = new RegExp(allowed.replace(/\*/g, '.*'));
      return regex.test(repository);
    }
    return allowed === repository;
  });
}

/**
 * Validate branch against target branches
 */
export function isValidBranch(
  branch: string,
  targetBranches: string[] = DEFAULT_WEBHOOK_CONFIG.targetBranches
): boolean {
  return targetBranches.includes(branch);
}

/**
 * Check if file should be processed based on path and extension
 */
export function shouldProcessFile(
  filePath: string,
  targetDirectories: string[] = DEFAULT_WEBHOOK_CONFIG.targetDirectories,
  fileExtensions: string[] = DEFAULT_WEBHOOK_CONFIG.fileExtensions
): boolean {
  // Check if file is in target directory
  const isInTargetDir = targetDirectories.some(dir => filePath.startsWith(dir));
  
  // Check if file has target extension
  const hasTargetExtension = fileExtensions.some(ext => 
    filePath.toLowerCase().endsWith(ext.toLowerCase())
  );
  
  return isInTargetDir && hasTargetExtension;
}

/**
 * Extract changed files from GitHub push event that should be processed
 */
export function extractProcessableFiles(commits: Array<{
  added: string[];
  modified: string[];
  removed: string[];
}>, config: Partial<WebhookConfig> = {}): {
  toProcess: string[];
  toDelete: string[];
} {
  const { targetDirectories, fileExtensions } = { ...DEFAULT_WEBHOOK_CONFIG, ...config };
  
  const toProcess = new Set<string>();
  const toDelete = new Set<string>();
  
  commits.forEach(commit => {
    // Process added and modified files
    [...commit.added, ...commit.modified].forEach(filePath => {
      if (shouldProcessFile(filePath, targetDirectories, fileExtensions)) {
        toProcess.add(filePath);
      }
    });
    
    // Track removed files for cleanup
    commit.removed.forEach(filePath => {
      if (shouldProcessFile(filePath, targetDirectories, fileExtensions)) {
        toDelete.add(filePath);
      }
    });
  });
  
  return {
    toProcess: Array.from(toProcess),
    toDelete: Array.from(toDelete)
  };
}

/**
 * Create webhook configuration from environment variables
 */
export function createWebhookConfig(): WebhookConfig {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
  }

  const allowedEvents = process.env.GITHUB_ALLOWED_EVENTS?.split(',') || DEFAULT_WEBHOOK_CONFIG.allowedEvents;
  const allowedRepositories = process.env.GITHUB_ALLOWED_REPOSITORIES?.split(',') || undefined;
  const targetBranches = process.env.GITHUB_TARGET_BRANCHES?.split(',') || DEFAULT_WEBHOOK_CONFIG.targetBranches;
  const targetDirectories = process.env.GITHUB_TARGET_DIRECTORIES?.split(',') || DEFAULT_WEBHOOK_CONFIG.targetDirectories;
  const fileExtensions = process.env.GITHUB_FILE_EXTENSIONS?.split(',') || DEFAULT_WEBHOOK_CONFIG.fileExtensions;

  return {
    secret,
    allowedEvents,
    allowedRepositories,
    targetBranches,
    targetDirectories,
    fileExtensions,
  };
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if client is within rate limits
   */
  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests outside the window
    const recentRequests = clientRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    );
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);
    
    return true;
  }

  /**
   * Get remaining requests for client
   */
  getRemaining(clientId: string): number {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    const recentRequests = clientRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    );
    
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  /**
   * Clear rate limit data for client
   */
  clear(clientId: string): void {
    this.requests.delete(clientId);
  }
}

/**
 * Validate GitHub webhook payload structure
 */
export function validateGitHubPayload(payload: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check required fields
  if (!payload.repository) {
    errors.push('Missing repository information');
  } else {
    if (!payload.repository.full_name) {
      errors.push('Missing repository full_name');
    }
  }
  
  if (!payload.ref) {
    errors.push('Missing ref (branch) information');
  }
  
  if (!payload.head_commit) {
    errors.push('Missing head_commit information');
  } else {
    if (!payload.head_commit.id) {
      errors.push('Missing commit SHA');
    }
  }
  
  if (!Array.isArray(payload.commits)) {
    errors.push('Missing or invalid commits array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Security headers for webhook responses
 */
export const WEBHOOK_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

/**
 * Create secure response headers
 */
export function createSecureHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    ...WEBHOOK_SECURITY_HEADERS,
    ...additionalHeaders,
  };
}

/**
 * Parse client folder and version from file path
 */
export function parseClientFromPath(filePath: string): { clientFolder?: string; version?: string } {
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