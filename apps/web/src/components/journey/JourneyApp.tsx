'use client';

import {
  FIXTURES,
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
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { LineChart } from '@/components/charts/LineChart';
import { AiBadge, TypingDots } from '@/components/ui/AiBadge';
import {
  RangeField,
  Segmented,
  SelectField,
  TextField,
  Toggle,
  inputClass,
  textareaClass,
} from '@/components/ui/controls';
import { Badge, Button, Panel, Stat } from '@/components/ui/primitives';
import { errorMessage, postJson } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { modeLabel, placeLabel, tj } from '@/lib/i18n/journey';
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
const DATE_TAG = { en: 'en-GB', de: 'de-DE' } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Stat-tile duration: "48 min" or "1:30 h" — short enough to never wrap. */
function shortDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
}

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
  const t = useT();
  const f = useFormat();
  const { locale } = useLocale();
  const tj_ = t.journey;
  const language = locale;
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

  const fixture = FIXTURES.find((x) => x.id === fixtureId) ?? FIXTURES[0]!;
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
  const L = (s: string) => tj(s, locale);

  // ── Gemini narration (debounced; loading is derived, not set in the effect) ──
  const [narration, setNarration] = useState<{
    key: string;
    data?: AiPayload<string>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
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
      clearTimeout(timer);
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
        fields.push(placeLabel(getOrigin(v.originId).label, locale));
        const avail = availableModes(getOrigin(v.originId));
        if (!v.mode && !avail.includes(mode)) setMode(avail[0] as Mode);
      }
      if (v.mode) {
        setMode(v.mode);
        fields.push(tj_.modes[v.mode]);
      }
      if (v.blockId && BLOCK_IDS.has(v.blockId)) {
        setBlockInput(v.blockId);
        fields.push(tj_.fields.block(v.blockId));
      }
      if (v.withKids !== null) {
        setWithKids(v.withKids);
        if (v.withKids) fields.push(tj_.fields.kids);
      }
      if (v.wantsFood !== null) {
        setWantsFood(v.wantsFood);
        fields.push(v.wantsFood ? tj_.fields.food : tj_.fields.noFood);
      }
      if (v.stepFree !== null) {
        setStepFree(v.stepFree);
        if (v.stepFree) fields.push(tj_.fields.stepFree);
      }
      if (v.seatedBy !== null) {
        setSeatedBy(v.seatedBy);
        fields.push(tj_.fields.seated(v.seatedBy));
      }
      if (v.postMatch) {
        setPostMatch(v.postMatch);
        fields.push(v.postMatch === 'asap' ? tj_.fields.asap : tj_.fields.relaxed);
      }
      setParsed({ fields, source: res.source });
      if (fields.length) toast.success(tj_.planned, { description: fields.join(' · ') });
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
  const chosenMode = modeLabel(c.mode, c.modeLabel, locale);
  const rec = plan.postMatch.find((o) => o.recommended) ?? plan.postMatch[0]!;
  const usesU6 = c.legs.some((l) => l.crowdSensitive);
  const crowdLeg = c.legs.findIndex((l) => l.crowdSensitive);
  const afterU6 = crowdLeg >= 0 ? c.legs.slice(crowdLeg + 1).reduce((a, l) => a + l.minutes, 0) : 0;
  const maxQueue = Math.max(...plan.postMatch.map((o) => o.queueMinutes), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6" aria-label="Your matchday">
        <Panel
          className="relative overflow-hidden"
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-bad" aria-hidden /> {tj_.tellTitle}
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
              {tj_.describe}
            </label>
            <textarea
              id="journey-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={600}
              rows={3}
              enterKeyHint="go"
              placeholder={tj_.placeholder}
              className={textareaClass}
            />
            <Button type="submit" className="mt-2.5 w-full" disabled={parsing || !text.trim()}>
              {parsing ? (
                <TypingDots label={tj_.understanding} />
              ) : (
                <Wand2 className="size-4" aria-hidden />
              )}{' '}
              {tj_.planIt}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tj_.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  void runParse(ex);
                }}
                className="press rounded-full bg-ink-800 px-2.5 py-1 text-left text-[11px] text-fg-2 hover:bg-ink-750 hover:text-fg"
              >
                {ex.length > 46 ? `${ex.slice(0, 44)}…` : ex}
              </button>
            ))}
          </div>
          {parsed && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
              <AiBadge source={parsed.source} />
              {parsed.fields.length ? (
                parsed.fields.map((x, i) => (
                  <Badge
                    key={x}
                    tone="red"
                    className="animate-pop"
                    style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
                  >
                    {x}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-fg-3">{tj_.nothing}</span>
              )}
            </div>
          )}
          {parseError && (
            <p role="alert" className="mt-2 text-xs text-bad">
              {parseError}
            </p>
          )}
        </Panel>

        <Panel title={tj_.tripTitle}>
          <div className="grid gap-4">
            <SelectField
              label={tj_.match}
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
            >
              {FIXTURES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.opponent} — {formatMatchDate(x.kickoff, DATE_TAG[locale])},{' '}
                  {clockAt(x.kickoff, 0)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={tj_.from}
              value={originId}
              onChange={(e) => {
                setOriginId(e.target.value);
                const avail = availableModes(getOrigin(e.target.value));
                if (!avail.includes(mode)) setMode(avail[0] as Mode);
              }}
            >
              {ORIGINS.map((o) => (
                <option key={o.id} value={o.id}>
                  {placeLabel(o.label, locale)} · {o.area}
                </option>
              ))}
            </SelectField>
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-3">{tj_.gettingThere}</p>
              <Segmented<Mode>
                label={tj_.travelMode}
                value={request.mode}
                onChange={setMode}
                size="sm"
                options={(['ubahn', 'bike', 'car', 'fanbus', 'walk'] as Mode[]).map((m) => {
                  const Icon = MODE_ICON[m];
                  return {
                    value: m,
                    label: tj_.modes[m],
                    icon: <Icon className="size-3.5" aria-hidden />,
                    disabled: !modes.includes(m),
                    hint: modes.includes(m)
                      ? undefined
                      : tj_.notFrom(placeLabel(origin.label, locale)),
                  };
                })}
              />
            </div>
            <TextField
              label={tj_.block}
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
                  ? tj_.blockSud
                  : tj_.blockTier(plan.block.stand, tj_.tiers[plan.block.tier] ?? plan.block.tier)
                : tj_.blockUnknown}
            </p>
            <RangeField
              label={tj_.seatedBy}
              valueLabel={`${seatedBy} min${seatedBy >= 30 ? ` · ${tj_.choreo}` : ''}`}
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
                label={tj_.food}
                icon={<Utensils className="size-4" />}
              />
              <Toggle
                checked={withKids}
                onChange={setWithKids}
                label={tj_.kids}
                description={tj_.kidsSub}
                icon={<Baby className="size-4" />}
              />
              <Toggle
                checked={stepFree}
                onChange={setStepFree}
                label={tj_.stepFree}
                icon={<Accessibility className="size-4" />}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-3">{tj_.afterWhistle}</p>
              <Segmented<PostMatchPreference>
                label={tj_.afterMatch}
                size="sm"
                value={postMatch}
                onChange={setPostMatch}
                options={[
                  { value: 'auto', label: tj_.smartest },
                  { value: 'asap', label: tj_.straightHome },
                  { value: 'relaxed', label: tj_.noRush },
                ]}
              />
            </div>
          </div>
        </Panel>

        <Panel title={tj_.surprisesTitle} subtitle={tj_.surprisesSub}>
          <div className="grid gap-2" role="group" aria-label={tj_.disruptions}>
            {(
              [
                { id: 'u6-strike', label: tj_.strike, icon: AlertTriangle },
                { id: 'u6-north-closure', label: tj_.closure, icon: Construction },
                { id: 'heavy-rain', label: tj_.rain, icon: CloudRain },
              ] as const
            ).map((d) => {
              const on = disruption === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDisruption((cur) => (cur === d.id ? null : d.id))}
                  className={cn(
                    'press flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm',
                    on
                      ? 'bg-fcb/[0.07] text-fg shadow-[inset_0_0_0_1px_rgb(220_5_45/0.45)]'
                      : 'text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-ink-800',
                  )}
                >
                  <d.icon className={cn('size-4', on ? 'text-bad' : 'text-fg-3')} aria-hidden />
                  <span className="flex-1">{d.label}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 rounded-full transition-[transform,opacity] duration-200 ease-[var(--ease-out)]',
                      on ? 'scale-100 bg-fcb opacity-100' : 'scale-50 opacity-0',
                    )}
                  />
                </button>
              );
            })}
          </div>
        </Panel>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <AnimatePresence initial={false} mode="popLayout">
          {plan.alerts.map((a) => (
            <motion.div
              key={a.title}
              role="alert"
              initial={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className={cn(
                'flex gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-inset',
                a.severity === 'critical'
                  ? 'bg-fcb/[0.07] ring-fcb/35'
                  : a.severity === 'warning'
                    ? 'bg-viz-amber/10 ring-viz-amber/40'
                    : 'bg-blue/[0.07] ring-blue/30',
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
                <p className="font-semibold text-fg">{L(a.title)}</p>
                <p className="text-sm text-fg-2">{L(a.detail)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat
            label={tj_.leaveAt}
            value={plan.facts.departClock}
            sub={placeLabel(origin.label, locale)}
            tone="red"
          />
          <Stat
            label={tj_.inSeat}
            value={plan.facts.seatedClock}
            sub={tj_.kickoff(plan.facts.kickoffClock)}
            tone="red"
          />
          <Stat
            label={tj_.doorToSeat}
            value={shortDuration(c.doorToSeatMinutes)}
            sub={chosenMode}
          />
          <Stat
            label={tj_.homeBy}
            value={rec.homeClock}
            sub={rec.stayMinutes ? tj_.afterStay(rec.stayMinutes) : tj_.atWhistle}
            tone="blue"
          />
          <Stat
            label={tj_.green}
            value={`+${plan.green.points}`}
            sub={plan.green.co2SavedKg > 0 ? tj_.co2(f.dec(plan.green.co2SavedKg, 1)) : tj_.noCo2}
            tone="green"
            className="col-span-2 md:col-span-1"
          />
        </div>

        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-bad" aria-hidden /> {tj_.narrationTitle}
            </span>
          }
          actions={
            !narrating &&
            narration?.data && (
              <AiBadge
                source={narration.data.source}
                model={narration.data.model}
                latencyMs={narration.data.latencyMs}
                note={narration.data.note}
              />
            )
          }
        >
          <div aria-live="polite" className="min-h-16 text-[15px] leading-relaxed text-fg-2">
            {narrating && !narration?.data ? (
              <div className="space-y-2.5" aria-busy="true">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-11/12 rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            ) : narration?.error ? (
              <p role="alert" className="text-bad">
                {narration.error}
              </p>
            ) : (
              // Old text stays while the new one loads, softened — no layout jump.
              <p
                className={cn(
                  'text-pretty transition-[opacity,filter] duration-200',
                  narrating && 'opacity-50 blur-[1.5px]',
                )}
                aria-busy={narrating}
              >
                {narration?.data?.value}
              </p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={plan.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex h-9 items-center gap-2 rounded-xl bg-fg px-3.5 text-sm font-semibold text-inverse hover:opacity-90"
            >
              <ExternalLink className="size-4" aria-hidden /> {tj_.maps}
            </a>
            {plan.green.breakdown.map((b) => (
              <Badge key={b} tone="green">
                <Leaf className="size-3" aria-hidden /> {L(b)}
              </Badge>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title={tj_.timelineTitle} subtitle={`${chosenMode} · ${plan.entrance.label}`}>
            <Timeline steps={plan.timeline} />
          </Panel>

          <div className="flex min-w-0 flex-col gap-6">
            <Panel title={tj_.afterTitle} subtitle={tj_.afterSub}>
              <ul className="space-y-2.5">
                {plan.postMatch.map((o) => (
                  <li
                    key={o.stayMinutes}
                    className={cn(
                      'rounded-xl p-3 transition-colors duration-200',
                      o.recommended ? 'bg-fcb/[0.05] ring-1 ring-fcb/30 ring-inset' : 'bg-ink-800',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-fg">{L(o.label)}</span>
                      {o.recommended && <Badge tone="red">{tj_.recommended}</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <span className="h-2 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                        <span
                          className="block h-full origin-left rounded-full bg-fcb transition-transform duration-500 ease-[var(--ease-out)]"
                          style={{
                            transform: `scaleX(${Math.max(0.03, o.queueMinutes / maxQueue).toFixed(4)})`,
                          }}
                        />
                      </span>
                      <span className="tabular text-xs text-fg-2">
                        {tj_.queueHome(f.minutes(o.queueMinutes), o.homeClock)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            {usesU6 && (
              <Panel title={tj_.u6Title} subtitle={tj_.u6Sub}>
                <LineChart
                  title={tj_.u6Aria}
                  series={[
                    {
                      key: 'load',
                      label: tj_.u6Load,
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
                  band={{ from: 1, to: 1.4, label: tj_.overCapacity }}
                  markers={[
                    { x: c.esplanadeAt - afterU6, label: tj_.yourTrain, color: 'var(--color-fg)' },
                  ]}
                  height={220}
                />
              </Panel>
            )}

            {plan.alternatives.length > 0 && (
              <Panel title={tj_.planB}>
                <ul className="text-sm">
                  {plan.alternatives.map((a) => {
                    const Icon = MODE_ICON[a.mode];
                    return (
                      <li
                        key={a.mode}
                        className="flex items-center justify-between gap-3 border-t hairline py-2.5 first:border-t-0 first:pt-0"
                      >
                        <span className="inline-flex items-center gap-2 font-medium text-fg">
                          <Icon className="size-4 text-fg-3" aria-hidden />{' '}
                          {modeLabel(a.mode, a.modeLabel, locale)}
                        </span>
                        <span className="tabular min-w-0 flex-1 text-right text-xs text-fg-3">
                          {tj_.leave(
                            clockAt(fixture.kickoff, a.departAt),
                            formatDuration(a.doorToSeatMinutes),
                          )}
                        </span>
                        <Button size="sm" variant="secondary" onClick={() => setMode(a.mode)}>
                          {tj_.use}
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
              <MessageCircle className="size-4 text-bad" aria-hidden /> {tj_.askTitle}
            </span>
          }
          subtitle={tj_.askSub}
        >
          <ul className="space-y-3" aria-live="polite">
            <AnimatePresence initial={false}>
              {qa.map((x) => (
                <motion.li
                  key={x.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                  className="space-y-1.5"
                >
                  <p className="ml-auto w-fit max-w-[85%] rounded-[20px] rounded-br-md bg-fcb px-3.5 py-2 text-sm text-white">
                    {x.q}
                  </p>
                  {x.a ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, ease: EASE_OUT }}
                      className="max-w-[85%]"
                    >
                      <p className="rounded-[20px] rounded-bl-md bg-ink-750 px-3.5 py-2 text-sm text-fg">
                        {x.a.value}
                      </p>
                      <AiBadge source={x.a.source} className="mt-1 origin-left scale-90" />
                    </motion.div>
                  ) : x.error ? (
                    <p role="alert" className="text-sm text-bad">
                      {x.error}
                    </p>
                  ) : (
                    <div className="w-fit rounded-[20px] rounded-bl-md bg-ink-750 px-3.5 py-3">
                      <TypingDots />
                    </div>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className={cn('flex flex-wrap gap-1.5', qa.length > 0 && 'mt-4')}>
            {tj_.questions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void ask(q)}
                className="press rounded-full bg-ink-800 px-3 py-1.5 text-xs text-fg-2 hover:bg-ink-750 hover:text-fg"
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
              {tj_.askLabel}
            </label>
            <input
              id="journey-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={300}
              enterKeyHint="send"
              placeholder={tj_.askPlaceholder}
              className={cn(inputClass, 'min-w-0 flex-1')}
            />
            <Button type="submit" aria-label={tj_.ask} disabled={!question.trim()}>
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
