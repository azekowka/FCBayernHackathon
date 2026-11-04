import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SinglePhone } from '@/components/live/StageDemo';

export const metadata: Metadata = { title: 'Phone view — stage demo' };
export const dynamic = 'force-dynamic';

const ROLES = new Set(['sepp', 'mia', 'jonas', 'kofi', 'elif', 'huber-group']);

export default async function PhonePage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const [{ role }, { room }] = await Promise.all([params, searchParams]);
  if (!ROLES.has(role)) notFound();
  const roomId = room && /^[a-z0-9-]{1,24}$/.test(room) ? room : 'stage';
  return <SinglePhone room={roomId} role={role} />;
}
