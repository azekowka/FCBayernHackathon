import { Ban, Calculator, Eye, Fingerprint, Lock, ShieldCheck, Users, Wifi } from 'lucide-react';
import type { Metadata } from 'next';
import { Eyebrow, PageHeader, Panel } from '@/components/ui/primitives';
import { aiStatus } from '@/lib/server/ai';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'Architecture, grounding loop, privacy and pilot plan behind the Fan AI Lab prototypes.',
};

function Box({ x, y, w, h, title, lines, accent }: { x: number; y: number; w: number; h: number; title: string; lines: string[]; accent: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} fill="#111827" stroke="#34405a" />
      <rect x={x} y={y + 14} width={3} height={h - 28} rx={1.5} fill={accent} />
      <text x={x + 16} y={y + 26} className="fill-fg text-[13px] font-semibold">
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 16} y={y + 46 + i * 17} className="fill-fg-3 text-[11px]">
          {l}
        </text>
      ))}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label, dy = -6 }: { x1: number; y1: number; x2: number; y2: number; label?: string; dy?: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8590a6" strokeWidth={1.5} markerEnd="url(#arrow)" />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + dy} textAnchor="middle" className="fill-fg-2 text-[11px]">
          {label}
        </text>
      )}
    </g>
  );
}

export default function HowItWorksPage() {
  const ai = aiStatus();
  return (
    <>
      <PageHeader
        eyebrow="Architecture & responsible AI"
        title="Engines decide. Gemini explains."
        lead="Every number a fan sees — odds, draw positions, seats, queue minutes — comes from deterministic, unit-tested engines. Gemini only turns those facts into conversation, in the fan’s language. If it ever writes a number the engines didn’t produce, we throw the sentence away."
      />

      <Panel title="System at a glance" subtitle={`Currently running: ${ai.mode === 'gemini' ? `Gemini (${ai.model})` : 'offline demo templates — set GEMINI_API_KEY for live Gemini'}`}>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 980 360" className="h-auto w-full min-w-[760px]" role="img" aria-labelledby="arch-title arch-desc">
            <title id="arch-title">Architecture diagram</title>
            <desc id="arch-desc">
              The fan app calls typed API routes. Routes ask the deterministic core engines for facts, then the AI layer turns the facts into text with Gemini, checks every number, and falls back to templates when needed.
            </desc>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#8590a6" />
              </marker>
            </defs>
            <Box x={10} y={120} w={190} h={120} title="Fan app (Next.js)" lines={['Ballot · Recycling · Journey', 'Two-phone live room (SSE)', 'Source badge on every AI text']} accent="#dc052d" />
            <Box x={270} y={120} w={200} h={120} title="API routes" lines={['zod-validated inputs', 'rate limits, body caps', 'facts recomputed server-side', 'commit–reveal draw secret']} accent="#8a7cf0" />
            <Box x={540} y={20} w={200} h={130} title="@fcb/core engines" lines={['weighted verifiable draw', 'no-show model + matching', 'U6 crowd model + planner', '73 tests · 99% coverage']} accent="#12a08e" />
            <Box x={540} y={210} w={200} h={130} title="@fcb/ai layer" lines={['prompts + JSON schemas', 'numbers guard', 'injection hygiene', 'EN/DE grounded fallback']} accent="#3d8fe0" />
            <Box x={800} y={210} w={170} h={130} title="Google Gemini" lines={[ai.model, 'structured output', 'any language', 'timeouts → fallback']} accent="#3d8fe0" />
            <Arrow x1={200} y1={180} x2={268} y2={180} label="JSON" />
            <Arrow x1={470} y1={160} x2={538} y2={100} label="inputs" dy={-10} />
            <Arrow x1={640} y1={150} x2={640} y2={208} label="facts" dy={4} />
            <Arrow x1={740} y1={262} x2={798} y2={262} label="prompt" />
            <Arrow x1={798} y1={300} x2={740} y2={300} label="text" dy={16} />
            <Arrow x1={538} y1={275} x2={472} y2={215} label="verified text" dy={20} />
          </svg>
        </div>
        <p className="mt-3 text-sm text-fg-3">
          Read left to right: the app never talks to Gemini directly, and Gemini never sees anything the engines didn’t compute. The engines run identically in the browser, on the server and in tests.
        </p>
      </Panel>

      <section className="mt-10" aria-labelledby="loop-title">
        <Eyebrow>The grounding loop</Eyebrow>
        <h2 id="loop-title" className="display mt-2 text-3xl font-bold">
          Five steps behind every sentence
        </h2>
        <ol className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            ['Compute', 'An engine produces structured facts — odds, draw position, queue minutes.'],
            ['Phrase', 'Gemini writes from those facts only, in the fan’s language, with a strict system prompt.'],
            ['Verify', 'Every multi-digit number in the reply must exist in the facts — or the reply is discarded.'],
            ['Fall back', 'Timeouts, invalid JSON or invented numbers switch to a grounded template instantly.'],
            ['Disclose', 'A badge tells the fan which path wrote the text: Gemini, demo, or safe fallback.'],
          ].map(([t, d], i) => (
            <li key={t} className="card p-4">
              <p className="display tabular text-3xl font-bold text-bad">{i + 1}</p>
              <p className="mt-1 font-semibold text-fg">{t}</p>
              <p className="mt-1 text-sm text-fg-3">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Fan-first by design">
          <ul className="grid gap-3 text-sm text-fg-2">
            {[
              { icon: Ban, t: 'No dynamic pricing — capacity is dynamic, prices are not. Recycled seats move at face value without fees.' },
              { icon: Fingerprint, t: 'Verifiable draws — SHA-256 commitment before the ballot closes; any member can recompute their own race time.' },
              { icon: Lock, t: 'Privacy — opt-in signals only (calendar, attendance), no biometrics, no location tracking; the no-show estimate is built to run on-device.' },
              { icon: ShieldCheck, t: 'Human in the loop — Gemini can only suggest; releasing a seat needs the fan’s tap.' },
              { icon: Users, t: 'Inclusion — groups never split, accessible spaces prioritised, step-free routing, youth fan-club gifting.' },
              { icon: Eye, t: 'Transparency — published loyalty rules, offer windows and per-Pechvogel win rates after every draw.' },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="From prototype to pilot">
          <ol className="grid gap-4 text-sm">
            {[
              ['Now', 'Working prototype: three products, full-size draws, live two-phone demo, offline-safe AI.'],
              ['Pilot · 1 match', 'One low-demand home match, 500 opt-in season-ticket holders. Measure release rate, refill rate, minutes to refill and fan satisfaction against the Ticket Exchange.'],
              ['Ballot phase', 'Publish odds and per-Pechvogel win rates for one ballot phase; co-design rules with the Fan Dialogue working group.'],
              ['Matchday', 'Swap the schematic network for Google Maps Routes and MVG live data through the same interfaces; run on Vertex AI / Cloud Run.'],
            ].map(([t, d]) => (
              <li key={t} className="grid grid-cols-[110px_1fr] gap-3">
                <span className="font-semibold text-fg">{t}</span>
                <span className="text-fg-2">{d}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-xs text-fg-3">
            <Wifi className="size-3.5" aria-hidden /> Works offline in demo mode — the stage never depends on venue Wi-Fi.
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-fg-3">
            <Calculator className="size-3.5" aria-hidden /> All figures are illustrative model outputs on synthetic data, not FC Bayern data.
          </p>
        </Panel>
      </section>
    </>
  );
}
