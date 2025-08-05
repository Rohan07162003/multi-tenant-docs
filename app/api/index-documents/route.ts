import { NextRequest, NextResponse } from 'next/server';
import { indexContent, indexDocuments } from '@/lib/document-indexer';
import { deleteDocumentChunksBySource, documentChunksExist } from '@/lib/firestore';

interface IndexRequest {
  action: 'index' | 'delete' | 'check';
  documents?: Array<{
    title: string;
    content: string;
    url: string;
    clientFolder?: string;
    version?: string;
  }>;
  source?: string;
  options?: {
    maxChunkSize?: number;
    overlapSize?: number;
    minChunkSize?: number;
  };
}

interface IndexResponse {
  success: boolean;
  message: string;
  documentsProcessed?: number;
  error?: string;
  exists?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse<IndexResponse>> {
  try {
    const body: IndexRequest = await request.json();
    const { action, documents, source, options } = body;

    console.log('Document indexing request:', { action, documentsCount: documents?.length, source });

    switch (action) {
      case 'index':
        if (!documents || documents.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'No documents provided for indexing',
          }, { status: 400 });
        }

        // Validate documents
        for (const doc of documents) {
          if (!doc.title || !doc.content || !doc.url) {
            return NextResponse.json({
              success: false,
              message: 'Each document must have title, content, and url',
            }, { status: 400 });
          }
        }

        await indexDocuments(documents, options);

        return NextResponse.json({
          success: true,
          message: `Successfully indexed ${documents.length} documents`,
          documentsProcessed: documents.length,
        });

      case 'delete':
        if (!source) {
          return NextResponse.json({
            success: false,
            message: 'Source is required for deletion',
          }, { status: 400 });
        }

        await deleteDocumentChunksBySource(source);

        return NextResponse.json({
          success: true,
          message: `Successfully deleted documents for source: ${source}`,
        });

      case 'check':
        if (!source) {
          return NextResponse.json({
            success: false,
            message: 'Source is required for checking',
          }, { status: 400 });
        }

        const exists = await documentChunksExist(source);

        return NextResponse.json({
          success: true,
          message: `Documents ${exists ? 'exist' : 'do not exist'} for source: ${source}`,
          exists,
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Must be one of: index, delete, check',
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Document indexing error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Internal server error during document indexing',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Document Indexing API',
    description: 'Index documents into Firestore for vector search',
    endpoints: {
      POST: {
        description: 'Index, delete, or check documents',
        actions: {
          index: 'Index documents into Firestore',
          delete: 'Delete documents by source',
          check: 'Check if documents exist for a source',
        },
        exampleRequests: {
          index: {
            action: 'index',
            documents: [
              {
                title: 'Example Document',
                content: 'This is the content of the document...',
                url: '/docs/example',
                clientFolder: 'acme-corp',
                version: 'v1',
              }
            ],
            options: {
              maxChunkSize: 1000,
              overlapSize: 200,
              minChunkSize: 100,
            }
          },
          delete: {
            action: 'delete',
            source: '/docs/example'
          },
          check: {
            action: 'check',
            source: '/docs/example'
          }
        }
      }
    },
    requirements: [
      'FIREBASE_PROJECT_ID environment variable',
      'FIREBASE_SERVICE_ACCOUNT_KEY environment variable (optional)',
      'GEMINI_API_KEY environment variable for embeddings',
    ]
  });
} 