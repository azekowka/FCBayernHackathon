import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A device frame for the stage demo — content scrolls inside the screen. */
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
        'relative mx-auto w-full max-w-[380px] rounded-[2.6rem] border border-line-strong bg-ink-950 p-2.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] transition-shadow duration-500',
        highlight && 'shadow-[0_0_0_2px_rgb(220_5_45/0.6),0_40px_80px_-30px_rgb(220_5_45/0.55)]',
        className,
      )}
    >
      <div className="relative flex h-[680px] flex-col overflow-hidden rounded-[2.1rem] bg-ink-900">
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-fg-2">
          <span className="tabular">{time}</span>
          <span aria-hidden className="h-5 w-24 rounded-full bg-ink-950" />
          <span aria-hidden className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-fg-2" />
            <span className="h-2.5 w-5 rounded-sm border border-fg-2" />
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        <div aria-hidden className="mx-auto mt-1 mb-2 h-1 w-28 rounded-full bg-fg-3/60" />
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
