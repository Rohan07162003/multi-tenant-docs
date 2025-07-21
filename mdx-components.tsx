import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { APIPage } from 'fumadocs-openapi/ui';
import { ApiEndpoint } from './components/ApiEndpoint';
import { openapi } from '@/lib/source';

// Fallback implementations with explicit typing
interface StepProps {
  title: string;
  children: ReactNode;
}
const Step = ({ title, children }: StepProps) => (
  <div style={{ margin: '1em 0', padding: '1em', border: '1px solid #eee', borderRadius: 4 }}>
    <strong>{title}</strong>
    <div>{children}</div>
  </div>
);
interface StepsProps {
  children: ReactNode;
}
const Steps = ({ children }: StepsProps) => <div>{children}</div>;
interface TabsProps {
  children: ReactNode;
}
const Tabs = ({ children }: TabsProps) => <div>{children}</div>;
interface TabProps {
  children: ReactNode;
}
const Tab = ({ children }: TabProps) => <div>{children}</div>;

// Additional fallback components
interface CodeProps {
  children: ReactNode;
}
const Code = ({ children }: CodeProps) => <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: 3 }}>{children}</code>;

interface PreProps {
  children: ReactNode;
}
const Pre = ({ children }: PreProps) => {
  let content = children;
  if (typeof content === 'string') {
    content = content.trim();
  }
  return <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflowX: 'auto' }}>{content}</pre>;
};

interface FileProps {
  href: string;
  children: ReactNode;
}
const File = ({ href, children }: FileProps) => <a href={href} download style={{ color: '#0070f3', textDecoration: 'underline' }}>{children}</a>;

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Step,
    Steps,
    Tabs,
    Tab,
    Code,
    Pre,
    File,
    APIPage: (props) => <APIPage {...openapi.getAPIPageProps(props)} />,
    ApiEndpoint,
    ...components,
  };
}