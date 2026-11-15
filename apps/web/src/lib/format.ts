import { oneIn } from '@fcb/core';

const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

export function fmtInt(n: number): string {
  return int.format(Math.round(n));
}

export function fmtCompact(n: number): string {
  return compact.format(n);
}

export function fmtPct(p: number, decimals = 0): string {
  const v = p * 100;
  if (v > 0 && v < 1 && decimals === 0) return '<1%';
  return `${v.toFixed(decimals)}%`;
}

export function fmtOneIn(p: number): string {
  const n = oneIn(p);
  if (!Number.isFinite(n)) return '—';
  return n === 1 ? 'Certain' : `1 in ${n}`;
}

export function fmtSigned(n: number, decimals = 0): string {
  const s = n.toFixed(decimals);
  return n > 0 ? `+${s}` : s;
}

export function fmtMinutes(m: number): string {
  const v = Math.max(0, Math.round(m));
  return v < 1 ? '<1 min' : `${v} min`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
