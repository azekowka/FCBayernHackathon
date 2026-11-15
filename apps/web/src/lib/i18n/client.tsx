'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { formatters } from '@/lib/format';
import { LOCALE_COOKIE, type Locale } from './config';
import { MESSAGES } from './messages';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  switching: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState<Locale>(initial);
  const [switching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setState(next);
      // Server components (headings, metadata) re-render in the new language.
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo(() => ({ locale, setLocale, switching }), [locale, setLocale, switching]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>');
  return ctx;
}

/** Messages for the active language. */
export function useT() {
  return MESSAGES[useLocale().locale];
}

/** Number formatters for the active language. */
export function useFormat() {
  const { locale } = useLocale();
  return useMemo(() => formatters(locale), [locale]);
}
