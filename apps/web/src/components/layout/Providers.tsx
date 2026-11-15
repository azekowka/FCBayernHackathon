'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import type { Locale } from '@/lib/i18n/config';
import { LocaleProvider } from '@/lib/i18n/client';

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LocaleProvider initial={locale}>
        {/* Motion follows the OS "reduce motion" setting everywhere. */}
        <MotionConfig reducedMotion="user">
          {children}
          <ThemedToaster />
        </MotionConfig>
      </LocaleProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-2xl !border-0 !bg-ink-850 !text-fg !shadow-[var(--shadow-pop)] !font-sans !gap-3',
          description: '!text-fg-3',
        },
      }}
    />
  );
}
