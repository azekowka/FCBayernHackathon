import { STADIUM_ASPECT, TIER_SPECS, type Tier } from '@fcb/core';

/** SVG geometry for the oval Arena map (0° = east, clockwise on screen). */
export const MAP = { w: 420, h: 540, cx: 210, cy: 270, ry: 258 } as const;
export const RX = MAP.ry * STADIUM_ASPECT.rx;

const RING = Object.fromEntries(TIER_SPECS.map((t) => [t.tier, t.ring])) as Record<Tier, readonly [number, number]>;

function point(deg: number, f: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [MAP.cx + RX * f * Math.cos(t), MAP.cy + MAP.ry * f * Math.sin(t)];
}

export function blockPath(startAngle: number, endAngle: number, tier: Tier, gapDeg = 0.9): string {
  const [f0, f1] = RING[tier];
  const a0 = startAngle + gapDeg / 2;
  const a1 = endAngle - gapDeg / 2;
  const steps = 6;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    outer.push(point(a, f1).map((v) => v.toFixed(1)).join(','));
    inner.unshift(point(a, f0).map((v) => v.toFixed(1)).join(','));
  }
  return `M${outer.join(' L')} L${inner.join(' L')} Z`;
}

export function labelPoint(startAngle: number, endAngle: number, tier: Tier): [number, number] {
  const [f0, f1] = RING[tier];
  return point((startAngle + endAngle) / 2, (f0 + f1) / 2);
}

/** Pitch rectangle inside the lower tier (goals north/south). */
export function pitchRect() {
  const f = TIER_SPECS[0]!.ring[0] * 0.86;
  const w = RX * f * 1.25;
  const h = MAP.ry * f * 1.42;
  return { x: MAP.cx - w / 2, y: MAP.cy - h / 2, w, h };
}
