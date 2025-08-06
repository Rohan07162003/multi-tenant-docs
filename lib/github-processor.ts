import { fetchGitHubFileContent, fetchGitHubFileDiff, GitHubApiClient } from './github-api';
import { indexClientContentWithDisplayUrl } from './document-indexer';
import { deleteClientDocumentChunksBySource } from './firestore';

// Define GitHubPushEvent interface locally to avoid circular imports
export interface GitHubPushEvent {
  ref: string;
  before: string;
  after: string;
  repository: {
    name: string;
    full_name: string;
    clone_url: string;
    html_url: string;
    default_branch: string;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
    added: string[];
    modified: string[];
    removed: string[];
  };
}

export interface ProcessingResult {
  filesProcessed: number;
  filesIndexed: number;
  filesSkipped: number;
  errors: string[];
  clientsUpdated: string[];
}

export interface PushEventData {
  repository: GitHubPushEvent['repository'];
  headCommit: GitHubPushEvent['head_commit'];
  targetFiles: string[];
  filesByClient: Record<string, string[]>;
}

// Initialize GitHub API client
function getGitHubClient(): GitHubApiClient {
  const token = process.env.GITHUB_ACCESS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_ACCESS_TOKEN is not configured');
  }
  return new GitHubApiClient(token);
}

// Parse client folder and version from file path
function parseDocumentContext(filePath: string): { 
  clientFolder?: string; 
  version?: string; 
  documentPath?: string;
} {
  // Match patterns like: content/docs/client-name/v1/filename.mdx
  const match = filePath.match(/(?:content\/docs|docs|documentation)\/([^\/]+)\/?(v\d+)?\/(.+)/);
  
  if (match) {
    return {
      clientFolder: match[1],
      version: match[2] || undefined,
      documentPath: match[3] || filePath
    };
  }
  
  return { documentPath: filePath };
}

// Extract title from markdown frontmatter or filename
function extractTitle(content: string, filePath: string): string {
  // Try to extract from frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(/title:\s*(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim().replace(/['"]/g, ''); // Remove quotes
    }
  }
  
  // Fallback to filename
  const filename = filePath.split('/').pop()?.replace(/\.(md|mdx)$/i, '') || 'untitled';
  return filename.charAt(0).toUpperCase() + filename.slice(1).replace(/[-_]/g, ' ');
}

