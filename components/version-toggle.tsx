'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface VersionToggleProps {
  clientFolder?: string;
  currentVersion?: string;
  availableVersions: string[];
}

export function VersionToggle({ clientFolder, currentVersion, availableVersions }: VersionToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show the toggle if there's no client or only one version
  if (!clientFolder || availableVersions.length <= 1) {
    return null;
  }

  const handleVersionChange = (version: string) => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    
    let newHostname: string;
    
    if (hostname.includes('.localhost')) {
      // Local development
      if (version === 'v2') {
        // Latest version - no version in subdomain
        newHostname = `${clientFolder}.localhost`;
      } else {
        // Specific version
        newHostname = `${clientFolder}.${version}.localhost`;
      }
    } else {
      // Production domain
      const parts = hostname.split('.');
      if (version === 'v2') {
        // Latest version - no version in subdomain
        newHostname = `${clientFolder}.${parts.slice(-2).join('.')}`;
      } else {
        // Specific version
        newHostname = `${clientFolder}.${version}.${parts.slice(-2).join('.')}`;
      }
    }
    
    const newUrl = `${protocol}//${newHostname}${port ? `:${port}` : ''}${pathname}`;
    window.location.href = newUrl;
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const displayVersion = currentVersion || 'v2';
  const displayName = displayVersion === 'v2' ? `${displayVersion} (Latest)` : displayVersion;

  return (
    <div className="relative">
      <button
        onClick={handleDropdownToggle}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground border border-fd-border rounded-md bg-fd-background hover:bg-fd-muted/50 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        type="button"
      >
        <span className="text-xs font-mono">{displayName}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[120px] bg-fd-background border border-fd-border rounded-md shadow-lg z-50">
          {availableVersions.map((version) => {
            const isLatest = version === 'v2';
            const isCurrent = version === displayVersion;
            
            return (
              <button
                key={version}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVersionChange(version);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-fd-muted/50 first:rounded-t-md last:rounded-b-md transition-colors ${
                  isCurrent ? 'bg-fd-primary/10 text-fd-primary font-medium' : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{version}</span>
                  {isLatest && (
                    <span className="text-xs text-fd-muted-foreground">Latest</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 