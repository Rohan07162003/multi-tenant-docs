import { getClientPage, source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/mdx-components';
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

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const clientFolder = await getClientFolder();
  
  // Use client-specific page lookup
  const page = getClientPage(params.slug, clientFolder);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  // For static generation, we need to generate params for all clients
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const clientFolder = await getClientFolder();
  const page = getClientPage(params.slug, clientFolder);
  
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
