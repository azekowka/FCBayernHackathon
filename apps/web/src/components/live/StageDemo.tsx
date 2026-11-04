'use client';

import {
  ArrowRight,
  CircleCheck,
  Gift,
  Info,
  Radio,
  RotateCcw,
  SkipForward,
  Smartphone,
  Unlock,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Segmented } from '@/components/ui/controls';
import { Badge, Button, Panel } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { fmtInt } from '@/lib/format';
import type { EngineEvent } from '@/lib/server/liveRooms';
import { FanPhone, HolderPhone } from './Phones';
import { useLiveRoom } from './useLiveRoom';

const EVENT_ICON: Record<EngineEvent['kind'], typeof Info> = {
  info: Info,
  released: Unlock,
  gifted: Gift,
  skipped: SkipForward,
  offered: ArrowRight,
  accepted: CircleCheck,
  declined: X,
  kept: CircleCheck,
};

export function StageDemo({ room }: { room: string }) {
  const { state, connection, error, busy, send } = useLiveRoom(room);
  const [view, setView] = useState<'sepp' | 'engine' | 'fan'>('sepp');
  const [fanChoice, setFanChoice] = useState<string | null>(null);

  if (!state) {
    return (
      <div className="grid gap-6 xl:grid-cols-[380px_1fr_380px]" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[700px] rounded-[2.6rem]" />
        ))}
      </div>
    );
  }

  const active = state.fans.find((f) => f.offer) ?? state.fans.find((f) => f.ticket);
  const fan =
    state.fans.find((f) => f.id === fanChoice) ??
    active ??
    state.fans.find((f) => f.id === 'mia') ??
    state.fans[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge
            tone={connection === 'live' ? 'teal' : connection === 'polling' ? 'amber' : 'neutral'}
          >
            <Radio className="size-3" aria-hidden />{' '}
            {connection === 'live'
              ? 'Live · SSE'
              : connection === 'polling'
                ? 'Polling'
                : 'Connecting'}
          </Badge>
          <span className="text-fg-3">
            Room <span className="font-mono text-fg-2">{room}</span> · matchday clock{' '}
            <span className="tabular text-fg">{state.clock}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<'en' | 'de'>
            label="Assistant language"
            size="sm"
            value={state.language}
            onChange={(language) => send({ action: 'reset', language })}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'de', label: 'DE' },
            ]}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => send({ action: 'reset', language: state.language })}
            disabled={busy}
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reset demo
          </Button>
          <a
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-fg-3 hover:text-fg"
            href={`/live/sepp?room=${room}`}
            target="_blank"
            rel="noreferrer"
          >
            <Smartphone className="size-3.5" aria-hidden /> Sepp’s phone
          </a>
          <a
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-fg-3 hover:text-fg"
            href={`/live/mia?room=${room}`}
            target="_blank"
            rel="noreferrer"
          >
            <Smartphone className="size-3.5" aria-hidden /> Mia’s phone
          </a>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-fcb/40 bg-fcb/10 px-3 py-2 text-sm text-bad"
        >
          {error}
        </p>
      )}

      <div className="xl:hidden">
        <Segmented<'sepp' | 'engine' | 'fan'>
          label="Choose view"
          value={view}
          onChange={setView}
          options={[
            { value: 'sepp', label: 'Sepp (holder)' },
            { value: 'engine', label: 'Engine' },
            { value: 'fan', label: `${fan?.name.split(' ')[0] ?? 'Fan'} (waitlist)` },
          ]}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        <div className={cn(view !== 'sepp' && 'hidden xl:block')}>
          <HolderPhone state={state} send={send} busy={busy} />
        </div>

        <div className={cn('min-w-0', view !== 'engine' && 'hidden xl:block')}>
          <Panel
            title="Matching engine"
            subtitle="The same deterministic engine as the simulation — every step logged"
            bodyClassName="p-0"
          >
            <ol className="max-h-[360px] space-y-0 overflow-y-auto px-5 py-3" aria-live="polite">
              {state.events.map((e) => {
                const Icon = EVENT_ICON[e.kind];
                return (
                  <li key={e.id} className="flex animate-rise gap-3 py-2 text-sm">
                    <span
                      className={cn(
                        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                        e.kind === 'accepted' || e.kind === 'gifted'
                          ? 'bg-viz-teal/20 text-ok'
                          : e.kind === 'skipped'
                            ? 'bg-ink-700 text-fg-3'
                            : e.kind === 'offered' || e.kind === 'released'
                              ? 'bg-fcb/20 text-bad'
                              : 'bg-ink-700 text-fg-2',
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-fg-2">{e.text}</span>
                    <span className="tabular shrink-0 text-xs text-fg-3">{e.clock}</span>
                  </li>
                );
              })}
            </ol>
            <div className="border-t hairline px-5 py-4">
              <p className="mb-2 text-xs font-medium text-fg-3">
                Waitlist for Saturday (ballot draw order)
              </p>
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Fan</th>
                    <th scope="col">Needs</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {state.fans.map((f) => (
                    <tr key={f.id} className={cn(f.id === fan?.id && 'bg-ink-800/60')}>
                      <td className="tabular py-2 pr-2 text-fg-3">#{f.rank}</td>
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          className="text-left font-medium text-fg hover:underline"
                          onClick={() => {
                            setFanChoice(f.id);
                            setView('fan');
                          }}
                        >
                          {f.name}
                        </button>
                        <span className="block text-xs text-fg-3">
                          {f.city} · draw {fmtInt(f.drawPosition)}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs text-fg-3">{f.note}</td>
                      <td className="py-2 text-right">
                        <Badge
                          tone={
                            f.status === 'seated'
                              ? 'teal'
                              : f.status === 'offered'
                                ? 'red'
                                : f.status === 'waiting'
                                  ? 'neutral'
                                  : 'amber'
                          }
                        >
                          {f.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className={cn(view !== 'fan' && 'hidden xl:block')}>
          {fan && <FanPhone fan={fan} state={state} send={send} busy={busy} />}
        </div>
      </div>
    </div>
  );
}

export function SinglePhone({ room, role }: { room: string; role: string }) {
  const { state, send, busy, error } = useLiveRoom(room);
  if (!state)
    return (
      <div className="skeleton mx-auto h-[700px] max-w-[380px] rounded-[2.6rem]" aria-busy="true" />
    );
  const fan = state.fans.find((f) => f.id === role);
  return (
    <div className="flex flex-col gap-3 py-6">
      {error && (
        <p role="alert" className="text-center text-sm text-bad">
          {error}
        </p>
      )}
      {role === 'sepp' ? (
        <HolderPhone state={state} send={send} busy={busy} />
      ) : fan ? (
        <FanPhone fan={fan} state={state} send={send} busy={busy} />
      ) : (
        <p>Unknown fan.</p>
      )}
    </div>
  );
}
