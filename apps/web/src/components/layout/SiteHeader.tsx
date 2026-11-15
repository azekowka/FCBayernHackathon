'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { LogoMark } from './Logo';

export const NAV = [
  { href: '/ballot', label: 'Fair Seat Ballot', short: 'Ballot' },
  { href: '/recycling', label: 'Seat Recycling', short: 'Recycling' },
  { href: '/live', label: 'Stage Demo', short: 'Live' },
  { href: '/journey', label: 'Matchday Journey', short: 'Journey' },
  { href: '/how-it-works', label: 'How it works', short: 'How' },
] as const;

export function SiteHeader({ ai }: { ai: { mode: 'gemini' | 'demo'; model: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b hairline bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg"
          aria-label="Fan AI Lab home"
        >
          <LogoMark />
          <span className="leading-none">
            <span className="display block text-lg font-bold tracking-wide text-fg">
              Fan AI Lab
            </span>
            <span className="block text-[10px] font-medium tracking-wider text-fg-3 uppercase">
              FC Bayern Fan AI-DEATION · prototype
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-ink-750 text-fg' : 'text-fg-3 hover:text-fg',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span
          className="ml-auto hidden items-center gap-2 rounded-full border hairline bg-ink-850 px-3 py-1 text-xs text-fg-2 sm:inline-flex lg:ml-2"
          title={
            ai.mode === 'gemini'
              ? `Live Gemini (${ai.model})`
              : 'No API key — grounded offline templates'
          }
        >
          <span
            aria-hidden
            className={cn('size-2 rounded-full', ai.mode === 'gemini' ? 'bg-ok' : 'bg-warn')}
          />
          {ai.mode === 'gemini' ? 'Gemini live' : 'Demo AI'}
        </span>

        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-fg-2 hover:bg-ink-750 sm:ml-0 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t hairline px-4 pb-4 lg:hidden">
          <ul className="grid gap-1 pt-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-base font-medium text-fg-2 hover:bg-ink-750 hover:text-fg"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
