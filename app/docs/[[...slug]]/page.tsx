import { getClientPage, getClientPages } from '@/lib/source';
import type { Metadata } from 'next';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

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

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const { clientFolder, version } = await getClientContext();
  
  const page = getClientPage(params.slug ?? [], clientFolder, version);

  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsBody>
        <h1>{page.data.title}</h1>
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  // For static generation, we'll generate params for all versions
  const allPages = getClientPages(); // Get all pages
  
  return allPages.map((page) => ({
    slug: page.url.split('/').filter(Boolean),
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const { clientFolder, version } = await getClientContext();
  
  const page = getClientPage(params.slug ?? [], clientFolder, version);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
