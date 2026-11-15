'use client';

import { buildStadium } from '@fcb/core';
import NumberFlow from '@number-flow/react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MAP, blockPath, pitchRect } from '@/components/stadium/geometry';
import { LiveDot } from '@/components/ui/primitives';
import { useLocale, useT } from '@/lib/i18n/client';

const STADIUM = buildStadium();
const FANS = [
  'Mia · Garching',
  'Jonas · Freising',
  'Elif · Giesing',
  'Kofi · Pasing',
  'Lena · Haidhausen',
  'Yuna · Schwabing',
  'Tobi · Dachau',
  'Anna · Rosenheim',
];
const EMPTY_BLOCKS = 34;

/** Deterministic shuffle (no Math.random → server and client agree). */
function seededOrder(n: number) {
  let s = 1337;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}

/**
 * Hero visual: the real 116-block Arena. Season seats that would stay empty
 * show as hollow blocks, then light up Bayern red one by one as the matching
 * engine hands them to waitlist fans. Explanatory motion, so it pauses
 * off-screen and shows the final state under reduced motion.
 */
export function ArenaPulse({ target }: { target: number }) {
  const t = useT();
  const { locale } = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-80px' });
  const pitch = pitchRect();

  const empties = useMemo(
    () =>
      seededOrder(STADIUM.length)
        .slice(0, EMPTY_BLOCKS)
        .map((i) => STADIUM[i]!.id),
    [],
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    // Hold the empty arena briefly, refill block by block, hold full, loop.
    const delay = step === 0 ? 1100 : step >= EMPTY_BLOCKS ? 2600 : 560;
    const id = setTimeout(() => setStep((s) => (s >= EMPTY_BLOCKS ? 0 : s + 1)), delay);
    return () => clearTimeout(id);
  }, [step, inView, reduce]);

  const filled = reduce ? EMPTY_BLOCKS : step;
  const refilled = new Set(empties.slice(0, filled));
  const empty = new Set(empties.slice(filled));
  const latest = filled > 0 ? empties[filled - 1] : null;
  const seats = Math.round((target * filled) / EMPTY_BLOCKS);
  const fan = FANS[(filled + FANS.length - 1) % FANS.length];

  return (
    <div ref={ref} className="card relative overflow-hidden p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium text-fg-3">
            <LiveDot /> {t.home.arenaCaption}
          </p>
          <p className="display mt-3 text-[44px] leading-none text-fg md:text-[52px]">
            <NumberFlow
              value={seats}
              prefix="+"
              locales={locale === 'de' ? 'de-DE' : 'en-GB'}
              className="tabular"
              trend={1}
              // Settles well inside the 560ms step, so the count always reads cleanly.
              spinTiming={{ duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
              transformTiming={{ duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
            />
          </p>
          <p className="mt-2 text-sm text-fg-2">{t.home.arenaLabel}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1 text-[11px] text-fg-3">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-fcb" /> {t.home.arenaRefilled}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] border border-dashed border-fg-3" />
            {t.home.arenaEmpty}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${MAP.h} ${MAP.w}`}
        className="mx-auto mt-4 h-auto w-full max-w-[520px]"
        aria-hidden
      >
        {/* Map is drawn portrait (goals north/south); turn it landscape for the hero. */}
        <g transform={`translate(${MAP.h} 0) rotate(90)`}>
          <defs>
            <linearGradient id="arena-pitch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f8f52" />
              <stop offset="1" stopColor="#177443" />
            </linearGradient>
          </defs>
          <rect
            x={pitch.x}
            y={pitch.y}
            width={pitch.w}
            height={pitch.h}
            rx={8}
            fill="url(#arena-pitch)"
          />
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={pitch.x}
              y={pitch.y + (pitch.h / 8) * i}
              width={pitch.w}
              height={pitch.h / 16}
              fill="#ffffff"
              opacity={0.06}
            />
          ))}
          <g fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.2}>
            <rect x={pitch.x + 7} y={pitch.y + 7} width={pitch.w - 14} height={pitch.h - 14} />
            <line x1={pitch.x + 7} x2={pitch.x + pitch.w - 7} y1={MAP.cy} y2={MAP.cy} />
            <circle cx={MAP.cx} cy={MAP.cy} r={pitch.w * 0.14} />
            <rect
              x={MAP.cx - pitch.w * 0.22}
              y={pitch.y + 7}
              width={pitch.w * 0.44}
              height={pitch.h * 0.14}
            />
            <rect
              x={MAP.cx - pitch.w * 0.22}
              y={pitch.y + pitch.h - 7 - pitch.h * 0.14}
              width={pitch.w * 0.44}
              height={pitch.h * 0.14}
            />
          </g>
          <circle cx={MAP.cx} cy={MAP.cy} r={2.5} fill="#ffffff" />
          {STADIUM.map((b) => {
            const isRefilled = refilled.has(b.id);
            const isEmpty = empty.has(b.id);
            return (
              <path
                key={b.id}
                d={blockPath(b.startAngle, b.endAngle, b.tier, 1.4)}
                className={
                  isRefilled
                    ? 'fill-fcb'
                    : isEmpty
                      ? 'fill-transparent stroke-fg-3'
                      : 'fill-ink-600'
                }
                strokeWidth={isEmpty ? 1 : 0}
                strokeDasharray={isEmpty ? '3 2.5' : undefined}
                style={{ transition: 'fill 450ms ease' }}
              />
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none mt-3 flex h-8 justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {latest && (
            <motion.div
              key={filled}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-2 rounded-full bg-ink-800 py-1 pr-3.5 pl-1 text-xs font-medium text-fg ring-1 ring-line"
            >
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-fcb px-1.5 text-[10px] font-bold text-white">
                {latest}
              </span>
              <span aria-hidden className="text-fg-3">
                →
              </span>
              {fan}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
