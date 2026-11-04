import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { aiStatus } from '@/lib/server/ai';

export const metadata: Metadata = {
  title: {
    default: 'Fan AI Lab — Gemini prototypes for FC Bayern fans',
    template: '%s · Fan AI Lab',
  },
  description:
    'FCB Fair Seat (transparent loyalty ballot + smart seat recycling) and the Matchday Journey Agent — grounded Gemini prototypes for the FC Bayern Fan AI-DEATION.',
  applicationName: 'Fan AI Lab',
};

export const viewport: Viewport = {
  themeColor: '#060912',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const ai = aiStatus();
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-fcb px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <SiteHeader ai={{ mode: ai.mode, model: ai.model }} />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 md:px-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
