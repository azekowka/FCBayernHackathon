import { ARENA_CAPACITY, MAX_REQUESTS } from '@fcb/core';
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  Calculator,
  EyeOff,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { ArenaPulse } from '@/components/home/ArenaPulse';
import { BallotPreview, JourneyPreview, SeatsPreview } from '@/components/home/Previews';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ButtonLink, Eyebrow } from '@/components/ui/primitives';
import { formatters } from '@/lib/format';
import { getMessages } from '@/lib/i18n/server';
import { headlines } from '@/lib/server/insights';

const PRINCIPLE_ICONS = [Ban, Fingerprint, EyeOff, ShieldCheck, Calculator, Users];

export default async function HomePage() {
  const { t, locale } = await getMessages();
  const f = formatters(locale);
  const h = headlines();

  const products = [
    {
      href: '/ballot',
      n: '01',
      copy: t.products.ballot,
      kpiLabel: t.products.ballot.kpiLabel,
      kpi: `${f.oneIn(h.ballot.lenaOdds)} vs ${f.oneIn(h.ballot.firstTimerOdds)}`,
      preview: <BallotPreview />,
    },
    {
      href: '/recycling',
      n: '02',
      copy: t.products.recycling,
      kpiLabel: t.products.recycling.kpiLabel,
      kpi: `${f.pct(h.recycling.todayShare)} → ${f.pct(h.recycling.fairShare)}`,
      preview: <SeatsPreview />,
    },
    {
      href: '/journey',
      n: '03',
      copy: t.products.journey,
      kpiLabel: t.products.journey.kpiLabel(h.journey.stayMinutes),
      kpi: `${Math.round(h.journey.queueNow)} → ${Math.round(h.journey.queueRecommended)} min`,
      preview: <JourneyPreview />,
    },
  ];

  const stats = [
    { k: t.home.stats.seats, v: ARENA_CAPACITY, sub: t.home.stats.seatsSub },
    {
      k: t.home.stats.requests,
      v: MAX_REQUESTS,
      sub: t.home.stats.requestsSub,
      compact: true,
    },
    {
      k: t.home.stats.empty,
      v: h.recycling.absentSeats,
      prefix: '≈',
      sub: t.home.stats.emptySub,
    },
    {
      k: t.home.stats.extra,
      v: h.recycling.extraFansPerMatch,
      prefix: '+',
      sub: t.home.stats.extraSub,
      accent: true,
    },
  ];

  return (
    <div className="pb-8">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="grid items-center gap-10 pt-10 pb-14 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <div>
          <p className="inline-flex max-w-full animate-rise items-center gap-2 rounded-full bg-ink-850 py-1 pr-3 pl-1 text-xs font-medium text-fg-2 shadow-[var(--shadow-card)]">
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-fcb px-2 py-0.5 text-[11px] font-semibold text-white">
              <Sparkles className="size-3" aria-hidden /> Gemini
            </span>
            <span className="truncate">{t.home.badge}</span>
          </p>
          <h1 className="display mt-6 animate-rise text-[44px] leading-[0.98] text-balance [animation-delay:60ms] sm:text-6xl lg:text-[72px]">
            {t.home.titleA} <span className="block text-fcb">{t.home.titleB}</span>
          </h1>
          <p className="mt-6 max-w-xl animate-rise text-lg leading-relaxed text-pretty text-fg-2 [animation-delay:120ms]">
            {t.home.lead}
          </p>
          <div className="mt-8 flex animate-rise flex-wrap gap-3 [animation-delay:170ms]">
            <ButtonLink href="/live" size="lg">
              {t.home.ctaLive} <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/ballot" size="lg" variant="secondary">
              {t.home.ctaBallot}
            </ButtonLink>
          </div>
        </div>
        <div className="animate-rise [animation-delay:120ms]">
          <ArenaPulse target={h.recycling.extraFansPerMatch} />
        </div>
      </section>

      {/* ── Numbers ──────────────────────────────────────────── */}
      <section aria-label={t.home.statsLabel}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line shadow-[var(--shadow-card)] lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.k} className="bg-ink-850 p-5 md:p-6">
              <dt className="text-xs font-medium text-fg-3">{s.k}</dt>
              <dd
                className={`display mt-3 text-[32px] leading-none md:text-[44px] ${s.accent ? 'text-fcb' : 'text-fg'}`}
              >
                <AnimatedNumber
                  value={s.v}
                  prefix={s.prefix}
                  countUp
                  format={s.compact ? { notation: 'compact' } : undefined}
                />
              </dd>
              <dd className="mt-2 text-xs text-fg-3">{s.sub}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Products ─────────────────────────────────────────── */}
      <section aria-labelledby="products-title" className="pt-24">
        <div className="max-w-2xl">
          <Eyebrow className="text-bad">{t.home.productsEyebrow}</Eyebrow>
          <h2 id="products-title" className="display mt-3 text-4xl text-balance md:text-5xl">
            {t.home.productsTitle}
          </h2>
          <p className="mt-4 text-lg text-pretty text-fg-2">{t.home.productsLead}</p>
        </div>
        <ul className="mt-10 grid gap-5 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="card lift group relative flex h-full flex-col overflow-hidden"
              >
                <div aria-hidden className="relative h-44 overflow-hidden bg-ink-800">
                  {p.preview}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between text-xs font-medium text-fg-3">
                    <span>{p.copy.tag}</span>
                    <span className="tabular">{p.n}</span>
                  </div>
                  <h3 className="display mt-3 text-2xl">{p.copy.name}</h3>
                  <p className="mt-1 text-sm font-medium text-fg-2">{p.copy.en}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-3">{p.copy.body}</p>
                  <div className="mt-6 flex items-end justify-between gap-4 border-t hairline pt-4">
                    <div className="min-w-0">
                      <p className="text-xs text-fg-3">{p.kpiLabel}</p>
                      <p className="display tabular mt-1 text-xl text-fg">{p.kpi}</p>
                    </div>
                    <span className="sr-only">{t.products.open(p.copy.name)}</span>
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-750 text-fg transition-[background-color,color,transform] duration-200 ease-[var(--ease-out)] group-hover:rotate-45 group-hover:bg-fcb group-hover:text-white"
                    >
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Trust loop ───────────────────────────────────────── */}
      <section aria-labelledby="trust-title" className="pt-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <Eyebrow className="text-bad">{t.home.loopEyebrow}</Eyebrow>
            <h2 id="trust-title" className="display mt-3 text-4xl text-balance md:text-5xl">
              {t.home.loopTitle}
            </h2>
            <p className="mt-4 text-pretty text-fg-2">{t.home.loopLead}</p>
            <ButtonLink href="/how-it-works" variant="secondary" className="mt-7">
              {t.home.howLink} <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {t.home.loop.map((step, i) => (
              <li key={step.t} className="card p-5">
                <span className="display tabular flex size-8 items-center justify-center rounded-lg bg-fcb/10 text-sm text-bad">
                  {i + 1}
                </span>
                <p className="mt-4 font-semibold text-fg">{step.t}</p>
                <p className="mt-1 text-sm text-fg-3">{step.d}</p>
              </li>
            ))}
          </ol>
        </div>

        <ul className="mt-14 grid gap-x-8 gap-y-8 border-t hairline pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.home.principles.map((x, i) => {
            const Icon = PRINCIPLE_ICONS[i] ?? ShieldCheck;
            return (
              <li key={x.t} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-850 shadow-[var(--shadow-card)]">
                  <Icon className="size-[18px] text-bad" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-fg">{x.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fg-3">{x.d}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="pt-24">
        <div className="relative overflow-hidden rounded-[28px] bg-fcb px-6 py-12 text-white md:px-14 md:py-16">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgb(255_255_255/0.18),transparent_60%),radial-gradient(60%_80%_at_0%_100%,rgb(10_27_61/0.45),transparent_70%)]"
          />
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="absolute -top-16 -right-16 size-80 text-white/15 md:size-[28rem]"
          >
            <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="100" cy="100" r="4" fill="currentColor" />
            <path d="M100 0v200" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="relative max-w-2xl">
            <h2 className="display text-4xl text-balance md:text-5xl">{t.home.ctaTitle}</h2>
            <p className="mt-4 text-lg text-pretty text-white/90">{t.home.ctaLead}</p>
            <Link
              href="/live"
              className="press mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-fcb-700 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.4)] hover:bg-white/90"
            >
              {t.home.ctaButton} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
