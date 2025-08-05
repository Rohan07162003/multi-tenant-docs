import fs from 'fs/promises';
import path from 'path';
import { indexClientContent, indexClientContentWithDisplayUrl } from './document-indexer';

interface FileInfo {
  filePath: string;
  clientFolder: string;
  version: string;
  title: string;
  content: string;
  url: string;
  displayUrl: string;
}

// Parse client folder and version from file path
function parseFilePath(filePath: string): { clientFolder: string; version: string } | null {
  // Normalize path to handle both absolute and relative paths
  // Match patterns like: content/docs/client-name/v1/filename.mdx
  const normalizedPath = filePath.replace(/.*\/fumadocs-domain-poc\//, '');
  const match = normalizedPath.match(/content\/docs\/([^\/]+)\/(v\d+)\//);
  
  if (match) {
    return {
      clientFolder: match[1],
      version: match[2]
    };
  }
  
  return null;
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
  const filename = path.basename(filePath, path.extname(filePath));
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

// Generate URL from file path
function generateUrl(filePath: string, clientFolder: string, version: string): string {
  // Convert file path to URL, removing client folder since we use subdomains
  // content/docs/acme-corp/v1/index.mdx -> /docs/v1/index
  const normalizedPath = filePath.replace(/.*\/fumadocs-domain-poc\//, '');
  const relativePath = normalizedPath.replace('content/docs/', '');
  const pathWithoutClient = relativePath.replace(`${clientFolder}/`, '');
  const urlPath = pathWithoutClient.replace(/\.mdx?$/, '');
  return `/docs/${urlPath}`;
}

// Generate full display URL with subdomain
function generateDisplayUrl(filePath: string, clientFolder: string, version: string): string {
  // Remove the client folder from the path for the subdomain URL
  // content/docs/acme-corp/v1/index.mdx -> /docs/v1/index
  const normalizedPath = filePath.replace(/.*\/fumadocs-domain-poc\//, '');
  const relativePath = normalizedPath.replace('content/docs/', '');
  const pathWithoutClient = relativePath.replace(`${clientFolder}/`, '');
  const urlPath = pathWithoutClient.replace(/\.mdx?$/, '');
  
  // Generate subdomain URL
  // e.g., "http://acme-corp.docs.localhost:3001/docs/v1/index"
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${clientFolder}.docs.yourdomain.com`
    : `http://${clientFolder}.docs.localhost:3000`;
  
  return `${baseUrl}/docs/${urlPath}`;
}

// Scan directory recursively for markdown files
async function scanDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${currentPath}:`, error);
    }
  }
  
  await scan(dirPath);
  return files;
}

// Process a single file
async function processFile(filePath: string): Promise<FileInfo | null> {
  try {
    // Parse client and version from path
    const parsed = parseFilePath(filePath);
    if (!parsed) {
      console.log(`Skipping ${filePath} - no client/version pattern found`);
      return null;
    }
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.trim()) {
      console.log(`Skipping ${filePath} - empty file`);
      return null;
    }
    
    // Extract title and clean content
    const title = extractTitle(content, filePath);
    const cleanedContent = cleanMarkdownContent(content);
    
    if (cleanedContent.length < 50) {
      console.log(`Skipping ${filePath} - content too short (${cleanedContent.length} chars)`);
      return null;
    }
    
    // Generate URLs
    const url = generateUrl(filePath, parsed.clientFolder, parsed.version);
    const displayUrl = generateDisplayUrl(filePath, parsed.clientFolder, parsed.version);
    
    return {
      filePath,
      clientFolder: parsed.clientFolder,
      version: parsed.version,
      title,
      content: cleanedContent,
      url,
      displayUrl
    };
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return null;
  }
}

// Main indexing function
export async function indexLocalFiles(options: {
  maxChunkSize?: number;
  overlapSize?: number;
  minChunkSize?: number;
} = {}): Promise<void> {
  console.log('🚀 Starting manual indexing of local files...');
  
  try {
    // Scan for all markdown files
    const contentDir = path.join(process.cwd(), 'content/docs');
    console.log(`📁 Scanning directory: ${contentDir}`);
    
    const allFiles = await scanDirectory(contentDir);
    console.log(`📄 Found ${allFiles.length} markdown files`);
    
    // Process files
    const processedFiles: FileInfo[] = [];
    
    for (const filePath of allFiles) {
      const fileInfo = await processFile(filePath);
      if (fileInfo) {
        processedFiles.push(fileInfo);
      }
    }
    
    console.log(`✅ Processed ${processedFiles.length} files for indexing`);
    
    // Group by client for better logging
    const byClient = processedFiles.reduce((acc, file) => {
      if (!acc[file.clientFolder]) {
        acc[file.clientFolder] = [];
      }
      acc[file.clientFolder].push(file);
      return acc;
    }, {} as Record<string, FileInfo[]>);
    
    // Index files by client
    let indexedCount = 0;
    
    for (const [client, files] of Object.entries(byClient)) {
      console.log(`\n📚 Indexing ${files.length} files for client: ${client}`);
      
      for (const file of files) {
        try {
          console.log(`  📝 Indexing: ${file.title} (${file.version})`);
          
          await indexClientContentWithDisplayUrl(
            file.title,
            file.content,
            file.url,
            file.clientFolder,
            file.version,
            file.displayUrl,
            options
          );
          
          indexedCount++;
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`  ❌ Failed to index ${file.title}:`, error);
        }
      }
    }
    
    console.log(`\n🎉 Manual indexing completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Files processed: ${processedFiles.length}`);
    console.log(`  - Files indexed: ${indexedCount}`);
    console.log(`  - Clients: ${Object.keys(byClient).join(', ')}`);
    console.log(`  - Collections created: ${Object.keys(byClient).map(c => `${c}_chunks`).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Manual indexing failed:', error);
    throw error;
  }
}

// Index specific client/version
export async function indexClientFiles(
  clientFolder: string,
  version?: string,
  options: {
    maxChunkSize?: number;
    overlapSize?: number;
    minChunkSize?: number;
  } = {}
): Promise<void> {
  console.log(`🚀 Starting manual indexing for client: ${clientFolder}${version ? ` (${version})` : ''}`);
  
  try {
    const contentDir = path.join(process.cwd(), 'content/docs');
    const clientDir = path.join(contentDir, clientFolder);
    
    // Check if client directory exists
    try {
      await fs.access(clientDir);
    } catch {
      throw new Error(`Client directory not found: ${clientDir}`);
    }
    
    // Get all files for this client
    const allFiles = await scanDirectory(clientDir);
    
    // Filter by version if specified
    const targetFiles = version 
      ? allFiles.filter(file => file.includes(`/${version}/`))
      : allFiles;
    
    console.log(`📄 Found ${targetFiles.length} files for ${clientFolder}${version ? `/${version}` : ''}`);
    
    // Process and index files
    let indexedCount = 0;
    
    for (const filePath of targetFiles) {
      const fileInfo = await processFile(filePath);
      if (fileInfo) {
        try {
          console.log(`  📝 Indexing: ${fileInfo.title} (${fileInfo.version})`);
          
          await indexClientContentWithDisplayUrl(
            fileInfo.title,
            fileInfo.content,
            fileInfo.url,
            fileInfo.clientFolder,
            fileInfo.version,
            fileInfo.displayUrl,
            options
          );
          
          indexedCount++;
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`  ❌ Failed to index ${fileInfo.title}:`, error);
        }
      }
    }
    
    console.log(`\n🎯 Indexing completed for ${clientFolder}!`);
    console.log(`📊 Files indexed: ${indexedCount}`);
    console.log(`📦 Collection: ${clientFolder}_chunks`);
    
  } catch (error) {
    console.error(`❌ Failed to index ${clientFolder}:`, error);
    throw error;
  }
} 