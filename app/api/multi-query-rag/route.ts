import { NextRequest, NextResponse } from 'next/server';
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { vectorSearchInClient, vectorSearchAcrossClients, FirestoreSearchResult } from '@/lib/firestore';

// Create the search instance
const searchInstance = createFromSource(source, {
  language: 'english',
});

interface MultiQueryRAGRequest {
  query: string;
  maxQueries?: number;
  maxResults?: number;
  useFirestore?: boolean;
  clientFolder?: string; // Optional override
  version?: string;      // Optional override
  tokenOptimization?: 'aggressive' | 'balanced' | 'quality'; // New: Token optimization level
}

interface DocumentChunk {
  id: string;
  content: string;
  title: string;
  url: string;
  embedding?: number[];
  score: number;
  metadata?: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    timestamp: string;
    clientFolder?: string;
    version?: string;
    displayUrl?: string;
    subdomain?: string;
  };
}

interface MultiQueryRAGResponse {
  originalQuery: string;
  augmentedQueries: string[];
  queryResults: Array<{
    query: string;
    summary: string;
    results: Array<{
      title: string;
      url: string;
      content: string;
      score: number;
      source: 'fumadocs' | 'firestore';
      clientFolder?: string;
      displayUrl?: string;
    }>;
  }>;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    source: 'fumadocs' | 'firestore';
    clientFolder?: string;
    displayUrl?: string;
  }>;
  firestoreResults: DocumentChunk[];
  finalAnswer: string;
  totalResults: number;
  modelUsed: string;
  clientContext: {
    clientFolder?: string;
    version?: string;
    searchScope: 'single-client' | 'multi-client';
  };
}

// Initialize Gemini AI with 2.0 Flash-Lite
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Generate embeddings using Gemini 2.0 Flash-Lite (text-embedding model)
async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    const result = await model.embedContent(text);
    return result.embedding.values || [];
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return zero vector as fallback
    return new Array(768).fill(0);
  }
}

// Enhanced Firestore vector search function for client-specific collections
async function searchFirestoreChunks(
  queries: string[], 
  maxResults: number = 10, 
  clientFolder?: string, 
  version?: string
): Promise<DocumentChunk[]> {
  try {
    console.log('Firestore search - queries:', queries);
    console.log('Firestore search - context:', { clientFolder, version, maxResults });
    
    // Generate embeddings for all queries
    const queryEmbeddings = await Promise.all(
      queries.map(query => generateEmbeddings(query))
    );
    
    console.log('Firestore search - generated embeddings for', queryEmbeddings.length, 'queries');
    
    let firestoreResults: FirestoreSearchResult[] = [];
    
    if (clientFolder && clientFolder !== 'all') {
      // Search specific client collection using the new client-specific function
      console.log(`Searching client-specific collection: ${clientFolder}_chunks`);
      
      // For multi-query search, we'll search with the first query and highest scoring embedding
      // TODO: Implement proper multi-query vector search for client collections
      const bestQueryEmbedding = queryEmbeddings[0]; // Use first query for now
      
      firestoreResults = await vectorSearchInClient(
        clientFolder,
        bestQueryEmbedding,
        {
          limit: maxResults,
          version,
          threshold: 0.1,
        }
      );
    } else {
      // Search across all client collections
      console.log('Searching across all client collections');
      const allClients = ['acme-corp', 'globaldyne-industries', 'techflow-solutions', 'public'];
      
      const bestQueryEmbedding = queryEmbeddings[0];
      
      firestoreResults = await vectorSearchAcrossClients(
        bestQueryEmbedding,
        {
          clientFolders: allClients,
          limit: maxResults,
          version,
          threshold: 0.1,
        }
      );
    }
    
    console.log('Firestore search - found', firestoreResults.length, 'results');
    
    // Convert Firestore results to DocumentChunk format with enhanced metadata
    const documentChunks: DocumentChunk[] = firestoreResults.map(result => ({
      id: result.id,
      content: result.content,
      title: result.title,
      url: result.url,
      score: result.score,
      metadata: {
        source: result.metadata.source,
        chunkIndex: result.metadata.chunkIndex,
        totalChunks: result.metadata.totalChunks,
        timestamp: result.metadata.timestamp,
        clientFolder: result.metadata.clientFolder,
        version: result.metadata.version,
        displayUrl: result.metadata.displayUrl,
        subdomain: result.metadata.subdomain,
      },
    }));
    
    return documentChunks;
      
  } catch (error) {
    console.error('Error searching Firestore chunks:', error);
    // Return empty array on error rather than failing the entire request
    return [];
  }
}

