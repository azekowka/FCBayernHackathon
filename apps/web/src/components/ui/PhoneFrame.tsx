import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A device frame for the stage demo. The hardware stays black in both themes
 * (it's a phone, not UI); the screen follows the app theme. On a real phone
 * (below `sm`) the frame disappears and the app fills the screen — no phone
 * drawn inside a phone.
 */
export function PhoneFrame({
  label,
  time = '13:30',
  children,
  className,
  highlight,
}: {
  label: string;
  time?: string;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <figure
      aria-label={label}
      className={cn(
        'relative mx-auto w-full max-w-[380px] rounded-[3rem] bg-[#0b0e15] p-[9px] shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset,0_0_0_1.5px_#2a2f3a,0_40px_80px_-32px_rgb(10_20_40/0.55)] transition-shadow duration-500 ease-[var(--ease-out)]',
        highlight &&
          'shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset,0_0_0_3px_#dc052d,0_40px_90px_-28px_rgb(220_5_45/0.6)]',
        'max-sm:max-w-none max-sm:rounded-none max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex h-[680px] flex-col overflow-hidden rounded-[2.45rem] bg-ink-900',
          'max-sm:h-[calc(100dvh-6rem)] max-sm:rounded-[var(--radius-card)] max-sm:shadow-[var(--shadow-card)]',
          highlight && 'max-sm:shadow-[0_0_0_2px_#dc052d,var(--shadow-pop)]',
        )}
      >
        <div className="relative flex h-11 shrink-0 items-center justify-between px-7 text-[12px] font-semibold text-fg max-sm:hidden">
          <span className="tabular">{time}</span>
          <span
            aria-hidden
            className="absolute top-2.5 left-1/2 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black"
          />
          <span aria-hidden className="flex items-center gap-1">
            <span className="flex items-end gap-[2px]">
              {[4, 6, 8, 10].map((h) => (
                <span key={h} className="w-[3px] rounded-[1px] bg-fg" style={{ height: h }} />
              ))}
            </span>
            <span className="relative ml-1 h-[11px] w-[22px] rounded-[3px] border border-fg/60 p-[1.5px]">
              <span className="block h-full w-3/4 rounded-[1px] bg-fg" />
            </span>
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        <div
          aria-hidden
          className="mx-auto mt-1 mb-2 h-[5px] w-32 shrink-0 rounded-full bg-fg/80 max-sm:hidden"
        />
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
