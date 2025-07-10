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
    // acme-corp.localhost -> ['acme-corp', 'localhost']
    // acme-corp.v1.localhost -> ['acme-corp', 'v1', 'localhost']
    
    if (parts.length === 3) {
      // Format: client.version.localhost (e.g., acme-corp.v1.localhost)
      const clientFolder = parts[0];
      const version = parts[1];
      return { clientFolder, version };
    } else if (parts.length === 2) {
      // Format: client.localhost (e.g., acme-corp.localhost) - no version specified
      const clientFolder = parts[0];
      return { clientFolder, version: null };
    }
  } else {
    // Production domain handling
    if (parts.length >= 3) {
      // Check if second part is a version (starts with 'v')
      if (parts[1].startsWith('v')) {
        // Format: client.v1.domain.com
        const clientFolder = parts[0];
        const version = parts[1];
        return { clientFolder, version };
      } else {
        // Format: client.domain.com - no version specified
        const clientFolder = parts[0];
        return { clientFolder, version: null };
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