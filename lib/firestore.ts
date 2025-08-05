import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Query, DocumentData } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
let firestore: Firestore;

function initializeFirebase() {
  if (getApps().length === 0) {
    // Debug logging
    console.log('=== Firebase Initialization Debug ===');
    console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING');
    console.log('FIREBASE_SERVICE_ACCOUNT_KEY:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'MISSING');
    console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'MISSING');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('=====================================');
    
    // Initialize with service account or default credentials
    let app;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('Using Firebase service account key');
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      } catch (error) {
        console.error('Error parsing service account key:', error);
        throw new Error('Invalid Firebase service account key format');
      }
    } else if (process.env.FIREBASE_PROJECT_ID) {
      console.log('Using Firebase default credentials');
      // Use default credentials (for deployment environments)
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      console.error('Firebase configuration missing - no PROJECT_ID or SERVICE_ACCOUNT_KEY found');
      throw new Error('Firebase configuration is missing. Please set FIREBASE_PROJECT_ID and optionally FIREBASE_SERVICE_ACCOUNT_KEY');
    }
    
    firestore = getFirestore(app);
  } else {
    firestore = getFirestore();
  }
  
  return firestore;
}

// Collection names
export const COLLECTIONS = {
  DOCUMENT_CHUNKS: 'document_chunks', // Legacy collection for backward compatibility
  CLIENT_CHUNKS: (clientFolder: string) => `${clientFolder}_chunks`,
  METADATA: 'client_metadata', // For tracking client collections
} as const;

// Client metadata interface
export interface ClientMetadata {
  clientFolder: string;
  versions: string[];
  totalChunks: number;
  lastUpdated: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

// Document chunk interface for Firestore
export interface FirestoreDocumentChunk {
  id: string;
  content: string;
  title: string;
  url: string;
  embedding: number[];
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    timestamp: string;
    clientFolder?: string;
    version?: string;
    contentHash: string;
    // Full URL with subdomain for UI display
    displayUrl?: string; // e.g., "http://globaldyne-industries.docs.localhost:3001/docs/v1/warehouse-operations"
    subdomain?: string; // e.g., "globaldyne-industries"
  };
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

// Search result interface
export interface FirestoreSearchResult {
  id: string;
  content: string;
  title: string;
  url: string;
  score: number;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    timestamp: string;
    clientFolder?: string;
    version?: string;
    // Full URL with subdomain for UI display
    displayUrl?: string;
    subdomain?: string;
  };
}

// Calculate cosine similarity between two vectors
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get Firestore instance
export function getFirestoreInstance(): Firestore {
  if (!firestore) {
    firestore = initializeFirebase();
  }
  return firestore;
}

