import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

// Create the main source
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

// Export function to get client-specific pages with version support
export function getClientPages(clientFolder?: string, version?: string) {
  const allPages = source.getPages();
  
  if (!clientFolder) {
    return allPages;
  }
  
  // Default to latest version if no version provided
  const versionPath = version || 'v2';
  const fullPath = `/${clientFolder}/${versionPath}`;
  
  // Filter pages to only include those from the specific client folder and version
  return allPages.filter(page => {
    return page.url.startsWith(`${fullPath}/`);
  }).map(page => ({
    ...page,
    // Remove client folder and version from URL so /acme-corp/v1/production-systems becomes /production-systems
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
  
  // Default to latest version if no version provided
  const versionPath = version || 'v2';
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
    return source.pageTree;
  }

  // Default to latest version if no version provided
  const versionPath = version || 'v2';
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
