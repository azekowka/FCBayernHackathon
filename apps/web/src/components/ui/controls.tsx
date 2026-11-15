'use client';

import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  hint?: string;
}

const SEG_SIZE = {
  sm: 'h-7 px-2.5 text-xs gap-1',
  md: 'h-9 px-3.5 text-sm gap-1.5',
} as const;

/**
 * Accessible radio group styled as a segmented control.
 *
 * The active state is a duplicate of the option row, styled "active" and
 * revealed with `clip-path` over the active option. Moving the clip changes the
 * pill and the label colour as one element — no colours drift out of sync.
 * Keyboard changes move instantly (never animate keyboard-initiated actions).
 */
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
  const root = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [clip, setClip] = useState<string | null>(null);
  const [instant, setInstant] = useState(true);
  const enabled = options.filter((o) => !o.disabled);
  const activeIndex = options.findIndex((o) => o.value === value);

  const measure = useCallback(() => {
    const el = refs.current[activeIndex];
    const box = root.current;
    if (!el || !box) return;
    const top = el.offsetTop;
    const left = el.offsetLeft;
    const right = box.clientWidth - left - el.offsetWidth;
    const bottom = box.clientHeight - top - el.offsetHeight;
    setClip(`inset(${top}px ${right}px ${bottom}px ${left}px round 8px)`);
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
    const box = root.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setInstant(true);
      measure();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [measure]);

  const choose = (v: T, fromKeyboard: boolean) => {
    setInstant(fromKeyboard);
    onChange(v);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (!next) return;
    choose(next.value, true);
    refs.current[options.indexOf(next)]?.focus();
  };

  const row = (active: boolean) =>
    options.map((o, i) => {
      const checked = o.value === value;
      const content = (
        <>
          {o.icon}
          {o.label}
        </>
      );
      if (active) {
        return (
          <span
            key={o.value}
            className={cn(
              'inline-flex items-center rounded-lg bg-ink-850 font-medium whitespace-nowrap text-fg shadow-[0_0_0_1px_var(--color-line),0_1px_3px_rgb(10_20_40/0.12)] dark:bg-ink-600',
              SEG_SIZE[size],
            )}
          >
            {content}
          </span>
        );
      }
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
          onClick={() => choose(o.value, false)}
          className={cn(
            'inline-flex items-center rounded-lg font-medium whitespace-nowrap text-fg-3 transition-colors duration-150 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40',
            SEG_SIZE[size],
            // Before the first measurement (SSR), show the active state statically.
            !clip &&
              checked &&
              'bg-ink-850 text-fg shadow-[0_0_0_1px_var(--color-line)] dark:bg-ink-600',
          )}
        >
          {content}
        </button>
      );
    });

  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn(
        'relative inline-flex max-w-full flex-wrap gap-0.5 rounded-xl bg-ink-750 p-1 ring-1 ring-line ring-inset',
        className,
      )}
    >
      {row(false)}
      {clip && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-wrap gap-0.5 p-1"
          style={{
            clipPath: clip,
            transition: instant ? 'none' : 'clip-path 240ms var(--ease-in-out)',
          }}
        >
          {row(true)}
        </div>
      )}
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
    <div className="flex items-center justify-between gap-3 py-2">
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
          'press relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-fcb' : 'bg-ink-600',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-[var(--ease-out)]',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

const FIELD =
  'h-10 w-full rounded-xl bg-ink-900 text-sm text-fg shadow-[0_0_0_1px_var(--color-line-strong)] transition-shadow duration-150 placeholder:text-fg-3 hover:shadow-[0_0_0_1px_var(--color-fg-3)] focus:shadow-[0_0_0_2px_var(--color-fcb)] focus:outline-none';

export function SelectField({
  label,
  className,
  children,
  ...props
}: ComponentProps<'select'> & { label: string }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-fg-3">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={cn(FIELD, 'appearance-none truncate pr-9 pl-3')} {...props}>
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
      <input id={id} className={cn(FIELD, 'px-3')} {...props} />
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

export const textareaClass = cn(FIELD, 'h-auto resize-none p-3 leading-relaxed');
export const inputClass = cn(FIELD, 'px-3');
