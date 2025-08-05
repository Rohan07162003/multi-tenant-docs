import { GoogleGenerativeAI } from '@google/generative-ai';
import { batchStoreDocumentChunks, batchStoreClientDocumentChunks, FirestoreDocumentChunk } from './firestore';
import { source } from './source';
import crypto from 'crypto';

interface DocumentContent {
  title: string;
  content: string;
  url: string;
  clientFolder?: string;
  version?: string;
  displayUrl?: string;
}

interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  minChunkSize?: number;
}

// Initialize Gemini AI for embeddings
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Generate embeddings using Gemini
async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    const result = await model.embedContent(text);
    return result.embedding.values || [];
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return new Array(768).fill(0);
  }
}

// Split text into chunks with overlap
function chunkText(text: string, options: ChunkingOptions = {}): string[] {
  const {
    maxChunkSize = 1000,
    overlapSize = 200,
    minChunkSize = 100,
  } = options;

  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // If this isn't the last chunk, try to break at a sentence or paragraph boundary
    if (end < text.length) {
      // Look for sentence breaks within the last 200 characters
      const searchStart = Math.max(end - 200, start + minChunkSize);
      const substring = text.substring(searchStart, end);
      
      // Look for paragraph breaks first
      const paragraphBreak = substring.lastIndexOf('\n\n');
      if (paragraphBreak !== -1) {
        end = searchStart + paragraphBreak;
      } else {
        // Look for sentence breaks
        const sentenceBreak = substring.lastIndexOf('. ');
        if (sentenceBreak !== -1) {
          end = searchStart + sentenceBreak + 1;
        }
      }
    }

    const chunk = text.substring(start, end).trim();
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
    }

    // Move start position with overlap
    start = end - overlapSize;
    if (start >= text.length) break;
  }

  return chunks;
}

// Create content hash for deduplication
function createContentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Index a single document (Legacy - uses legacy collection)
export async function indexDocument(
  doc: DocumentContent,
  options: ChunkingOptions = {}
): Promise<void> {
  try {
    console.log(`Indexing document: ${doc.title}`);
    
    // Clean and prepare content
    const cleanContent = doc.content
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (cleanContent.length < 50) {
      console.log(`Skipping document ${doc.title} - content too short`);
      return;
    }

    // Chunk the content
    const chunks = chunkText(cleanContent, options);
    console.log(`Created ${chunks.length} chunks for ${doc.title}`);

    // Process chunks in batches to avoid rate limits
    const batchSize = 5;
    const documentChunks: Omit<FirestoreDocumentChunk, 'createdAt' | 'updatedAt'>[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} for ${doc.title}`);
      
      // Generate embeddings for this batch
      const embeddings = await Promise.all(
        batch.map(chunk => generateEmbeddings(chunk))
      );

      // Create document chunks
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const chunk = batch[j];
        const embedding = embeddings[j];
        
        const chunkId = `${createContentHash(doc.url)}_chunk_${chunkIndex}`;
        
        documentChunks.push({
          id: chunkId,
          content: chunk,
          title: doc.title,
          url: doc.url,
          embedding,
          metadata: {
            source: doc.url,
            chunkIndex,
            totalChunks: chunks.length,
            timestamp: new Date().toISOString(),
            clientFolder: doc.clientFolder,
            version: doc.version,
            contentHash: createContentHash(chunk),
            displayUrl: doc.displayUrl,
            subdomain: doc.clientFolder,
          },
        });
      }

      // Add a small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Store all chunks in Firestore
    if (documentChunks.length > 0) {
      await batchStoreDocumentChunks(documentChunks);
      console.log(`Successfully indexed ${documentChunks.length} chunks for ${doc.title}`);
    }

  } catch (error) {
    console.error(`Error indexing document ${doc.title}:`, error);
    throw error;
  }
}

// Index a single document in client-specific collection
export async function indexClientDocument(
  doc: DocumentContent,
  options: ChunkingOptions = {}
): Promise<void> {
  if (!doc.clientFolder) {
    throw new Error('Client folder is required for client-specific indexing');
  }

  try {
    console.log(`Indexing document for client ${doc.clientFolder}: ${doc.title}`);
    
    // Clean and prepare content
    const cleanContent = doc.content
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (cleanContent.length < 50) {
      console.log(`Skipping document ${doc.title} - content too short`);
      return;
    }

    // Chunk the content
    const chunks = chunkText(cleanContent, options);
    console.log(`Created ${chunks.length} chunks for ${doc.title}`);

    // Process chunks in batches to avoid rate limits
    const batchSize = 5;
    const documentChunks: Omit<FirestoreDocumentChunk, 'createdAt' | 'updatedAt'>[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} for ${doc.title}`);
      
      // Generate embeddings for this batch
      const embeddings = await Promise.all(
        batch.map(chunk => generateEmbeddings(chunk))
      );

      // Create document chunks
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const chunk = batch[j];
        const embedding = embeddings[j];
        
        const chunkId = `${createContentHash(doc.url)}_chunk_${chunkIndex}`;
        
        documentChunks.push({
          id: chunkId,
          content: chunk,
          title: doc.title,
          url: doc.url,
          embedding,
          metadata: {
            source: doc.url,
            chunkIndex,
            totalChunks: chunks.length,
            timestamp: new Date().toISOString(),
            clientFolder: doc.clientFolder,
            version: doc.version,
            contentHash: createContentHash(chunk),
            displayUrl: doc.displayUrl,
            subdomain: doc.clientFolder,
          },
        });
      }

      // Add a small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Store all chunks in client-specific Firestore collection
    if (documentChunks.length > 0) {
      await batchStoreClientDocumentChunks(doc.clientFolder, documentChunks);
      console.log(`Successfully indexed ${documentChunks.length} chunks for ${doc.title} in client collection: ${doc.clientFolder}`);
    }

  } catch (error) {
    console.error(`Error indexing document ${doc.title} for client ${doc.clientFolder}:`, error);
    throw error;
  }
}

