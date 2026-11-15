import type { Metadata } from 'next';
import { StageDemo } from '@/components/live/StageDemo';
import { PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Stage demo — two phones, one seat',
  description:
    'Sepp releases his Südkurve spot in a Gemini chat; Mia from the waitlist gets it seconds later.',
};

export const dynamic = 'force-dynamic';

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  const roomId = room && /^[a-z0-9-]{1,24}$/.test(room) ? room : 'stage';
  return (
    <>
      <PageHeader
        eyebrow="Kein Platz bleibt leer · live"
        title="Two phones. One seat. Zero empty."
        lead="Friday afternoon, 26 hours before kick-off. Sepp’s calendar says Hamburg. Gemini asks him kindly — he taps once, and the engine hands his Südkurve spot to the next fan who fits: Mia from Garching, nine “no”s in a row. Open the phone links on two real devices for the stage."
      />
      <StageDemo room={roomId} />
    </>
  );
}
