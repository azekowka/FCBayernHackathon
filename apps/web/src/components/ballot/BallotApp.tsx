'use client';

import {
  DEMO_MEMBERS,
  clockAt,
  formatMatchDate,
  getMember,
  oddsForMember,
  oneIn,
  openFixtures,
  recommendApplications,
  type FixtureOdds,
  type MemberProfile,
  type Strategy,
} from '@fcb/core';
import { Check, Heart, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Segmented } from '@/components/ui/controls';
import { Avatar, Badge, Button, Panel } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { DrawPanel } from './DrawPanel';
import { LoyaltyCard } from './LoyaltyCard';

const OPEN = openFixtures();
const MAX_APPS = 3;
const DATE_TAG = { en: 'en-GB', de: 'de-DE' } as const;

function smartPicksFor(member: MemberProfile, strategy: Strategy): string[] {
  const odds = OPEN.map((f) => oddsForMember(f, member));
  return recommendApplications({
    fixtures: OPEN,
    odds,
    preferences: member.preferences,
    maxApplications: MAX_APPS,
    strategy,
  }).smart.picks.map((p) => p.fixtureId);
}

/** "1 in 15" as a rolling number: prefix + value so only the digits move. */
function OddsNumber({ p, className }: { p: number; className?: string }) {
  const { locale } = useLocale();
  const n = oneIn(p);
  if (!Number.isFinite(n)) return <span className={className}>—</span>;
  return (
    <AnimatedNumber
      className={className}
      value={n}
      prefix={locale === 'de' ? '1 zu ' : '1 in '}
      format={{ maximumFractionDigits: 1 }}
    />
  );
}

