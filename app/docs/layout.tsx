import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { getClientPageTree,isValidClientFolder } from '@/lib/source';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

// Function to get client context from headers
async function getClientContext(): Promise<{ clientFolder?: string; version?: string }> {
  try {
    const headersList = await headers();
    console.log('=== LAYOUT HEADERS DEBUG ===');
    console.log('All headers:', Object.fromEntries(headersList.entries()));
    const clientFolder = headersList.get('x-client-folder') || undefined;
    const version = headersList.get('x-client-version') || undefined;
    console.log('Extracted clientFolder:', clientFolder);
    console.log('Extracted version:', version);
    console.log('=== END LAYOUT HEADERS ===');
    return { clientFolder, version };
  } catch (error) {
    console.log('Error getting headers:', error);
    return {};
  }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const { clientFolder, version } = await getClientContext();
  console.log('clientFolder', clientFolder);
  console.log('version', version);
  const pageTree = getClientPageTree(clientFolder, version);
  const hardcodetree=getClientPageTree('acme-corp', 'v2')
  console.log('getClientPageTree', hardcodetree)
  console.log('pageTree', pageTree);
  // if (clientFolder && !isValidClientFolder(clientFolder)) {
  //   notFound(); // This will render the 404 page
  // }
  
  return (
    <DocsLayout tree={pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
