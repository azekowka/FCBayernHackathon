import {
  LOYALTY_RULES,
  MAX_WEIGHT,
  applicationWeight,
  explainWeight,
  loyaltyWeight,
  membershipYears,
  type MemberProfile,
} from '@fcb/core';

/** The member's loyalty weight as a stacked bar: base + Pechvogel + membership. */
export function LoyaltyCard({ member }: { member: MemberProfile }) {
  const b = loyaltyWeight(member.pechvogel, membershipYears(member.memberSince));
  const weight = applicationWeight(member);
  const pct = (v: number) => `${(v / MAX_WEIGHT) * 100}%`;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-fg">Loyalty weight</p>
        <p className="display tabular text-4xl font-bold text-fg">
          {weight.toFixed(2)}
          <span className="ml-0.5 text-xl text-fg-3">×</span>
        </p>
      </div>
      <div
        className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-ink-700"
        aria-hidden
      >
        <span className="h-full bg-fg-3" style={{ width: pct(b.base) }} />
        {b.pechvogelBonus > 0 && (
          <span className="h-full bg-viz-red" style={{ width: pct(b.pechvogelBonus) }} />
        )}
        {b.membershipBonus > 0 && (
          <span className="h-full bg-viz-violet" style={{ width: pct(b.membershipBonus) }} />
        )}
      </div>
      <ul className="mt-3 grid gap-1 text-xs text-fg-3">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-fg-3" /> Base{' '}
          <span className="tabular ml-auto text-fg-2">1.00</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-viz-red" /> Pechvogel bonus
          <span className="tabular ml-auto text-fg-2">+{b.pechvogelBonus.toFixed(2)}</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-viz-violet" /> Membership bonus
          <span className="tabular ml-auto text-fg-2">+{b.membershipBonus.toFixed(2)}</span>
        </li>
      </ul>

      <div className="mt-5">
        <p className="flex items-baseline justify-between text-sm font-semibold text-fg">
          Pechvogel counter
          <span className="tabular text-fg-2">
            {member.pechvogel} {member.pechvogel === 1 ? 'miss' : 'misses'}
          </span>
        </p>
        <div
          className="mt-2 grid grid-cols-10 gap-1"
          role="img"
          aria-label={`${b.pechvogelCounted} of ${LOYALTY_RULES.pechvogelCap} bonus steps earned`}
        >
          {Array.from({ length: LOYALTY_RULES.pechvogelCap }, (_, i) => (
            <span
              key={i}
              className={
                i < b.pechvogelCounted ? 'h-2 rounded-sm bg-viz-red' : 'h-2 rounded-sm bg-ink-600'
              }
            />
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 border-t hairline pt-4 text-xs leading-relaxed text-fg-3">
        {explainWeight(member).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
