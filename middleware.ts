import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';
  const pathname = url.pathname;
  
  console.log('=== MIDDLEWARE START ===');
  console.log('Processing request:', pathname);
  console.log('Hostname:', hostname);
  
  // Extract subdomain and version from hostname and path
  const { clientFolder } = parseSubdomain(hostname);
  const { version, newPathname } = parseVersionFromPath(pathname);

  console.log('clientFolder', clientFolder);
  console.log('version', version);
  console.log('original pathname', pathname);
  console.log('new pathname', newPathname);

  // If we have a client folder, add context to headers
  if (clientFolder) {
    console.log('Setting headers for client:', clientFolder);
    
    // Set version header if version was found in path
    if (version) {
      console.log('Setting version header:', version);
      
      // Rewrite the URL to remove the version from the path
      // e.g., /docs/v1/page -> /docs/page
      console.log('Rewriting URL from', pathname, 'to', newPathname);
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
    
    console.log('Returning response with client headers (no version)');
    return response;
  }
  
  console.log('No client folder found, proceeding normally');
  console.log('=== MIDDLEWARE END ===');
  // For main domain without subdomain, proceed normally
  return NextResponse.next();
}

function parseSubdomain(hostname: string): { clientFolder: string | null } {
  console.log('=== MIDDLEWARE DEBUG ===');
  console.log('Original hostname:', hostname);
  
  const host = hostname.split(':')[0];
  console.log('Host after port removal:', host);
  
  const parts = host.split('.');
  console.log('Host parts:', parts);
  console.log('Parts length:', parts.length);
  
  // Special case: docs.localhost or docs.domain - routes to public folder
  if (parts.length >= 2 && parts[0] === 'docs') {
    console.log('Matched docs pattern, returning public');
    return { clientFolder: 'public' };
  }
  
  // For client subdomains: clientName.docs.domain
  if (parts.length >= 3 && parts[1] === 'docs') {
    const clientFolder = parts[0];
    console.log('Matched client pattern, returning:', clientFolder);
    return { clientFolder };
  }
  
  console.log('No pattern matched, returning null');
  console.log('=== END DEBUG ===');
  return { clientFolder: null };
}

function parseVersionFromPath(pathname: string): { version: string | null; newPathname: string } {
  console.log('=== VERSION PARSING ===');
  console.log('Original pathname:', pathname);
  
  // Match /docs/v1, /docs/v2, etc.
  const versionMatch = pathname.match(/^\/docs\/(v\d+)(?:\/(.*))?$/);
  
  if (versionMatch) {
    const version = versionMatch[1]; // e.g., 'v1'
    const remainingPath = versionMatch[2] || ''; // everything after /docs/v1/
    const newPathname = `/docs/${remainingPath}`;
    
    console.log('Found version in path:', version);
    console.log('Remaining path:', remainingPath);
    console.log('New pathname:', newPathname);
    
    return { version, newPathname };
  }
  
  console.log('No version found in path');
  return { version: null, newPathname: pathname };
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    // Explicitly match docs routes
    '/docs/:path*',
  ],
};