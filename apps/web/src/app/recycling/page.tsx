import {
  BEHAVIOUR,
  OFFER_WINDOW_TABLE,
  RECYCLING_FIXTURE_ID,
  clockAt,
  formatMatchDate,
  getFixture,
  matchContextFor,
} from '@fcb/core';
import type { Metadata } from 'next';
import { RecyclingDashboard } from '@/components/recycling/RecyclingDashboard';
import { ButtonLink, PageHeader } from '@/components/ui/primitives';
import { recyclingForecast, recyclingSimulation, seppPrediction } from '@/lib/server/insights';

export const metadata: Metadata = {
  title: 'Kein Platz bleibt leer — Smart Seat Recycling',
  description:
    'Dynamic capacity management without dynamic pricing: predict empty seats, nudge kindly, refill from the waitlist up to kick-off.',
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

export default function RecyclingPage() {
  const fixture = getFixture(RECYCLING_FIXTURE_ID);
  const ctx = matchContextFor(fixture);
  const sepp = seppPrediction();
  return (
    <>
      <PageHeader
        eyebrow="FCB Fair Seat · Kein Platz bleibt leer"
        title="Dynamic capacity. Never dynamic prices."
        lead="Season-ticket holders who can’t come often release late — or never — and the exchange shuts three hours before kick-off. Fair Seat spots likely empty seats, asks kindly, and hands them to the next fan in the ballot’s own waitlist, right up to kick-off."
      >
        <ButtonLink href="/live">Two-phone demo</ButtonLink>
      </PageHeader>
      <RecyclingDashboard
        fixtureLabel={`FC Bayern vs ${fixture.opponent}`}
        kickoffLabel={`${formatMatchDate(fixture.kickoff)}, ${clockAt(fixture.kickoff, 0)}`}
        context={{
          rain: ctx.rainProbability,
          temperature: ctx.temperatureC,
          weekday: ctx.midweek ? 'Midweek' : 'Weekend',
        }}
        forecast={recyclingForecast()}
        sim={recyclingSimulation()}
        sepp={{ probability: sepp.probability, contributions: sepp.contributions }}
        offerWindows={OFFER_WINDOW_TABLE.map((r) => ({ label: r.label, minutes: r.minutes }))}
        behaviour={[
          {
            label: 'Absent holders who release',
            today: pct(BEHAVIOUR.today.releaseRate),
            fairseat: `${pct(BEHAVIOUR.fairseat.optedInReleaseRate)} (opted in)`,
          },
          { label: 'Release deadline', today: 'T−3 h', fairseat: 'T−30 min' },
          { label: 'Fees for the next fan', today: '15% + €5–8', fairseat: 'none' },
          {
            label: 'Offers left unanswered',
            today: '—',
            fairseat: pct(BEHAVIOUR.fairseat.noResponseShare),
          },
          {
            label: 'Holders gifting to youth',
            today: '—',
            fairseat: pct(BEHAVIOUR.fairseat.youthGiftShare),
          },
        ]}
      />
    </>
  );
}
