import { Radio } from 'lucide-react';
import type { Metadata } from 'next';
import { StageDemo } from '@/components/live/StageDemo';
import { PageHeader } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.live.metaTitle, description: t.live.metaDescription };
}

export const dynamic = 'force-dynamic';

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const [{ room }, { t }] = await Promise.all([searchParams, getMessages()]);
  const roomId = room && /^[a-z0-9-]{1,24}$/.test(room) ? room : 'stage';
  return (
    <>
      <PageHeader
        icon={<Radio className="size-3.5" aria-hidden />}
        eyebrow={t.live.eyebrow}
        title={t.live.title}
        lead={t.live.lead}
      />
      <StageDemo room={roomId} />
    </>
  );
}
