'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LiveDot } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/client';
import type { Messages } from '@/lib/i18n/messages';
import { LogoMark, Wordmark } from './Logo';
import { LanguageSwitch, ThemeToggle } from './Preferences';

export const NAV: { href: string; key: keyof Messages['nav'] }[] = [
  { href: '/ballot', key: 'ballot' },
  { href: '/recycling', key: 'recycling' },
  { href: '/live', key: 'live' },
  { href: '/journey', key: 'journey' },
  { href: '/how-it-works', key: 'how' },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function SiteHeader({ ai }: { ai: { mode: 'gemini' | 'demo'; model: string } }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200',
        scrolled || open
          ? 'bg-ink-950/80 shadow-[0_1px_0_0_var(--color-line)] backdrop-blur-xl backdrop-saturate-150'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
        <Link
          href="/"
          className="press flex items-center gap-2.5 rounded-xl"
          aria-label={t.common.home}
          onClick={() => setOpen(false)}
        >
          <LogoMark />
          <span className="flex flex-col gap-1">
            <Wordmark />
            <span className="hidden text-[10px] leading-none font-medium tracking-wide text-fg-3 sm:block">
              {t.common.brandTagline}
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                  active ? 'text-fg' : 'text-fg-3 hover:text-fg',
                )}
              >
                {t.nav[item.key]}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-fcb"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-3">
          <span
            className="hidden items-center gap-2 rounded-full bg-ink-850 px-3 py-1.5 text-xs font-medium text-fg-2 shadow-[0_0_0_1px_var(--color-line)] xl:inline-flex"
            title={ai.mode === 'gemini' ? t.common.aiLiveTitle(ai.model) : t.common.aiDemoTitle}
          >
            <LiveDot tone={ai.mode === 'gemini' ? 'green' : 'amber'} />
            {ai.mode === 'gemini' ? t.common.aiLive : t.common.aiDemo}
          </span>
          <LanguageSwitch className="hidden sm:inline-flex" />
          <ThemeToggle />
          <button
            type="button"
            className="press relative size-9 rounded-xl text-fg-2 hover:bg-ink-750 hover:text-fg lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.common.closeMenu : t.common.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {/* Two bars that morph into an X — one object changing state. */}
            <span
              aria-hidden
              className={cn(
                'absolute top-1/2 left-1/2 h-[1.5px] w-[18px] -translate-x-1/2 rounded-full bg-current transition-transform duration-300 ease-[var(--ease-out)]',
                open ? '-translate-y-1/2 rotate-45' : '-translate-y-[4px]',
              )}
            />
            <span
              aria-hidden
              className={cn(
                'absolute top-1/2 left-1/2 h-[1.5px] w-[18px] -translate-x-1/2 rounded-full bg-current transition-transform duration-300 ease-[var(--ease-out)]',
                open ? '-translate-y-1/2 -rotate-45' : 'translate-y-[3px]',
              )}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Main"
            className="overflow-hidden lg:hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <ul className="grid gap-1 px-4 pt-1 pb-3">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'press flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium',
                        active ? 'bg-ink-850 text-fg shadow-[var(--shadow-card)]' : 'text-fg-2',
                      )}
                    >
                      {t.nav[item.key]}
                      {active && <span aria-hidden className="size-1.5 rounded-full bg-fcb" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t hairline px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-fg-3">
                <LiveDot tone={ai.mode === 'gemini' ? 'green' : 'amber'} />
                {ai.mode === 'gemini' ? t.common.aiLive : t.common.aiDemo}
              </span>
              <LanguageSwitch className="sm:hidden" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
