import {
  Ban,
  Calculator,
  Cpu,
  Eye,
  Fingerprint,
  Lock,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Eyebrow, PageHeader, Panel } from '@/components/ui/primitives';
import { getMessages } from '@/lib/i18n/server';
import { aiStatus } from '@/lib/server/ai';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.how.metaTitle, description: t.how.metaDescription };
}

function Box({
  x,
  y,
  w,
  h,
  lines,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  accent: string;
}) {
  const [title, ...rest] = lines;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={16}
        fill="var(--color-ink-850)"
        stroke="var(--color-line-strong)"
      />
      <rect x={x} y={y + 16} width={3} height={h - 32} rx={1.5} fill={accent} />
      <text x={x + 18} y={y + 28} className="fill-fg text-[13px] font-semibold">
        {title}
      </text>
      {rest.map((l, i) => (
        <text key={l} x={x + 18} y={y + 49 + i * 18} className="fill-fg-3 text-[11px]">
          {l}
        </text>
      ))}
    </g>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  label,
  dy = -6,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  dy?: number;
}) {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--color-fg-3)"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
      {/* Data in motion: dashes travel along the arrow — constant motion, so linear. */}
      <line
        x1={x1}
        y1={y1}
        x2={x2 - Math.sign(x2 - x1) * 6}
        y2={y2 - Math.sign(y2 - y1) * 6}
        stroke="var(--color-fcb)"
        strokeWidth={2}
        strokeLinecap="round"
        className="flow-dash"
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 + dy}
          textAnchor="middle"
          className="fill-fg-2 text-[11px] font-medium"
        >
          {label}
        </text>
      )}
    </g>
  );
}

const FAN_ICONS = [Ban, Fingerprint, Lock, ShieldCheck, Users, Eye];

export default async function HowItWorksPage() {
  const { t } = await getMessages();
  const h = t.how;
  const ai = aiStatus();
  return (
    <>
      <PageHeader
        icon={<Cpu className="size-3.5" aria-hidden />}
        eyebrow={h.eyebrow}
        title={h.title}
        lead={h.lead}
      />

      <Panel
        title={h.systemTitle}
        subtitle={h.running(ai.mode === 'gemini' ? `Gemini (${ai.model})` : h.runningDemo)}
      >
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={h.diagramRegion}>
          <svg
            viewBox="0 0 980 360"
            className="h-auto w-full min-w-[760px]"
            role="img"
            aria-labelledby="arch-title arch-desc"
          >
            <title id="arch-title">{h.diagramTitle}</title>
            <desc id="arch-desc">{h.diagramDesc}</desc>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="var(--color-fg-3)" />
              </marker>
            </defs>
            <Box x={10} y={120} w={190} h={120} lines={h.boxes.app} accent="#dc052d" />
            <Box x={270} y={120} w={200} h={130} lines={h.boxes.api} accent="var(--color-fg-3)" />
            <Box x={540} y={20} w={200} h={130} lines={h.boxes.core} accent="var(--color-ok)" />
            <Box x={540} y={210} w={200} h={130} lines={h.boxes.ai} accent="var(--color-blue)" />
            <Box
              x={800}
              y={210}
              w={170}
              h={130}
              lines={[h.boxes.gemini[0] ?? 'Gemini', ai.model, ...h.boxes.gemini.slice(1)]}
              accent="var(--color-blue)"
            />
            <Arrow x1={200} y1={180} x2={268} y2={180} label={h.arrows.json} />
            <Arrow x1={470} y1={160} x2={538} y2={100} label={h.arrows.inputs} dy={-10} />
            <Arrow x1={640} y1={150} x2={640} y2={208} label={h.arrows.facts} dy={4} />
            <Arrow x1={740} y1={262} x2={798} y2={262} label={h.arrows.prompt} />
            <Arrow x1={798} y1={300} x2={740} y2={300} label={h.arrows.text} dy={16} />
            <Arrow x1={538} y1={275} x2={472} y2={215} label={h.arrows.verified} dy={20} />
          </svg>
        </div>
        <p className="mt-4 text-sm text-pretty text-fg-3">{h.diagramNote}</p>
      </Panel>

      <section className="mt-16" aria-labelledby="loop-title">
        <Eyebrow className="text-bad">{h.loopEyebrow}</Eyebrow>
        <h2 id="loop-title" className="display mt-3 text-4xl">
          {h.loopTitle}
        </h2>
        <ol className="mt-8 grid gap-3 md:grid-cols-5">
          {h.loop.map(([title, d], i) => (
            <li key={title} className="card relative p-5">
              <span className="display tabular flex size-9 items-center justify-center rounded-xl bg-fcb text-base text-white">
                {i + 1}
              </span>
              <p className="mt-4 font-semibold text-fg">{title}</p>
              <p className="mt-1 text-sm text-pretty text-fg-3">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <Panel title={h.fanFirst}>
          <ul className="grid gap-3.5 text-sm text-fg-2">
            {h.fanFirstList.map((line, i) => {
              const Icon = FAN_ICONS[i] ?? ShieldCheck;
              return (
                <li key={line} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-fcb/10">
                    <Icon className="size-3.5 text-bad" aria-hidden />
                  </span>
                  <span className="pt-0.5 text-pretty">{line}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title={h.pilotTitle}>
          <ol className="relative grid gap-5 text-sm">
            {h.pilot.map(([title, d], i) => (
              <li key={title} className="grid grid-cols-[20px_1fr] gap-3">
                <span className="relative flex justify-center" aria-hidden>
                  {i < h.pilot.length - 1 && (
                    <span className="absolute top-4 -bottom-5 w-0.5 rounded-full bg-line-strong" />
                  )}
                  <span
                    className={
                      i === 0
                        ? 'relative mt-1 size-3 rounded-full bg-fcb ring-4 ring-fcb/15'
                        : 'relative mt-1 size-3 rounded-full bg-ink-600 ring-4 ring-ink-850'
                    }
                  />
                </span>
                <span>
                  <span className="block font-semibold text-fg">{title}</span>
                  <span className="mt-0.5 block text-pretty text-fg-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 space-y-1.5 border-t hairline pt-4 text-xs text-fg-3">
            <p className="flex items-center gap-2">
              <Wifi className="size-3.5 shrink-0" aria-hidden /> {h.offline}
            </p>
            <p className="flex items-center gap-2">
              <Calculator className="size-3.5 shrink-0" aria-hidden /> {h.synthetic}
            </p>
          </div>
        </Panel>
      </section>
    </>
  );
}
