'use client';

import type { Contribution, SimulationResult } from '@fcb/core';
import { ArrowRight, Gift, Lock, Scale, ShieldCheck, Timer, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LineChart } from '@/components/charts/LineChart';
import { StadiumMap, type MapBlock } from '@/components/stadium/StadiumMap';
import { Segmented } from '@/components/ui/controls';
import { Badge, ButtonLink, Panel, Stat } from '@/components/ui/primitives';
import { fmtInt, fmtPct } from '@/lib/format';
import type { BlockRiskView } from '@/lib/server/insights';
import { NO_SEASON, RISK_STEPS, riskScale } from './riskRamp';

interface Props {
  fixtureLabel: string;
  kickoffLabel: string;
  context: { rain: number; temperature: number; weekday: string };
  forecast: {
    blocks: BlockRiskView[];
    expectedAbsent: number;
    seasonSeats: number;
    nudgeable: number;
  };
  sim: { today: SimulationResult; fairseat: SimulationResult };
  sepp: { probability: number; contributions: Contribution[] };
  offerWindows: { label: string; minutes: number }[];
  behaviour: { label: string; today: string; fairseat: string }[];
}

type Layer = 'risk' | 'recovered';

export function RecyclingDashboard({
  fixtureLabel,
  kickoffLabel,
  context,
  forecast,
  sim,
  sepp,
  offerWindows,
  behaviour,
}: Props) {
  const [layer, setLayer] = useState<Layer>('risk');
  const [selected, setSelected] = useState<string>('112');
  const block = forecast.blocks.find((b) => b.id === selected);
  const extraFans =
    sim.fairseat.refilledSeats + sim.fairseat.donatedSeats - sim.today.refilledSeats;
  const recoveredFair = sim.fairseat.recoveredShare;

  const mapBlocks: MapBlock[] = forecast.blocks;
  const byId = useMemo(() => new Map(forecast.blocks.map((b) => [b.id, b])), [forecast.blocks]);
  const scale = useMemo(
    () => riskScale(forecast.blocks.filter((b) => b.seasonSeats > 0).map((b) => b.risk)),
    [forecast.blocks],
  );

  const fill = (mb: MapBlock) => {
    const b = byId.get(mb.id);
    if (!b) return NO_SEASON;
    if (layer === 'risk') return scale.color(b.risk, b.seasonSeats);
    if (b.seasonSeats === 0) return NO_SEASON;
    // Recovered layer: teal intensity by expected seats brought back in this block.
    const back = b.expectedAbsent * recoveredFair;
    return back > 40 ? '#12a08e' : back > 25 ? '#0f7f72' : back > 12 ? '#0d5f57' : '#123c3a';
  };

  const toHours = (r: SimulationResult) => r.series.map((p) => ({ x: p.at / 60, y: p.refilled }));
  const maxSeats = Math.max(
    ...sim.fairseat.series.map((p) => p.refilled),
    ...sim.today.series.map((p) => p.refilled),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Season seats likely empty"
          value={fmtInt(forecast.expectedAbsent)}
          sub={`of ${fmtInt(forecast.seasonSeats)} season seats`}
          tone="red"
        />
        <Stat
          label="Opted-in fans Gemini would nudge"
          value={fmtInt(forecast.nudgeable)}
          sub="risk ≥ 30%, opted in"
          tone="amber"
        />
        <Stat
          label="Back in use — today"
          value={fmtPct(sim.today.recoveredShare)}
          sub={`${fmtInt(sim.today.refilledSeats)} seats via the exchange`}
          tone="blue"
        />
        <Stat
          label="Back in use — Fair Seat"
          value={fmtPct(recoveredFair)}
          sub={`${fmtInt(sim.fairseat.refilledSeats + sim.fairseat.donatedSeats)} seats incl. youth gifts`}
          tone="green"
        />
        <Stat
          label="Extra fans in the Arena"
          value={`+${fmtInt(extraFans)}`}
          sub={`this match · ≈${fmtInt(extraFans * 17)} per Bundesliga season`}
          tone="green"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel
          title="Arena forecast"
          subtitle={`${fixtureLabel} · ${kickoffLabel} · ${context.weekday}, ${Math.round(context.rain * 100)}% rain, ${context.temperature}°C`}
          actions={
            <Segmented<Layer>
              label="Map layer"
              size="sm"
              value={layer}
              onChange={setLayer}
              options={[
                { value: 'risk', label: 'No-show risk' },
                { value: 'recovered', label: 'Seats recovered' },
              ]}
            />
          }
        >
          <StadiumMap
            title={
              layer === 'risk'
                ? 'Predicted share of season seats left empty, per block'
                : 'Seats brought back into use with Fair Seat, per block'
            }
            blocks={mapBlocks}
            fill={fill}
            highlightId={selected}
            onSelect={(b) => setSelected(b.id)}
            tooltip={(mb) => {
              const b = byId.get(mb.id);
              if (!b) return mb.label;
              return (
                <>
                  <p className="font-semibold text-fg">{b.label}</p>
                  {b.seasonSeats === 0 ? (
                    <p className="text-fg-3">No season tickets ({b.kind})</p>
                  ) : (
                    <p className="tabular text-fg-2">
                      {fmtPct(b.risk, 1)} risk · ≈{Math.round(b.expectedAbsent)} empty of{' '}
                      {fmtInt(b.seasonSeats)}
                    </p>
                  )}
                </>
              );
            }}
            legend={
              layer === 'risk' ? (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-fg-3">
                  {RISK_STEPS.map((c, i) => (
                    <span key={c} className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="size-3 rounded-sm" style={{ background: c }} />{' '}
                      {scale.label(i)}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-3 rounded-sm ring-1 ring-line-strong"
                      style={{ background: NO_SEASON }}
                    />{' '}
                    no season seats
                  </span>
                </div>
              ) : (
                <p className="text-center text-[11px] text-fg-3">
                  Brighter teal = more seats back in use in that block
                </p>
              )
            }
          />
          {block && (
            <div className="mt-4 flex items-center justify-between rounded-xl border hairline bg-ink-800/60 px-4 py-3 text-sm">
              <span className="font-medium text-fg">{block.label}</span>
              <span className="tabular text-fg-2">
                {block.seasonSeats
                  ? `${fmtPct(block.risk, 1)} · ≈${Math.round(block.expectedAbsent)} seats`
                  : 'no season seats'}
              </span>
            </div>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Seats back in use, 72 hours to kick-off"
            subtitle="Same absent fans in both runs — only the process differs. Simulated with the real matching engine."
          >
            <LineChart
              title="Cumulative seats back in use before kick-off"
              series={[
                {
                  key: 'fair',
                  label: 'Fair Seat (nudge + waitlist)',
                  color: 'var(--color-viz-a)',
                  points: toHours(sim.fairseat),
                },
                {
                  key: 'today',
                  label: 'Today (Ticket Exchange)',
                  color: 'var(--color-viz-c)',
                  points: toHours(sim.today),
                },
              ]}
              xTicks={[-72, -48, -24, 0]}
              formatX={(h) => (Math.round(h) === 0 ? 'Kick-off' : `T−${Math.abs(Math.round(h))} h`)}
              formatY={(v) => fmtInt(v)}
              yMax={maxSeats * 1.1}
              markers={[{ x: -3, label: 'Exchange closes', color: 'var(--color-viz-c)' }]}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <p className="rounded-xl bg-ink-800/60 p-3 text-xs text-fg-3">
                <Timer className="mb-1 size-4 text-ok" aria-hidden />
                Median time from release to a new fan:{' '}
                <span className="font-semibold text-fg">
                  {sim.fairseat.medianMinutesToRefill ?? '—'} min
                </span>{' '}
                (today {sim.today.medianMinutesToRefill ?? '—'} min).
              </p>
              <p className="rounded-xl bg-ink-800/60 p-3 text-xs text-fg-3">
                <Users className="mb-1 size-4 text-ok" aria-hidden />
                <span className="font-semibold text-fg">
                  {fmtInt(sim.fairseat.fansServed)}
                </span>{' '}
                waitlist fans seated, from {fmtInt(sim.fairseat.offersMade)} one-tap offers.
              </p>
              <p className="rounded-xl bg-ink-800/60 p-3 text-xs text-fg-3">
                <Gift className="mb-1 size-4 text-ok" aria-hidden />
                <span className="font-semibold text-fg">
                  {fmtInt(sim.fairseat.donatedSeats)}
                </span>{' '}
                seats gifted to youth fan clubs by their holders.
              </p>
            </div>
          </Panel>

          <Panel
            title="Why the app asks Sepp"
            subtitle="Block 112 · season ticket since 1998 · explainable, on-device estimate"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-fg-2">Chance his Südkurve spot stays empty</p>
              <p className="display tabular text-3xl font-bold text-fg">
                {fmtPct(sepp.probability)}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {sepp.contributions.map((c) => {
                const max = sepp.contributions[0]?.effect ?? 1;
                return (
                  <li
                    key={c.feature}
                    className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-xs"
                  >
                    <span className="truncate text-fg-2">{c.label}</span>
                    <span
                      className="h-2 rounded-full bg-viz-a"
                      style={{ width: `${Math.max(6, (c.effect / max) * 100)}%` }}
                      aria-hidden
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 flex items-start gap-2 text-xs text-fg-3">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Opt-in signals only. Designed to run on the phone — the club learns nothing unless
              Sepp taps “release”.
            </p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Published matching rules">
          <ul className="space-y-2.5 text-sm text-fg-2">
            <li className="flex gap-2">
              <Scale className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden /> Next in line is the
              ballot’s own verifiable draw order.
            </li>
            <li className="flex gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden /> Groups are never
              split; leftover seats are re-listed instantly.
            </li>
            <li className="flex gap-2">
              <Timer className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden /> Only fans who can
              still reach the Arena in time get an offer.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden /> Accessible
              spaces go to fans who need them first.
            </li>
            <li className="flex gap-2">
              <Badge tone="green">Face value</Badge> No fees, no surge — releasing keeps your
              loyalty credit.
            </li>
          </ul>
        </Panel>
        <Panel title="Offer windows shrink towards kick-off">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {offerWindows.map((w) => (
                <tr key={w.label}>
                  <th scope="row" className="py-2 text-left font-normal text-fg-2">
                    {w.label}
                  </th>
                  <td className="tabular py-2 text-right font-semibold text-fg">{w.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Assumptions we will test in the pilot">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-fg-3">
                <th scope="col" className="pb-2 text-left font-medium" />
                <th scope="col" className="pb-2 text-right font-medium">
                  Today
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Fair Seat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {behaviour.map((b) => (
                <tr key={b.label}>
                  <th scope="row" className="py-2 text-left font-normal text-fg-2">
                    {b.label}
                  </th>
                  <td className="tabular py-2 text-right text-fg-2">{b.today}</td>
                  <td className="tabular py-2 text-right font-semibold text-fg">{b.fairseat}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-fg-3">
            Pilot: one low-demand home match, 500 opt-in season-ticket holders.
          </p>
        </Panel>
      </div>

      <div className="card flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
        <div>
          <p className="display text-2xl font-bold">See it happen on two phones</p>
          <p className="text-sm text-fg-2">
            Sepp releases his Südkurve spot in a Gemini chat — Mia gets the offer seconds later.
          </p>
        </div>
        <ButtonLink href="/live" size="lg">
          Open the stage demo <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </div>
    </div>
  );
}
