'use client';

import type { CrowdLevel, StepKind, TimelineStep } from '@fcb/core';
import { Badge, type Tone } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/client';
import { crowdLabel, tj } from '@/lib/i18n/journey';

const DOT: Record<StepKind, string> = {
  depart: 'bg-fg',
  walk: 'bg-fg-3',
  ride: 'bg-u6',
  drive: 'bg-viz-amber',
  cycle: 'bg-ok',
  arrive: 'bg-fg',
  gate: 'bg-fcb',
  food: 'bg-fcb',
  seat: 'bg-fcb',
  kickoff: 'bg-fcb',
  halftime: 'bg-fg-2',
  fulltime: 'bg-fg',
  postmatch: 'bg-blue',
  return: 'bg-u6',
  home: 'bg-fg',
};

const CROWD_TONE: Record<CrowdLevel, Tone> = {
  calm: 'green',
  busy: 'neutral',
  packed: 'amber',
  crush: 'red',
};

/** The plan drawn like a U-Bahn line diagram: stops on a line, colour by mode. */
export function Timeline({ steps }: { steps: readonly TimelineStep[] }) {
  const { locale } = useLocale();
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const big =
          s.kind === 'kickoff' || s.kind === 'seat' || s.kind === 'depart' || s.kind === 'home';
        const rideNext = steps[i + 1]?.kind === 'ride' || s.kind === 'ride';
        return (
          <li key={s.id} className="grid grid-cols-[48px_22px_minmax(0,1fr)] gap-x-3">
            <time
              className={cn(
                'tabular pt-0.5 text-right text-sm',
                big ? 'font-semibold text-fg' : 'text-fg-3',
              )}
            >
              {s.clock}
            </time>
            <span className="relative flex justify-center" aria-hidden>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'absolute top-3 bottom-[-4px] w-[3px] rounded-full',
                    rideNext ? 'bg-u6' : 'bg-line-strong',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative mt-1 rounded-full ring-4 ring-ink-850',
                  DOT[s.kind],
                  big ? 'size-3.5' : 'size-2.5',
                  s.kind === 'kickoff' && 'shadow-[0_0_0_6px_rgb(220_5_45/0.18)]',
                )}
              />
            </span>
            <div className="pb-5">
              <p
                className={cn(
                  'flex flex-wrap items-center gap-2 text-sm',
                  big ? 'font-semibold text-fg' : 'font-medium text-fg-2',
                )}
              >
                {s.line && (
                  <span className="rounded-md bg-u6 px-1.5 py-px text-[11px] font-bold text-white">
                    {s.line}
                  </span>
                )}
                {tj(s.title, locale)}
                {s.crowd && <Badge tone={CROWD_TONE[s.crowd]}>{crowdLabel(s.crowd, locale)}</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-pretty text-fg-3">{tj(s.detail, locale)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
