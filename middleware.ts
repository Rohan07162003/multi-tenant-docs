import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';
  const pathname = url.pathname;
  
  // Extract subdomain and version from hostname and path
  const { clientFolder } = parseSubdomain(hostname);
  const { version, newPathname } = parseVersionFromPath(pathname);

  // If we have a client folder, add context to headers
  if (clientFolder) {
    // Set version header if version was found in path
    if (version) {
      // Rewrite the URL to remove the version from the path
      // e.g., /docs/v1/page -> /docs/page
      url.pathname = newPathname;
      
      // Create rewrite response and set headers on it
      const response = NextResponse.rewrite(url);
      response.headers.set('x-client-subdomain', clientFolder);
      response.headers.set('x-client-folder', clientFolder);
      response.headers.set('x-client-version', version);
      
      return response;
    }
    
    // For requests without version, just set client headers
    const response = NextResponse.next();
    response.headers.set('x-client-subdomain', clientFolder);
    response.headers.set('x-client-folder', clientFolder);
    
    return response;
  }
  
  // For main domain without subdomain, proceed normally
  return NextResponse.next();
}

function parseSubdomain(hostname: string): { clientFolder: string | null } {
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

function parseVersionFromPath(pathname: string): { version: string | null; newPathname: string } {
  // Match /docs/v1, /docs/v2, etc. (standard pattern)
  const standardVersionMatch = pathname.match(/^\/docs\/(v\d+)(?:\/(.*))?$/);
  
  if (standardVersionMatch) {
    const version = standardVersionMatch[1];
    const remainingPath = standardVersionMatch[2] || '';
    return { version, newPathname: `/docs/${remainingPath}` };
  }
  
  // Match /docs/clientFolder/v1, /docs/clientFolder/v2, etc. (search result URLs)
  const clientVersionMatch = pathname.match(/^\/docs\/[^\/]+\/(v\d+)(?:\/(.*))?$/);
  
  if (clientVersionMatch) {
    const version = clientVersionMatch[1];
    const remainingPath = clientVersionMatch[2] || '';
    return { version, newPathname: `/docs/${remainingPath}` };
  }
  
  return { version: null, newPathname: pathname };
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * But include the search API route for domain filtering
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    // Explicitly match important routes
    '/docs/:path*',
    '/api/search/:path*',
  ],
};