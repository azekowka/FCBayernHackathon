'use client';

import type { Tier } from '@fcb/core';
import { useState, type ReactNode } from 'react';
import { MAP, blockPath, pitchRect } from './geometry';

export interface MapBlock {
  id: string;
  tier: Tier;
  startAngle: number;
  endAngle: number;
  label: string;
}

/**
 * Interactive Allianz Arena map. Colour comes from the caller (sequential
 * risk ramp, status colours…); the map owns geometry, hover and focus.
 * Blocks are keyboard-focusable and announce their tooltip text.
 */
export function StadiumMap({
  blocks,
  fill,
  tooltip,
  highlightId,
  pulseIds = [],
  onSelect,
  title,
  legend,
}: {
  blocks: readonly MapBlock[];
  fill: (b: MapBlock) => string;
  tooltip: (b: MapBlock) => ReactNode;
  highlightId?: string;
  pulseIds?: readonly string[];
  onSelect?: (b: MapBlock) => void;
  title: string;
  legend?: ReactNode;
}) {
  const [hover, setHover] = useState<MapBlock | null>(null);
  const pitch = pitchRect();
  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${MAP.w} ${MAP.h}`}
        className="mx-auto h-auto w-full max-w-[460px]"
        role="group"
        aria-label={title}
      >
        <defs>
          <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f8f52" />
            <stop offset="1" stopColor="#177443" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={pitch.x} y={pitch.y} width={pitch.w} height={pitch.h} rx={6} fill="url(#pitch)" />
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
        <g fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1}>
          <rect x={pitch.x + 6} y={pitch.y + 6} width={pitch.w - 12} height={pitch.h - 12} />
          <line x1={pitch.x + 6} x2={pitch.x + pitch.w - 6} y1={MAP.cy} y2={MAP.cy} />
          <circle cx={MAP.cx} cy={MAP.cy} r={pitch.w * 0.14} />
          <rect
            x={MAP.cx - pitch.w * 0.22}
            y={pitch.y + 6}
            width={pitch.w * 0.44}
            height={pitch.h * 0.14}
          />
          <rect
            x={MAP.cx - pitch.w * 0.22}
            y={pitch.y + pitch.h - 6 - pitch.h * 0.14}
            width={pitch.w * 0.44}
            height={pitch.h * 0.14}
          />
        </g>
        <text
          x={MAP.cx}
          y={pitch.y + pitch.h + 22}
          textAnchor="middle"
          className="fill-fg-3 text-[10px] font-semibold tracking-[0.3em]"
        >
          SÜDKURVE
        </text>
        <text
          x={MAP.cx}
          y={pitch.y - 14}
          textAnchor="middle"
          className="fill-fg-3 text-[10px] font-semibold tracking-[0.3em]"
        >
          NORDKURVE
        </text>

        {blocks.map((b) => {
          const hi = b.id === highlightId;
          const pulse = pulseIds.includes(b.id);
          return (
            <path
              key={b.id}
              d={blockPath(b.startAngle, b.endAngle, b.tier)}
              fill={fill(b)}
              stroke={hi ? 'var(--color-fg)' : 'transparent'}
              strokeWidth={hi ? 2.5 : 0}
              filter={pulse ? 'url(#glow)' : undefined}
              tabIndex={0}
              role="button"
              aria-label={b.label}
              className="cursor-pointer outline-none transition-[fill,opacity] duration-300 hover:opacity-75 focus-visible:stroke-fg"
              onMouseEnter={() => setHover(b)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(b)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(b)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(b);
                }
              }}
            />
          );
        })}
      </svg>
      <div
        className="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
        aria-live="polite"
      >
        {hover && (
          <div className="animate-pop rounded-xl bg-ink-850/95 px-3 py-2 text-xs shadow-[var(--shadow-pop)] backdrop-blur">
            {tooltip(hover)}
          </div>
        )}
      </div>
      {legend && <figcaption className="mt-3">{legend}</figcaption>}
    </figure>
  );
}
