'use client';

import {
  FIXTURES,
  MODE_LABEL,
  ORIGINS,
  availableModes,
  buildStadium,
  clockAt,
  formatDuration,
  formatMatchDate,
  getOrigin,
  planJourney,
  type DisruptionId,
  type JourneyRequest,
  type Mode,
  type PostMatchPreference,
} from '@fcb/core';
import {
  Accessibility,
  AlertTriangle,
  Baby,
  Bike,
  Bus,
  Car,
  CloudRain,
  Construction,
  ExternalLink,
  Footprints,
  Info,
  Leaf,
  MessageCircle,
  Send,
  Sparkles,
  TrainFront,
  Utensils,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LineChart } from '@/components/charts/LineChart';
import { AiBadge, TypingDots } from '@/components/ui/AiBadge';
import { RangeField, Segmented, SelectField, TextField, Toggle } from '@/components/ui/controls';
import { Badge, Button, Panel, Stat } from '@/components/ui/primitives';
import { errorMessage, postJson } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtMinutes } from '@/lib/format';
import type { AiPayload } from '@/lib/types';
import { Timeline } from './Timeline';

const MODE_ICON: Record<Mode, typeof TrainFront> = {
  ubahn: TrainFront,
  bike: Bike,
  car: Car,
  fanbus: Bus,
  walk: Footprints,
};
const BLOCK_IDS = new Set(buildStadium().map((b) => b.id));
const EXAMPLES = [
  'Coming from Augsburg by train with my two kids, Block 214 — we want Brezn before the choreo',
  'Landing at the airport at noon, Block 330, no rush afterwards',
  'Mit dem Rad aus Schwabing, Block 112, danach schnell heim',
];

interface Intent {
  originId: string | null;
  mode: Mode | null;
  blockId: string | null;
  withKids: boolean | null;
  wantsFood: boolean | null;
  stepFree: boolean | null;
  seatedBy: number | null;
  postMatch: PostMatchPreference | null;
}

