'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  hint?: string;
}

/** Accessible radio-group styled as a segmented control (arrow keys move). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);
  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-xl border hairline bg-ink-900/80 p-1',
        className,
      )}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm',
              checked ? 'bg-ink-600 text-fg shadow-sm' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-fg-3">{icon}</span>}
        <div className="min-w-0">
          <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-fg">
            {label}
          </label>
          {description && <p className="text-xs text-fg-3">{description}</p>}
        </div>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-viz-teal' : 'bg-ink-600',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: ComponentProps<'select'> & { label: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-fg-3">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="h-10 w-full appearance-none rounded-xl border border-line-strong bg-ink-900 pr-9 pl-3 text-sm text-fg transition-colors hover:border-fg-3 focus:border-fcb-glow"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-3"
        />
      </div>
    </div>
  );
}

export function TextField({
  label,
  className,
  ...props
}: ComponentProps<'input'> & { label: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-fg-3">
        {label}
      </label>
      <input
        id={id}
        className="h-10 w-full rounded-xl border border-line-strong bg-ink-900 px-3 text-sm text-fg placeholder:text-fg-3 hover:border-fg-3 focus:border-fcb-glow"
        {...props}
      />
    </div>
  );
}

export function RangeField({
  label,
  valueLabel,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; valueLabel: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-medium text-fg-3">
          {label}
        </label>
        <span className="tabular text-sm font-semibold text-fg">{valueLabel}</span>
      </div>
      <input id={id} type="range" className="h-2 w-full cursor-pointer accent-fcb" {...props} />
    </div>
  );
}