// Clean markdown content (remove frontmatter, normalize)
function cleanMarkdownContent(content: string): string {
  // Remove frontmatter
  let cleaned = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Generate URL from file path (for internal routing)
function generateUrl(filePath: string, clientFolder: string, version?: string): string {
  const { documentPath } = parseDocumentContext(filePath);
  if (!documentPath) return '/';
  
  // Remove file extension and create clean URL path
  const urlPath = documentPath.replace(/\.(md|mdx)$/i, '');
  
  // Generate URL without client folder since we use subdomains
  if (version) {
    return `/docs/${version}/${urlPath}`;
  } else {
    return `/docs/${urlPath}`;
  }
}

// Generate full display URL with subdomain
function generateDisplayUrl(filePath: string, clientFolder: string, version?: string): string {
  const url = generateUrl(filePath, clientFolder, version);
  
  // Generate subdomain URL
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${clientFolder}.docs.yourdomain.com`
    : `http://${clientFolder}.docs.localhost:3000`;
  
  return `${baseUrl}${url}`;
}

// Process a single file
async function processFile(
  gitHub: GitHubApiClient,
  repository: GitHubPushEvent['repository'],
  filePath: string,
  commitSha: string
): Promise<{ success: boolean; error?: string; indexed?: boolean }> {
  try {
    console.log(`Processing file: ${filePath}`);
    
    // Parse context from file path
    const { clientFolder, version } = parseDocumentContext(filePath);
    
    if (!clientFolder) {
      console.log(`Skipping ${filePath} - could not determine client folder`);
      return { success: true, indexed: false };
    }
    
    // Fetch file content from GitHub
    const fileContent = await fetchGitHubFileContent(
      gitHub,
      repository.full_name,
      filePath,
      commitSha
    );
    
    if (!fileContent) {
      console.log(`Skipping ${filePath} - could not fetch content`);
      return { success: true, indexed: false };
    }
    
    // Extract title and clean content
    const title = extractTitle(fileContent, filePath);
    const cleanedContent = cleanMarkdownContent(fileContent);
    
    if (cleanedContent.length < 50) {
      console.log(`Skipping ${filePath} - content too short (${cleanedContent.length} chars)`);
      return { success: true, indexed: false };
    }
    
    // Generate URLs
    const url = generateUrl(filePath, clientFolder, version);
    const displayUrl = generateDisplayUrl(filePath, clientFolder, version);
    
    console.log(`Indexing document: ${title} for client ${clientFolder}${version ? ` (${version})` : ''}`);
    
    // Delete existing chunks for this document first (to handle updates)
    try {
      await deleteClientDocumentChunksBySource(clientFolder, url);
    } catch (error) {
      console.warn(`Could not delete existing chunks for ${url}:`, error);
    }
    
    // Index the document
    await indexClientContentWithDisplayUrl(
      title,
      cleanedContent,
      url,
      clientFolder,
      version,
      displayUrl,
      {
        maxChunkSize: 1000,
        overlapSize: 200,
        minChunkSize: 100
      }
    );
    
    console.log(`Successfully indexed: ${title}`);
    return { success: true, indexed: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing ${filePath}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Main processing function
export async function processGitHubPushEvent(data: PushEventData): Promise<ProcessingResult> {
  const { repository, headCommit, targetFiles, filesByClient } = data;
  
  console.log('GitHub processor - Starting document processing:', {
    repository: repository.full_name,
    commit: headCommit.id.substring(0, 7),
    filesCount: targetFiles.length,
    clients: Object.keys(filesByClient)
  });
  
  const result: ProcessingResult = {
    filesProcessed: 0,
    filesIndexed: 0,
    filesSkipped: 0,
    errors: [],
    clientsUpdated: []
  };
  
  try {
    // Initialize GitHub API client
    const gitHub = getGitHubClient();
    
    // Process files by client
    for (const [client, files] of Object.entries(filesByClient)) {
      console.log(`\nProcessing ${files.length} files for client: ${client}`);
      
      let clientUpdated = false;
      
      for (const filePath of files) {
        result.filesProcessed++;
        
        const fileResult = await processFile(
          gitHub,
          repository,
          filePath,
          headCommit.id
        );
        
        if (fileResult.success) {
          if (fileResult.indexed) {
            result.filesIndexed++;
            clientUpdated = true;
          } else {
            result.filesSkipped++;
          }
        } else {
          result.errors.push(`${filePath}: ${fileResult.error}`);
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (clientUpdated && client !== 'unknown') {
        result.clientsUpdated.push(client);
      }
    }
    
    console.log('\nGitHub processor - Processing completed:', {
      filesProcessed: result.filesProcessed,
      filesIndexed: result.filesIndexed,
      filesSkipped: result.filesSkipped,
      errors: result.errors.length,
      clientsUpdated: result.clientsUpdated
    });
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('GitHub processor - Fatal error:', errorMessage);
    result.errors.push(`Fatal error: ${errorMessage}`);
    return result;
  }
}

// Utility function to get diff information (for future enhancement)
export async function getFileDiff(
  repository: string,
  filePath: string,
  beforeSha: string,
  afterSha: string
): Promise<string | null> {
  try {
    const gitHub = getGitHubClient();
    return await fetchGitHubFileDiff(gitHub, repository, filePath, beforeSha, afterSha);
  } catch (error) {
    console.error(`Error fetching diff for ${filePath}:`, error);
    return null;
  }
} 