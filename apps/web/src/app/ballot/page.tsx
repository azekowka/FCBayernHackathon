import { Ticket } from 'lucide-react';
import type { Metadata } from 'next';
import { BallotApp } from '@/components/ballot/BallotApp';
import { PageHeader } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.ballot.metaTitle, description: t.ballot.metaDescription };
}

export default async function BallotPage() {
  const { t } = await getMessages();
  return (
    <>
      <PageHeader
        icon={<Ticket className="size-3.5" aria-hidden />}
        eyebrow={t.ballot.eyebrow}
        title={t.ballot.title}
        lead={t.ballot.lead}
      />
      <BallotApp />
    </>
  );
}
