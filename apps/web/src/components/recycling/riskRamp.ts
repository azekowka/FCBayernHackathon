/**
 * Sequential, single-hue (red) ramp for no-show risk on the dark surface:
 * brighter = higher risk. Breaks are quintiles of the actual block risks so
 * the map discriminates instead of painting one colour everywhere.
 */
export const RISK_STEPS = ['#2a1a26', '#4a1d2d', '#742235', '#a8283f', '#e23a4e'] as const;
export const NO_SEASON = '#1c2436';

export interface RiskScale {
  breaks: number[];
  color: (risk: number, seasonSeats: number) => string;
  label: (i: number) => string;
}

const pct = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;

export function riskScale(risks: readonly number[]): RiskScale {
  const sorted = [...risks].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const breaks = [q(0.2), q(0.4), q(0.6), q(0.8)];
  return {
    breaks,
    color(risk, seasonSeats) {
      if (seasonSeats === 0) return NO_SEASON;
      const i = breaks.findIndex((b) => risk < b);
      return RISK_STEPS[i === -1 ? RISK_STEPS.length - 1 : i] as string;
    },
    label(i) {
      if (i === 0) return `< ${pct(breaks[0] ?? 0)}`;
      if (i === RISK_STEPS.length - 1) return `≥ ${pct(breaks.at(-1) ?? 0)}`;
      return `${pct(breaks[i - 1] ?? 0)}–${pct(breaks[i] ?? 0)}`;
    },
  };
}
