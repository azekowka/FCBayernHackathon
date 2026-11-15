import { cn } from '@/lib/cn';

/**
 * Kickoff mark: the centre circle and halfway line — the spot where every
 * match starts — on a Bayern-red tile. Original artwork, not the club crest.
 */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="9" fill="#dc052d" />
      <rect width="32" height="16" rx="9" fill="#ffffff" fillOpacity="0.08" />
      <path d="M16 4.5v23" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#ffffff" strokeWidth="2" />
      <circle cx="16" cy="16" r="2.25" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('display text-[19px] leading-none font-[750] text-fg', className)}>
      Kickoff
    </span>
  );
}
