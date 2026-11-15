import {
  BEHAVIOUR,
  OFFER_WINDOW_TABLE,
  RECYCLING_FIXTURE_ID,
  clockAt,
  getFixture,
  matchContextFor,
} from '@fcb/core';
import { Armchair, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { RecyclingDashboard } from '@/components/recycling/RecyclingDashboard';
import { ButtonLink, PageHeader } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';
import { recyclingForecast, recyclingSimulation, seppPrediction } from '@/lib/server/insights';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.recycling.metaTitle, description: t.recycling.metaDescription };
}

export default async function RecyclingPage() {
  const { t } = await getMessages();
  const fixture = getFixture(RECYCLING_FIXTURE_ID);
  const ctx = matchContextFor(fixture);
  const sepp = seppPrediction();
  return (
    <>
      <PageHeader
        icon={<Armchair className="size-3.5" aria-hidden />}
        eyebrow={t.recycling.eyebrow}
        title={t.recycling.title}
        lead={t.recycling.lead}
      >
        <ButtonLink href="/live" size="lg">
          {t.recycling.demoButton} <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </PageHeader>
      <RecyclingDashboard
        fixture={{
          label: `FC Bayern vs ${fixture.opponent}`,
          kickoff: fixture.kickoff,
          clock: clockAt(fixture.kickoff, 0),
        }}
        context={{
          rain: ctx.rainProbability,
          temperature: ctx.temperatureC,
          midweek: ctx.midweek,
        }}
        forecast={recyclingForecast()}
        sim={recyclingSimulation()}
        sepp={{ probability: sepp.probability, contributions: sepp.contributions }}
        offerWindows={OFFER_WINDOW_TABLE.map((r) => ({ label: r.label, minutes: r.minutes }))}
        behaviour={{
          releaseToday: BEHAVIOUR.today.releaseRate,
          releaseFair: BEHAVIOUR.fairseat.optedInReleaseRate,
          noResponse: BEHAVIOUR.fairseat.noResponseShare,
          youthGift: BEHAVIOUR.fairseat.youthGiftShare,
        }}
      />
    </>
  );
}
