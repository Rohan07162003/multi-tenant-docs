# Firestore Vector Search Setup

This guide explains how to set up and use the Firestore-based vector search pipeline for your multi-query RAG system.

## Prerequisites

1. **Firebase Project**: Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. **Firestore Database**: Enable Firestore in your Firebase project
3. **Gemini API Key**: Get an API key for Google's Gemini models

## Environment Variables

Add these environment variables to your `.env.local` file:

```env
# Required: Gemini AI for embeddings and query generation
GEMINI_API_KEY=your_gemini_api_key_here

# Required: Firebase project ID
FIREBASE_PROJECT_ID=your_firebase_project_id_here

# Optional: Service account key for local development
# For production, use default application credentials
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...",...}'
```

## Firebase Setup

### 1. Create Service Account (for local development)

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Set the entire JSON content as `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

### 2. Firestore Security Rules

Update your Firestore security rules to allow read/write access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write to document_chunks collection
    match /document_chunks/{document=**} {
      allow read, write: if true; // Adjust based on your auth requirements
    }
    
    // Allow read/write to embeddings collection
    match /embeddings/{document=**} {
      allow read, write: if true; // Adjust based on your auth requirements
    }
  }
}
```

### 3. Create Firestore Indexes

Create these indexes in Firestore for better performance:

1. **Composite Index for Client Filtering**:
   - Collection: `document_chunks`
   - Fields: `metadata.clientFolder` (Ascending), `metadata.version` (Ascending)

2. **Single Field Indexes**:
   - Collection: `document_chunks`
   - Field: `metadata.source` (Ascending)
   - Field: `metadata.clientFolder` (Ascending)
   - Field: `metadata.version` (Ascending)

## Usage

### 1. Index Documents

Use the document indexing API to populate Firestore with your documentation:

```bash
# Index sample documents
curl -X POST http://localhost:3000/api/index-documents \
  -H "Content-Type: application/json" \
  -d '{
    "action": "index",
    "documents": [
      {
        "title": "Getting Started",
        "content": "This is a comprehensive guide to getting started with our API...",
        "url": "/docs/acme-corp/v1/getting-started",
        "clientFolder": "acme-corp",
        "version": "v1"
      }
    ],
    "options": {
      "maxChunkSize": 1000,
      "overlapSize": 200,
      "minChunkSize": 100
    }
  }'
```

### 2. Test Vector Search

Once documents are indexed, test the multi-query RAG:

```bash
# Test multi-query RAG with Firestore
curl -X POST http://localhost:3000/api/multi-query-rag \
  -H "Content-Type: application/json" \
  -H "x-client-folder: acme-corp" \
  -H "x-client-version: v1" \
  -d '{
    "query": "How do I authenticate users?",
    "maxQueries": 5,
    "maxResults": 10,
    "useFirestore": true
  }'
```

### 3. Check Document Status

Verify if documents are indexed:

```bash
# Check if documents exist for a source
curl -X POST http://localhost:3000/api/index-documents \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check",
    "source": "/docs/acme-corp/v1/getting-started"
  }'
```

## API Endpoints

### Multi-Query RAG: `/api/multi-query-rag`
- **Method**: POST
- **Features**: 
  - Query expansion using Gemini
  - Hybrid search (Fumadocs + Firestore)
  - Subdomain-aware filtering
  - Version-specific results

### Document Indexing: `/api/index-documents`
- **Method**: POST
- **Actions**:
  - `index`: Add documents to Firestore
  - `delete`: Remove documents by source
  - `check`: Verify document existence

## Data Structure

### Document Chunks in Firestore

```javascript
{
  id: "unique_chunk_id",
  content: "chunk of document content",
  title: "Document Title",
  url: "/docs/client/version/page",
  embedding: [0.1, 0.2, ...], // 768-dimensional vector
  metadata: {
    source: "/docs/client/version/page",
    chunkIndex: 0,
    totalChunks: 5,
    timestamp: "2024-01-01T00:00:00Z",
    clientFolder: "acme-corp",
    version: "v1",
    contentHash: "md5_hash"
  },
  createdAt: FirestoreTimestamp,
  updatedAt: FirestoreTimestamp
}
```

## Features

### 1. **Subdomain-Aware Search**
- Automatically filters results based on client subdomain
- Supports multi-tenant documentation

### 2. **Version-Specific Results**
- Filters by document version (v1, v2, etc.)
- Ensures users see relevant version content

### 3. **Intelligent Chunking**
- Splits documents at sentence/paragraph boundaries
- Configurable chunk size with overlap
- Prevents context loss at chunk boundaries

### 4. **Vector Similarity Search**
- Uses Gemini embeddings for semantic search
- Cosine similarity scoring
- Configurable similarity threshold

### 5. **Query Expansion**
- Generates related queries using Gemini
- Improves search coverage and relevance
- Deduplicates results across queries

## Performance Considerations

1. **Rate Limiting**: The indexer includes delays to respect Gemini API rate limits
2. **Batch Processing**: Documents are processed in batches for efficiency
3. **Caching**: Consider implementing caching for frequently accessed embeddings
4. **Indexes**: Create appropriate Firestore indexes for your query patterns

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify Firebase service account key
   - Check project ID matches your Firebase project

2. **No Search Results**:
   - Confirm documents are indexed (use check endpoint)
   - Verify client context headers are set correctly
   - Check similarity threshold (lower for more results)

3. **Rate Limit Errors**:
   - Reduce batch size in indexer
   - Increase delays between requests
   - Monitor Gemini API usage

### Debug Logging

The implementation includes comprehensive logging. Check your server logs for:
- Document indexing progress
- Search query processing
- Client context detection
- Firestore query results

## Migration from Mock Data

The real Firestore implementation replaces the mock data entirely. To migrate:

1. Set up Firestore as described above
2. Index your documentation using the indexing API
3. The multi-query RAG will automatically use real data
4. Remove any references to mock data

## Next Steps

1. **Index Your Documentation**: Use the indexing API to populate Firestore
2. **Optimize Chunking**: Adjust chunk size and overlap for your content
3. **Monitor Performance**: Track search relevance and response times
4. **Scale**: Consider using Firestore's vector search when it becomes available 