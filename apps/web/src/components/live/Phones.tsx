'use client';

import { BellRing, Check, Gift, Send, Ticket, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LogoMark } from '@/components/layout/Logo';
import { AiBadge, TypingDots } from '@/components/ui/AiBadge';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { Avatar, Badge, Button, type Tone } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useFormat, useT } from '@/lib/i18n/client';
import type { FanView, LiveState } from '@/lib/server/liveRooms';
import type { LiveAction } from './useLiveRoom';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BUBBLE = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.28, ease: EASE_OUT },
};

function AppBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b hairline px-4 pt-1 pb-3 max-sm:pt-3">
      <LogoMark size={32} />
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
  const t = useT();
  const th = t.live.holder;
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
    const v = text.trim();
    if (!v || busy || thinking) return;
    send({ action: 'say', text: v });
    setText('');
  };
  const status: { label: string; tone: Tone } = {
    open: { label: th.statusOpen, tone: 'neutral' as Tone },
    released: { label: th.statusReleased, tone: 'green' as Tone },
    gifted: { label: th.statusGifted, tone: 'green' as Tone },
    kept: { label: th.statusKept, tone: 'blue' as Tone },
  }[h.status];
  const lastConfirm = [...h.chat].reverse().find((m) => m.role === 'assistant');

  return (
    <PhoneFrame label={th.frame} time={state.clock}>
      <AppBar title="Kein Platz bleibt leer" subtitle={th.appSub} />
      <div className="relative mx-3 mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-fcb to-fcb-700 p-3.5 text-white shadow-[0_12px_24px_-12px_rgb(220_5_45/0.7)]">
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -top-6 -right-6 size-28 text-white/15"
        >
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M50 0v100" stroke="currentColor" strokeWidth="3" />
        </svg>
        <div className="relative flex items-center justify-between text-[10px] font-semibold tracking-widest uppercase opacity-90">
          <span>{th.seasonTicket}</span>
          <span>{state.fixture.kickoff}</span>
        </div>
        <p className="relative mt-1.5 font-semibold">{state.fixture.label}</p>
        <p className="relative text-xs opacity-90">{h.seatLabel}</p>
        <span className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-white/25">
          {status.tone === 'green' && <Check className="size-3" aria-hidden />}
          {status.label}
        </span>
      </div>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-3 py-3"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {h.chat.map((m) => (
            <motion.div
              key={m.id}
              {...BUBBLE}
              className={cn(
                'flex flex-col gap-1',
                m.role === 'fan'
                  ? 'origin-bottom-right items-end'
                  : 'origin-bottom-left items-start',
              )}
            >
              <p
                className={cn(
                  'max-w-[88%] rounded-[20px] px-3.5 py-2 text-[13px] leading-snug',
                  m.role === 'fan'
                    ? 'rounded-br-md bg-fcb text-white'
                    : 'rounded-bl-md bg-ink-750 text-fg',
                )}
              >
                {m.text}
              </p>
              {m.role === 'assistant' && m.source && (
                <AiBadge source={m.source} className="origin-left scale-90" />
              )}
              {m.confirm && open && m.id === lastConfirm?.id && (
                <div className="mt-1 flex w-[88%] flex-col gap-1.5 rounded-2xl bg-ink-850 p-2.5 shadow-[var(--shadow-card)]">
                  <p className="text-[11px] text-fg-3">{th.nothingUntilTap}</p>
                  {m.confirm === 'release' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => send({ action: 'release', mode: 'waitlist' })}
                        disabled={busy}
                      >
                        <Check className="size-3.5" aria-hidden /> {th.release}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => send({ action: 'release', mode: 'youth' })}
                        disabled={busy}
                      >
                        <Gift className="size-3.5" aria-hidden /> {th.gift}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => send({ action: 'release', mode: 'youth' })}
                      disabled={busy}
                    >
                      <Gift className="size-3.5" aria-hidden /> {th.gift}
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
          {thinking && (
            <motion.div
              key="typing"
              {...BUBBLE}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="w-fit origin-bottom-left rounded-[20px] rounded-bl-md bg-ink-750 px-3.5 py-3"
            >
              <TypingDots label={th.typing} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {open && !thinking && (
        <div
          className="flex gap-1.5 overflow-x-auto overscroll-contain px-3 pb-2 [scrollbar-width:none]"
          role="group"
          aria-label={th.quickReplies}
        >
          {h.quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => send({ action: 'say', text: q })}
              className="press shrink-0 rounded-full bg-ink-850 px-3 py-1.5 text-xs font-medium text-fg-2 shadow-[0_0_0_1px_var(--color-line-strong)] hover:text-fg disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 border-t hairline px-3 py-2.5">
        <label htmlFor="holder-input" className="sr-only">
          {th.inputLabel}
        </label>
        <input
          id="holder-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          enterKeyHint="send"
          placeholder={open ? th.placeholderOpen : th.placeholderDone}
          className="h-9 min-w-0 flex-1 rounded-full bg-ink-750 px-3.5 text-sm text-fg placeholder:text-fg-3 focus:shadow-[0_0_0_2px_var(--color-fcb)] focus:outline-none"
        />
        <button
          type="submit"
          aria-label={th.send}
          disabled={!text.trim() || busy || thinking}
          className="press flex size-9 items-center justify-center rounded-full bg-fcb text-white disabled:bg-ink-600 disabled:text-fg-3"
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
  const t = useT();
  const f = useFormat();
  const tf = t.live.fan;
  const first = fan.name.split(' ')[0] ?? fan.name;
  const writing = state.thinking === 'fan' && fan.offer && !fan.offer.message;
  return (
    <PhoneFrame label={tf.frame(fan.name)} time={state.clock} highlight={!!fan.offer}>
      <AppBar title={tf.hi(first)} subtitle={tf.sub(fan.rank, fan.city)} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {fan.offer && (
            <motion.div
              key={`push-${fan.offer.id}`}
              role="alert"
              initial={{ opacity: 0, y: -28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.22 }}
              className="flex items-center gap-3 rounded-2xl bg-ink-850/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur"
            >
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-fcb text-white">
                <BellRing className="size-4" aria-hidden />
                <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse-ring rounded-full bg-fcb" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold tracking-wider text-bad uppercase">
                  {tf.push}
                </span>
                <span className="block text-sm leading-snug font-semibold text-fg">
                  {tf.opened}
                </span>
              </span>
            </motion.div>
          )}

          {fan.offer ? (
            <motion.div
              key={`offer-${fan.offer.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.08 }}
              className="rounded-2xl bg-ink-850 p-4 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs text-fg-3">
                {state.fixture.label} · {state.fixture.kickoff}
              </p>
              <p className="mt-1 font-semibold text-fg">{fan.offer.seatLabel}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Badge tone="green">{tf.price(15)}</Badge>
                <Badge tone="amber">{tf.expires(fan.offer.expiresInMinutes)}</Badge>
              </div>
              <div className="mt-3 min-h-16 rounded-xl bg-ink-800 p-3 text-[13px] leading-snug text-fg-2">
                {writing ? <TypingDots label={tf.writing} /> : fan.offer.message}
              </div>
              {!writing && (
                <AiBadge source={fan.offer.source} className="mt-2 origin-left scale-90" />
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => send({ action: 'respond', fanId: fan.id, accept: false })}
                  disabled={busy}
                >
                  <X className="size-4" aria-hidden /> {tf.pass}
                </Button>
                <Button
                  onClick={() => send({ action: 'respond', fanId: fan.id, accept: true })}
                  disabled={busy}
                >
                  <Check className="size-4" aria-hidden /> {tf.accept}
                </Button>
              </div>
            </motion.div>
          ) : fan.ticket ? (
            <motion.div
              key="ticket"
              initial={{ opacity: 0, scale: 0.94, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ type: 'spring', duration: 0.6, bounce: 0.25 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fcb to-fcb-700 text-white shadow-[0_24px_48px_-20px_rgb(220_5_45/0.8)]"
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(80%_80%_at_100%_0%,rgb(255_255_255/0.2),transparent_60%)]"
              />
              <div className="relative p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase opacity-90">
                  <Ticket className="size-3.5" aria-hidden /> {tf.admit}
                </p>
                <p className="display mt-3 text-[28px] leading-none">{tf.youreIn(first)}</p>
                <p className="mt-2.5 text-sm opacity-95">{state.fixture.label}</p>
                <p className="text-sm opacity-85">{state.fixture.kickoff}</p>
              </div>
              <div className="relative flex items-end justify-between gap-3 border-t-2 border-dashed border-white/35 bg-black/15 p-4 text-sm">
                <span
                  aria-hidden
                  className="absolute -top-3 -left-3 size-6 rounded-full bg-ink-900"
                />
                <span
                  aria-hidden
                  className="absolute -top-3 -right-3 size-6 rounded-full bg-ink-900"
                />
                <div className="min-w-0">
                  <p className="font-semibold">{fan.ticket.seatLabel}</p>
                  <p className="text-xs opacity-90">{tf.paid(fan.ticket.faceValue)}</p>
                </div>
                <QrGlyph />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-ink-850 p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <Avatar name={fan.name} hue={fan.id.length * 47} size={40} />
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{fan.name}</p>
                  <p className="text-xs text-fg-3">{fan.note}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-ink-800 p-2.5">
                  <dt className="text-[11px] text-fg-3">{tf.waitlist}</dt>
                  <dd className="display tabular text-2xl text-fg">#{fan.rank}</dd>
                </div>
                <div className="rounded-xl bg-ink-800 p-2.5">
                  <dt className="text-[11px] text-fg-3">{tf.drawPosition}</dt>
                  <dd className="display tabular text-2xl text-fg">{f.int(fan.drawPosition)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-fg-3">
                {fan.status === 'passed' || fan.status === 'missed'
                  ? tf.passedNote
                  : tf.waitingNote}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PhoneFrame>
  );
}

/** Decorative QR-style glyph (not a real code). */
function QrGlyph() {
  const cells = [
    1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0,
    1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1,
  ];
  return (
    <span aria-hidden className="grid size-14 shrink-0 grid-cols-9 gap-px rounded-md bg-white p-1">
      {cells.map((c, i) => (
        <span key={i} className={c ? 'bg-[#0a1428]' : 'bg-white'} />
      ))}
    </span>
  );
}
