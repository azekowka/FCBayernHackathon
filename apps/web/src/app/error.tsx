'use client';

import { Button } from '@/components/ui/primitives';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-24">
      <p className="display text-6xl font-bold text-bad">VAR check</p>
      <h1 className="display text-3xl font-bold">Something went wrong on our side.</h1>
      <p className="text-fg-2">Nothing you did — try again, and if it persists, reload the page.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
