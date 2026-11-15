import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/layout/Providers';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { getMessages } from '@/lib/i18n/server';
import { aiStatus } from '@/lib/server/ai';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return {
    title: { default: t.meta.title, template: '%s · Kickoff' },
    description: t.meta.description,
    applicationName: 'Kickoff',
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#050a15' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const ai = aiStatus();
  const { locale, t } = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
        <Providers locale={locale}>
          <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-fcb px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {t.common.skip}
          </a>
          {/* Page-top atmosphere: faint pitch grid and a red floodlight glow. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden"
          >
            <div className="pitch-grid absolute inset-0 opacity-70" />
            <div className="absolute -top-56 left-1/2 h-[520px] w-[min(1100px,140vw)] -translate-x-1/2 rounded-[100%] bg-fcb/[0.07] blur-[100px] dark:bg-fcb/[0.12]" />
          </div>
          <SiteHeader ai={{ mode: ai.mode, model: ai.model }} />
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 md:px-6">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
