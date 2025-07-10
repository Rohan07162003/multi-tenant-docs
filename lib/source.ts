import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

// Create the main source
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

// Export function to get available versions for a client
export function getClientVersions(clientFolder: string): string[] {
  if (!clientFolder) return [];
  
  // Get all pages and find version folders for this client by checking the source file paths
  const allPages = source.getPages();
  const versions = new Set<string>();
  
  console.log(`🔍 Getting versions for client: ${clientFolder}`);
  
  allPages.forEach(page => {
    // Check the page's file property or url to find version folders
    // The page.url will be like /docs/client-folder/version/page-name or /docs/client-folder/version
    if (page.url.includes(`/${clientFolder}/`)) {
      // Extract the part after /docs/client-folder/
      const clientFolderIndex = page.url.indexOf(`/${clientFolder}/`);
      const pathAfterClient = page.url.substring(clientFolderIndex + `/${clientFolder}/`.length);
      
      // Get the first segment which should be the version (v1, v2, etc.)
      const versionPart = pathAfterClient.split('/')[0];
      
      console.log(`📄 Page: ${page.url} -> pathAfterClient: "${pathAfterClient}" -> versionPart: "${versionPart}"`);
      
      if (versionPart && versionPart.startsWith('v')) {
        versions.add(versionPart);
        console.log(`✅ Added version: ${versionPart}`);
      }
    }
  });
  
  const sortedVersions = Array.from(versions).sort((a, b) => {
    const aNum = parseInt(a.substring(1));
    const bNum = parseInt(b.substring(1));
    return aNum - bNum;
  });
  
  console.log(`📊 Final versions for ${clientFolder}:`, sortedVersions);
  
  // Sort versions (v1, v2, etc.)
  return sortedVersions;
}

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
