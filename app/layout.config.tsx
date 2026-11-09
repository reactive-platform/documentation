import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <img src="/logo/reactive-logo-black.svg" alt="" width={24} height={24} className="dark:hidden" />
        <img src="/logo/reactive-logo-white.svg" alt="" width={24} height={24} className="hidden dark:block" />
        ReactiveUI
      </>
    ),
  },
  // see https://fumadocs.dev/docs/ui/navigation/links
  links: [
    {
      text: 'Playground',
      url: '/playground',
    },
  ],
};
