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
    const clientFolder = headersList.get('x-client-folder') || undefined;
    const version = headersList.get('x-client-version') || undefined;
    return { clientFolder, version };
  } catch {
    return {};
  }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const { clientFolder, version } = await getClientContext();
  const pageTree = getClientPageTree(clientFolder, version);
  
  // if (clientFolder && !isValidClientFolder(clientFolder)) {
  //   notFound(); // This will render the 404 page
  // }
  
  return (
    <DocsLayout tree={pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
