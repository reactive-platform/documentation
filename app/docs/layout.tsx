import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { PlaygroundLink } from '@/app/components/playground/PlaygroundLink';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions} links={[]} sidebar={{ footer: <PlaygroundLink /> }}>
      {children}
    </DocsLayout>
  );
}