// Store document chunk with embedding (Legacy function - kept for backward compatibility)
export async function storeDocumentChunk(chunk: Omit<FirestoreDocumentChunk, 'createdAt' | 'updatedAt'>): Promise<void> {
  const db = getFirestoreInstance();
  const docRef = db.collection(COLLECTIONS.DOCUMENT_CHUNKS).doc(chunk.id);
  
  await docRef.set({
    ...chunk,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// Batch store multiple document chunks (Legacy function - kept for backward compatibility)
export async function batchStoreDocumentChunks(chunks: Omit<FirestoreDocumentChunk, 'createdAt' | 'updatedAt'>[]): Promise<void> {
  const db = getFirestoreInstance();
  const batch = db.batch();
  
  chunks.forEach(chunk => {
    const docRef = db.collection(COLLECTIONS.DOCUMENT_CHUNKS).doc(chunk.id);
    batch.set(docRef, {
      ...chunk,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  
  await batch.commit();
}

// Store document chunk in client-specific collection
export async function storeClientDocumentChunk(
  clientFolder: string,
  chunk: Omit<FirestoreDocumentChunk, 'createdAt' | 'updatedAt'>
): Promise<void> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific storage');
  }
  
  const db = getFirestoreInstance();
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  const docRef = db.collection(collectionName).doc(chunk.id);
  
  await docRef.set({
    ...chunk,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// Batch store multiple document chunks in client-specific collection
export async function batchStoreClientDocumentChunks(
  clientFolder: string,
  chunks: Omit<FirestoreDocumentChunk, 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific storage');
  }
  
  if (chunks.length === 0) {
    return;
  }
  
  const db = getFirestoreInstance();
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  
  // Firestore batch has a limit of 500 operations
  const batchSize = 500;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = db.batch();
    const batchChunks = chunks.slice(i, i + batchSize);
    
    batchChunks.forEach(chunk => {
      const docRef = db.collection(collectionName).doc(chunk.id);
      batch.set(docRef, {
        ...chunk,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    await batch.commit();
  }
}

// Vector search function with filtering options (Legacy - searches legacy collection)
export async function vectorSearch(
  queryEmbedding: number[],
  options: {
    limit?: number;
    clientFolder?: string;
    version?: string;
    threshold?: number;
  } = {}
): Promise<FirestoreSearchResult[]> {
  const db = getFirestoreInstance();
  const { limit = 10, clientFolder, version, threshold = 0.1 } = options;
  
  let query: Query<DocumentData> = db.collection(COLLECTIONS.DOCUMENT_CHUNKS);
  
  // Apply filters for client folder if specified
  if (clientFolder) {
    if (clientFolder === 'public') {
      query = query.where('metadata.clientFolder', '==', 'public');
    } else {
      query = query.where('metadata.clientFolder', '==', clientFolder);
    }
  }
  
  // Apply version filter if specified
  if (version) {
    query = query.where('metadata.version', '==', version);
  }
  
  // Get all matching documents (Firestore doesn't have built-in vector search yet)
  const snapshot = await query.get();
  
  const results: FirestoreSearchResult[] = [];
  
  snapshot.forEach(doc => {
    const data = doc.data() as FirestoreDocumentChunk;
    
    if (data.embedding && data.embedding.length > 0) {
      const similarity = calculateCosineSimilarity(queryEmbedding, data.embedding);
      
      if (similarity >= threshold) {
        results.push({
          id: data.id,
          content: data.content,
          title: data.title,
          url: data.url,
          score: similarity,
          metadata: {
            source: data.metadata.source,
            chunkIndex: data.metadata.chunkIndex,
            totalChunks: data.metadata.totalChunks,
            timestamp: data.metadata.timestamp,
            clientFolder: data.metadata.clientFolder,
            version: data.metadata.version,
            displayUrl: data.metadata.displayUrl,
            subdomain: data.metadata.subdomain,
          },
        });
      }
    }
  });
  
  // Sort by similarity score and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Vector search in client-specific collection
export async function vectorSearchInClient(
  clientFolder: string,
  queryEmbedding: number[],
  options: {
    limit?: number;
    version?: string;
    threshold?: number;
  } = {}
): Promise<FirestoreSearchResult[]> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific search');
  }
  
  const db = getFirestoreInstance();
  const { limit = 10, version, threshold = 0.1 } = options;
  
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  let query: Query<DocumentData> = db.collection(collectionName);
  
  // Apply version filter if specified
  if (version) {
    query = query.where('metadata.version', '==', version);
  }
  
  // Get all matching documents
  const snapshot = await query.get();
  
  const results: FirestoreSearchResult[] = [];
  
  snapshot.forEach(doc => {
    const data = doc.data() as FirestoreDocumentChunk;
    
    if (data.embedding && data.embedding.length > 0) {
      const similarity = calculateCosineSimilarity(queryEmbedding, data.embedding);
      
      if (similarity >= threshold) {
        results.push({
          id: data.id,
          content: data.content,
          title: data.title,
          url: data.url,
          score: similarity,
          metadata: {
            source: data.metadata.source,
            chunkIndex: data.metadata.chunkIndex,
            totalChunks: data.metadata.totalChunks,
            timestamp: data.metadata.timestamp,
            clientFolder: data.metadata.clientFolder,
            version: data.metadata.version,
            displayUrl: data.metadata.displayUrl,
            subdomain: data.metadata.subdomain,
          },
        });
      }
    }
  });
  
  // Sort by similarity score and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Vector search across multiple clients
export async function vectorSearchAcrossClients(
  queryEmbedding: number[],
  options: {
    clientFolders: string[];
    limit?: number;
    version?: string;
    threshold?: number;
  }
): Promise<FirestoreSearchResult[]> {
  const { clientFolders, limit = 10, version, threshold = 0.1 } = options;
  
  if (!clientFolders || clientFolders.length === 0) {
    throw new Error('At least one client folder is required for multi-client search');
  }
  
  // Search each client collection and combine results
  const allResults: FirestoreSearchResult[] = [];
  
  for (const clientFolder of clientFolders) {
    try {
      const clientResults = await vectorSearchInClient(
        clientFolder,
        queryEmbedding,
        { limit, version, threshold }
      );
      allResults.push(...clientResults);
    } catch (error) {
      console.warn(`Failed to search client ${clientFolder}:`, error);
      // Continue with other clients
    }
  }
  
  // Sort combined results and return top matches
  return allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Multi-query vector search
export async function multiQueryVectorSearch(
  queryEmbeddings: number[][],
  options: {
    limit?: number;
    clientFolder?: string;
    version?: string;
    threshold?: number;
  } = {}
): Promise<FirestoreSearchResult[]> {
  const db = getFirestoreInstance();
  const { limit = 10, clientFolder, version, threshold = 0.1 } = options;
  
  let query: Query<DocumentData> = db.collection(COLLECTIONS.DOCUMENT_CHUNKS);
  
  // Apply filters
  if (clientFolder) {
    if (clientFolder === 'public') {
      query = query.where('metadata.clientFolder', '==', 'public');
    } else {
      query = query.where('metadata.clientFolder', '==', clientFolder);
    }
  }
  
  if (version) {
    query = query.where('metadata.version', '==', version);
  }
  
  const snapshot = await query.get();
  
  const resultsMap = new Map<string, FirestoreSearchResult>();
  
  snapshot.forEach(doc => {
    const data = doc.data() as FirestoreDocumentChunk;
    
    if (data.embedding && data.embedding.length > 0) {
      // Calculate maximum similarity across all query embeddings
      const maxSimilarity = Math.max(
        ...queryEmbeddings.map(queryEmbedding => 
          calculateCosineSimilarity(queryEmbedding, data.embedding)
        )
      );
      
      if (maxSimilarity >= threshold) {
        const existingResult = resultsMap.get(data.id);
        
        // Keep the result with the highest score
        if (!existingResult || maxSimilarity > existingResult.score) {
          resultsMap.set(data.id, {
            id: data.id,
            content: data.content,
            title: data.title,
            url: data.url,
            score: maxSimilarity,
            metadata: {
              source: data.metadata.source,
              chunkIndex: data.metadata.chunkIndex,
              totalChunks: data.metadata.totalChunks,
              timestamp: data.metadata.timestamp,
              clientFolder: data.metadata.clientFolder,
              version: data.metadata.version,
            },
          });
        }
      }
    }
  });
  
  // Convert to array, sort by score, and return top results
  return Array.from(resultsMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Delete document chunks by source (Legacy function)
export async function deleteDocumentChunksBySource(source: string): Promise<void> {
  const db = getFirestoreInstance();
  const query = db.collection(COLLECTIONS.DOCUMENT_CHUNKS).where('metadata.source', '==', source);
  
  const snapshot = await query.get();
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}

// Check if document chunks exist for a source (Legacy function)
export async function documentChunksExist(source: string): Promise<boolean> {
  const db = getFirestoreInstance();
  const query = db.collection(COLLECTIONS.DOCUMENT_CHUNKS)
    .where('metadata.source', '==', source)
    .limit(1);
  
  const snapshot = await query.get();
  return !snapshot.empty;
}

// Delete document chunks by source in client-specific collection
export async function deleteClientDocumentChunksBySource(
  clientFolder: string,
  source: string
): Promise<void> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific deletion');
  }
  
  const db = getFirestoreInstance();
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  const query = db.collection(collectionName).where('metadata.source', '==', source);
  
  const snapshot = await query.get();
  
  // Firestore batch has a limit of 500 operations
  const batchSize = 500;
  const docs = snapshot.docs;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = docs.slice(i, i + batchSize);
    
    batchDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }
}

// Delete all documents for a client
export async function deleteAllClientDocuments(clientFolder: string): Promise<void> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client deletion');
  }
  
  const db = getFirestoreInstance();
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  
  // Get all documents in the collection
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`No documents found for client: ${clientFolder}`);
    return;
  }
  
  // Delete in batches
  const batchSize = 500;
  const docs = snapshot.docs;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = docs.slice(i, i + batchSize);
    
    batchDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }
  
  console.log(`Deleted ${docs.length} documents for client: ${clientFolder}`);
}

// Check if document chunks exist for a source in client collection
export async function clientDocumentChunksExist(
  clientFolder: string,
  source: string
): Promise<boolean> {
  if (!clientFolder) {
    throw new Error('Client folder is required for client-specific check');
  }
  
  const db = getFirestoreInstance();
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  const query = db.collection(collectionName)
    .where('metadata.source', '==', source)
    .limit(1);
  
  const snapshot = await query.get();
  return !snapshot.empty;
}

// Get client statistics
export async function getClientStats(clientFolder: string): Promise<{
  totalChunks: number;
  versions: string[];
  lastUpdated: string | null;
}> {
  if (!clientFolder) {
    throw new Error('Client folder is required for stats');
  }
  
  const db = getFirestoreInstance();
  const collectionName = COLLECTIONS.CLIENT_CHUNKS(clientFolder);
  
  const snapshot = await db.collection(collectionName).get();
  
  const versions = new Set<string>();
  let lastUpdated: string | null = null;
  
  snapshot.forEach(doc => {
    const data = doc.data() as FirestoreDocumentChunk;
    if (data.metadata.version) {
      versions.add(data.metadata.version);
    }
    if (data.metadata.timestamp && (!lastUpdated || data.metadata.timestamp > lastUpdated)) {
      lastUpdated = data.metadata.timestamp;
    }
  });
  
  return {
    totalChunks: snapshot.size,
    versions: Array.from(versions).sort(),
    lastUpdated,
  };
}

// List all client collections
export async function listAllClients(): Promise<string[]> {
  const db = getFirestoreInstance();
  
  // Note: Firestore doesn't have a direct way to list collections
  // This is a workaround that checks for known patterns
  // In production, you might want to maintain a separate metadata collection
  
  const clients: string[] = [];
  
  // This is a simplified approach - in reality you'd want to maintain
  // a metadata collection that tracks all client folders
  console.warn('listAllClients() is a placeholder. Consider maintaining a client registry collection.');
  
  return clients;
} 