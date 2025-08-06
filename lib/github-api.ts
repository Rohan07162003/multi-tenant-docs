/**
 * GitHub API Client for fetching repository content and diffs
 * Uses GitHub REST API v4 for file operations
 */

export class GitHubApiClient {
  private baseUrl = 'https://api.github.com';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Fumadocs-Webhook-Bot/1.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API request failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    return response;
  }

  /**
   * Get file content from repository at specific commit
   */
  async getFileContent(
    repository: string,
    filePath: string,
    ref: string = 'main'
  ): Promise<string | null> {
    try {
      const endpoint = `/repos/${repository}/contents/${encodeURIComponent(filePath)}?ref=${ref}`;
      const response = await this.makeRequest(endpoint);
      const data = await response.json();

      // GitHub returns file content base64 encoded
      if (data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      console.error(`Error fetching file content for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get diff between two commits for a specific file
   */
  async getFileDiff(
    repository: string,
    filePath: string,
    baseSha: string,
    headSha: string
  ): Promise<string | null> {
    try {
      // Use the compare endpoint to get diff
      const endpoint = `/repos/${repository}/compare/${baseSha}...${headSha}`;
      const response = await this.makeRequest(endpoint, {
        headers: {
          'Accept': 'application/vnd.github.v3.diff',
        },
      });

      const diffText = await response.text();
      
      // Extract diff for specific file from the full diff
      const fileDiff = this.extractFileDiff(diffText, filePath);
      return fileDiff;
    } catch (error) {
      console.error(`Error fetching diff for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get commit information
   */
  async getCommit(repository: string, sha: string): Promise<any> {
    try {
      const endpoint = `/repos/${repository}/commits/${sha}`;
      const response = await this.makeRequest(endpoint);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching commit ${sha}:`, error);
      return null;
    }
  }

  /**
   * Get repository information
   */
  async getRepository(repository: string): Promise<any> {
    try {
      const endpoint = `/repos/${repository}`;
      const response = await this.makeRequest(endpoint);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching repository ${repository}:`, error);
      return null;
    }
  }

  /**
   * Check if file exists in repository
   */
  async fileExists(
    repository: string,
    filePath: string,
    ref: string = 'main'
  ): Promise<boolean> {
    try {
      const endpoint = `/repos/${repository}/contents/${encodeURIComponent(filePath)}?ref=${ref}`;
      const response = await this.makeRequest(endpoint);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract diff for a specific file from full diff text
   */
  private extractFileDiff(fullDiff: string, filePath: string): string | null {
    const lines = fullDiff.split('\n');
    const fileDiffLines: string[] = [];
    let inTargetFile = false;
    
    for (const line of lines) {
      // Look for file header
      if (line.startsWith('diff --git') && line.includes(filePath)) {
        inTargetFile = true;
        fileDiffLines.push(line);
        continue;
      }
      
      // Stop when we hit another file's diff
      if (inTargetFile && line.startsWith('diff --git') && !line.includes(filePath)) {
        break;
      }
      
      // Collect lines for target file
      if (inTargetFile) {
        fileDiffLines.push(line);
      }
    }
    
    return fileDiffLines.length > 0 ? fileDiffLines.join('\n') : null;
  }

  /**
   * Get list of files changed in a commit
   */
  async getCommitFiles(repository: string, sha: string): Promise<{
    filename: string;
    status: 'added' | 'modified' | 'removed';
    changes: number;
    additions: number;
    deletions: number;
  }[]> {
    try {
      const endpoint = `/repos/${repository}/commits/${sha}`;
      const response = await this.makeRequest(endpoint);
      const commit = await response.json();
      
      return commit.files || [];
    } catch (error) {
      console.error(`Error fetching commit files for ${sha}:`, error);
      return [];
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(): Promise<any> {
    try {
      const endpoint = '/rate_limit';
      const response = await this.makeRequest(endpoint);
      return await response.json();
    } catch (error) {
      console.error('Error fetching rate limit:', error);
      return null;
    }
  }
}

/**
 * Convenience function to fetch file content
 */
export async function fetchGitHubFileContent(
  client: GitHubApiClient,
  repository: string,
  filePath: string,
  ref: string = 'main'
): Promise<string | null> {
  return await client.getFileContent(repository, filePath, ref);
}

/**
 * Convenience function to fetch file diff
 */
export async function fetchGitHubFileDiff(
  client: GitHubApiClient,
  repository: string,
  filePath: string,
  baseSha: string,
  headSha: string
): Promise<string | null> {
  return await client.getFileDiff(repository, filePath, baseSha, headSha);
}

/**
 * Utility to check GitHub API rate limits
 */
export async function checkGitHubRateLimit(token: string): Promise<{
  remaining: number;
  limit: number;
  resetTime: Date;
}> {
  const client = new GitHubApiClient(token);
  const rateLimit = await client.getRateLimit();
  
  if (!rateLimit) {
    throw new Error('Could not fetch rate limit information');
  }
  
  return {
    remaining: rateLimit.rate.remaining,
    limit: rateLimit.rate.limit,
    resetTime: new Date(rateLimit.rate.reset * 1000),
  };
} 