import { ButtonLink } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-24">
      <p className="display text-7xl font-bold text-bad">404</p>
      <h1 className="display text-4xl font-bold">Offside — this page doesn’t exist.</h1>
      <p className="text-fg-2">The link may be old, or the page moved to another block.</p>
      <ButtonLink href="/">Back to the hub</ButtonLink>
    </div>
  );
}
