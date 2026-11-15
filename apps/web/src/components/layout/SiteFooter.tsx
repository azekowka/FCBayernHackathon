import Link from 'next/link';
import { getMessages } from '@/lib/i18n/server';
import { LogoMark, Wordmark } from './Logo';

export async function SiteFooter() {
  const { t } = await getMessages();
  return (
    <footer className="relative mt-28 overflow-hidden border-t hairline">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-8 text-sm text-fg-3 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <Wordmark />
          </div>
          <p className="mt-4 leading-relaxed text-pretty">{t.footer.blurb}</p>
        </div>
        <div>
          <p className="font-semibold text-fg">{t.footer.products}</p>
          <ul className="mt-4 space-y-2.5">
            {(
              [
                ['/ballot', t.products.ballot.name],
                ['/recycling', t.products.recycling.name],
                ['/journey', t.products.journey.name],
              ] as const
            ).map(([href, name]) => (
              <li key={href}>
                <Link className="transition-colors duration-150 hover:text-fg" href={href}>
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-fg">{t.footer.principles}</p>
          <ul className="mt-4 space-y-2.5">
            {t.footer.principleList.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 pb-6 text-xs text-fg-3 md:px-6">
        <span>© 2026 Kickoff</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-3 rounded-[2px] bg-fcb" />
          <span aria-hidden className="h-2 w-3 rounded-[2px] bg-white ring-1 ring-line-strong" />
          <span aria-hidden className="h-2 w-3 rounded-[2px] bg-blue" />
          <span className="ml-1">{t.footer.made}</span>
        </span>
      </div>
      {/* Oversized wordmark, cropped by the page edge. Decorative. */}
      <p
        aria-hidden
        className="display pointer-events-none -mb-[0.22em] text-center text-[22vw] leading-[0.8] font-[800] tracking-[-0.06em] text-fg/[0.045] select-none"
      >
        Kickoff
      </p>
    </footer>
  );
}
