import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';
import { createOpenAPI } from 'fumadocs-openapi/server';

// Create the main source
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export const openapi = createOpenAPI();

export function getClientVersions(clientFolder: string): string[] {
  if (!clientFolder || typeof clientFolder !== 'string') return [];

  const allPages = source.getPages();
  const versions = new Set<string>();
   // Match URLs like /docs/clientFolder/v1/, /docs/clientFolder/v2/page-name
   const versionRegex = new RegExp(`/${clientFolder}/(v\\d+)(/|$)`);

  for (const page of allPages) {
    // console.log('page', page);
    const match = page.url.match(versionRegex);
    // console.log('match', match);
    if (match && match[1]) {
      versions.add(match[1]);
    }
  }
  console.log('versions', versions);
  return Array.from(versions).sort((a, b) => {
    const numA = parseInt(a.slice(1)); // remove "v" from "v3"
    const numB = parseInt(b.slice(1));
    return numA - numB;
  });
//   If you want to support things like: v1.0 v2-beta v3.1.4

// You could upgrade the regex like this:

// const versionRegex = new RegExp(`/${clientFolder}/(v[\\w.-]+)/`);
}

// Helper to get the latest version for a client
export function getLatestVersion(clientFolder: string): string | undefined {
  const versions = getClientVersions(clientFolder);
  return versions[versions.length - 1];
}

// Export function to get client-specific pages with version support
export function getClientPages(clientFolder?: string, version?: string) {
  const allPages = source.getPages();
  
  if (!clientFolder) {
    return allPages;
  }
  
  // Use the single source of truth for latest version
  const versionPath = version || getLatestVersion(clientFolder);
  if (!versionPath) return [];
  const fullPath = `/${clientFolder}/${versionPath}`;
  
  return allPages.filter(page => {
    return page.url.startsWith(`${fullPath}/`);
  }).map(page => ({
    ...page,
    url: page.url.replace(`${fullPath}`, '') || '/',
  }));
}

// Export function to get client-specific page with version support
export function getClientPage(slug: string[], clientFolder?: string, version?: string) {
  const allPages = source.getPages();
  
  if (!clientFolder) {
    // For main domain, use default behavior
    return source.getPage(slug);
  }
  
  // Use the single source of truth for latest version
  const versionPath = version || getLatestVersion(clientFolder);
  if (!versionPath) return null;
  const fullSlug = [clientFolder, versionPath, ...slug];
  const page = source.getPage(fullSlug);
  
  if (page) {
    return {
      ...page,
      // Remove client folder and version from URL
      url: page.url.replace(`/${clientFolder}/${versionPath}`, '') || '/',
    };
  }
  
  return null;
}

// Export function to get client-specific page tree with version support
export function getClientPageTree(clientFolder?: string, version?: string) {
  if (!clientFolder) {
    console.log('source.pageTree', source.pageTree);
    return source.pageTree;
  }

  // Use the single source of truth for latest version
  const versionPath = version || getLatestVersion(clientFolder);
  if (!versionPath) return { name: 'Docs', children: [] };
  const targetPath = `/${clientFolder}/${versionPath}`;
  
  // Find the client's version folder in the page tree
  function findClientNode(node: any, path: string[]): any {
    if (path.length === 0) {
      return node;
    }
    
    const [current, ...rest] = path;
    const child = node.children?.find((child: any) => 
      child.type === 'folder' && child.$id.includes(current)
    );
    
    if (child) {
      return findClientNode(child, rest);
    }
    
    return null;
  }
  
  // Split the path and find the corresponding node
  const pathParts = targetPath.split('/').filter(Boolean); // ['acme-corp', 'v1']
  const clientNode = findClientNode(source.pageTree, pathParts);
  
  if (clientNode) {
    // Create a new tree with the client's content as root
    // Transform the URLs to remove the client folder and version prefix
    function transformNode(node: any): any {
      const transformed = { ...node };
      
      if (node.url) {
        transformed.url = node.url.replace(targetPath, '') || '/';
      }
      
      if (node.children) {
        transformed.children = node.children.map(transformNode);
      }
      
      return transformed;
    }
    
    return {
      name: clientNode.name || 'Docs',
      children: clientNode.children ? clientNode.children.map(transformNode) : [],
    };
  }
  
  // Fallback: create tree from filtered pages
  const clientPages = getClientPages(clientFolder, version);
  return {
    name: 'Docs',
    children: clientPages.map(page => ({
      type: 'page',
      name: page.data.title || page.url,
      url: page.url,
    })),
  };
}
