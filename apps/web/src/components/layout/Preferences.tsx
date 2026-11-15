'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Segmented } from '@/components/ui/controls';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n/config';
import { useLocale, useT } from '@/lib/i18n/client';

/** EN / DE switch. The choice is stored in a cookie so server-rendered text follows it. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return (
    <Segmented<Locale>
      label={t.common.language}
      size="sm"
      value={locale}
      onChange={setLocale}
      className={className}
      options={[
        { value: 'en', label: 'EN', hint: 'English' },
        { value: 'de', label: 'DE', hint: 'Deutsch' },
      ]}
    />
  );
}

/**
 * Sun/moon toggle. Both icons are always rendered and swapped with CSS on the
 * `.dark` class, so server and client markup match (no hydration flash); the
 * swap itself is a short scale + blur crossfade.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useT();
  const icon =
    'absolute inset-0 m-auto size-[18px] transition-[transform,opacity,filter] duration-300 ease-[var(--ease-out)]';
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={t.common.theme}
      title={t.common.theme}
      className={cn(
        'press relative size-9 shrink-0 rounded-xl text-fg-2 hover:bg-ink-750 hover:text-fg',
        className,
      )}
    >
      <Sun
        aria-hidden
        className={cn(icon, 'scale-100 opacity-100 dark:scale-50 dark:opacity-0 dark:blur-[4px]')}
      />
      <Moon
        aria-hidden
        className={cn(
          icon,
          'scale-50 opacity-0 blur-[4px] dark:scale-100 dark:opacity-100 dark:blur-none',
        )}
      />
    </button>
  );
}
