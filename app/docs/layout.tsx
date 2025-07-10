import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { getClientPageTree } from '@/lib/source';
import { headers } from 'next/headers';

// Function to get client folder from headers
async function getClientFolder(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get('x-client-folder') || undefined;
  } catch {
    return undefined;
  }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const clientFolder = await getClientFolder();
  const pageTree = getClientPageTree(clientFolder);
  
  return (
    <DocsLayout tree={pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
