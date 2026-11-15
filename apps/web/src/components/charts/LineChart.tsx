'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { linear, niceTicks } from './scale';

export interface Series {
  key: string;
  label: string;
  color: string;
  points: readonly { x: number; y: number }[];
  /** Soft 10% wash under the line (single-series charts). */
  area?: boolean;
}

export interface Marker {
  x: number;
  label: string;
  color?: string;
}

/**
 * Multi-series line chart with a crosshair tooltip, legend (≥ 2 series),
 * end-of-line direct labels, optional threshold band and vertical markers.
 * Never a second y-axis.
 */
export function LineChart({
  series,
  formatX,
  formatY,
  xTicks,
  height = 260,
  title,
  markers = [],
  band,
  yMax,
  footer,
}: {
  series: readonly Series[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  xTicks: readonly number[];
  height?: number;
  title: string;
  markers?: readonly Marker[];
  band?: { from: number; to: number; label: string };
  yMax?: number;
  footer?: ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const pad = { l: 48, r: 92, t: 18, b: 30 };
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const ticks = niceTicks(yMax ?? Math.max(...ys, 0), 4);
  const top = ticks.at(-1) ?? 1;
  const x = linear([x0, x1], [pad.l, W - pad.r]);
  const y = linear([0, top], [H - pad.b, pad.t]);

  const nearest = (pts: readonly { x: number; y: number }[], target: number) =>
    pts.reduce(
      (a, p) => (Math.abs(p.x - target) < Math.abs(a.x - target) ? p : a),
      pts[0] ?? { x: 0, y: 0 },
    );

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < pad.l || px > W - pad.r) return setHoverX(null);
    const inv = x0 + ((px - pad.l) / (W - pad.l - pad.r)) * (x1 - x0);
    setHoverX(nearest(series[0]?.points ?? [], inv).x);
  };

  return (
    <figure className="relative">
      {series.length > 1 && (
        <figcaption className="mb-3 flex flex-wrap gap-4 text-xs text-fg-2">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="h-[3px] w-5 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={title}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverX(null)}
      >
        {band && (
          <g>
            <rect
              x={pad.l}
              width={W - pad.l - pad.r}
              y={y(band.to)}
              height={Math.max(0, y(band.from) - y(band.to))}
              fill="var(--color-viz-a)"
              opacity={0.08}
            />
            <text
              x={W - pad.r - 6}
              y={y(band.to) + 14}
              textAnchor="end"
              className="fill-fg-3 text-[11px]"
            >
              {band.label}
            </text>
          </g>
        )}
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
              {formatY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-fg-3 text-[11px]">
            {formatX(t)}
          </text>
        ))}
        {series.map((s) => {
          const d = s.points
            .map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`)
            .join(' ');
          const last = s.points.at(-1);
          return (
            <g key={s.key}>
              {s.area && last && (
                <path
                  d={`${d} L${x(last.x)},${y(0)} L${x(s.points[0]?.x ?? 0)},${y(0)} Z`}
                  fill={s.color}
                  opacity={0.1}
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2.25}
                pathLength={1}
                className="chart-draw"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {last && (
                <>
                  <circle
                    cx={x(last.x)}
                    cy={y(last.y)}
                    r={4}
                    fill={s.color}
                    stroke="var(--color-ink-850)"
                    strokeWidth={2}
                  />
                  <text
                    x={x(last.x) + 8}
                    y={y(last.y)}
                    dy="0.32em"
                    className="fill-fg-2 text-[11px] font-medium"
                  >
                    {formatY(last.y)}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {markers.map((m) => (
          <g key={`${m.x}-${m.label}`}>
            <line
              x1={x(m.x)}
              x2={x(m.x)}
              y1={pad.t}
              y2={H - pad.b}
              stroke={m.color ?? 'var(--color-fg-2)'}
              strokeWidth={1.5}
              strokeDasharray="0"
              opacity={0.85}
            />
            <rect
              x={x(m.x) - 1}
              y={pad.t - 2}
              width={2}
              height={6}
              fill={m.color ?? 'var(--color-fg)'}
            />
            <text x={x(m.x) + 6} y={pad.t + 10} className="fill-fg text-[11px] font-semibold">
              {m.label}
            </text>
          </g>
        ))}
        {hoverX !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hoverX)}
              x2={x(hoverX)}
              y1={pad.t}
              y2={H - pad.b}
              stroke="var(--color-fg-3)"
              strokeWidth={1}
            />
            {series.map((s) => {
              const p = nearest(s.points, hoverX);
              return (
                <circle
                  key={s.key}
                  cx={x(p.x)}
                  cy={y(p.y)}
                  r={4.5}
                  fill={s.color}
                  stroke="var(--color-ink-850)"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}
      </svg>
      {hoverX !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-8 min-w-36 rounded-xl bg-ink-850/95 px-3 py-2 text-xs shadow-[var(--shadow-pop)] backdrop-blur"
          style={{
            left: `${(x(hoverX) / W) * 100}%`,
            transform: x(hoverX) > W * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          }}
        >
          <p className="mb-1 font-semibold text-fg">{formatX(hoverX)}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-4 text-fg-2">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tabular font-semibold text-fg">
                {formatY(nearest(s.points, hoverX).y)}
              </span>
            </p>
          ))}
        </div>
      )}
      {footer}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">x</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(series[0]?.points ?? []).map((p, i) => (
              <tr key={p.x}>
                <th scope="row">{formatX(p.x)}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatY(s.points[i]?.y ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
