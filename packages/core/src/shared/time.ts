/**
 * Time helpers. Matchday logic works in "minutes relative to kick-off"
 * (negative = before). Wall-clock rendering always uses Europe/Berlin so
 * server and browser agree (no hydration drift, no DST surprises).
 */

export const MUNICH_TZ = 'Europe/Berlin';

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: MUNICH_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Adds minutes to an ISO instant and returns epoch milliseconds. */
export function addMinutes(isoOrMs: string | number, minutes: number): number {
  const base = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  return base + Math.round(minutes * 60_000);
}

/** "18:30" in Munich local time. */
export function formatClock(epochMs: number): string {
  return timeFormatter.format(new Date(epochMs));
}

/** Clock time for an offset relative to kick-off. */
export function clockAt(kickoffIso: string, minutesFromKickoff: number): string {
  return formatClock(addMinutes(kickoffIso, minutesFromKickoff));
}

export function formatMatchDate(iso: string, locale = 'en-GB'): string {
  let fmt = dateFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      timeZone: MUNICH_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    dateFormatters.set(locale, fmt);
  }
  return fmt.format(new Date(iso));
}

/** 0 = Sunday … 6 = Saturday, evaluated in Munich. */
export function munichWeekday(iso: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: MUNICH_TZ, weekday: 'short' }).format(
    new Date(iso),
  );
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** Hour of day (0–23) in Munich. */
export function munichHour(iso: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: MUNICH_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return Number.parseInt(hour, 10) % 24;
}

/** Human duration like "1 h 05 min" or "25 min". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')} min`;
}

/** "T−2 h 30 min" style label for minutes relative to kick-off. */
export function formatRelativeToKickoff(minutes: number): string {
  if (Math.round(minutes) === 0) return 'Kick-off';
  const sign = minutes < 0 ? '−' : '+';
  return `T${sign}${formatDuration(Math.abs(minutes))}`;
}
