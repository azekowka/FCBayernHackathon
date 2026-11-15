'use client';

import {
  LOYALTY_RULES,
  MAX_WEIGHT,
  applicationWeight,
  loyaltyWeight,
  membershipYears,
  type MemberProfile,
} from '@fcb/core';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/cn';
import { useFormat, useT } from '@/lib/i18n/client';

/** The member's loyalty weight as a stacked bar: base + Pechvogel + membership. */
export function LoyaltyCard({ member }: { member: MemberProfile }) {
  const t = useT();
  const f = useFormat();
  const tb = t.ballot;
  const b = loyaltyWeight(member.pechvogel, membershipYears(member.memberSince));
  const weight = applicationWeight(member);
  const share = (v: number) => v / MAX_WEIGHT;
  const segments = [
    { key: 'base', v: b.base, color: 'bg-fg-3', label: tb.base, value: f.dec(1, 2) },
    {
      key: 'pech',
      v: b.pechvogelBonus,
      color: 'bg-fcb',
      label: tb.pechvogelBonus,
      value: `+${f.dec(b.pechvogelBonus, 2)}`,
    },
    {
      key: 'member',
      v: b.membershipBonus,
      color: 'bg-blue',
      label: tb.membershipBonus,
      value: `+${f.dec(b.membershipBonus, 2)}`,
    },
  ];
  let offset = 0;

  const explain = [
    tb.explain.start,
    b.pechvogelCounted > 0
      ? tb.explain.pechvogel(f.dec(b.pechvogelBonus, 2), b.pechvogelCounted)
      : tb.explain.noPechvogel,
    tb.explain.membership(f.dec(b.membershipBonus, 2), b.yearsCounted),
    ...((member.companions?.length ?? 0) > 0 ? [tb.explain.group(member.groupSize)] : []),
  ];

  return (
    <section className="card p-5 md:p-6" aria-label={tb.loyaltyTitle}>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold tracking-tight text-fg">{tb.loyaltyTitle}</p>
        <p className="display text-4xl text-fg">
          <AnimatedNumber
            value={weight}
            format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            suffix="×"
          />
        </p>
      </div>
      {/* Segments are positioned with transforms so they glide when the member changes. */}
      <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-ink-750" aria-hidden>
        {segments.map((s) => {
          const left = offset;
          offset += share(s.v);
          return (
            <span
              key={s.key}
              className={cn(
                'absolute inset-y-0 left-0 w-full origin-left transition-transform duration-500 ease-[var(--ease-out)]',
                s.color,
              )}
              style={{
                transform: `translateX(${(left * 100).toFixed(3)}%) scaleX(${Math.max(share(s.v), 0).toFixed(4)})`,
              }}
            />
          );
        })}
      </div>
      <ul className="mt-4 grid gap-1.5 text-xs text-fg-3">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className={cn('size-2 rounded-full', s.color)} /> {s.label}
            <span className="tabular ml-auto font-medium text-fg-2">{s.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <p className="flex items-baseline justify-between text-sm font-semibold text-fg">
          {tb.pechvogelCounter}
          <span className="tabular text-xs font-medium text-fg-3">
            {tb.misses(member.pechvogel)}
          </span>
        </p>
        <div
          className="mt-2.5 grid grid-cols-10 gap-1"
          role="img"
          aria-label={tb.bonusSteps(b.pechvogelCounted, LOYALTY_RULES.pechvogelCap)}
        >
          {Array.from({ length: LOYALTY_RULES.pechvogelCap }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-colors duration-300',
                i < b.pechvogelCounted ? 'bg-fcb' : 'bg-ink-700',
              )}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          ))}
        </div>
      </div>

      <ul className="mt-5 space-y-1.5 border-t hairline pt-4 text-xs leading-relaxed text-fg-3">
        {explain.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
