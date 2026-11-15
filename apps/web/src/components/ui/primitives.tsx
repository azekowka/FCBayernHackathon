import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  // `press` = scale(0.97) on :active, 160ms ease-out — the UI heard the tap.
  'press inline-flex items-center justify-center font-semibold whitespace-nowrap select-none disabled:cursor-not-allowed [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-fcb text-white shadow-[0_1px_0_0_rgb(255_255_255/0.18)_inset,0_8px_20px_-10px_rgb(220_5_45/0.75)] hover:bg-fcb-600 disabled:bg-ink-600 disabled:text-fg-3 disabled:shadow-none',
        secondary:
          'bg-ink-850 text-fg shadow-[0_0_0_1px_var(--color-line-strong),0_1px_2px_rgb(10_20_40/0.05)] hover:bg-ink-750 disabled:text-fg-3',
        inverse: 'bg-fg text-inverse hover:opacity-90 disabled:bg-ink-600 disabled:text-fg-3',
        blue: 'bg-blue text-white hover:brightness-110 disabled:bg-ink-600 disabled:text-fg-3',
        ghost: 'text-fg-2 hover:bg-ink-750 hover:text-fg',
      },
      size: {
        sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
        md: 'h-10 gap-2 rounded-xl px-4 text-sm',
        lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
        icon: 'size-9 rounded-xl',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;
type Variant = NonNullable<ButtonVariants['variant']>;
type Size = NonNullable<ButtonVariants['size']>;

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(buttonVariants({ variant, size }), className);
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

export type Tone = 'neutral' | 'red' | 'green' | 'amber' | 'blue';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-750 text-fg-2 ring-line-strong/70',
  red: 'bg-fcb/10 text-bad ring-fcb/25',
  green: 'bg-ok/10 text-ok ring-ok/25',
  amber: 'bg-viz-amber/12 text-warn ring-viz-amber/30',
  blue: 'bg-blue/10 text-info ring-blue/25',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
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
    <p
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-fg-3 uppercase',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A small live/status dot with a soft ring that breathes. */
export function LiveDot({
  tone = 'red',
  className,
}: {
  tone?: 'red' | 'green' | 'amber';
  className?: string;
}) {
  const color = tone === 'green' ? 'bg-ok' : tone === 'amber' ? 'bg-viz-amber' : 'bg-fcb';
  return (
    <span aria-hidden className={cn('relative inline-flex size-2 shrink-0', className)}>
      <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', color)} />
      <span className={cn('relative size-2 rounded-full', color)} />
    </span>
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
    <Tag
      className={cn('card min-w-0', className)}
      id={id}
      aria-labelledby={title ? headingId : undefined}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 md:px-6">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[15px] font-semibold tracking-tight text-fg">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-sm text-pretty text-fg-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5 md:p-6', (title || actions) && 'pt-4 md:pt-4', bodyClassName)}>
        {children}
      </div>
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
  tone?: 'green' | 'red' | 'amber' | 'blue';
  className?: string;
}) {
  const dot =
    tone === 'green'
      ? 'bg-ok'
      : tone === 'red'
        ? 'bg-fcb'
        : tone === 'amber'
          ? 'bg-viz-amber'
          : tone === 'blue'
            ? 'bg-blue'
            : 'bg-fg-3/50';
  return (
    <div className={cn('card relative min-w-0 px-4 py-4 md:px-5', className)}>
      <p className="flex items-start gap-2 text-xs font-medium text-fg-3">
        <span aria-hidden className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', dot)} />
        <span className="line-clamp-2 text-pretty">{label}</span>
      </p>
      <div className="display tabular mt-2 text-[28px] leading-none text-fg md:text-[32px]">
        {value}
      </div>
      {sub && <p className="mt-2 text-xs text-pretty text-fg-3">{sub}</p>}
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
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 62% 50%), hsl(${(hue + 30) % 360} 60% 34%))`,
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
  icon,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 pt-10 pb-8 md:flex-row md:items-end md:justify-between md:pt-16 md:pb-10">
      <div className="max-w-3xl animate-rise">
        <Eyebrow className="text-bad">
          {icon}
          {eyebrow}
        </Eyebrow>
        <h1 className="display mt-3 text-[40px] leading-[1.02] text-balance text-fg md:text-6xl">
          {title}
        </h1>
        {lead && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-fg-2 md:text-lg">
            {lead}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 animate-rise flex-wrap gap-2 [animation-delay:80ms]">
          {children}
        </div>
      )}
    </header>
  );
}
