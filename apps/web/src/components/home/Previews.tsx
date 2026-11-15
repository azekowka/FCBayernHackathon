/**
 * Small illustrative previews for the product cards. Decorative (the card
 * carries the text), CSS-only, and they move only on fine-pointer hover.
 */

const HOVER_GROW =
  'origin-left transition-transform duration-500 ease-[var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-x-[1.06]';

export function BallotPreview() {
  const rows = [
    { team: 'BVB', you: 0.67, base: 0.24 },
    { team: 'PSG', you: 0.86, base: 0.31 },
    { team: 'WOB', you: 1, base: 0.42 },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3.5 px-8">
      {rows.map((r) => (
        <div key={r.team} className="grid grid-cols-[36px_1fr] items-center gap-3">
          <span className="text-[11px] font-semibold text-fg-3">{r.team}</span>
          <span className="flex flex-col gap-1">
            <span
              className={`h-2.5 rounded-full bg-fcb ${HOVER_GROW}`}
              style={{ width: `${r.you * 100}%` }}
            />
            <span className="h-2.5 rounded-full bg-viz-c" style={{ width: `${r.base * 100}%` }} />
          </span>
        </div>
      ))}
      <div className="absolute top-4 right-5 rounded-full bg-ink-850 px-2.5 py-1 text-[11px] font-semibold text-fg shadow-[var(--shadow-card)]">
        Pechvogel ×7
      </div>
    </div>
  );
}

export function SeatsPreview() {
  // 12 × 5 seats; a few "released" seats light up red.
  const lit = new Set([3, 8, 14, 21, 27, 33, 38, 46, 51, 57]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="grid grid-cols-12 gap-1.5 [perspective:400px]">
        {Array.from({ length: 60 }, (_, i) => (
          <span
            key={i}
            className={
              lit.has(i)
                ? 'size-4 rounded-[4px] bg-fcb transition-transform duration-300 ease-[var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-1'
                : 'size-4 rounded-[4px] bg-ink-600'
            }
            style={lit.has(i) ? { transitionDelay: `${(i % 7) * 25}ms` } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function JourneyPreview() {
  const stops = ['Marienplatz', 'Münchner Freiheit', 'Studentenstadt', 'Fröttmaning'];
  return (
    <div className="absolute inset-0 flex items-center px-8">
      <div className="@container relative w-full">
        <div className="absolute top-[7px] right-2 left-2 h-1.5 rounded-full bg-u6" />
        <div className="relative flex justify-between">
          {stops.map((s, i) => (
            <div key={s} className="flex w-0 flex-col items-center">
              <span
                className={`size-5 rounded-full border-[3px] border-u6 ${i === stops.length - 1 ? 'bg-fcb' : 'bg-ink-850'}`}
              />
              <span className="mt-2 text-center text-[10px] font-medium whitespace-nowrap text-fg-3">
                {i === 0 || i === stops.length - 1 ? s : ''}
              </span>
            </div>
          ))}
        </div>
        <span className="absolute top-[-22px] left-2 rounded-md bg-u6 px-1.5 py-0.5 text-[10px] font-bold text-white transition-transform duration-700 ease-[var(--ease-in-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-[calc(100cqw-3rem)]">
          U6
        </span>
      </div>
    </div>
  );
}
