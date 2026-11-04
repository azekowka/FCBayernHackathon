'use client';

import { useState } from 'react';
import { linear, niceTicks } from './scale';

export interface Column {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

/**
 * Single-series column chart (title names the series → no legend box).
 * Thin columns (≤ 24px), 4px rounded data-ends, hairline grid, hover tooltip,
 * a highlighted column and a table fallback for screen readers.
 */
export function ColumnChart({
  data,
  format,
  highlightKey,
  color = 'var(--color-viz-teal)',
  height = 200,
  title,
}: {
  data: readonly Column[];
  format: (v: number) => string;
  highlightKey?: string;
  color?: string;
  height?: number;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 40, r: 8, t: 16, b: 28 };
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = niceTicks(max, 4);
  const top = ticks.at(-1) ?? 1;
  const y = linear([0, top], [H - pad.b, pad.t]);
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(24, band * 0.6);
  const active = hover !== null ? data[hover] : undefined;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={pad.l - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-fg-3 text-[11px]"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h / 2, bw / 2);
          const x0 = cx - bw / 2;
          const yTop = y(d.value);
          const hi = d.key === highlightKey;
          const path = `M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + bw - r} Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r} V${y(0)} Z`;
          return (
            <g key={d.key}>
              <path
                d={path}
                fill={color}
                opacity={hover === null || hover === i ? (hi || !highlightKey ? 1 : 0.55) : 0.3}
              />
              {hi && (
                <text
                  x={cx}
                  y={yTop - 6}
                  textAnchor="middle"
                  className="fill-fg text-[11px] font-semibold"
                >
                  {format(d.value)}
                </text>
              )}
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                className={hi ? 'fill-fg text-[11px] font-semibold' : 'fill-fg-3 text-[11px]'}
              >
                {d.label}
              </text>
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={H - pad.t - pad.b}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 rounded-lg border border-line-strong bg-ink-950/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${((pad.l + band * hover + band / 2) / W) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-semibold text-fg">{format(active.value)}</p>
          <p className="text-fg-3">{active.detail ?? active.label}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.detail ?? d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
