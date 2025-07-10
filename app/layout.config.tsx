import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { VersionToggle } from '@/components/version-toggle';
import { headers } from 'next/headers';
import { getClientVersions } from '@/lib/source';

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

// Async component for navigation with version toggle
async function NavTitle() {
  const { clientFolder, version } = await getClientContext();
  const availableVersions = clientFolder ? getClientVersions(clientFolder) : [];

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <svg
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Logo"
        >
          <circle cx={12} cy={12} r={12} fill="currentColor" />
        </svg>
        My App
      </div>
      
      {clientFolder && availableVersions.length > 1 && (
        <VersionToggle 
          clientFolder={clientFolder}
          currentVersion={version}
          availableVersions={availableVersions}
        />
      )}
    </div>
  );
}

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <NavTitle />,
  },
  // see https://fumadocs.dev/docs/ui/navigation/links
  links: [],
};
