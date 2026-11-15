'use client';

import { formatMatchDate, type Contribution, type SimulationResult } from '@fcb/core';
import { ArrowRight, Gift, Lock, Scale, ShieldCheck, Timer, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LineChart } from '@/components/charts/LineChart';
import { StadiumMap, type MapBlock } from '@/components/stadium/StadiumMap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Segmented } from '@/components/ui/controls';
import { Badge, ButtonLink, Panel, Stat } from '@/components/ui/primitives';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { blockKind, blockLabel, contributionLabel, offerWindowLabel } from '@/lib/i18n/domain';
import type { BlockRiskView } from '@/lib/server/insights';
import { NO_SEASON, RECOVERED_STEPS, RISK_STEPS, riskScale } from './riskRamp';

interface Props {
  fixture: { label: string; kickoff: string; clock: string };
  context: { rain: number; temperature: number; midweek: boolean };
  forecast: {
    blocks: BlockRiskView[];
    expectedAbsent: number;
    seasonSeats: number;
    nudgeable: number;
  };
  sim: { today: SimulationResult; fairseat: SimulationResult };
  sepp: { probability: number; contributions: Contribution[] };
  offerWindows: { label: string; minutes: number }[];
  behaviour: { releaseToday: number; releaseFair: number; noResponse: number; youthGift: number };
}

type Layer = 'risk' | 'recovered';
const DATE_TAG = { en: 'en-GB', de: 'de-DE' } as const;

