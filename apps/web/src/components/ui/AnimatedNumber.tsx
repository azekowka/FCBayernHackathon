'use client';

import NumberFlow, { type Format } from '@number-flow/react';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import { useLocale } from '@/lib/i18n/client';

const TAG = { en: 'en-GB', de: 'de-DE' } as const;

/**
 * A number whose digits roll to their new value (NumberFlow). With `countUp`,
 * it starts at 0 and rolls up the first time it scrolls into view — once.
 */
export function AnimatedNumber({
  value,
  format,
  prefix,
  suffix,
  countUp = false,
  className,
}: {
  value: number;
  format?: Format;
  prefix?: string;
  suffix?: string;
  countUp?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  const shown = countUp && !inView ? 0 : value;
  return (
    <span ref={ref} className={className}>
      <NumberFlow
        value={shown}
        locales={TAG[locale]}
        format={format}
        prefix={prefix}
        suffix={suffix}
        className="tabular"
        spinTiming={{ duration: 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
    </span>
  );
}
