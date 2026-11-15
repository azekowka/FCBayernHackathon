'use client';

import {
  ArrowRight,
  CircleCheck,
  Gift,
  Info,
  RotateCcw,
  SkipForward,
  Smartphone,
  Unlock,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Segmented } from '@/components/ui/controls';
import { Badge, Button, LiveDot, Panel, type Tone } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import type { EngineEvent, LiveState } from '@/lib/server/liveRooms';
import { FanPhone, HolderPhone } from './Phones';
import { useLiveRoom, type LiveAction } from './useLiveRoom';

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

const STATUS_TONE: Record<string, Tone> = {
  seated: 'green',
  offered: 'red',
  waiting: 'neutral',
};

/** A fresh room nobody has touched yet adopts the viewer's language. */
function useAdoptLocale(state: LiveState | null, send: (a: LiveAction) => void) {
  const { locale } = useLocale();
  const done = useRef(false);
  useEffect(() => {
    if (!state || done.current) return;
    done.current = true;
    const untouched =
      state.holder.status === 'open' &&
      state.holder.chat.every((m) => m.role === 'assistant') &&
      state.events.length <= 1;
    if (untouched && state.language !== locale) send({ action: 'reset', language: locale });
  }, [state, locale, send]);
}

export function StageDemo({ room }: { room: string }) {
  const t = useT();
  const f = useFormat();
  const tl = t.live;
  const { state, connection, error, busy, send } = useLiveRoom(room);
  const [view, setView] = useState<'sepp' | 'engine' | 'fan'>('sepp');
  const [fanChoice, setFanChoice] = useState<string | null>(null);
  const log = useRef<HTMLOListElement>(null);
  useAdoptLocale(state, send);
  const eventCount = state?.events.length ?? 0;
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [eventCount]);

  if (!state) {
    return (
      <div className="grid gap-6 xl:grid-cols-[380px_1fr_380px]" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[700px] rounded-[3rem]" />
        ))}
      </div>
    );
  }

  const active = state.fans.find((x) => x.offer) ?? state.fans.find((x) => x.ticket);
  const fan =
    state.fans.find((x) => x.id === fanChoice) ??
    active ??
    state.fans.find((x) => x.id === 'mia') ??
    state.fans[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge
            tone={connection === 'live' ? 'green' : connection === 'polling' ? 'amber' : 'neutral'}
          >
            <LiveDot tone={connection === 'live' ? 'green' : 'amber'} className="mr-0.5 size-1.5" />
            {connection === 'live'
              ? tl.connLive
              : connection === 'polling'
                ? tl.connPolling
                : tl.connConnecting}
          </Badge>
          <span className="text-fg-3">
            {tl.room} <span className="font-mono text-fg-2">{room}</span> · {tl.clock}{' '}
            <span className="tabular font-semibold text-fg">{state.clock}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<'en' | 'de'>
            label={tl.assistantLang}
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
            onClick={() => {
              send({ action: 'reset', language: state.language });
              toast(tl.resetDone);
            }}
            disabled={busy}
          >
            <RotateCcw className="size-3.5" aria-hidden /> {tl.reset}
          </Button>
          {(
            [
              ['sepp', tl.seppPhone],
              ['mia', tl.miaPhone],
            ] as const
          ).map(([id, label]) => (
            <a
              key={id}
              className="press inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-3 hover:bg-ink-750 hover:text-fg"
              href={`/live/${id}?room=${room}`}
              target="_blank"
              rel="noreferrer"
            >
              <Smartphone className="size-3.5" aria-hidden /> {label}
            </a>
          ))}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="animate-pop rounded-xl bg-fcb/10 px-3 py-2 text-sm text-bad ring-1 ring-fcb/25 ring-inset"
        >
          {error}
        </p>
      )}

      <div className="xl:hidden">
        <Segmented<'sepp' | 'engine' | 'fan'>
          label={tl.chooseView}
          value={view}
          onChange={setView}
          options={[
            { value: 'sepp', label: tl.viewSepp },
            { value: 'engine', label: tl.viewEngine },
            { value: 'fan', label: tl.viewFan(fan?.name.split(' ')[0] ?? 'Fan') },
          ]}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        <div className={cn(view !== 'sepp' && 'hidden xl:block')}>
          <HolderPhone state={state} send={send} busy={busy} />
        </div>

        <div className={cn('min-w-0', view !== 'engine' && 'hidden xl:block')}>
          <Panel title={tl.engineTitle} subtitle={tl.engineSub} bodyClassName="p-0 md:p-0">
            <ol
              ref={log}
              className="max-h-[360px] overflow-y-auto overscroll-contain px-5 py-3 md:px-6"
              aria-live="polite"
            >
              <AnimatePresence initial={false}>
                {state.events.map((e) => {
                  const Icon = EVENT_ICON[e.kind];
                  return (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      className="relative flex gap-3 py-2 text-sm"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                          e.kind === 'accepted' || e.kind === 'gifted' || e.kind === 'kept'
                            ? 'bg-ok/12 text-ok'
                            : e.kind === 'skipped'
                              ? 'bg-ink-750 text-fg-3'
                              : e.kind === 'offered' || e.kind === 'released'
                                ? 'bg-fcb/12 text-bad'
                                : 'bg-ink-750 text-fg-2',
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-fg-2">{e.text}</span>
                      <span className="tabular shrink-0 text-xs text-fg-3">{e.clock}</span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
            <div className="border-t hairline px-5 py-4 md:px-6">
              <p className="mb-2 text-xs font-medium text-fg-3">{tl.waitlistTitle}</p>
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{tl.colRank}</th>
                    <th scope="col">{tl.colFan}</th>
                    <th scope="col">{tl.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.fans.map((x) => (
                    <tr
                      key={x.id}
                      className={cn(
                        'border-t hairline transition-colors duration-200 first:border-t-0',
                        x.id === fan?.id && 'bg-ink-800',
                      )}
                    >
                      <td className="tabular py-2.5 pr-2 pl-2 text-fg-3">#{x.rank}</td>
                      <td className="py-2.5 pr-2">
                        <button
                          type="button"
                          className="text-left font-medium text-fg hover:text-bad"
                          onClick={() => {
                            setFanChoice(x.id);
                            setView('fan');
                          }}
                        >
                          {x.name}
                        </button>
                        <span className="block text-xs text-fg-3">
                          {x.city} · {tl.draw(f.int(x.drawPosition))}
                        </span>
                        <span className="block text-xs text-fg-2">{x.note}</span>
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <Badge tone={STATUS_TONE[x.status] ?? 'amber'}>
                          {tl.status[x.status] ?? x.status}
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
  const t = useT();
  const { state, send, busy, error } = useLiveRoom(room);
  // Sepp's phone drives the chat, so a fresh room follows that device's language.
  useAdoptLocale(role === 'sepp' ? state : null, send);
  if (!state)
    return (
      <div
        className="skeleton mx-auto my-6 h-[700px] max-w-[380px] rounded-[3rem]"
        aria-busy="true"
      />
    );
  const fan = state.fans.find((x) => x.id === role);
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
        <p>{t.live.unknownFan}</p>
      )}
    </div>
  );
}
