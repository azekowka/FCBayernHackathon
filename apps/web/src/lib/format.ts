import { oneIn } from '@fcb/core';
import type { Locale } from '@/lib/i18n/config';

const INTL: Record<Locale, string> = { en: 'en-GB', de: 'de-DE' };

/** Number formatting that follows the app language (75,024 vs 75.024). */
export function formatters(locale: Locale = 'en') {
  const tag = INTL[locale];
  const int = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 });
  const dec = (d: number) =>
    new Intl.NumberFormat(tag, { minimumFractionDigits: d, maximumFractionDigits: d });
  return {
    locale,
    tag,
    int: (n: number) => int.format(Math.round(n)),
    compact: (n: number) => compact.format(n),
    dec: (n: number, d = 1) => dec(d).format(n),
    pct: (p: number, decimals = 0) => {
      const v = p * 100;
      if (v > 0 && v < 1 && decimals === 0) return '<1%';
      return locale === 'de' ? `${dec(decimals).format(v)} %` : `${v.toFixed(decimals)}%`;
    },
    oneIn: (p: number) => {
      const n = oneIn(p);
      if (!Number.isFinite(n)) return '—';
      if (n === 1) return locale === 'de' ? 'Sicher' : 'Certain';
      const v = Number.isInteger(n) ? String(n) : dec(1).format(n);
      return locale === 'de' ? `1 zu ${v}` : `1 in ${v}`;
    },
    signed: (n: number, decimals = 0) => {
      const s = dec(decimals).format(n);
      return n > 0 ? `+${s}` : s;
    },
    minutes: (m: number) => {
      const v = Math.max(0, Math.round(m));
      return v < 1 ? '<1 min' : `${v} min`;
    },
  };
}

export type Formatters = ReturnType<typeof formatters>;

const en = formatters('en');

export const fmtInt = en.int;
export const fmtCompact = en.compact;
export const fmtPct = en.pct;
export const fmtOneIn = en.oneIn;
export const fmtSigned = en.signed;
export const fmtMinutes = en.minutes;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
