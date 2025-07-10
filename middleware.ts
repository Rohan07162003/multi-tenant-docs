import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';
  
  // Extract subdomain from hostname
  const { clientFolder, version } = parseSubdomain(hostname);

  // If we have a client folder, add context to headers
  if (clientFolder) {
    const response = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    
    response.headers.set('x-client-subdomain', clientFolder);
    response.headers.set('x-client-folder', clientFolder);
    
    // Only set version header if version was explicitly found
    if (version) {
      response.headers.set('x-client-version', version);
    }
    
    return response;
  }
  
  // For main domain without subdomain, proceed normally
  return NextResponse.next();
}

function parseSubdomain(hostname: string): { clientFolder: string | null; version: string | null } {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Split hostname into parts
  const parts = host.split('.');
  
  // Handle localhost development
  if (host.includes('.localhost')) {
    // Examples: 
    // acme-corp.docs.localhost -> ['acme-corp', 'docs', 'localhost']
    // acme-corp.v1.docs.localhost -> ['acme-corp', 'v1', 'docs', 'localhost']
    
    if (parts.length === 4 && parts[2] === 'docs') {
      // Format: client.version.docs.localhost
      const clientFolder = parts[0];
      const version = parts[1];
      return { clientFolder, version };
    } else if (parts.length === 3 && parts[1] === 'docs') {
      // Format: client.docs.localhost
      const clientFolder = parts[0];
      return { clientFolder, version: null };
    }
  } else {
    // Production domain handling
    // Two scenarios:
    // 1. clientName.docs.domain.com (parts[1] === 'docs')
    // 2. clientName.version.docs.domain.com (parts[2] === 'docs')
    
    if (parts.length >= 3 && parts[1] === 'docs') {
      // Scenario 1: clientName.docs.domain.com
      const clientFolder = parts[0];
      return { clientFolder, version: null };
    } else if (parts.length >= 4 && parts[2] === 'docs') {
      // Scenario 2: clientName.version.docs.domain.com
      const clientFolder = parts[0];
      const version = parts[1];
      // Validate version format
      if (version.startsWith('v')) {
        return { clientFolder, version };
      }
    }
  }
  
  return { clientFolder: null, version: null };
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
  ],
}; 