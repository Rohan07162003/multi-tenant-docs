import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { NextRequest } from 'next/server';

// Helper functions to parse subdomain and version (copied from middleware.ts)
function parseSubdomainFromHost(hostname: string): { clientFolder: string | null } {
  const host = hostname.split(':')[0];
  const parts = host.split('.');
  
  // Special case: docs.localhost or docs.domain - routes to public folder
  if (parts.length >= 2 && parts[0] === 'docs') {
    return { clientFolder: 'public' };
  }
  
  // For client subdomains: clientName.docs.domain
  if (parts.length >= 3 && parts[1] === 'docs') {
    return { clientFolder: parts[0] };
  }
  
  return { clientFolder: null };
}

function parseVersionFromPath(pathname: string): { version: string | null } {
  // Match /docs/v1, /docs/v2, etc. (standard pattern)
  const standardVersionMatch = pathname.match(/^\/docs\/(v\d+)(?:\/(.*))?$/);
  
  if (standardVersionMatch) {
    const version = standardVersionMatch[1];
    return { version };
  }
  
  // Match /docs/clientFolder/v1, /docs/clientFolder/v2, etc. (search result URLs)
  const clientVersionMatch = pathname.match(/^\/docs\/[^\/]+\/(v\d+)(?:\/(.*))?$/);
  
  if (clientVersionMatch) {
    const version = clientVersionMatch[1];
    return { version };
  }
  
  return { version: null };
}

const searchApi = createFromSource(source, {
  // https://docs.orama.com/open-source/supported-languages
  language: 'english',
});

export async function GET(request: NextRequest) {
  // Get the original search results
  const response = await searchApi.GET(request);
  
  if (!response.ok) {
    return response;
  }
  
  try {
    const data = await response.json();
    
    // Get client context from headers (set by middleware)
    let clientFolder = request.headers.get('x-client-folder');
    let version = request.headers.get('x-client-version');
    const host = request.headers.get('host');
    const referer = request.headers.get('referer');
    
    console.log('Search API Debug - All headers:');
    console.log('  Host:', host);
    console.log('  Referer:', referer);
    console.log('  x-client-folder:', clientFolder);
    console.log('  x-client-version:', version);
    
    // Fallback: Parse domain from referer if middleware headers aren't available
    if (!clientFolder && referer) {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname;
      const refererPath = refererUrl.pathname;
      
      console.log('Parsing from referer - hostname:', refererHost, 'pathname:', refererPath);
      
      // Parse subdomain from referer
      const { clientFolder: parsedClientFolder } = parseSubdomainFromHost(refererHost);
      clientFolder = parsedClientFolder;
      
      // Parse version from referer path
      const { version: parsedVersion } = parseVersionFromPath(refererPath);
      version = parsedVersion;
      
      console.log('Parsed from referer - clientFolder:', clientFolder, 'version:', version);
    }
    
    if (data.results) {
      console.log('Processing search results for client:', clientFolder, 'version:', version);
      
      if (clientFolder && clientFolder !== 'public') {
        // Filter results to only include pages from the current client domain
        console.log('Filtering results for client:', clientFolder);
        
        data.results = data.results.filter((result: any) => {
          if (result.document && result.document.url) {
            const url = result.document.url;
            // Only include results that belong to this client
            const belongsToClient = url.includes(`/docs/${clientFolder}/`);
            console.log(`URL ${url} belongs to client ${clientFolder}:`, belongsToClient);
            return belongsToClient;
          }
          return false;
        });
        
        // Transform URLs to remove client folder prefix for subdomain routing
        data.results = data.results.map((result: any) => {
          if (result.document && result.document.url) {
            const originalUrl = result.document.url;
            let transformedUrl = originalUrl;
            
            console.log('Original URL:', originalUrl);
            
            // Transform URL from /docs/clientFolder/version/page to /docs/version/page
            if (version) {
              const pattern = `/docs/${clientFolder}/${version}`;
              if (originalUrl.startsWith(pattern)) {
                transformedUrl = originalUrl.replace(pattern, `/docs/${version}`);
              }
            } else {
              // Fallback: remove client folder if no specific version
              const pattern = `/docs/${clientFolder}/`;
              if (originalUrl.startsWith(pattern)) {
                transformedUrl = originalUrl.replace(pattern, `/docs/`);
              }
            }
            
            console.log('Transformed URL:', transformedUrl);
            result.document.url = transformedUrl;
          }
          return result;
        });
      } else if (clientFolder === 'public') {
        // For public domain, only show public content
        console.log('Filtering results for public domain');
        
        data.results = data.results.filter((result: any) => {
          if (result.document && result.document.url) {
            const url = result.document.url;
            // Only include results that belong to the public folder
            const isPublic = url.includes('/docs/public/');
            console.log(`URL ${url} is public:`, isPublic);
            return isPublic;
          }
          return false;
        });
        
        // Transform URLs for public domain (remove /public/ from path)
        data.results = data.results.map((result: any) => {
          if (result.document && result.document.url) {
            const originalUrl = result.document.url;
            let transformedUrl = originalUrl;
            
            // Transform URL from /docs/public/version/page to /docs/version/page
            if (version) {
              const pattern = `/docs/public/${version}`;
              if (originalUrl.startsWith(pattern)) {
                transformedUrl = originalUrl.replace(pattern, `/docs/${version}`);
              }
            } else {
              // Fallback: remove public folder if no specific version
              const pattern = `/docs/public/`;
              if (originalUrl.startsWith(pattern)) {
                transformedUrl = originalUrl.replace(pattern, `/docs/`);
              }
            }
            
            result.document.url = transformedUrl;
          }
          return result;
        });
      }
      // If no clientFolder, show all results (main domain behavior)
    }
    
    // Return filtered and transformed results
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error processing search results:', error);
    // Fall back to original response if transformation fails
    return response;
  }
}