// Index multiple documents
export async function indexDocuments(
  docs: DocumentContent[],
  options: ChunkingOptions = {}
): Promise<void> {
  console.log(`Starting indexing of ${docs.length} documents`);
  
  for (let i = 0; i < docs.length; i++) {
    try {
      console.log(`\nIndexing document ${i + 1}/${docs.length}`);
      await indexDocument(docs[i], options);
      
      // Add delay between documents to respect rate limits
      if (i < docs.length - 1) {
        console.log('Waiting before next document...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Failed to index document ${docs[i].title}:`, error);
      // Continue with next document rather than stopping entirely
    }
  }
  
  console.log('\nDocument indexing completed!');
}

// Parse client folder and version from URL
function parseDocumentContext(url: string): { clientFolder?: string; version?: string } {
  // Match patterns like /docs/client-name/v1/... or /docs/public/v1/...
  const match = url.match(/^\/docs\/([^\/]+)\/([^\/]+)/);
  
  if (match) {
    const [, folder, versionOrPath] = match;
    
    // Check if the second part is a version (starts with 'v' followed by number)
    if (versionOrPath.match(/^v\d+$/)) {
      return { clientFolder: folder, version: versionOrPath };
    } else {
      // If no version, the second part might be content, so folder is the only context
      return { clientFolder: folder };
    }
  }
  
  return {};
}

// Index documents from Fumadocs source
export async function indexFromFumadocsSource(options: ChunkingOptions = {}): Promise<void> {
  try {
    console.log('Loading documents from Fumadocs source...');
    
    // Get all pages from the source
    const allDocs: DocumentContent[] = [];
    
    // This is a simplified approach - you may need to adapt based on your source structure
    // For now, we'll create a placeholder that shows the pattern
    console.log('Note: You\'ll need to implement the document extraction from your Fumadocs source');
    console.log('This would typically involve:');
    console.log('1. Iterating through all pages in your source');
    console.log('2. Extracting title, content, and URL from each page');
    console.log('3. Parsing client folder and version from the URL');
    
    // Example of how you might structure this:
    /*
    for (const page of source.pages) {
      const { clientFolder, version } = parseDocumentContext(page.url);
      
      allDocs.push({
        title: page.title || 'Untitled',
        content: page.content || '',
        url: page.url,
        clientFolder,
        version,
      });
    }
    */
    
    if (allDocs.length === 0) {
      console.log('No documents found to index. Please implement document extraction from your source.');
      return;
    }
    
    await indexDocuments(allDocs, options);
    
  } catch (error) {
    console.error('Error indexing from Fumadocs source:', error);
    throw error;
  }
}

// Utility to index specific content manually (Legacy - uses legacy collection)
export async function indexContent(
  title: string,
  content: string,
  url: string,
  clientFolder?: string,
  version?: string,
  options: ChunkingOptions = {}
): Promise<void> {
  const doc: DocumentContent = {
    title,
    content,
    url,
    clientFolder,
    version,
  };
  
  await indexDocument(doc, options);
}

// Utility to index specific content in client-specific collection
export async function indexClientContent(
  title: string,
  content: string,
  url: string,
  clientFolder: string,
  version?: string,
  options: ChunkingOptions = {}
): Promise<void> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific indexing');
  }

  const doc: DocumentContent = {
    title,
    content,
    url,
    clientFolder,
    version,
  };
  
  await indexClientDocument(doc, options);
}

// Utility to index specific content in client-specific collection with display URL
export async function indexClientContentWithDisplayUrl(
  title: string,
  content: string,
  url: string,
  clientFolder: string,
  version: string | undefined,
  displayUrl: string,
  options: ChunkingOptions = {}
): Promise<void> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific indexing');
  }

  const doc: DocumentContent = {
    title,
    content,
    url,
    clientFolder,
    version,
    displayUrl,
  };
  
  await indexClientDocument(doc, options);
} 