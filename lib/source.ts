import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

// Create the main source
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

// Export function to get client-specific pages
export function getClientPages(clientFolder?: string) {
  const allPages = source.getPages();
  
  if (!clientFolder) {
    return allPages;
  }
  
  // Filter pages to only include those from the specific client folder
  return allPages.filter(page => {
    return page.url.startsWith(`/${clientFolder}/`);
  }).map(page => ({
    ...page,
    // Remove client folder from URL so /acme-corp/production-systems becomes /production-systems
    url: page.url.replace(`/${clientFolder}`, '') || '/',
  }));
}

// Export function to get client-specific page
export function getClientPage(slug?: string[], clientFolder?: string) {
  if (!clientFolder) {
    return source.getPage(slug);
  }
  
  // Convert slug to include client folder for finding the actual page
  const clientSlug = slug ? [clientFolder, ...slug] : [clientFolder];
  return source.getPage(clientSlug);
}

// Export function to get client-specific page tree
export function getClientPageTree(clientFolder?: string) {
  const fullTree = source.pageTree;
  console.log({clientFolder})
  console.log(JSON.stringify(fullTree, null, 2))
  if (!clientFolder) {
    return fullTree;
  }
  
  // Find the specific client folder in the tree
  const clientNode = fullTree.children?.find(node => 
    node.type === 'folder' && node.$id === clientFolder
  );
  
  if (!clientNode || clientNode.type !== 'folder') {
    // If no client folder found, create tree directly from filtered pages
    const clientPages = getClientPages(clientFolder);
    
    return {
      name: 'Docs',
      children: clientPages.map(page => ({
        type: 'page' as const,
        name: page.data.title || 'Untitled',
        url: page.url,
      }))
    };
  }
  
  // Transform the client folder's children to remove client folder prefix from URLs
  const transformedChildren = clientNode.children?.map(child => {
    if (child.type === 'page') {
      return {
        ...child,
        url: child.url?.replace(`/${clientFolder}`, '') || child.url,
      };
    } else if (child.type === 'folder') {
      // For nested folders, transform their children too
      return {
        ...child,
        children: child.children?.map(nestedChild => {
          if (nestedChild.type === 'page') {
            return {
              ...nestedChild,
              url: nestedChild.url?.replace(`/${clientFolder}`, '') || nestedChild.url,
            };
          }
          return nestedChild;
        })
      };
    }
    return child;
  }) || [];
  
  // Return a proper Root structure with the transformed children
  return {
    name: 'Docs',
    children: transformedChildren
  };
}
