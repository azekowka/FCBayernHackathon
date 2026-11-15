import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'teal';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-fcb text-white hover:bg-fcb-600 shadow-[0_8px_24px_-12px_rgb(220_5_45/0.8)] disabled:bg-ink-600 disabled:text-fg-3 disabled:shadow-none',
  secondary: 'bg-ink-700 text-fg hover:bg-ink-600 border border-line-strong disabled:text-fg-3',
  ghost: 'text-fg-2 hover:text-fg hover:bg-ink-750',
  // Darker than the chart teal so white text clears WCAG AA (≈ 5:1).
  teal: 'bg-[#0b7366] text-white hover:bg-[#0a665b] disabled:bg-ink-600 disabled:text-fg-3',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-[background,transform,filter] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 select-none',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export type Tone = 'neutral' | 'red' | 'teal' | 'amber' | 'violet' | 'blue';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-700/80 text-fg-2 ring-line-strong',
  red: 'bg-fcb/15 text-bad ring-fcb/40',
  teal: 'bg-viz-teal/15 text-ok ring-viz-teal/40',
  amber: 'bg-viz-amber/15 text-warn ring-viz-amber/40',
  violet: 'bg-viz-violet/15 text-info ring-viz-violet/40',
  blue: 'bg-u6/15 text-info ring-u6/40',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs font-semibold tracking-[0.18em] text-fg-3 uppercase', className)}>
      {children}
    </p>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = 'section',
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'div' | 'article';
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag className={cn('card', className)} id={id} aria-labelledby={title ? headingId : undefined}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b hairline px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-base font-semibold text-fg">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-fg-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'teal' | 'red' | 'amber' | 'violet';
  className?: string;
}) {
  const accent =
    tone === 'teal'
      ? 'bg-viz-teal'
      : tone === 'red'
        ? 'bg-viz-red'
        : tone === 'amber'
          ? 'bg-viz-amber'
          : tone === 'violet'
            ? 'bg-viz-violet'
            : 'bg-line-strong';
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border hairline bg-ink-800/70 px-4 py-3.5',
        className,
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r', accent)} />
      <p className="text-xs font-medium text-fg-3">{label}</p>
      <p className="display tabular mt-1 text-3xl leading-none font-semibold text-fg">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-fg-3">{sub}</p>}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cn('font-mono text-[12px] break-all text-fg-2', className)}>{children}</code>
  );
}

export function Avatar({ name, hue, size = 40 }: { name: string; hue: number; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 70% 46%), hsl(${(hue + 40) % 360} 65% 32%))`,
      }}
    >
      {letters}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 pt-8 pb-6 md:flex-row md:items-end md:justify-between md:pt-12">
      <div className="max-w-3xl animate-rise">
        <Eyebrow className="text-bad">{eyebrow}</Eyebrow>
        <h1 className="display mt-2 text-4xl leading-[0.95] font-bold text-balance text-fg md:text-6xl">
          {title}
        </h1>
        {lead && (
          <p className="mt-4 max-w-2xl text-base text-pretty text-fg-2 md:text-lg">{lead}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  );
}
