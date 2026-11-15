/**
 * Sequential, single-hue (red) ramp for no-show risk — theme tokens, so it
 * reads light→red on white and dark→red at night: stronger = higher risk. Breaks are quintiles of the actual block risks so
 * the map discriminates instead of painting one colour everywhere.
 */
export const RISK_STEPS = [
  'var(--risk-0)',
  'var(--risk-1)',
  'var(--risk-2)',
  'var(--risk-3)',
  'var(--risk-4)',
] as const;
export const NO_SEASON = 'var(--risk-none)';
export const RECOVERED_STEPS = [
  'var(--rec-0)',
  'var(--rec-1)',
  'var(--rec-2)',
  'var(--rec-3)',
] as const;

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
