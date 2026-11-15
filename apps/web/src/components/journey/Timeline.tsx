import type { CrowdLevel, StepKind, TimelineStep } from '@fcb/core';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

const DOT: Record<StepKind, string> = {
  depart: 'bg-fg',
  walk: 'bg-fg-3',
  ride: 'bg-u6',
  drive: 'bg-viz-amber',
  cycle: 'bg-viz-teal',
  arrive: 'bg-fg',
  gate: 'bg-fcb',
  food: 'bg-fcb',
  seat: 'bg-fcb',
  kickoff: 'bg-white',
  halftime: 'bg-fg-2',
  fulltime: 'bg-white',
  postmatch: 'bg-viz-teal',
  return: 'bg-u6',
  home: 'bg-fg',
};

const CROWD: Record<CrowdLevel, { tone: 'teal' | 'neutral' | 'amber' | 'red'; label: string }> = {
  calm: { tone: 'teal', label: 'Calm' },
  busy: { tone: 'neutral', label: 'Busy' },
  packed: { tone: 'amber', label: 'Packed' },
  crush: { tone: 'red', label: 'Very full' },
};

/** The plan drawn like a U-Bahn line diagram: stops on a line, colour by mode. */
export function Timeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const big =
          s.kind === 'kickoff' || s.kind === 'seat' || s.kind === 'depart' || s.kind === 'home';
        return (
          <li key={s.id} className="grid grid-cols-[52px_22px_minmax(0,1fr)] gap-x-3">
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
                <span className="absolute top-3 bottom-[-4px] w-[3px] rounded bg-line-strong" />
              )}
              <span
                className={cn(
                  'relative mt-1 rounded-full ring-4 ring-ink-850',
                  DOT[s.kind],
                  big ? 'size-3.5' : 'size-2.5',
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
                  <span className="rounded bg-[#1b5fa8] px-1.5 py-px text-[11px] font-bold text-white">
                    {s.line}
                  </span>
                )}
                {s.title}
                {s.crowd && <Badge tone={CROWD[s.crowd].tone}>{CROWD[s.crowd].label}</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-fg-3">{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
