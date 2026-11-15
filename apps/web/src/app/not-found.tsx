import { ArrowLeft } from 'lucide-react';
import { ButtonLink } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t } = await getMessages();
  return (
    <div className="flex animate-rise flex-col items-start gap-5 py-24 md:py-32">
      <p className="display text-8xl text-fcb md:text-9xl">{t.notFound.code}</p>
      <h1 className="display text-4xl text-balance md:text-5xl">{t.notFound.title}</h1>
      <p className="max-w-lg text-lg text-fg-2">{t.notFound.lead}</p>
      <ButtonLink href="/" size="lg">
        <ArrowLeft className="size-4" aria-hidden /> {t.common.backHome}
      </ButtonLink>
    </div>
  );
}