export function BallotApp() {
  const t = useT();
  const f = useFormat();
  const { locale } = useLocale();
  const tb = t.ballot;
  const [memberId, setMemberId] = useState('lena');
  const [strategy, setStrategy] = useState<Strategy>('at-least-one');
  const member = getMember(memberId);
  const [selected, setSelected] = useState<string[]>(() => smartPicksFor(member, 'at-least-one'));

  const odds = useMemo(() => OPEN.map((x) => oddsForMember(x, member)), [member]);
  const oddsById = useMemo(() => new Map(odds.map((o) => [o.fixtureId, o])), [odds]);
  const rec = useMemo(
    () =>
      recommendApplications({
        fixtures: OPEN,
        odds,
        preferences: member.preferences,
        maxApplications: MAX_APPS,
        strategy,
      }),
    [odds, member, strategy],
  );
  const maxP = Math.max(...odds.map((o) => o.probability));

  const chooseMember = (id: string) => {
    setMemberId(id);
    setSelected(smartPicksFor(getMember(id), strategy));
  };
  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_APPS ? [...cur, id] : cur,
    );
  const pSelected =
    1 - selected.reduce((acc, id) => acc * (1 - (oddsById.get(id)?.probability ?? 0)), 1);

  const reason = (pick: (typeof rec.smart.picks)[number]) => {
    const fx = OPEN.find((x) => x.id === pick.fixtureId);
    const o = oddsById.get(pick.fixtureId);
    if (!fx || !o) return '';
    const parts = [f.oneIn(pick.probability)];
    if (fx.tags.includes('midweek')) parts.push(tb.reason.midweek);
    else if (o.pressure < 12) parts.push(tb.reason.pressure(f.dec(o.pressure, 1)));
    else if (fx.tags.includes('top-game')) parts.push(tb.reason.top);
    if (o.loyaltyMultiplier >= 1.5) parts.push(tb.reason.loyalty(f.dec(o.loyaltyMultiplier, 1)));
    if (pick.preference === 3) parts.push(tb.reason.mustSee);
    return parts.join(' · ');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6" aria-label="Member">
        <Panel title={tb.whoTitle} subtitle={tb.whoSub}>
          <div className="-mx-2 grid gap-1" role="radiogroup" aria-label="Demo member">
            {DEMO_MEMBERS.map((m) => {
              const active = m.id === memberId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseMember(m.id)}
                  className={cn(
                    'press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left',
                    active
                      ? 'bg-fcb/[0.06] shadow-[inset_0_0_0_1px_rgb(220_5_45/0.35)]'
                      : 'hover:bg-ink-750',
                  )}
                >
                  <Avatar name={m.name} hue={m.avatarHue} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                      {m.name}
                      {m.groupSize > 1 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-normal text-fg-3">
                          <Users className="size-3" aria-hidden />×{m.groupSize}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-fg-3">
                      {m.city} · {tb.memberSince(m.memberSince)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full bg-fcb text-white transition-[opacity,transform] duration-200 ease-[var(--ease-out)]',
                      active ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 rounded-xl bg-ink-800 p-3 text-xs leading-relaxed text-fg-2">
            {tb.personas[member.id] ?? member.persona}
          </p>
        </Panel>
        <LoyaltyCard member={member} />
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          id="odds"
          title={tb.oddsTitle}
          subtitle={tb.oddsSub(MAX_APPS)}
          actions={
            <Badge tone={selected.length === MAX_APPS ? 'red' : 'neutral'} className="tabular">
              {tb.applications(selected.length, MAX_APPS)}
            </Badge>
          }
          bodyClassName="p-0 md:p-0"
        >
          <div className="flex flex-wrap items-center gap-4 px-5 pb-3 text-xs text-fg-3 md:px-6">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-2 w-5 rounded-full bg-viz-a" />
              {member.id === 'huber' ? tb.legendFamily : member.firstName}
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-2 w-5 rounded-full bg-viz-c" /> {tb.legendFirst}
            </span>
          </div>
          <ul className="border-t hairline">
            {OPEN.map((fx) => {
              const o = oddsById.get(fx.id) as FixtureOdds;
              const checked = selected.includes(fx.id);
              const disabled = !checked && selected.length >= MAX_APPS;
              const pref = member.preferences[fx.id] ?? 0;
              return (
                <li key={fx.id} className="border-b hairline last:border-b-0">
                  <label
                    className={cn(
                      'grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors duration-150 sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)] md:px-6',
                      checked ? 'bg-fcb/[0.035]' : 'hover:bg-ink-800',
                      disabled && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <span className="relative flex size-5 items-center justify-center">
                      <input
                        type="checkbox"
                        className="peer size-5 cursor-pointer appearance-none rounded-md bg-ink-900 shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors duration-150 checked:bg-fcb checked:shadow-none disabled:cursor-not-allowed"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(fx.id)}
                        aria-describedby={`odds-${fx.id}`}
                      />
                      <Check
                        aria-hidden
                        strokeWidth={3}
                        className="pointer-events-none absolute size-3.5 scale-50 text-white opacity-0 transition-[opacity,transform] duration-150 ease-[var(--ease-out)] peer-checked:scale-100 peer-checked:opacity-100"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-fg">{fx.opponent}</span>
                        {fx.billing && (
                          <Badge tone="red">{tb.billing[fx.billing] ?? fx.billing}</Badge>
                        )}
                        {fx.tags.includes('midweek') && <Badge tone="amber">{tb.midweek}</Badge>}
                        {pref === 3 && (
                          <Heart className="size-3.5 fill-fcb text-fcb" aria-label={tb.mustSee} />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-fg-3">
                        {formatMatchDate(fx.kickoff, DATE_TAG[locale])} · {clockAt(fx.kickoff, 0)} ·{' '}
                        {fx.competition}
                      </span>
                    </span>
                    <span
                      id={`odds-${fx.id}`}
                      className="col-span-2 flex items-center gap-4 sm:col-span-1"
                    >
                      <span className="w-24 shrink-0 text-right">
                        <span className="display odds-value block text-[22px] leading-none text-fg">
                          <OddsNumber p={o.probability} />
                        </span>
                        <span className="tabular text-[11px] text-fg-3">
                          {f.pct(o.probability, 1)}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1" aria-hidden>
                        {/* Bars scale from the left (transform, not width) when the member changes. */}
                        <span className="h-2 overflow-hidden rounded-full bg-ink-750">
                          <span
                            className="block h-full origin-left rounded-full bg-viz-a transition-transform duration-500 ease-[var(--ease-out)]"
                            style={{ transform: `scaleX(${(o.probability / maxP).toFixed(4)})` }}
                          />
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-ink-750">
                          <span
                            className="block h-full origin-left rounded-full bg-viz-c transition-transform duration-500 ease-[var(--ease-out)]"
                            style={{
                              transform: `scaleX(${(o.baselineProbability / maxP).toFixed(4)})`,
                            }}
                          />
                        </span>
                      </span>
                      <span className="sr-only">
                        {tb.srOdds(f.oneIn(o.baselineProbability), f.dec(o.loyaltyMultiplier, 1))}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t hairline bg-ink-800/60 px-5 py-4 md:px-6">
            <p className="text-sm text-fg-2">{tb.atLeastOne}</p>
            <p className="display text-3xl text-fg">
              <AnimatedNumber value={pSelected} format={{ style: 'percent' }} />
            </p>
          </div>
        </Panel>

        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-bad" aria-hidden /> {tb.smartTitle}
            </span>
          }
          subtitle={tb.smartSub}
          actions={
            <Segmented<Strategy>
              label={tb.strategy}
              size="sm"
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: 'at-least-one', label: tb.strategyBest },
                { value: 'favourites', label: tb.strategyFav },
              ]}
            />
          }
        >
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            {[
              { title: tb.smartPicks, r: rec.smart, accent: true },
              { title: tb.bigGames, r: rec.naive, accent: false },
            ].map((col) => (
              <div
                key={col.title}
                className={cn(
                  'rounded-2xl p-4',
                  col.accent ? 'bg-fcb/[0.05] ring-1 ring-fcb/20 ring-inset' : 'bg-ink-800',
                )}
              >
                <p className="flex items-center gap-2 text-xs font-medium text-fg-3">
                  <span
                    aria-hidden
                    className={cn('size-1.5 rounded-full', col.accent ? 'bg-fcb' : 'bg-viz-c')}
                  />
                  {col.title}
                </p>
                <p className="display mt-2 text-4xl text-fg">
                  <AnimatedNumber value={col.r.pAtLeastOne} format={{ style: 'percent' }} />
                </p>
                <p className="text-xs text-fg-3">{tb.chanceOfOne}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {col.r.picks.map((p) => {
                    const fx = OPEN.find((x) => x.id === p.fixtureId);
                    return (
                      <li key={p.fixtureId} className="flex items-center justify-between gap-2">
                        <span className="truncate text-fg-2">{fx?.opponent}</span>
                        <span className="tabular shrink-0 text-xs text-fg-3">
                          {f.oneIn(p.probability)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-fg p-4 text-inverse md:w-52">
              <div>
                <p className="text-xs font-medium opacity-70">{tb.uplift}</p>
                <p className="display mt-1 text-4xl">
                  <AnimatedNumber
                    value={Math.max(0, Math.round(rec.uplift * 100))}
                    prefix="+"
                    suffix={` ${tb.pts}`}
                  />
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelected(rec.smart.picks.map((p) => p.fixtureId));
                  const first = rec.smart.picks[0];
                  toast.success(tb.smartApplied, {
                    description: first ? reason(first) : undefined,
                  });
                }}
              >
                {tb.useSmart}
              </Button>
            </div>
          </div>
          {rec.smart.picks[0] && (
            <p className="mt-4 text-xs text-fg-3">
              <span className="font-semibold text-fg-2">{tb.why}:</span>{' '}
              {reason(rec.smart.picks[0])}.
            </p>
          )}
        </Panel>

        <DrawPanel
          key={memberId}
          member={member}
          candidateIds={selected.length ? selected : OPEN.map((x) => x.id)}
        />
      </div>
    </div>
  );
}
