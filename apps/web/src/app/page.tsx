import {
  ArrowRight,
  Ban,
  Calculator,
  EyeOff,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrainFront,
  Armchair,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { ARENA_CAPACITY, MAX_REQUESTS } from '@fcb/core';
import { Badge, ButtonLink, Eyebrow } from '@/components/ui/primitives';
import { fmtInt, fmtOneIn, fmtPct } from '@/lib/format';
import { headlines } from '@/lib/server/insights';

export default function HomePage() {
  const h = headlines();
  const products = [
    {
      href: '/ballot',
      icon: Ticket,
      tag: 'FCB Fair Seat · 1',
      name: 'Losglück mit System',
      en: 'The transparent, loyalty-aware ballot',
      body: 'See your odds before you apply. Every “no” raises your Pechvogel bonus. Apply smart, then verify the draw yourself — the losers become the recycling waitlist.',
      kpiLabel: 'Klassiker odds, Pechvogel ×7 vs first-timer',
      kpi: `${fmtOneIn(h.ballot.lenaOdds)} vs ${fmtOneIn(h.ballot.firstTimerOdds)}`,
      accent: 'from-fcb/30',
    },
    {
      href: '/recycling',
      icon: Armchair,
      tag: 'FCB Fair Seat · 2',
      name: 'Kein Platz bleibt leer',
      en: 'Smart seat recycling — dynamic capacity, never dynamic pricing',
      body: 'An explainable model spots seats likely to stay empty. Gemini nudges the holder kindly; one tap sends the seat to the next fan on the waitlist, right up to kick-off.',
      kpiLabel: 'Empty seats back in use, Saturday vs Freiburg',
      kpi: `${fmtPct(h.recycling.todayShare)} → ${fmtPct(h.recycling.fairShare)}`,
      accent: 'from-viz-teal/30',
    },
    {
      href: '/journey',
      icon: TrainFront,
      tag: 'Matchday',
      name: 'Vom Sofa bis zum Sitz',
      en: 'The matchday journey agent',
      body: 'When to leave, how full the U6 will be, the quickest gate and kiosk, and a staggered return that skips the Fröttmaning crush. Re-plans live around strikes and closures.',
      kpiLabel: `U6 queue if you stay ${h.journey.stayMinutes} min after the whistle`,
      kpi: `${Math.round(h.journey.queueNow)} → ${Math.round(h.journey.queueRecommended)} min`,
      accent: 'from-u6/30',
    },
  ];

  return (
    <div className="pb-8">
      <section className="grid items-center gap-10 pt-10 pb-12 md:pt-16 lg:grid-cols-[1.25fr_1fr]">
        <div className="animate-rise">
          <Badge tone="red" className="mb-5">
            <Sparkles className="size-3" aria-hidden /> Built on Google Gemini · grounded by tested
            engines
          </Badge>
          <h1 className="display text-5xl leading-[0.9] font-bold text-balance md:text-7xl">
            More fans in the Arena.
            <span className="block text-fcb-glow">Not higher prices.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-fg-2">
            Three working prototypes that make the toughest ticket in football the fairest one — and
            get every fan from sofa to seat. The engines decide; Gemini explains, in any language.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/live" size="lg">
              Watch the two-phone demo <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/ballot" size="lg" variant="secondary">
              Check your ballot odds
            </ButtonLink>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3" aria-label="The problem in numbers">
          {[
            {
              k: 'Seats in the Allianz Arena',
              v: fmtInt(ARENA_CAPACITY),
              sub: 'sold out for 20+ years',
            },
            {
              k: 'Requests for one home match',
              v: `${Math.round(MAX_REQUESTS / 1000)}k`,
              sub: 'Der Klassiker, 2026/27',
            },
            {
              k: 'Empty seats on a normal Saturday',
              v: `≈${fmtInt(h.recycling.absentSeats)}`,
              sub: 'season tickets not used (model)',
            },
            {
              k: 'Extra fans per match with Fair Seat',
              v: `+${fmtInt(h.recycling.extraFansPerMatch)}`,
              sub: 'same seats, same prices',
            },
          ].map((s, i) => (
            <div
              key={s.k}
              className="card animate-rise p-5"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <dt className="text-xs font-medium text-fg-3">{s.k}</dt>
              <dd className="display tabular mt-2 text-4xl font-bold text-fg md:text-5xl">{s.v}</dd>
              <dd className="mt-1 text-xs text-fg-3">{s.sub}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="products-title" className="pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow>The top three ideas — shipped</Eyebrow>
            <h2 id="products-title" className="display mt-2 text-3xl font-bold md:text-4xl">
              Three products, one fan journey
            </h2>
          </div>
        </div>
        <ul className="mt-6 grid gap-4 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className={`card group relative flex h-full flex-col overflow-hidden p-6 transition-transform duration-200 hover:-translate-y-0.5`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${p.accent} to-transparent opacity-60`}
                />
                <div className="relative flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-ink-700 ring-1 ring-line-strong">
                    <p.icon className="size-5 text-fg" aria-hidden />
                  </span>
                  <span className="text-xs font-medium text-fg-3">{p.tag}</span>
                </div>
                <h3 className="display relative mt-5 text-3xl font-bold">{p.name}</h3>
                <p className="relative mt-1 text-sm font-medium text-fg-2">{p.en}</p>
                <p className="relative mt-4 flex-1 text-sm leading-relaxed text-fg-3">{p.body}</p>
                <div className="relative mt-6 border-t hairline pt-4">
                  <p className="text-xs text-fg-3">{p.kpiLabel}</p>
                  <p className="display tabular mt-1 text-2xl font-bold text-fg">{p.kpi}</p>
                </div>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-bad group-hover:gap-2.5 transition-[gap]">
                  Open {p.name} <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust-title" className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Eyebrow>Why the jury can trust it</Eyebrow>
          <h2 id="trust-title" className="display mt-2 text-3xl font-bold md:text-4xl">
            Engines decide. Gemini explains.
          </h2>
          <p className="mt-4 text-fg-2">
            Every allocation, odds figure and travel time comes from deterministic, unit-tested
            engines. Gemini turns those facts into warm, multilingual conversation — and a numbers
            guard throws away any sentence that contains a figure the engine didn’t produce.
          </p>
          <ButtonLink href="/how-it-works" variant="secondary" className="mt-6">
            How it works <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: Ban,
              t: 'No dynamic pricing',
              d: 'Capacity is dynamic, prices never are. Every recycled seat moves at face value.',
            },
            {
              icon: Fingerprint,
              t: 'Verifiable draws',
              d: 'SHA-256 commitment before the ballot closes; anyone can re-check their entry.',
            },
            {
              icon: EyeOff,
              t: 'Privacy by design',
              d: 'Opt-in signals only, no biometrics. The no-show estimate is built to run on-device.',
            },
            {
              icon: ShieldCheck,
              t: 'Human in the loop',
              d: 'Gemini can suggest a release — only the fan’s tap can execute it.',
            },
            {
              icon: Calculator,
              t: 'Numbers guard',
              d: 'Invented numbers trigger a safe, grounded fallback. The UI always shows the source.',
            },
            {
              icon: Users,
              t: 'Nobody left behind',
              d: 'Works offline in demo mode, step-free routing, youth fan-club gifting.',
            },
          ].map((x) => (
            <li key={x.t} className="rounded-2xl border hairline bg-ink-850/60 p-4">
              <x.icon className="size-5 text-bad" aria-hidden />
              <p className="mt-3 font-semibold text-fg">{x.t}</p>
              <p className="mt-1 text-sm text-fg-3">{x.d}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
