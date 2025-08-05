'use client';

import React, { useState } from 'react';

interface MultiQueryRAGResult {
  title: string;
  url: string;
  content: string;
  score: number;
  source: 'fumadocs' | 'firestore';
}

interface FirestoreResult {
  id: string;
  content: string;
  title: string;
  url: string;
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
  firestoreResults: FirestoreResult[];
  finalAnswer: string;
  totalResults: number;
  modelUsed: string;
  clientContext: {
    clientFolder?: string;
    version?: string;
    searchScope: 'single-client' | 'multi-client';
  };
}

interface MultiQueryRAGProps {
  className?: string;
}

// Helper function to render markdown text properly
function renderMarkdownText(text: string): string {
  // Convert markdown formatting to plain text with better formatting
  return text
    // Convert **bold** to bold
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Convert *italic* to italic  
    .replace(/\*(.*?)\*/g, '$1')
    // Convert ### headings to better format
    .replace(/###\s*(.*?)$/gm, '📋 $1')
    // Convert ## headings to better format
    .replace(/##\s*(.*?)$/gm, '📌 $1')
    // Convert # headings to better format
    .replace(/#\s*(.*?)$/gm, '🔹 $1')
    // Convert - list items to bullet points
    .replace(/^-\s+/gm, '• ')
    // Clean up extra spaces and line breaks
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

// Component to render formatted text
function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  const formattedText = renderMarkdownText(text);
  
  return (
    <div className={`${className} whitespace-pre-line leading-relaxed`}>
      {formattedText.split('\n').map((line, index) => {
        // Handle different types of formatted lines
        if (line.startsWith('📌 ') || line.startsWith('📋 ') || line.startsWith('🔹 ')) {
          return (
            <div key={index} className="font-semibold text-gray-900 mt-4 mb-2 first:mt-0">
              {line}
            </div>
          );
        } else if (line.startsWith('• ')) {
          return (
            <div key={index} className="ml-4 mb-1">
              {line}
            </div>
          );
        } else if (line.trim() === '') {
          return <div key={index} className="h-3" />;
        } else {
          return (
            <div key={index} className="mb-2">
              {line}
            </div>
          );
        }
      })}
    </div>
  );
}

export function MultiQueryRAG({ className = '' }: MultiQueryRAGProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MultiQueryRAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFirestore, setUseFirestore] = useState(true);
  const [showFirestoreDetails, setShowFirestoreDetails] = useState(false);
  const [tokenOptimization, setTokenOptimization] = useState<'aggressive' | 'balanced' | 'quality'>('balanced');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/multi-query-rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          maxQueries: tokenOptimization === 'aggressive' ? 2 : tokenOptimization === 'quality' ? 5 : 3,
          maxResults: 10,
          useFirestore,
          tokenOptimization,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed: ${response.statusText}`);
      }

      const data: MultiQueryRAGResponse = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Enhanced Search Input */}
      <div className="space-y-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
          <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything about the documentation... (e.g., 'How do I implement user authentication?' or 'What are the API rate limits?')"
              className="w-full p-6 border-0 bg-transparent resize-none focus:ring-0 focus:outline-none min-h-[120px] text-gray-800 placeholder-gray-500 text-lg"
              rows={3}
              disabled={isLoading}
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-4">
              {/* Token Optimization Selector */}
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600 font-medium">Quality:</label>
                <select
                  value={tokenOptimization}
                  onChange={(e) => setTokenOptimization(e.target.value as 'aggressive' | 'balanced' | 'quality')}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  <option value="aggressive">Fast (Lower cost)</option>
                  <option value="balanced">Balanced</option>
                  <option value="quality">Detailed (Higher cost)</option>
                </select>
              </div>
              
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={useFirestore}
                  onChange={(e) => setUseFirestore(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">Vector search</span>
              </label>
              <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Searching with AI...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Enhanced info section with token optimization explanation */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 text-sm text-gray-600 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-xl p-4">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p>
              <span className="font-medium text-blue-700">Powered by Gemini 2.0 Flash-Lite:</span> Cost-efficient AI model with enhanced reasoning capabilities.
            </p>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-600 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <p>
              <span className="font-medium text-green-700">Token Optimization:</span> 
              <span className={`ml-1 px-2 py-1 rounded text-xs font-bold ${
                tokenOptimization === 'aggressive' ? 'bg-green-100 text-green-800' :
                tokenOptimization === 'quality' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {tokenOptimization === 'aggressive' ? 'Fast & Efficient' :
                 tokenOptimization === 'quality' ? 'Detailed Analysis' :
                 'Balanced Approach'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Error Display */}
      {error && (
        <div className="p-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-red-800 text-lg mb-2">Search Error</h4>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Results */}
      {results && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Model Info & Results Summary */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-indigo-900">Search Summary</h3>
                  <p className="text-sm text-indigo-700">Model: {results.modelUsed}</p>
                </div>
              </div>
              {results.firestoreResults.length > 0 && (
                <button
                  onClick={() => setShowFirestoreDetails(!showFirestoreDetails)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 underline font-medium"
                >
                  {showFirestoreDetails ? 'Hide' : 'Show'} Vector Details
                </button>
              )}
            </div>

            {/* Client Context Display */}
            {results.clientContext && (
              <div className="mb-4 p-3 bg-white/60 rounded-lg border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                  </svg>
                  <span className="font-medium text-indigo-900">Search Context</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-indigo-700 font-medium">Client:</span>
                    <span className="ml-2 text-indigo-600">
                      {results.clientContext.clientFolder || 'All Clients'}
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-700 font-medium">Version:</span>
                    <span className="ml-2 text-indigo-600">
                      {results.clientContext.version || 'All Versions'}
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-700 font-medium">Scope:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                      results.clientContext.searchScope === 'single-client' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {results.clientContext.searchScope === 'single-client' ? 'Single Client' : 'Multi-Client'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/60 rounded-lg p-3">
                <span className="font-medium text-blue-700">Search Results:</span>
                <span className="ml-2 font-bold">{results.results.filter(r => r.source === 'fumadocs').length}</span>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <span className="font-medium text-green-700">Vector Results:</span>
                <span className="ml-2 font-bold">{results.firestoreResults.length}</span>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <span className="font-medium text-purple-700">Queries Generated:</span>
                <span className="ml-2 font-bold">{results.queryResults?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Vector Search Details */}
          {showFirestoreDetails && results.firestoreResults.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg">
              <h3 className="font-semibold text-green-900 mb-4 text-lg flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                Vector Embedding Results
              </h3>
              <div className="space-y-3">
                {results.firestoreResults.slice(0, 5).map((result, index) => (
                  <div key={result.id} className="bg-white/60 rounded-lg p-4 text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-green-800">{result.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-bold">
                          {result.score.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <FormattedText text={result.content.substring(0, 300)} className="text-green-700 text-xs mb-2" />
                    {result.metadata && (
                      <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">
                        Source: {result.metadata.source} • Chunk {result.metadata.chunkIndex + 1}/{result.metadata.totalChunks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Answer Section */}
          {results.finalAnswer && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-8 shadow-lg">
              <h3 className="font-semibold text-emerald-900 mb-6 flex items-center gap-3 text-2xl">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Comprehensive Answer
              </h3>
              <FormattedText text={results.finalAnswer} className="text-emerald-800 text-lg" />
            </div>
          )}

          {/* Query Results with Summaries */}
          {results.queryResults && results.queryResults.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Detailed Analysis by Topic
              </h3>
              
              {results.queryResults.map((queryResult, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                  {/* Query Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-bold">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-blue-900 mb-2">
                          {queryResult.query}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-blue-700">
                          <span className="bg-blue-100 px-3 py-1 rounded-full font-medium">
                            {queryResult.results.length} source{queryResult.results.length !== 1 ? 's' : ''} found
                          </span>
                          {index === 0 && (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                              Your Original Question
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary with improved formatting */}
                  <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-purple-800">AI Analysis</span>
                    </div>
                    <FormattedText text={queryResult.summary} className="text-gray-800" />
                  </div>

                  {/* Source Documents */}
                  {queryResult.results.length > 0 && (
                    <div className="p-6 border-t border-gray-100">
                      <h5 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0118 12a8 8 0 10-8 8 7.962 7.962 0 005.291-2z" />
                        </svg>
                        Source Documents ({queryResult.results.length})
                      </h5>
                      <div className="grid gap-3">
                        {queryResult.results.slice(0, 3).map((result, resultIndex) => (
                          <div key={resultIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex justify-between items-start mb-2">
                              <h6 className="font-medium text-gray-900 text-sm">
                                <a 
                                  href={result.displayUrl || result.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-blue-600"
                                >
                                  {result.title}
                                </a>
                              </h6>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  result.source === 'firestore' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {result.source === 'firestore' ? 'Vector' : 'Search'}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
                                  {result.score.toFixed(3)}
                                </span>
                              </div>
                            </div>
                            <FormattedText text={result.content.substring(0, 300)} className="text-xs text-gray-600" />
                          </div>
                        ))}
                        {queryResult.results.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded-lg border border-gray-200">
                            + {queryResult.results.length - 3} more result{queryResult.results.length - 3 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Related Questions Summary */}
          {results.augmentedQueries.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg">
              <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-3 text-lg">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Related Topics Explored
              </h3>
              <div className="text-sm text-green-700 mb-4 bg-green-50 rounded-lg p-3 border border-green-200">
                💡 The AI generated these related questions to provide comprehensive coverage. Each has its detailed analysis above.
              </div>
              <div className="grid gap-3">
                {results.augmentedQueries.map((augQuery, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-white/60 rounded-xl border border-green-100">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-green-600 text-sm font-medium">{index + 2}</span>
                    </div>
                    <span className="text-green-800 font-medium">{augQuery}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 