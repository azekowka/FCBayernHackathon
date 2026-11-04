import type { Metadata } from 'next';
import { JourneyApp } from '@/components/journey/JourneyApp';
import { PageHeader } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Vom Sofa bis zum Sitz — Matchday Journey Agent',
  description: 'When to leave, how full the U6 will be, the quickest gate and kiosk, and a staggered return that skips the crush.',
};

export default function JourneyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Matchday · Vom Sofa bis zum Sitz"
        title="From sofa to seat — without the crush."
        lead="Most of 75,000 fans squeeze through one U-Bahn line. The app is your ticket — now it becomes your journey: when to leave, which gate, where the queue is shortest, and when to head home so you’re not standing on the Esplanade for half an hour."
      />
      <JourneyApp />
    </>
  );
}
