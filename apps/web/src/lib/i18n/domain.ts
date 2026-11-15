import type { Contribution } from '@fcb/core';
import type { Locale } from './config';

/**
 * Localised labels for facts produced by the deterministic engines. The
 * engines speak English (their tests pin those strings); the UI rebuilds the
 * German wording from the same structured facts.
 */

type BlockLike = { id: string; tier: string; stand: string; kind: string };

const TIER: Record<string, string> = {
  lower: 'Unterrang',
  middle: 'Mittelrang',
  upper: 'Oberrang',
};

export function blockLabel(b: BlockLike, locale: Locale): string {
  const stand = b.stand === 'Süd' && b.kind === 'standing' ? 'Südkurve' : b.stand;
  const standing = b.kind === 'standing' ? (locale === 'de' ? ' (Stehplatz)' : ' (standing)') : '';
  return `Block ${b.id} · ${stand} · ${TIER[b.tier] ?? b.tier}${standing}`;
}

const KIND_DE: Record<string, string> = {
  standing: 'Stehplätze',
  seated: 'Sitzplätze',
  family: 'Familienblock',
  away: 'Gästeblock',
  hospitality: 'Hospitality',
};

export function blockKind(kind: string, locale: Locale): string {
  return locale === 'de' ? (KIND_DE[kind] ?? kind) : kind;
}

/** First integer found in an engine label (e.g. "Lives 23 km from the Arena" → 23). */
function num(label: string, index = 0): string {
  return label.match(/-?\d+/g)?.[index] ?? '';
}

export function contributionLabel(c: Contribution, locale: Locale): string {
  if (locale === 'en') return c.label;
  switch (c.feature) {
    case 'attendance':
      return `${num(c.label)} der letzten 10 Heimspiele besucht`;
    case 'distance':
      return `Wohnt ${num(c.label)} km von der Arena entfernt`;
    case 'midweek':
      return 'Anstoß unter der Woche';
    case 'late':
      return 'Später Anstoß';
    case 'demand':
      return 'Weniger attraktiver Gegner';
    case 'rain':
      return `${num(c.label)} % Regenwahrscheinlichkeit`;
    case 'cold':
      return `Kalter Spieltag (${num(c.label)} °C)`;
    case 'holidays':
      return 'Schulferien';
    case 'calendar':
      return 'Dein Kalender zeigt dich unterwegs (freiwillig)';
    default:
      return c.label;
  }
}

const OFFER_DE = [
  'Mehr als 24 h vor Anpfiff',
  '6–24 h vorher',
  '2–6 h vorher',
  '45 min – 2 h vorher',
  'Letzte 45 Minuten',
];

export function offerWindowLabel(label: string, index: number, locale: Locale): string {
  return locale === 'de' ? (OFFER_DE[index] ?? label) : label;
}