export function JourneyApp() {
  const [fixtureId, setFixtureId] = useState(FIXTURES[0]?.id ?? '');
  const [originId, setOriginId] = useState('marienplatz');
  const [mode, setMode] = useState<Mode>('ubahn');
  const [blockInput, setBlockInput] = useState('112');
  const [seatedBy, setSeatedBy] = useState(20);
  const [wantsFood, setWantsFood] = useState(true);
  const [withKids, setWithKids] = useState(false);
  const [stepFree, setStepFree] = useState(false);
  const [postMatch, setPostMatch] = useState<PostMatchPreference>('auto');
  const [disruption, setDisruption] = useState<DisruptionId | null>(null);
  const [language, setLanguage] = useState<'en' | 'de'>('en');

  const fixture = FIXTURES.find((f) => f.id === fixtureId) ?? FIXTURES[0]!;
  const blockId = BLOCK_IDS.has(blockInput) ? blockInput : '112';
  const blockValid = BLOCK_IDS.has(blockInput);
  const origin = getOrigin(originId);
  // Memoised: a fresh array each render would change `request` and re-fire the narration effect forever.
  const modes = useMemo(() => availableModes(origin), [origin]);

  const request: JourneyRequest = useMemo(
    () => ({
      originId,
      mode: modes.includes(mode) ? mode : (modes[0] as Mode),
      blockId,
      kickoff: fixture.kickoff,
      fixtureLabel: `FC Bayern vs ${fixture.opponent}`,
      preferences: { seatedBy, wantsFood, withKids, stepFree, postMatch },
      disruption,
    }),
    [
      originId,
      mode,
      modes,
      blockId,
      fixture,
      seatedBy,
      wantsFood,
      withKids,
      stepFree,
      postMatch,
      disruption,
    ],
  );
  const plan = useMemo(() => planJourney(request), [request]);
  const key = JSON.stringify([request, language]);

  // ── Gemini narration (debounced; loading is derived, not set in the effect) ──
  const [narration, setNarration] = useState<{
    key: string;
    data?: AiPayload<string>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      postJson<AiPayload<string>>(
        '/api/ai/journey',
        { action: 'narrate', request, language },
        ctrl.signal,
      )
        .then((data) => setNarration({ key, data }))
        .catch((e) => {
          if (!(e instanceof DOMException)) setNarration({ key, error: errorMessage(e) });
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, request, language]);
  const narrating = narration?.key !== key;

  // ── free-text → planner inputs ──
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<{
    fields: string[];
    source: AiPayload<Intent>['source'];
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const runParse = async (value: string) => {
    if (!value.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await postJson<AiPayload<Intent>>('/api/ai/journey', {
        action: 'parse',
        text: value,
      });
      const v = res.value;
      const fields: string[] = [];
      if (v.originId) {
        setOriginId(v.originId);
        fields.push(getOrigin(v.originId).label);
        const avail = availableModes(getOrigin(v.originId));
        if (!v.mode && !avail.includes(mode)) setMode(avail[0] as Mode);
      }
      if (v.mode) {
        setMode(v.mode);
        fields.push(MODE_LABEL[v.mode]);
      }
      if (v.blockId && BLOCK_IDS.has(v.blockId)) {
        setBlockInput(v.blockId);
        fields.push(`Block ${v.blockId}`);
      }
      if (v.withKids !== null) {
        setWithKids(v.withKids);
        if (v.withKids) fields.push('with kids');
      }
      if (v.wantsFood !== null) {
        setWantsFood(v.wantsFood);
        fields.push(v.wantsFood ? 'food stop' : 'no food');
      }
      if (v.stepFree !== null) {
        setStepFree(v.stepFree);
        if (v.stepFree) fields.push('step-free');
      }
      if (v.seatedBy !== null) {
        setSeatedBy(v.seatedBy);
        fields.push(`seated ${v.seatedBy} min early`);
      }
      if (v.postMatch) {
        setPostMatch(v.postMatch);
        fields.push(v.postMatch === 'asap' ? 'straight home' : 'no rush after');
      }
      setParsed({ fields, source: res.source });
    } catch (e) {
      setParseError(errorMessage(e));
    } finally {
      setParsing(false);
    }
  };

  // ── Q&A ──
  const [question, setQuestion] = useState('');
  const [qa, setQa] = useState<{ id: number; q: string; a?: AiPayload<string>; error?: string }[]>(
    [],
  );
  const qaSeq = useRef(0);
  const ask = async (q: string) => {
    if (!q.trim()) return;
    // Stable ids: answers attach to their own question even if several are in flight.
    const id = ++qaSeq.current;
    setQuestion('');
    setQa((cur) => [...cur, { id, q }]);
    try {
      const a = await postJson<AiPayload<string>>('/api/ai/journey', {
        action: 'ask',
        request,
        question: q,
        language,
      });
      setQa((cur) => cur.map((x) => (x.id === id ? { ...x, a } : x)));
    } catch (e) {
      setQa((cur) => cur.map((x) => (x.id === id ? { ...x, error: errorMessage(e) } : x)));
    }
  };

  const c = plan.chosen;
  const rec = plan.postMatch.find((o) => o.recommended) ?? plan.postMatch[0]!;
  const usesU6 = c.legs.some((l) => l.crowdSensitive);
  const crowdLeg = c.legs.findIndex((l) => l.crowdSensitive);
  const afterU6 = crowdLeg >= 0 ? c.legs.slice(crowdLeg + 1).reduce((a, l) => a + l.minutes, 0) : 0;
  const maxQueue = Math.max(...plan.postMatch.map((o) => o.queueMinutes), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6" aria-label="Your matchday">
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-bad" aria-hidden /> Tell Gemini about your matchday
            </span>
          }
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void runParse(text);
            }}
          >
            <label htmlFor="journey-text" className="sr-only">
              Describe your matchday
            </label>
            <textarea
              id="journey-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="e.g. From Augsburg by train with my kids, Block 214, we want food before the choreo"
              className="w-full resize-none rounded-xl border border-line-strong bg-ink-900 p-3 text-sm text-fg placeholder:text-fg-3 focus:border-fcb-glow"
            />
            <Button type="submit" className="mt-2 w-full" disabled={parsing || !text.trim()}>
              {parsing ? (
                <TypingDots label="Understanding" />
              ) : (
                <Wand2 className="size-4" aria-hidden />
              )}{' '}
              Plan it for me
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  void runParse(ex);
                }}
                className="rounded-full border border-line-strong px-2.5 py-1 text-left text-[11px] text-fg-3 hover:border-fg-3 hover:text-fg-2"
              >
                {ex.length > 46 ? `${ex.slice(0, 44)}…` : ex}
              </button>
            ))}
          </div>
          {parsed && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
              <AiBadge source={parsed.source} />
              {parsed.fields.length ? (
                parsed.fields.map((f) => (
                  <Badge key={f} tone="teal">
                    {f}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-fg-3">Nothing recognised — adjust below.</span>
              )}
            </div>
          )}
          {parseError && (
            <p role="alert" className="mt-2 text-xs text-bad">
              {parseError}
            </p>
          )}
        </Panel>

        <Panel title="Your trip">
          <div className="grid gap-4">
            <SelectField
              label="Match"
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
            >
              {FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.opponent} — {formatMatchDate(f.kickoff)}, {clockAt(f.kickoff, 0)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Starting from"
              value={originId}
              onChange={(e) => {
                setOriginId(e.target.value);
                const avail = availableModes(getOrigin(e.target.value));
                if (!avail.includes(mode)) setMode(avail[0] as Mode);
              }}
            >
              {ORIGINS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} · {o.area}
                </option>
              ))}
            </SelectField>
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-3">Getting there</p>
              <Segmented<Mode>
                label="Travel mode"
                value={request.mode}
                onChange={setMode}
                size="sm"
                options={(['ubahn', 'bike', 'car', 'fanbus', 'walk'] as Mode[]).map((m) => {
                  const Icon = MODE_ICON[m];
                  return {
                    value: m,
                    label:
                      m === 'ubahn'
                        ? 'U-Bahn'
                        : m === 'fanbus'
                          ? 'Fan bus'
                          : m === 'walk'
                            ? 'Walk'
                            : m === 'car'
                              ? 'Car'
                              : 'Bike',
                    icon: <Icon className="size-3.5" aria-hidden />,
                    disabled: !modes.includes(m),
                    hint: modes.includes(m) ? undefined : `Not available from ${origin.label}`,
                  };
                })}
              />
            </div>
            <TextField
              label="Your block"
              inputMode="numeric"
              maxLength={3}
              value={blockInput}
              onChange={(e) => setBlockInput(e.target.value.replace(/\D/g, ''))}
              aria-invalid={!blockValid}
              aria-describedby="block-hint"
            />
            <p
              id="block-hint"
              className={cn('-mt-2 text-xs', blockValid ? 'text-fg-3' : 'text-warn')}
            >
              {blockValid
                ? plan.block.stand === 'Süd' && plan.block.kind === 'standing'
                  ? 'Südkurve — standing'
                  : `${plan.block.stand} · ${plan.block.tier} tier`
                : 'Unknown block — using 112 for now (101–140, 201–232, 301–344).'}
            </p>
            <RangeField
              label="In my seat before kick-off"
              valueLabel={`${seatedBy} min${seatedBy >= 30 ? ' · choreo' : ''}`}
              min={10}
              max={60}
              step={5}
              value={seatedBy}
              onChange={(e) => setSeatedBy(Number(e.target.value))}
            />
            <div className="divide-y divide-line">
              <Toggle
                checked={wantsFood}
                onChange={setWantsFood}
                label="Food before kick-off"
                icon={<Utensils className="size-4" />}
              />
              <Toggle
                checked={withKids}
                onChange={setWithKids}
                label="With kids"
                description="Avoids the worst crowds"
                icon={<Baby className="size-4" />}
              />
              <Toggle
                checked={stepFree}
                onChange={setStepFree}
                label="Step-free route"
                icon={<Accessibility className="size-4" />}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-3">After the final whistle</p>
              <Segmented<PostMatchPreference>
                label="After the match"
                size="sm"
                value={postMatch}
                onChange={setPostMatch}
                options={[
                  { value: 'auto', label: 'Smartest' },
                  { value: 'asap', label: 'Straight home' },
                  { value: 'relaxed', label: 'No rush' },
                ]}
              />
            </div>
          </div>
        </Panel>

        <Panel
          title="Matchday surprises"
          subtitle="Simulate a disruption — the agent re-plans live"
        >
          <div className="grid gap-2" role="group" aria-label="Disruptions">
            {(
              [
                { id: 'u6-strike', label: 'Public transport strike', icon: AlertTriangle },
                {
                  id: 'u6-north-closure',
                  label: 'U6 closed past Kieferngarten',
                  icon: Construction,
                },
                { id: 'heavy-rain', label: 'Heavy rain at kick-off', icon: CloudRain },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={disruption === d.id}
                onClick={() => setDisruption((cur) => (cur === d.id ? null : d.id))}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  disruption === d.id
                    ? 'border-fcb/60 bg-fcb/10 text-fg'
                    : 'border-line-strong text-fg-2 hover:border-fg-3',
                )}
              >
                <d.icon
                  className={cn('size-4', disruption === d.id ? 'text-bad' : 'text-fg-3')}
                  aria-hidden
                />{' '}
                {d.label}
              </button>
            ))}
          </div>
        </Panel>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {plan.alerts.map((a) => (
          <div
            key={a.title}
            role="alert"
            className={cn(
              'flex gap-3 rounded-2xl border px-4 py-3',
              a.severity === 'critical'
                ? 'border-fcb/60 bg-fcb/10'
                : a.severity === 'warning'
                  ? 'border-viz-amber/60 bg-viz-amber/10'
                  : 'border-u6/50 bg-u6/10',
            )}
          >
            {a.severity === 'info' ? (
              <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
            ) : (
              <AlertTriangle
                className={cn(
                  'mt-0.5 size-5 shrink-0',
                  a.severity === 'critical' ? 'text-bad' : 'text-warn',
                )}
                aria-hidden
              />
            )}
            <div>
              <p className="font-semibold text-fg">{a.title}</p>
              <p className="text-sm text-fg-2">{a.detail}</p>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Leave at" value={plan.facts.departClock} sub={origin.label} tone="red" />
          <Stat
            label="In your seat"
            value={plan.facts.seatedClock}
            sub={`kick-off ${plan.facts.kickoffClock}`}
            tone="red"
          />
          <Stat
            label="Door to seat"
            value={formatDuration(c.doorToSeatMinutes)}
            sub={c.modeLabel}
          />
          <Stat
            label="Home by"
            value={rec.homeClock}
            sub={rec.stayMinutes ? `after a ${rec.stayMinutes}-min stay` : 'leaving at the whistle'}
            tone="violet"
          />
          <Stat
            label="Green points"
            value={`+${plan.green.points}`}
            sub={
              plan.green.co2SavedKg > 0 ? `${plan.green.co2SavedKg} kg CO₂ saved` : 'no CO₂ saving'
            }
            tone="teal"
            className="col-span-2 md:col-span-1"
          />
        </div>

        <Panel
          title="Your matchday, in a sentence or five"
          actions={
            <div className="flex items-center gap-2">
              {!narrating && narration?.data && (
                <AiBadge
                  source={narration.data.source}
                  model={narration.data.model}
                  latencyMs={narration.data.latencyMs}
                  note={narration.data.note}
                />
              )}
              <Segmented<'en' | 'de'>
                label="Language"
                size="sm"
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'de', label: 'DE' },
                ]}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-h-16 text-[15px] leading-relaxed text-fg-2">
            {narrating ? (
              <div className="space-y-2" aria-busy="true">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-11/12 rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            ) : narration?.error ? (
              <p role="alert" className="text-bad">
                {narration.error}
              </p>
            ) : (
              <p>{narration?.data?.value}</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={plan.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-line-strong bg-ink-700 px-3 text-sm font-semibold text-fg hover:bg-ink-600"
            >
              <ExternalLink className="size-4" aria-hidden /> Open route in Google Maps
            </a>
            {plan.green.breakdown.map((b) => (
              <Badge key={b} tone="teal">
                <Leaf className="size-3" aria-hidden /> {b}
              </Badge>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel
            title="Sofa to seat — and back"
            subtitle={`${c.modeLabel} · ${plan.entrance.label}`}
          >
            <Timeline steps={plan.timeline} />
          </Panel>

          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="After the whistle" subtitle="Queue at the station vs. when you’d be home">
              <ul className="space-y-3">
                {plan.postMatch.map((o) => (
                  <li
                    key={o.stayMinutes}
                    className={cn(
                      'rounded-xl border p-3',
                      o.recommended
                        ? 'border-viz-teal/60 bg-viz-teal/10'
                        : 'hairline bg-ink-800/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-fg">{o.label}</span>
                      {o.recommended && <Badge tone="teal">Recommended</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <span
                        className="h-2 rounded-full bg-viz-red"
                        style={{ width: `${Math.max(3, (o.queueMinutes / maxQueue) * 100)}%` }}
                        aria-hidden
                      />
                      <span className="tabular text-xs text-fg-2">
                        {fmtMinutes(o.queueMinutes)} queue · home {o.homeClock}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            {usesU6 && (
              <Panel
                title="U6 to Fröttmaning — how full?"
                subtitle="Load vs. capacity on matchday; dot = your train"
              >
                <LineChart
                  title="Inbound U6 load before kick-off"
                  series={[
                    {
                      key: 'load',
                      label: 'U6 load',
                      color: 'var(--color-u6)',
                      area: true,
                      points: plan.inboundCurve
                        .filter((p) => p.at >= -150)
                        .map((p) => ({ x: p.at, y: p.load })),
                    },
                  ]}
                  xTicks={[-150, -120, -90, -60, -30, 0]}
                  formatX={(x) => clockAt(fixture.kickoff, x)}
                  formatY={(y) => `${Math.round(y * 100)}%`}
                  yMax={1.4}
                  band={{ from: 1, to: 1.4, label: 'over capacity' }}
                  markers={[
                    { x: c.esplanadeAt - afterU6, label: 'Your train', color: 'var(--color-fg)' },
                  ]}
                  height={220}
                />
              </Panel>
            )}

            {plan.alternatives.length > 0 && (
              <Panel title="Plan B">
                <ul className="divide-y divide-line text-sm">
                  {plan.alternatives.map((a) => {
                    const Icon = MODE_ICON[a.mode];
                    return (
                      <li key={a.mode} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="inline-flex items-center gap-2 text-fg-2">
                          <Icon className="size-4 text-fg-3" aria-hidden /> {a.modeLabel}
                        </span>
                        <span className="tabular text-xs text-fg-3">
                          leave {clockAt(fixture.kickoff, a.departAt)} ·{' '}
                          {formatDuration(a.doorToSeatMinutes)} door to seat
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setMode(a.mode)}>
                          Use
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}
          </div>
        </div>

        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="size-4 text-bad" aria-hidden /> Ask about your plan
            </span>
          }
          subtitle="Answers come only from your plan — no invented times."
        >
          <ul className="space-y-3" aria-live="polite">
            {qa.map((x) => (
              <li key={x.id} className="space-y-1.5">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-fcb px-3 py-2 text-sm text-white">
                  {x.q}
                </p>
                {x.a ? (
                  <div className="max-w-[85%]">
                    <p className="rounded-2xl rounded-bl-md bg-ink-700 px-3 py-2 text-sm text-fg">
                      {x.a.value}
                    </p>
                    <AiBadge source={x.a.source} className="mt-1 scale-90" />
                  </div>
                ) : x.error ? (
                  <p role="alert" className="text-sm text-bad">
                    {x.error}
                  </p>
                ) : (
                  <div className="w-fit rounded-2xl rounded-bl-md bg-ink-700 px-3 py-2.5">
                    <TypingDots />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              'Where are the shortest toilet queues?',
              'How do I get home fastest?',
              'Will the U6 be packed?',
              'Which entrance do I use?',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void ask(q)}
                className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-fg-3 hover:border-fg-3 hover:text-fg-2"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <label htmlFor="journey-q" className="sr-only">
              Ask a question about your plan
            </label>
            <input
              id="journey-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={300}
              placeholder="Ask anything about your matchday…"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-ink-900 px-3 text-sm text-fg placeholder:text-fg-3"
            />
            <Button type="submit" aria-label="Ask" disabled={!question.trim()}>
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
