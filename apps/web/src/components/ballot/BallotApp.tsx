'use client';

import {
  DEMO_MEMBERS,
  clockAt,
  formatMatchDate,
  getMember,
  oddsForMember,
  openFixtures,
  recommendApplications,
  type FixtureOdds,
  type MemberProfile,
  type Strategy,
} from '@fcb/core';
import { Check, Heart, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '@/components/ui/controls';
import { Avatar, Badge, Button, Panel } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { fmtOneIn, fmtPct } from '@/lib/format';
import { DrawPanel } from './DrawPanel';
import { LoyaltyCard } from './LoyaltyCard';

const OPEN = openFixtures();
const MAX_APPS = 3;

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

export function BallotApp() {
  const [memberId, setMemberId] = useState('lena');
  const [strategy, setStrategy] = useState<Strategy>('at-least-one');
  const member = getMember(memberId);
  const [selected, setSelected] = useState<string[]>(() => smartPicksFor(member, 'at-least-one'));

  const odds = useMemo(() => OPEN.map((f) => oddsForMember(f, member)), [member]);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="flex flex-col gap-6" aria-label="Member">
        <Panel title="Who’s applying?" subtitle="Fictional members — switch to compare">
          <div className="-mx-2 grid gap-1" role="radiogroup" aria-label="Demo member">
            {DEMO_MEMBERS.map((m) => {
              const active = m.id === memberId;
              return (
                <div key={m.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseMember(m.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                      active ? 'bg-ink-700 ring-1 ring-line-strong' : 'hover:bg-ink-750',
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
                      <span
                        className={cn('block truncate text-xs', active ? 'text-fg-2' : 'text-fg-3')}
                      >
                        {m.city} · member since {m.memberSince}
                      </span>
                    </span>
                    {active && <Check className="size-4 text-ok" aria-hidden />}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fg-3">{member.persona}</p>
        </Panel>
        <LoyaltyCard member={member} />
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          id="odds"
          title="Your odds for the next ballot phase"
          subtitle={`Pick up to ${MAX_APPS} matches. Odds come from the published rules and modelled demand.`}
          actions={
            <Badge tone={selected.length === MAX_APPS ? 'green' : 'neutral'}>
              {selected.length} of {MAX_APPS} applications
            </Badge>
          }
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center gap-4 border-b hairline px-5 py-2.5 text-xs text-fg-3">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-2 w-5 rounded-full bg-viz-a" />{' '}
              {member.firstName === 'Anna' ? 'Familie Huber' : member.firstName}
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-2 w-5 rounded-full bg-viz-c" /> First-time applicant
            </span>
          </div>
          <ul className="divide-y divide-line">
            {OPEN.map((f) => {
              const o = oddsById.get(f.id) as FixtureOdds;
              const checked = selected.includes(f.id);
              const disabled = !checked && selected.length >= MAX_APPS;
              const pref = member.preferences[f.id] ?? 0;
              return (
                <li key={f.id}>
                  <label
                    className={cn(
                      'grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)]',
                      checked ? 'bg-viz-a/[0.06]' : 'hover:bg-ink-800',
                      disabled && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-viz-a)]"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(f.id)}
                      aria-describedby={`odds-${f.id}`}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-fg">{f.opponent}</span>
                        {f.billing && <Badge tone="red">{f.billing}</Badge>}
                        {f.tags.includes('midweek') && <Badge tone="amber">Midweek</Badge>}
                        {pref === 3 && (
                          <Heart className="size-3.5 fill-bad text-bad" aria-label="Must-see" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-fg-3">
                        {formatMatchDate(f.kickoff)} · {clockAt(f.kickoff, 0)} · {f.competition}
                      </span>
                    </span>
                    <span
                      id={`odds-${f.id}`}
                      className="col-span-2 flex items-center gap-4 sm:col-span-1"
                    >
                      <span className="w-20 shrink-0 text-right">
                        <span className="display tabular block text-2xl leading-none font-bold text-fg">
                          {fmtOneIn(o.probability)}
                        </span>
                        <span className="tabular text-[11px] text-fg-3">
                          {fmtPct(o.probability, 1)}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1" aria-hidden>
                        <span
                          className="h-2 rounded-full bg-viz-a"
                          style={{ width: `${(o.probability / maxP) * 100}%` }}
                        />
                        <span
                          className="h-2 rounded-full bg-viz-c"
                          style={{ width: `${(o.baselineProbability / maxP) * 100}%` }}
                        />
                      </span>
                      <span className="sr-only">
                        First-time applicant: {fmtOneIn(o.baselineProbability)}. Loyalty multiplier{' '}
                        {o.loyaltyMultiplier.toFixed(1)}.
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline px-5 py-3.5">
            <p className="text-sm text-fg-2">
              Chance of at least one match with your picks:{' '}
              <span className="display tabular text-xl font-bold text-fg">{fmtPct(pSelected)}</span>
            </p>
          </div>
        </Panel>

        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-bad" aria-hidden /> Apply smart
            </span>
          }
          subtitle="Same number of applications, better odds — the draws are independent, so spreading wisely pays."
          actions={
            <Segmented<Strategy>
              label="Strategy"
              size="sm"
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: 'at-least-one', label: 'Best chance of a match' },
                { value: 'favourites', label: 'My favourites' },
              ]}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            {[
              { title: 'Smart picks', r: rec.smart, tone: 'green' as const },
              { title: 'Only the big games', r: rec.naive, tone: 'blue' as const },
            ].map((col) => (
              <div key={col.title} className="rounded-2xl border hairline bg-ink-800/60 p-4">
                <p className="text-xs font-medium text-fg-3">{col.title}</p>
                <p className="display tabular mt-1 text-4xl font-bold text-fg">
                  {fmtPct(col.r.pAtLeastOne)}
                </p>
                <p className="text-xs text-fg-3">chance of at least one match</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {col.r.picks.map((p) => {
                    const f = OPEN.find((x) => x.id === p.fixtureId);
                    return (
                      <li key={p.fixtureId} className="flex items-center justify-between gap-2">
                        <span className="truncate text-fg-2">{f?.opponent}</span>
                        <span className="tabular shrink-0 text-xs text-fg-3">
                          {fmtOneIn(p.probability)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-viz-a/40 bg-viz-a/10 p-4 md:w-48">
              <div>
                <p className="text-xs font-medium text-ok">Uplift</p>
                <p className="display tabular text-4xl font-bold text-fg">
                  +{Math.max(0, Math.round(rec.uplift * 100))}
                  <span className="text-xl"> pts</span>
                </p>
              </div>
              <Button
                variant="inverse"
                size="sm"
                onClick={() => setSelected(rec.smart.picks.map((p) => p.fixtureId))}
              >
                Use smart picks
              </Button>
            </div>
          </div>
          {rec.smart.picks[0] && (
            <p className="mt-4 text-xs text-fg-3">Why: {rec.smart.picks[0].reason}.</p>
          )}
        </Panel>

        <DrawPanel
          key={memberId}
          member={member}
          candidateIds={selected.length ? selected : OPEN.map((f) => f.id)}
        />
      </div>
    </div>
  );
}
