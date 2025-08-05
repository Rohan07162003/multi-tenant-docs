import { NextRequest, NextResponse } from 'next/server';
import { indexLocalFiles, indexClientFiles } from '@/lib/manual-indexer';
import { getClientStats, deleteAllClientDocuments, deleteClientDocumentChunksBySource } from '@/lib/firestore';

interface ManualIndexRequest {
  action: 'index-all' | 'index-client' | 'delete-client' | 'delete-source' | 'get-stats';
  clientFolder?: string;
  version?: string;
  source?: string; // For delete-source action
  options?: {
    maxChunkSize?: number;
    overlapSize?: number;
    minChunkSize?: number;
  };
}

interface ManualIndexResponse {
  success: boolean;
  message: string;
  error?: string;
  stats?: {
    totalChunks: number;
    versions: string[];
    lastUpdated: string | null;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ManualIndexResponse>> {
  try {
    const body: ManualIndexRequest = await request.json();
    const { action, clientFolder, version, source, options } = body;

    console.log('Manual indexing request:', { action, clientFolder, version, source });

    switch (action) {
      case 'index-all':
        await indexLocalFiles(options);
        
        return NextResponse.json({
          success: true,
          message: 'Successfully indexed all local files into client-specific collections',
        });

      case 'index-client':
        if (!clientFolder) {
          return NextResponse.json({
            success: false,
            message: 'Client folder is required for index-client action',
          }, { status: 400 });
        }

        await indexClientFiles(clientFolder, version, options);
        
        return NextResponse.json({
          success: true,
          message: `Successfully indexed files for client: ${clientFolder}${version ? ` (${version})` : ''} in collection: ${clientFolder}_chunks`,
        });

      case 'delete-client':
        if (!clientFolder) {
          return NextResponse.json({
            success: false,
            message: 'Client folder is required for delete-client action',
          }, { status: 400 });
        }

        await deleteAllClientDocuments(clientFolder);
        
        return NextResponse.json({
          success: true,
          message: `Successfully deleted all documents for client: ${clientFolder}`,
        });

      case 'delete-source':
        if (!clientFolder || !source) {
          return NextResponse.json({
            success: false,
            message: 'Client folder and source are required for delete-source action',
          }, { status: 400 });
        }

        await deleteClientDocumentChunksBySource(clientFolder, source);
        
        return NextResponse.json({
          success: true,
          message: `Successfully deleted documents for source: ${source} in client: ${clientFolder}`,
        });

      case 'get-stats':
        if (!clientFolder) {
          return NextResponse.json({
            success: false,
            message: 'Client folder is required for get-stats action',
          }, { status: 400 });
        }

        const stats = await getClientStats(clientFolder);
        
        return NextResponse.json({
          success: true,
          message: `Statistics for client: ${clientFolder}`,
          stats,
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Must be one of: index-all, index-client, delete-client, delete-source, get-stats',
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Manual indexing error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Internal server error during manual indexing',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Manual Indexing API (Client-Specific Collections)',
    description: 'Index local markdown files into client-specific Firestore collections',
    note: 'This API uses the new client-specific collection structure for better isolation',
    endpoints: {
      POST: {
        description: 'Trigger manual indexing with client-specific collections',
        actions: {
          'index-all': 'Index all markdown files in content/docs/ into client-specific collections',
          'index-client': 'Index files for a specific client (and optionally version)',
          'delete-client': 'Delete all documents for a specific client',
          'delete-source': 'Delete documents for a specific source URL within a client',
          'get-stats': 'Get statistics for a specific client collection',
        },
        exampleRequests: {
          'index-all': {
            action: 'index-all',
            options: {
              maxChunkSize: 1000,
              overlapSize: 200,
              minChunkSize: 100,
            }
          },
          'index-client': {
            action: 'index-client',
            clientFolder: 'acme-corp',
            version: 'v1',
            options: {
              maxChunkSize: 1000,
              overlapSize: 200,
              minChunkSize: 100,
            }
          },
          'delete-client': {
            action: 'delete-client',
            clientFolder: 'acme-corp'
          },
          'delete-source': {
            action: 'delete-source',
            clientFolder: 'acme-corp',
            source: '/docs/acme-corp/v1/index'
          },
          'get-stats': {
            action: 'get-stats',
            clientFolder: 'acme-corp'
          }
        }
      }
    },
    collections: {
      format: '{clientFolder}_chunks',
      examples: [
        'acme-corp_chunks',
        'globaldyne-industries_chunks', 
        'techflow-solutions_chunks',
        'public_chunks'
      ]
    },
    requirements: [
      'FIREBASE_PROJECT_ID environment variable',
      'FIREBASE_SERVICE_ACCOUNT_KEY environment variable (optional)',
      'GEMINI_API_KEY environment variable for embeddings',
    ]
  });
} 