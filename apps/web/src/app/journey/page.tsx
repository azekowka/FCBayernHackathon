import { TrainFront } from 'lucide-react';
import type { Metadata } from 'next';
import { JourneyApp } from '@/components/journey/JourneyApp';
import { PageHeader } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.journey.metaTitle, description: t.journey.metaDescription };
}

export default async function JourneyPage() {
  const { t } = await getMessages();
  return (
    <>
      <PageHeader
        icon={<TrainFront className="size-3.5" aria-hidden />}
        eyebrow={t.journey.eyebrow}
        title={t.journey.title}
        lead={t.journey.lead}
      />
      <JourneyApp />
    </>
  );
}
