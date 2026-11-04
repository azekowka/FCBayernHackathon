/**
 * Crowd model for the U6 corridor and the Arena gates.
 *
 * Fluid-queue approximation: arrivals per minute vs. service capacity per
 * minute; a FIFO queue builds when arrivals exceed capacity and the wait for
 * someone arriving at t is queue(t) / capacity. All parameters are illustrative
 * and would be replaced by MVG passenger counts and turnstile telemetry.
 */

export type CrowdLevel = 'calm' | 'busy' | 'packed' | 'crush';

export const FULL_TIME = 112; // minutes after kick-off incl. half-time and stoppage
export const HALF_TIME = { start: 47, end: 62 } as const;

export const CROWD_PARAMS = {
  inbound: {
    riders: 42_000,
    capacityPerMin: 450,
    peak: { share: 0.7, mean: -55, sd: 26 },
    window: { from: -150, to: -5 },
  },
  outbound: {
    riders: 38_000,
    capacityPerMin: 750,
    immediate: { share: 0.78, mean: 17, sd: 3.5 },
    linger: { share: 0.14, mean: 42, sd: 8 },
    late: { share: 0.08, from: 50, to: 100 },
  },
  gates: {
    attendance: 75_000,
    lanesPerMinute: 230,
  },
} as const;

function gaussianPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

function uniformPdf(x: number, from: number, to: number): number {
  return x >= from && x < to ? 1 / (to - from) : 0;
}

export interface InboundPoint {
  /** Minutes relative to kick-off when arriving at Fröttmaning. */
  at: number;
  arrivalsPerMin: number;
  load: number;
  waitMinutes: number;
  level: CrowdLevel;
}

export function crowdLevel(load: number): CrowdLevel {
  if (load < 0.55) return 'calm';
  if (load < 0.85) return 'busy';
  if (load < 1.05) return 'packed';
  return 'crush';
}

/** Inbound demand per minute, optionally scaled (e.g. rain pushes cyclists onto the U6). */
export function inboundArrivals(at: number, demandFactor = 1): number {
  const p = CROWD_PARAMS.inbound;
  const background = (1 - p.peak.share) * uniformPdf(at, p.window.from, p.window.to);
  const peak = p.peak.share * gaussianPdf(at, p.peak.mean, p.peak.sd);
  return p.riders * demandFactor * (background + peak);
}

const inboundCache = new Map<string, InboundPoint[]>();

export function inboundCurve(demandFactor = 1, capacityFactor = 1): InboundPoint[] {
  const key = `${demandFactor}:${capacityFactor}`;
  const cached = inboundCache.get(key);
  if (cached) return cached;
  const cap = CROWD_PARAMS.inbound.capacityPerMin * capacityFactor;
  const out: InboundPoint[] = [];
  let queue = 0;
  for (let t = -180; t <= 0; t++) {
    const a = inboundArrivals(t, demandFactor);
    queue = Math.max(0, queue + a - cap);
    const load = a / cap;
    out.push({ at: t, arrivalsPerMin: a, load, waitMinutes: queue / cap, level: crowdLevel(load) });
  }
  inboundCache.set(key, out);
  return out;
}

export function inboundAt(at: number, demandFactor = 1, capacityFactor = 1): InboundPoint {
  const curve = inboundCurve(demandFactor, capacityFactor);
  const idx = Math.min(curve.length - 1, Math.max(0, Math.round(at) + 180));
  return curve[idx] as InboundPoint;
}

export interface OutboundPoint {
  /** Minutes after the final whistle when arriving at the station. */
  afterFullTime: number;
  arrivalsPerMin: number;
  queue: number;
  waitMinutes: number;
}

export function outboundArrivals(afterFullTime: number, demandFactor = 1): number {
  const p = CROWD_PARAMS.outbound;
  return (
    p.riders *
    demandFactor *
    (p.immediate.share * gaussianPdf(afterFullTime, p.immediate.mean, p.immediate.sd) +
      p.linger.share * gaussianPdf(afterFullTime, p.linger.mean, p.linger.sd) +
      p.late.share * uniformPdf(afterFullTime, p.late.from, p.late.to))
  );
}

const outboundCache = new Map<string, OutboundPoint[]>();

export function outboundCurve(demandFactor = 1, capacityFactor = 1): OutboundPoint[] {
  const key = `${demandFactor}:${capacityFactor}`;
  const cached = outboundCache.get(key);
  if (cached) return cached;
  const cap = CROWD_PARAMS.outbound.capacityPerMin * capacityFactor;
  const out: OutboundPoint[] = [];
  let queue = 0;
  for (let t = 0; t <= 120; t++) {
    const a = outboundArrivals(t, demandFactor);
    queue = Math.max(0, queue + a - cap);
    out.push({ afterFullTime: t, arrivalsPerMin: a, queue, waitMinutes: queue / cap });
  }
  outboundCache.set(key, out);
  return out;
}

export function outboundWait(afterFullTime: number, demandFactor = 1, capacityFactor = 1): number {
  const curve = outboundCurve(demandFactor, capacityFactor);
  const idx = Math.min(curve.length - 1, Math.max(0, Math.round(afterFullTime)));
  return (curve[idx] as OutboundPoint).waitMinutes;
}

/**
 * Turnstile queue at one entrance zone. Arrivals follow the station curve
 * shifted by the Esplanade walk, plus car/bus/bike arrivals.
 */
export function gateWait(at: number, zoneShare: number, demandFactor = 1): number {
  const cap = CROWD_PARAMS.gates.lanesPerMinute * (zoneShare * 4);
  let queue = 0;
  for (let t = -180; t <= Math.min(0, Math.round(at)); t++) {
    const fromStation = inboundArrivals(t - 15, demandFactor) * zoneShare;
    const other =
      (CROWD_PARAMS.gates.attendance - CROWD_PARAMS.inbound.riders) *
      zoneShare *
      gaussianPdf(t, -50, 30);
    queue = Math.max(0, queue + fromStation + other - cap);
  }
  return queue / cap;
}

/** Concession queue in minutes: pre-match rush and the half-time crush. */
export function kioskQueue(at: number, busyness: number): number {
  const preMatch = 9 * Math.exp(-0.5 * ((at + 28) / 14) ** 2);
  const halfTime =
    at >= HALF_TIME.start - 3 && at <= HALF_TIME.end
      ? 13 * Math.exp(-0.5 * ((at - 50) / 4) ** 2)
      : 0;
  return Math.max(1, (1.5 + preMatch + halfTime) * busyness);
}
