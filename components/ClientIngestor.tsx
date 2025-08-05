'use client';

import { useState } from 'react';

interface IngestResponse {
  success: boolean;
  message: string;
  error?: string;
  stats?: {
    totalChunks: number;
    versions: string[];
    lastUpdated: string | null;
  };
}

interface ClientStats {
  [clientFolder: string]: {
    totalChunks: number;
    versions: string[];
    lastUpdated: string | null;
  };
}

export default function ClientIngestor() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<{ [key: string]: IngestResponse }>({});
  const [stats, setStats] = useState<ClientStats>({});

  // Known client folders - you could also fetch this dynamically
  const clients = [
    'acme-corp',
    'globaldyne-industries', 
    'techflow-solutions',
    'public'
  ];

  const ingestClient = async (clientFolder: string, version?: string) => {
    const key = `${clientFolder}${version ? `-${version}` : ''}`;
    setLoading(key);
    
    try {
      const response = await fetch('/api/manual-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'index-client',
          clientFolder,
          version,
          options: {
            maxChunkSize: 1000,
            overlapSize: 200,
            minChunkSize: 100,
          }
        }),
      });

      const result: IngestResponse = await response.json();
      setResults(prev => ({ ...prev, [key]: result }));

      // If successful, get updated stats
      if (result.success) {
        await getClientStats(clientFolder);
      }
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [key]: { 
          success: false, 
          message: 'Failed to connect to server',
          error: error instanceof Error ? error.message : 'Unknown error'
        } 
      }));
    } finally {
      setLoading(null);
    }
  };

  const ingestAllClients = async () => {
    setLoading('all');
    
    try {
      const response = await fetch('/api/manual-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'index-all',
          options: {
            maxChunkSize: 1000,
            overlapSize: 200,
            minChunkSize: 100,
          }
        }),
      });

      const result: IngestResponse = await response.json();
      setResults(prev => ({ ...prev, all: result }));

      // If successful, get stats for all clients
      if (result.success) {
        for (const client of clients) {
          await getClientStats(client);
        }
      }
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        all: { 
          success: false, 
          message: 'Failed to connect to server',
          error: error instanceof Error ? error.message : 'Unknown error'
        } 
      }));
    } finally {
      setLoading(null);
    }
  };

  const getClientStats = async (clientFolder: string) => {
    try {
      const response = await fetch('/api/manual-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get-stats',
          clientFolder,
        }),
      });

      const result: IngestResponse = await response.json();
      if (result.success && result.stats) {
        setStats(prev => ({ ...prev, [clientFolder]: result.stats! }));
      }
    } catch (error) {
      console.error(`Failed to get stats for ${clientFolder}:`, error);
    }
  };

  const deleteClient = async (clientFolder: string) => {
    if (!confirm(`Are you sure you want to delete all documents for ${clientFolder}? This cannot be undone.`)) {
      return;
    }

    setLoading(`delete-${clientFolder}`);
    
    try {
      const response = await fetch('/api/manual-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete-client',
          clientFolder,
        }),
      });

      const result: IngestResponse = await response.json();
      setResults(prev => ({ ...prev, [`delete-${clientFolder}`]: result }));

      // Clear stats for this client
      if (result.success) {
        setStats(prev => ({ ...prev, [clientFolder]: { totalChunks: 0, versions: [], lastUpdated: null } }));
      }
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [`delete-${clientFolder}`]: { 
          success: false, 
          message: 'Failed to delete client documents',
          error: error instanceof Error ? error.message : 'Unknown error'
        } 
      }));
    } finally {
      setLoading(null);
    }
  };

  // Load initial stats on component mount
  useState(() => {
    clients.forEach(client => getClientStats(client));
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="border rounded-lg p-6 bg-gray-50">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Document Ingestion Control Panel</h2>
        <p className="text-gray-600 mb-6">
          Ingest markdown documentation files into client-specific Firestore collections for vector search.
        </p>

        {/* Ingest All Button */}
        <div className="mb-8">
          <button
            onClick={ingestAllClients}
            disabled={loading !== null}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading === 'all' ? 'Ingesting All Clients...' : 'Ingest All Clients'}
          </button>
          
          {results.all && (
            <div className={`mt-2 p-3 rounded ${results.all.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {results.all.message}
              {results.all.error && <div className="text-sm mt-1">Error: {results.all.error}</div>}
            </div>
          )}
        </div>

        {/* Individual Client Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clients.map(client => (
            <div key={client} className="border rounded-lg p-4 bg-white">
              <h3 className="text-lg font-semibold mb-2 capitalize text-gray-800">
                {client.replace('-', ' ')}
              </h3>
              
              {/* Stats */}
              {stats[client] && (
                <div className="text-sm text-gray-600 mb-3">
                  <div>Chunks: {stats[client].totalChunks}</div>
                  <div>Versions: {stats[client].versions.join(', ') || 'None'}</div>
                  {stats[client].lastUpdated && (
                    <div>Last Updated: {new Date(stats[client].lastUpdated).toLocaleString()}</div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => ingestClient(client)}
                  disabled={loading !== null}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  {loading === client ? 'Ingesting...' : 'Ingest All Versions'}
                </button>

                <button
                  onClick={() => getClientStats(client)}
                  disabled={loading !== null}
                  className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  Refresh Stats
                </button>

                <button
                  onClick={() => deleteClient(client)}
                  disabled={loading !== null}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  {loading === `delete-${client}` ? 'Deleting...' : 'Delete All Documents'}
                </button>
              </div>

              {/* Results */}
              {results[client] && (
                <div className={`mt-3 p-2 rounded text-sm ${results[client].success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {results[client].message}
                  {results[client].error && <div className="mt-1">Error: {results[client].error}</div>}
                </div>
              )}

              {results[`delete-${client}`] && (
                <div className={`mt-3 p-2 rounded text-sm ${results[`delete-${client}`].success ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                  {results[`delete-${client}`].message}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* API Information */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Collection Structure</h4>
          <div className="text-sm text-blue-700">
            <div>• Documents are stored in client-specific collections: <code>{`{client}_chunks`}</code></div>
            <div>• Examples: <code>acme-corp_chunks</code>, <code>globaldyne-industries_chunks</code></div>
            <div>• Each collection contains document chunks with embeddings for vector search</div>
          </div>
        </div>
      </div>
    </div>
  );
} 