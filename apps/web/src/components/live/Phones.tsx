'use client';

import { BellRing, Check, Gift, Send, Ticket, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AiBadge, TypingDots } from '@/components/ui/AiBadge';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { Avatar, Badge, Button } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { fmtInt } from '@/lib/format';
import type { FanView, LiveState } from '@/lib/server/liveRooms';
import type { LiveAction } from './useLiveRoom';

const STATUS: Record<LiveState['holder']['status'], { label: string; tone: 'teal' | 'amber' | 'violet' | 'neutral' }> = {
  open: { label: 'Active', tone: 'neutral' },
  released: { label: 'Released to waitlist', tone: 'teal' },
  gifted: { label: 'Gifted to youth fan club', tone: 'teal' },
  kept: { label: 'You’re going', tone: 'violet' },
};

function AppBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b hairline px-4 py-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-fcb text-[11px] font-black text-white">FAN</span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-fg">{title}</p>
        <p className="truncate text-[11px] text-fg-3">{subtitle}</p>
      </div>
    </div>
  );
}

export function HolderPhone({
  state,
  send,
  busy,
}: {
  state: LiveState;
  send: (a: LiveAction) => void;
  busy: boolean;
}) {
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const h = state.holder;
  const thinking = state.thinking === 'holder';
  const open = h.status === 'open';

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [h.chat.length, thinking]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy || thinking) return;
    send({ action: 'say', text: t });
    setText('');
  };
  const status = STATUS[h.status];
  const lastConfirm = [...h.chat].reverse().find((m) => m.role === 'assistant');

  return (
    <PhoneFrame label="Sepp’s phone — season-ticket holder" time={state.clock}>
      <AppBar title="Kein Platz bleibt leer" subtitle="Gemini assistant · season ticket" />
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-fcb to-fcb-600 p-3.5 text-white">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-widest uppercase opacity-90">
          <span>Season ticket</span>
          <span>{state.fixture.kickoff}</span>
        </div>
        <p className="mt-1 font-semibold">{state.fixture.label}</p>
        <p className="text-xs opacity-90">{h.seatLabel}</p>
        <Badge tone={status.tone} className="mt-2 bg-black/25 text-white ring-white/30">
          {status.label}
        </Badge>
      </div>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
        {h.chat.map((m) => (
          <div key={m.id} className={cn('flex flex-col gap-1', m.role === 'fan' ? 'items-end' : 'items-start')}>
            <p
              className={cn(
                'max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug',
                m.role === 'fan' ? 'rounded-br-md bg-fcb text-white' : 'rounded-bl-md bg-ink-700 text-fg',
              )}
            >
              {m.text}
            </p>
            {m.role === 'assistant' && m.source && <AiBadge source={m.source} className="scale-90" />}
            {m.confirm && open && m.id === lastConfirm?.id && (
              <div className="mt-1 flex w-[88%] flex-col gap-1.5 rounded-2xl border border-line-strong bg-ink-800 p-2.5">
                <p className="text-[11px] text-fg-3">Nothing happens until you tap:</p>
                {m.confirm === 'release' ? (
                  <>
                    <Button size="sm" onClick={() => send({ action: 'release', mode: 'waitlist' })} disabled={busy}>
                      <Check className="size-3.5" aria-hidden /> Release seat to waitlist
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => send({ action: 'release', mode: 'youth' })} disabled={busy}>
                      <Gift className="size-3.5" aria-hidden /> Gift to youth fan club
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => send({ action: 'release', mode: 'youth' })} disabled={busy}>
                    <Gift className="size-3.5" aria-hidden /> Gift to youth fan club
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="w-fit rounded-2xl rounded-bl-md bg-ink-700 px-3 py-2.5">
            <TypingDots label="Assistant is typing" />
          </div>
        )}
      </div>

      {open && !thinking && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2" role="group" aria-label="Quick replies">
          {h.quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => send({ action: 'say', text: q })}
              className="shrink-0 rounded-full border border-line-strong bg-ink-800 px-3 py-1.5 text-xs text-fg-2 hover:border-fg-3 hover:text-fg disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 border-t hairline px-3 py-2.5">
        <label htmlFor="holder-input" className="sr-only">
          Message the assistant
        </label>
        <input
          id="holder-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={open ? 'Type a message…' : 'Ask anything…'}
          className="h-9 min-w-0 flex-1 rounded-full border border-line-strong bg-ink-950 px-3.5 text-sm text-fg placeholder:text-fg-3"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || busy || thinking}
          className="flex size-9 items-center justify-center rounded-full bg-fcb text-white disabled:bg-ink-600 disabled:text-fg-3"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </PhoneFrame>
  );
}

export function FanPhone({
  fan,
  state,
  send,
  busy,
}: {
  fan: FanView;
  state: LiveState;
  send: (a: LiveAction) => void;
  busy: boolean;
}) {
  const writing = state.thinking === 'fan' && fan.offer && !fan.offer.message;
  return (
    <PhoneFrame label={`${fan.name}’s phone — waitlist fan`} time={state.clock} highlight={!!fan.offer}>
      <AppBar title={`Hi ${fan.name.split(' ')[0]}`} subtitle={`Waitlist #${fan.rank} · ${fan.city}`} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {fan.offer && (
          <div role="alert" className="animate-rise rounded-2xl border border-fcb/50 bg-ink-800 p-3 shadow-[0_10px_30px_-10px_rgb(220_5_45/0.6)]">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-bad uppercase">
              <BellRing className="size-3.5" aria-hidden /> Kein Platz bleibt leer · now
            </p>
            <p className="mt-1 text-sm font-semibold text-fg">A Südkurve spot just opened up for you</p>
          </div>
        )}

        {fan.offer ? (
          <div className="rounded-2xl border hairline bg-ink-850 p-4">
            <p className="text-xs text-fg-3">{state.fixture.label} · {state.fixture.kickoff}</p>
            <p className="mt-1 font-semibold text-fg">{fan.offer.seatLabel}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="teal">€15 · face value</Badge>
              <Badge tone="amber">{fan.offer.expiresInMinutes} min to accept</Badge>
            </div>
            <div className="mt-3 min-h-16 rounded-xl bg-ink-750 p-3 text-[13px] leading-snug text-fg-2">
              {writing ? <TypingDots label="Writing your offer" /> : fan.offer.message}
            </div>
            {!writing && <AiBadge source={fan.offer.source} className="mt-2 scale-90" />}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => send({ action: 'respond', fanId: fan.id, accept: false })} disabled={busy}>
                <X className="size-4" aria-hidden /> Pass
              </Button>
              <Button variant="teal" onClick={() => send({ action: 'respond', fanId: fan.id, accept: true })} disabled={busy}>
                <Check className="size-4" aria-hidden /> Accept
              </Button>
            </div>
          </div>
        ) : fan.ticket ? (
          <div className="animate-rise overflow-hidden rounded-2xl bg-gradient-to-br from-viz-teal to-[#0b6f63] text-white">
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase opacity-90">
                <Ticket className="size-3.5" aria-hidden /> Admit one · in your wallet
              </p>
              <p className="display mt-2 text-3xl leading-none font-bold">You’re in, {fan.name.split(' ')[0]}!</p>
              <p className="mt-2 text-sm opacity-95">{state.fixture.label}</p>
              <p className="text-sm opacity-90">{state.fixture.kickoff}</p>
            </div>
            <div className="border-t-2 border-dashed border-white/40 bg-black/15 p-4 text-sm">
              <p className="font-semibold">{fan.ticket.seatLabel}</p>
              <p className="opacity-90">€{fan.ticket.faceValue} paid at face value · Pechvogel counter reset</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border hairline bg-ink-850 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={fan.name} hue={fan.id.length * 47} size={40} />
              <div>
                <p className="font-semibold text-fg">{fan.name}</p>
                <p className="text-xs text-fg-3">{fan.note}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-ink-750 p-2.5">
                <dt className="text-[11px] text-fg-3">Waitlist</dt>
                <dd className="display tabular text-2xl font-bold text-fg">#{fan.rank}</dd>
              </div>
              <div className="rounded-xl bg-ink-750 p-2.5">
                <dt className="text-[11px] text-fg-3">Draw position</dt>
                <dd className="display tabular text-2xl font-bold text-fg">{fmtInt(fan.drawPosition)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-fg-3">
              {fan.status === 'passed' || fan.status === 'missed'
                ? 'You passed on this one — no penalty. Your Pechvogel counter and future chances are unchanged.'
                : 'Didn’t win the ballot for Saturday. If a season-ticket holder releases a seat that fits you, it lands here — at face value.'}
            </p>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