// Token optimization configuration
const TOKEN_OPTIMIZATION = {
  MAX_CONTENT_LENGTH: 500, // Limit content per search result
  MAX_COMBINED_CONTENT: 2000, // Limit total content sent to AI
  MAX_QUERIES_FOR_SUMMARY: 3, // Reduce number of queries to generate
  MAX_RESULTS_PER_QUERY: 3, // Limit results per query for summarization
  ENABLE_DEDUPLICATION: true, // Remove duplicate content
};

// Helper function to truncate content intelligently
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  
  // Try to cut at sentence boundary
  const truncated = content.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  // Cut at sentence or paragraph boundary if possible
  const cutPoint = Math.max(lastSentence, lastNewline);
  if (cutPoint > maxLength * 0.7) { // Only if we don't lose too much content
    return content.substring(0, cutPoint + 1).trim();
  }
  
  return truncated.trim() + '...';
}

// Helper function to deduplicate content
function deduplicateResults(results: Array<{content: string; title: string; [key: string]: any}>): Array<{content: string; title: string; [key: string]: any}> {
  if (!TOKEN_OPTIMIZATION.ENABLE_DEDUPLICATION) return results;
  
  const seen = new Set<string>();
  return results.filter(result => {
    // Create a simple hash of content (first 100 chars + title)
    const signature = (result.content.substring(0, 100) + result.title).toLowerCase();
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

// Function to generate multiple queries using Gemini 2.0 Flash-Lite (OPTIMIZED)
async function generateMultiQueries(
  query: string,
  maxQueries: number = TOKEN_OPTIMIZATION.MAX_QUERIES_FOR_SUMMARY
): Promise<string[]> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // OPTIMIZED: Much shorter, more direct prompt
    const prompt = `Generate ${maxQueries} related questions for: "${query}"

Requirements:
- Single-topic questions only
- Practical, actionable focus
- No numbering
- One question per line

Questions:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    const queries = content
      .split('\n')
      .map((q: string) => q.trim())
      .filter((q: string) => q.length > 0 && !q.match(/^\d+\.?\s*/))
      .filter((q: string) => q.includes('?') || q.length > 10)
      .slice(0, maxQueries);

    return queries.length > 0 ? queries : [query];
  } catch (error) {
    console.error('Error generating multi-queries:', error);
    return [query];
  }
}

// Function to search documents using the enhanced search API
async function searchFumadocs(queries: string[], maxResults: number = 10, originalRequest: NextRequest) {
  const allResults: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    query: string;
    source: 'fumadocs';
  }> = [];

  // Process each query through the search API
  for (const query of queries) {
    try {
      // Create a new request URL for the search API
      const searchUrl = new URL('/api/search', originalRequest.url);
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('limit', maxResults.toString());
      
      // Create a new request with all the original headers to preserve context
      const searchRequest = new NextRequest(searchUrl.toString(), {
        method: 'GET',
        headers: originalRequest.headers,
      });
      
      // Import the search route handler dynamically to avoid circular dependencies
      const { GET: searchHandler } = await import('@/app/api/search/route');
      
      // Call the search handler directly
      const searchResponse = await searchHandler(searchRequest);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        
        if (searchData.results && Array.isArray(searchData.results)) {
          searchData.results.forEach((result: any) => {
            if (result.document) {
              allResults.push({
                title: result.document.title || 'Untitled',
                url: result.document.url || '',
                content: result.document.content || '',
                score: result.score || 0,
                query,
                source: 'fumadocs',
              });
            }
          });
        }
      } else {
        console.error(`Search API returned error for query "${query}":`, searchResponse.status);
      }
    } catch (error) {
      console.error(`Error searching Fumadocs for query "${query}":`, error);
    }
  }

  return allResults;
}

// Function to merge and deduplicate results from both sources
function mergeAndDeduplicateResults(
  fumadocsResults: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    query: string;
    source: 'fumadocs';
  }>,
  firestoreResults: DocumentChunk[]
) {
  const seen = new Set<string>();
  const mergedResults: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    source: 'fumadocs' | 'firestore';
    clientFolder?: string;
    displayUrl?: string;
  }> = [];

  // Add Fumadocs results
  for (const result of fumadocsResults) {
    const key = `${result.url}-${result.content.substring(0, 100)}`;
    if (!seen.has(key)) {
      seen.add(key);
      mergedResults.push({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        source: result.source,
      });
    }
  }

  // Add Firestore results with higher weight for embedding similarity
  for (const result of firestoreResults) {
    const key = `${result.url}-${result.content.substring(0, 100)}`;
    if (!seen.has(key)) {
      seen.add(key);
      mergedResults.push({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score * 1.2, // Give slight boost to embedding-based results
        source: 'firestore',
        clientFolder: result.metadata?.clientFolder,
        displayUrl: result.metadata?.displayUrl,
      });
    }
  }

  // Sort by score in descending order
  return mergedResults.sort((a, b) => b.score - a.score);
}

// Function to generate summaries for query results using Gemini (OPTIMIZED)
async function generateQuerySummary(
  query: string,
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    source: 'fumadocs' | 'firestore';
  }>
): Promise<string> {
  try {
    if (results.length === 0) {
      return `No relevant information found for: "${query}".`;
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // OPTIMIZED: Limit and deduplicate results
    const optimizedResults = deduplicateResults(results)
      .slice(0, TOKEN_OPTIMIZATION.MAX_RESULTS_PER_QUERY)
      .map(result => ({
        ...result,
        content: truncateContent(result.content, TOKEN_OPTIMIZATION.MAX_CONTENT_LENGTH)
      }));

    // OPTIMIZED: Much shorter prompt, limited content
    const combinedContent = optimizedResults
      .map((result, index) => `${index + 1}. ${result.title}: ${result.content}`)
      .join('\n')
      .substring(0, TOKEN_OPTIMIZATION.MAX_COMBINED_CONTENT);

    const prompt = `Answer: "${query}"

Sources:
${combinedContent}

Provide a clear, structured answer with key points and actionable guidance.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || `Key information found for "${query}" in: ${optimizedResults.map(r => r.title).join(', ')}.`;
  } catch (error) {
    console.error('Error generating query summary:', error);
    const titles = results.slice(0, 2).map(r => r.title).join(', ');
    return `Information found for "${query}" in: ${titles}.`;
  }
}

// Function to generate a comprehensive final answer (OPTIMIZED)
async function generateFinalAnswer(
  originalQuery: string,
  queryResults: Array<{
    query: string;
    summary: string;
    results: any[];
  }>
): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // OPTIMIZED: Limit summary length and content
    const limitedSummaries = queryResults
      .slice(0, TOKEN_OPTIMIZATION.MAX_QUERIES_FOR_SUMMARY + 1) // +1 for original query
      .map((qr, index) => {
        const truncatedSummary = truncateContent(qr.summary, 300);
        return `${index + 1}. ${qr.query}\n${truncatedSummary}`;
      })
      .join('\n\n')
      .substring(0, TOKEN_OPTIMIZATION.MAX_COMBINED_CONTENT);

    // OPTIMIZED: Much shorter, more direct prompt
    const prompt = `User question: "${originalQuery}"

Research findings:
${limitedSummaries}

Provide a comprehensive answer that:
- Addresses the original question directly
- Synthesizes key information
- Includes actionable steps
- Uses clear structure

Answer:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || `Based on research across ${queryResults.length} topics, here's what I found regarding "${originalQuery}". See detailed analysis above.`;
  } catch (error) {
    console.error('Error generating final answer:', error);
    return `Research completed for "${originalQuery}" across ${queryResults.length} topics. See detailed findings above.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: MultiQueryRAGRequest = await request.json();
    const { 
      query, 
      maxQueries = TOKEN_OPTIMIZATION.MAX_QUERIES_FOR_SUMMARY, // Use optimized default
      maxResults = 10, 
      useFirestore = true,
      tokenOptimization = 'balanced' // Default to balanced optimization
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Adjust optimization settings based on user preference
    let optimizationConfig = { ...TOKEN_OPTIMIZATION };
    
    switch (tokenOptimization) {
      case 'aggressive':
        optimizationConfig = {
          MAX_CONTENT_LENGTH: 300,
          MAX_COMBINED_CONTENT: 1200,
          MAX_QUERIES_FOR_SUMMARY: 2,
          MAX_RESULTS_PER_QUERY: 2,
          ENABLE_DEDUPLICATION: true,
        };
        break;
      case 'quality':
        optimizationConfig = {
          MAX_CONTENT_LENGTH: 800,
          MAX_COMBINED_CONTENT: 3000,
          MAX_QUERIES_FOR_SUMMARY: 5,
          MAX_RESULTS_PER_QUERY: 5,
          ENABLE_DEDUPLICATION: false,
        };
        break;
      case 'balanced':
      default:
        // Use default TOKEN_OPTIMIZATION values
        break;
    }

    // Temporarily override global config
    Object.assign(TOKEN_OPTIMIZATION, optimizationConfig);

    console.log('Multi-Query RAG - Token optimization level:', tokenOptimization);
    console.log('Multi-Query RAG - Config:', optimizationConfig);

    // Extract client context from middleware headers (subdomain-based)
    const clientFolderFromHeader = request.headers.get('x-client-folder');
    const clientVersionFromHeader = request.headers.get('x-client-version');
    const host = request.headers.get('host') || '';

    // Allow override from request body, but prefer subdomain detection
    const clientFolder = body.clientFolder || clientFolderFromHeader || undefined;
    const version = body.version || clientVersionFromHeader || undefined;

    console.log('Multi-Query RAG - Original query:', query);
    console.log('Multi-Query RAG - Client context:', {
      host,
      clientFolder,
      version,
      subdomain: request.headers.get('x-client-subdomain'),
    });

    // Generate multiple queries using optimized count
    const augmentedQueries = await generateMultiQueries(query, maxQueries);
    
    // Include original query in the search
    const allQueries = [query, ...augmentedQueries];
    
    console.log('Multi-Query RAG - Generated queries:', allQueries.length, 'queries');
    
    // Search both Fumadocs and Firestore in parallel
    const [fumadocsResults, firestoreResults] = await Promise.all([
      searchFumadocs(allQueries, maxResults, request),
      useFirestore ? searchFirestoreChunks(allQueries, maxResults, clientFolder || undefined, version || undefined) : Promise.resolve([])
    ]);
    
    console.log('Multi-Query RAG - Results:', fumadocsResults.length, 'fumadocs,', firestoreResults.length, 'firestore');
    
    // Merge and deduplicate results
    const mergedResults = mergeAndDeduplicateResults(fumadocsResults, firestoreResults);

    // Group results by query and generate summaries with optimizations
    const queryResults = await Promise.all(
      allQueries.slice(0, TOKEN_OPTIMIZATION.MAX_QUERIES_FOR_SUMMARY + 1).map(async (currentQuery) => {
        // Find results that match this query
        const querySpecificResults = mergedResults.filter(result => {
          const fumadocsMatch = fumadocsResults.find(fr => 
            fr.query === currentQuery && 
            fr.title === result.title && 
            fr.content === result.content
          );
          return fumadocsMatch || result.source === 'firestore';
        });

        // Generate summary for this query with optimization
        const summary = await generateQuerySummary(currentQuery, querySpecificResults);

        return {
          query: currentQuery,
          summary,
          results: querySpecificResults.slice(0, TOKEN_OPTIMIZATION.MAX_RESULTS_PER_QUERY),
        };
      })
    );

    // Generate comprehensive final answer with optimization
    const finalAnswer = await generateFinalAnswer(query, queryResults);

    const response: MultiQueryRAGResponse = {
      originalQuery: query,
      augmentedQueries,
      queryResults,
      results: mergedResults.slice(0, maxResults),
      firestoreResults,
      finalAnswer,
      totalResults: mergedResults.length,
      modelUsed: `gemini-2.0-flash-lite (${tokenOptimization} optimization)`,
      clientContext: {
        clientFolder,
        version,
        searchScope: clientFolder ? 'single-client' : 'multi-client',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Multi-query RAG error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const clientFolder = request.headers.get('x-client-folder');
  const version = request.headers.get('x-client-version');
  
  return NextResponse.json(
    { 
      message: 'Multi-Query RAG API (Client-Specific Collections)',
      models: ['gemini-2.0-flash-lite', 'text-embedding-004'],
      features: [
        'Query expansion', 
        'Hybrid search', 
        'Client-specific collections', 
        'Subdomain-aware search',
        'Enhanced metadata with display URLs'
      ],
      clientContext: {
        clientFolder,
        version,
        searchScope: clientFolder ? 'single-client' : 'multi-client',
      },
      endpoints: {
        POST: 'Perform multi-query RAG search with client-specific collections'
      },
      collections: {
        format: '{clientFolder}_chunks',
        examples: [
          'acme-corp_chunks',
          'globaldyne-industries_chunks', 
          'techflow-solutions_chunks',
          'public_chunks'
        ]
      }
    },
    { status: 200 }
  );
} 