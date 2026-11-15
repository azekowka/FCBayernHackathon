import type { Metadata } from 'next';
import { BallotApp } from '@/components/ballot/BallotApp';
import { PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Losglück mit System — Fair Seat Ballot',
  description:
    'See your odds before you apply, earn a Pechvogel bonus with every “no”, and verify the draw yourself.',
};

export default function BallotPage() {
  return (
    <>
      <PageHeader
        eyebrow="FCB Fair Seat · Losglück mit System"
        title="Know your odds. Earn your luck."
        lead="Up to 350,000 requests chase 75,024 seats. Today a “no” comes with no odds, no reason and no credit. Here every member sees their chances first, every miss raises the next one, and the draw is publicly verifiable."
      />
      <BallotApp />
    </>
  );
}