export function RecyclingDashboard({
  fixture,
  context,
  forecast,
  sim,
  sepp,
  offerWindows,
  behaviour,
}: Props) {
  const t = useT();
  const f = useFormat();
  const { locale } = useLocale();
  const tr = t.recycling;
  const [layer, setLayer] = useState<Layer>('risk');
  const [selected, setSelected] = useState<string>('112');
  const extraFans =
    sim.fairseat.refilledSeats + sim.fairseat.donatedSeats - sim.today.refilledSeats;
  const recoveredFair = sim.fairseat.recoveredShare;

  const blocks = useMemo(
    () => forecast.blocks.map((b) => ({ ...b, label: blockLabel(b, locale) })),
    [forecast.blocks, locale],
  );
  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const block = byId.get(selected);
  const scale = useMemo(
    () => riskScale(blocks.filter((b) => b.seasonSeats > 0).map((b) => b.risk)),
    [blocks],
  );

  const fill = (mb: MapBlock) => {
    const b = byId.get(mb.id);
    if (!b) return NO_SEASON;
    if (layer === 'risk') return scale.color(b.risk, b.seasonSeats);
    if (b.seasonSeats === 0) return NO_SEASON;
    const back = b.expectedAbsent * recoveredFair;
    const i = back > 40 ? 3 : back > 25 ? 2 : back > 12 ? 1 : 0;
    return RECOVERED_STEPS[i] as string;
  };

  const toHours = (r: SimulationResult) => r.series.map((p) => ({ x: p.at / 60, y: p.refilled }));
  const maxSeats = Math.max(
    ...sim.fairseat.series.map((p) => p.refilled),
    ...sim.today.series.map((p) => p.refilled),
  );
  const pctRound = (p: number) => f.pct(p);
  const behaviourRows = [
    {
      label: tr.behaviour.release,
      today: pctRound(behaviour.releaseToday),
      fair: `${pctRound(behaviour.releaseFair)} (${tr.behaviour.optedIn})`,
    },
    { label: tr.behaviour.deadline, today: 'T−3 h', fair: 'T−30 min' },
    { label: tr.behaviour.fees, today: '15% + €5–8', fair: tr.behaviour.feesNone },
    { label: tr.behaviour.unanswered, today: '—', fair: pctRound(behaviour.noResponse) },
    { label: tr.behaviour.youth, today: '—', fair: pctRound(behaviour.youthGift) },
  ];
  const ruleIcons = [Scale, Users, Timer, ShieldCheck];
  const maxEffect = sepp.contributions[0]?.effect ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label={tr.stats.empty}
          value={<AnimatedNumber value={Math.round(forecast.expectedAbsent)} countUp />}
          sub={tr.stats.emptySub(f.int(forecast.seasonSeats))}
          tone="red"
        />
        <Stat
          label={tr.stats.nudge}
          value={<AnimatedNumber value={Math.round(forecast.nudgeable)} countUp />}
          sub={tr.stats.nudgeSub}
          tone="amber"
        />
        <Stat
          label={tr.stats.today}
          value={f.pct(sim.today.recoveredShare)}
          sub={tr.stats.todaySub(f.int(sim.today.refilledSeats))}
        />
        <Stat
          label={tr.stats.fair}
          value={f.pct(recoveredFair)}
          sub={tr.stats.fairSub(f.int(sim.fairseat.refilledSeats + sim.fairseat.donatedSeats))}
          tone="red"
        />
        <Stat
          label={tr.stats.extra}
          value={
            <span className="text-fcb">
              <AnimatedNumber value={extraFans} prefix="+" countUp />
            </span>
          }
          sub={tr.stats.extraSub(f.int(extraFans * 17))}
          tone="red"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel
          title={tr.mapTitle}
          subtitle={tr.context(
            fixture.label,
            `${formatMatchDate(fixture.kickoff, DATE_TAG[locale])}, ${fixture.clock}`,
            context.midweek ? tr.weekday.midweek : tr.weekday.weekend,
            Math.round(context.rain * 100),
            context.temperature,
          )}
          actions={
            <Segmented<Layer>
              label={tr.layer}
              size="sm"
              value={layer}
              onChange={setLayer}
              options={[
                { value: 'risk', label: tr.layerRisk },
                { value: 'recovered', label: tr.layerRecovered },
              ]}
            />
          }
        >
          <StadiumMap
            title={layer === 'risk' ? tr.mapRiskTitle : tr.mapRecTitle}
            blocks={blocks}
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
                    <p className="text-fg-3">{tr.noSeason(blockKind(b.kind, locale))}</p>
                  ) : (
                    <p className="tabular text-fg-2">
                      {tr.riskLine(
                        f.pct(b.risk, 1),
                        Math.round(b.expectedAbsent),
                        f.int(b.seasonSeats),
                      )}
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
                      <span
                        aria-hidden
                        className="size-3 rounded-[4px]"
                        style={{ background: c }}
                      />
                      {scale.label(i)}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-3 rounded-[4px] ring-1 ring-line-strong"
                      style={{ background: NO_SEASON }}
                    />
                    {tr.noSeasonLegend}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-fg-3">
                  <span className="flex gap-0.5" aria-hidden>
                    {RECOVERED_STEPS.map((c) => (
                      <span key={c} className="size-3 rounded-[4px]" style={{ background: c }} />
                    ))}
                  </span>
                  {tr.recLegend}
                </div>
              )
            }
          />
          {block && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ink-800 px-4 py-3 text-sm">
              <span className="min-w-0 truncate font-medium text-fg">{block.label}</span>
              <span className="tabular shrink-0 text-fg-2">
                {block.seasonSeats
                  ? tr.blockLine(f.pct(block.risk, 1), Math.round(block.expectedAbsent))
                  : tr.noSeasonShort}
              </span>
            </div>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={tr.chartTitle} subtitle={tr.chartSub}>
            <LineChart
              title={tr.chartAria}
              series={[
                {
                  key: 'fair',
                  label: tr.seriesFair,
                  color: 'var(--color-viz-a)',
                  points: toHours(sim.fairseat),
                },
                {
                  key: 'today',
                  label: tr.seriesToday,
                  color: 'var(--color-viz-c)',
                  points: toHours(sim.today),
                },
              ]}
              xTicks={[-72, -48, -24, 0]}
              formatX={(h) => (Math.round(h) === 0 ? tr.kickoff : `T−${Math.abs(Math.round(h))} h`)}
              formatY={(v) => f.int(v)}
              yMax={maxSeats * 1.1}
              markers={[{ x: -3, label: tr.exchangeCloses, color: 'var(--color-fg-3)' }]}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Timer,
                  text: tr.median(
                    String(sim.fairseat.medianMinutesToRefill ?? '—'),
                    String(sim.today.medianMinutesToRefill ?? '—'),
                  ),
                },
                {
                  icon: Users,
                  text: tr.served(f.int(sim.fairseat.fansServed), f.int(sim.fairseat.offersMade)),
                },
                { icon: Gift, text: tr.gifted(f.int(sim.fairseat.donatedSeats)) },
              ].map((x) => (
                <p
                  key={x.text}
                  className="rounded-xl bg-ink-800 p-3.5 text-xs leading-relaxed text-fg-2"
                >
                  <x.icon className="mb-2 size-4 text-bad" aria-hidden />
                  {x.text}
                </p>
              ))}
            </div>
          </Panel>

          <Panel title={tr.seppTitle} subtitle={tr.seppSub}>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-fg-2">{tr.seppChance}</p>
              <p className="display text-4xl text-fcb">
                <AnimatedNumber value={sepp.probability} format={{ style: 'percent' }} countUp />
              </p>
            </div>
            <ul className="mt-4 space-y-2.5">
              {sepp.contributions.map((c, i) => (
                <li
                  key={c.feature}
                  className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-xs"
                >
                  <span className="truncate text-fg-2">{contributionLabel(c, locale)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-ink-750" aria-hidden>
                    <span
                      className="chart-bar block h-full origin-left rounded-full bg-fcb"
                      style={{
                        transform: `scaleX(${Math.max(0.06, c.effect / maxEffect).toFixed(4)})`,
                        animationDelay: `${i * 40}ms`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-ink-800 p-3 text-xs text-fg-3">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-fg-2" aria-hidden />
              {tr.seppPrivacy}
            </p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={tr.rulesTitle}>
          <ul className="space-y-3 text-sm text-fg-2">
            {tr.rules.map((rule, i) => {
              const Icon = ruleIcons[i] ?? Scale;
              return (
                <li key={rule} className="flex gap-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden /> {rule}
                </li>
              );
            })}
            <li className="flex flex-wrap items-center gap-2">
              <Badge tone="green">{tr.faceValue}</Badge> {tr.faceValueRule}
            </li>
          </ul>
        </Panel>
        <Panel title={tr.windowsTitle}>
          <table className="w-full text-sm">
            <tbody>
              {offerWindows.map((w, i) => (
                <tr key={w.label} className="border-b hairline last:border-0">
                  <th scope="row" className="py-2.5 text-left font-normal text-fg-2">
                    {offerWindowLabel(w.label, i, locale)}
                  </th>
                  <td className="tabular py-2.5 text-right font-semibold text-fg">
                    {w.minutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title={tr.pilotTitle}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-fg-3">
                <th scope="col" className="pb-2 text-left font-medium" />
                <th scope="col" className="pb-2 text-right font-medium">
                  {tr.colToday}
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  {tr.colFair}
                </th>
              </tr>
            </thead>
            <tbody>
              {behaviourRows.map((b) => (
                <tr key={b.label} className="border-t hairline">
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal text-fg-2">
                    {b.label}
                  </th>
                  <td className="tabular py-2.5 text-right text-fg-3">{b.today}</td>
                  <td className="tabular py-2.5 pl-2 text-right font-semibold text-fg">{b.fair}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-fg-3">{tr.pilot}</p>
        </Panel>
      </div>

      <div className="relative flex flex-col items-start justify-between gap-5 overflow-hidden rounded-[var(--radius-card)] bg-fg p-6 text-inverse md:flex-row md:items-center md:p-8">
        <div>
          <p className="display text-2xl md:text-3xl">{tr.ctaTitle}</p>
          <p className="mt-1 text-sm opacity-75">{tr.ctaLead}</p>
        </div>
        <ButtonLink href="/live" size="lg">
          {tr.ctaButton} <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </div>
    </div>
  );
}
