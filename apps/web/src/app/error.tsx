'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n/client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <div role="alert" className="flex animate-rise flex-col items-start gap-5 py-24 md:py-32">
      <p className="display text-6xl text-fcb md:text-7xl">{t.error.code}</p>
      <h1 className="display text-3xl text-balance md:text-4xl">{t.error.title}</h1>
      <p className="max-w-lg text-fg-2">{t.error.lead}</p>
      <Button size="lg" onClick={reset}>
        <RotateCcw className="size-4" aria-hidden /> {t.common.tryAgain}
      </Button>
    </div>
  );
}
