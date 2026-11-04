'use client';

import { clockAt, formatMatchDate, getFixture, verifyEntry, type MemberProfile } from '@fcb/core';
import {
  AlertTriangle,
  CheckCircle2,
  Dices,
  Fingerprint,
  Lock,
  RotateCcw,
  Ticket,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { AiBadge, TypingDots } from '@/components/ui/AiBadge';
import { Segmented, SelectField } from '@/components/ui/controls';
import { Badge, Button, Mono, Panel, Stat } from '@/components/ui/primitives';
import { errorMessage, postJson } from '@/lib/api';
import { fmtInt, fmtOneIn, fmtPct } from '@/lib/format';
import type { AiPayload, CommitResponse, DrawResponse } from '@/lib/types';

type Phase = 'idle' | 'committing' | 'committed' | 'drawing' | 'done';

const LANGS = [
  { value: 'en', label: 'EN' },
  { value: 'de', label: 'DE' },
  { value: 'es', label: 'ES' },
  { value: 'ko', label: 'KO' },
  { value: 'tr', label: 'TR' },
] as const;
type Lang = (typeof LANGS)[number]['value'];

function useCountUp(target: number, running: boolean, durationMs = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, running, durationMs]);
  return value;
}

export function DrawPanel({
  member,
  candidateIds,
}: {
  member: MemberProfile;
  candidateIds: string[];
}) {
  const [fixtureId, setFixtureId] = useState(candidateIds[0] ?? '');
  const activeFixtureId = candidateIds.includes(fixtureId) ? fixtureId : (candidateIds[0] ?? '');
  const fixture = activeFixtureId ? getFixture(activeFixtureId) : null;
  const [phase, setPhase] = useState<Phase>('idle');
  const [commit, setCommit] = useState<CommitResponse | null>(null);
  const [draw, setDraw] = useState<DrawResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counted = useCountUp(commit?.expectedEntrants ?? 0, phase === 'drawing');

  const reset = () => {
    setPhase('idle');
    setCommit(null);
    setDraw(null);
    setError(null);
  };

  const doCommit = async () => {
    if (!fixture) return;
    setError(null);
    setPhase('committing');
    try {
      setCommit(await postJson<CommitResponse>('/api/ballot/commit', { fixtureId: fixture.id }));
      setPhase('committed');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  };

  const doDraw = async () => {
    if (!commit) return;
    setError(null);
    setPhase('drawing');
    try {
      const [res] = await Promise.all([
        postJson<DrawResponse>('/api/ballot/draw', {
          drawId: commit.drawId,
          fixtureId: commit.fixtureId,
          memberId: member.id,
        }),
        new Promise((r) => setTimeout(r, 1200)),
      ]);
      setDraw(res);
      setPhase('done');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('committed');
    }
  };

  return (
    <Panel
      id="draw"
      title={
        <span className="inline-flex items-center gap-2">
          <Dices className="size-4 text-bad" aria-hidden /> The verifiable draw
        </span>
      }
      subtitle="Commit → draw → verify. The same code the club would run, on the full-size ballot."
      actions={
        phase !== 'idle' && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" aria-hidden /> New draw
          </Button>
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <SelectField
          label="Match to draw"
          value={activeFixtureId}
          onChange={(e) => {
            setFixtureId(e.target.value);
            reset();
          }}
          disabled={phase === 'committing' || phase === 'drawing'}
        >
          {candidateIds.map((id) => {
            const f = getFixture(id);
            return (
              <option key={id} value={id}>
                {f.opponent} — {formatMatchDate(f.kickoff)}
              </option>
            );
          })}
        </SelectField>
        <ol className="flex flex-wrap gap-2">
          <li>
            <Button
              onClick={doCommit}
              disabled={phase !== 'idle' || !fixture}
              variant={phase === 'idle' ? 'primary' : 'secondary'}
            >
              <Lock className="size-4" aria-hidden /> 1 · Publish commitment
            </Button>
          </li>
          <li>
            <Button
              onClick={doDraw}
              disabled={phase !== 'committed'}
              variant={phase === 'committed' ? 'primary' : 'secondary'}
            >
              <Dices className="size-4" aria-hidden /> 2 · Run the draw
            </Button>
          </li>
        </ol>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl border border-fcb/40 bg-fcb/10 px-3 py-2 text-sm text-bad"
        >
          <AlertTriangle className="size-4" aria-hidden /> {error}
        </p>
      )}

      {commit && (
        <div className="mt-5 rounded-2xl border hairline bg-ink-900/60 p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-fg-3">
            <Fingerprint className="size-3.5" aria-hidden /> Commitment published before the draw —
            SHA-256(seed)
          </p>
          <Mono className="mt-1.5 block text-fg">{commit.commitment}</Mono>
          <p className="mt-2 text-xs text-fg-3">
            {fmtInt(commit.seats)} member-ballot seats · ~{fmtInt(commit.expectedEntrants)}{' '}
            applications expected. The seed stays secret until the draw.
          </p>
        </div>
      )}

      {phase === 'drawing' && (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-fcb/40 bg-fcb/5 p-6 text-center"
        >
          <p className="text-sm text-fg-2">Drawing applications in race-time order…</p>
          <p className="display tabular mt-2 text-5xl font-bold text-fg">{fmtInt(counted)}</p>
        </div>
      )}

      {draw && fixture && (
        <DrawResult
          draw={draw}
          member={member}
          fixtureLabel={fixture.opponent}
          kickoff={fixture.kickoff}
        />
      )}
    </Panel>
  );
}

function DrawResult({
  draw,
  member,
  fixtureLabel,
  kickoff,
}: {
  draw: DrawResponse;
  member: MemberProfile;
  fixtureLabel: string;
  kickoff: string;
}) {
  const [verified, setVerified] = useState<ReturnType<typeof verifyEntry> | null>(null);
  const o = draw.outcome;
  const columns = draw.winRateByPechvogel.map((s) => ({
    key: String(s.pechvogel),
    label: s.pechvogel === 10 ? '10+' : String(s.pechvogel),
    value: s.rate,
    detail: `Pechvogel ${s.pechvogel === 10 ? '10+' : s.pechvogel}: ${fmtInt(s.winners)} of ${fmtInt(s.entrants)} won`,
  }));

  return (
    <div className="mt-6 grid animate-rise gap-5">
      {o.won ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fcb to-fcb-600 p-6 text-white shadow-[0_30px_60px_-30px_rgb(220_5_45/0.9)]">
          <div
            aria-hidden
            className="absolute top-0 right-28 bottom-0 border-r-2 border-dashed border-white/35"
          />
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase opacity-90">
                <Ticket className="size-4" aria-hidden /> You’re in
              </p>
              <p className="display mt-2 text-4xl leading-none font-bold">
                FC Bayern vs {fixtureLabel}
              </p>
              <p className="mt-2 text-sm opacity-90">
                {formatMatchDate(kickoff)} · {clockAt(kickoff, 0)} ·{' '}
                {o.groupSize > 1 ? `${o.groupSize} seats together` : '1 seat'} · face value
              </p>
            </div>
            <div className="w-20 shrink-0 text-right">
              <p className="text-[10px] tracking-widest uppercase opacity-80">Draw #</p>
              <p className="display tabular text-2xl font-bold">{fmtInt(o.rank)}</p>
            </div>
          </div>
          <p className="mt-5 text-sm">
            Pechvogel {draw.pechvogelBefore} → {draw.pechvogelAfter}. The next long-suffering fan
            moves up.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line-strong bg-ink-800 p-6">
          <p className="text-xs font-semibold tracking-widest text-fg-3 uppercase">Not this time</p>
          <p className="display mt-2 text-4xl leading-none font-bold text-fg">
            Waitlist #{fmtInt(o.waitlistPosition ?? 0)}
          </p>
          <p className="mt-3 max-w-2xl text-sm text-fg-2">
            Draw position {fmtInt(o.rank)} of {fmtInt(draw.entrants)}. If a season-ticket holder
            releases a seat, <strong>Kein Platz bleibt leer</strong> offers it in this order.
            Pechvogel {draw.pechvogelBefore} → {draw.pechvogelAfter}, weight →{' '}
            {draw.weightAfter.toFixed(2)}× for every future draw.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Applications" value={fmtInt(draw.entrants)} />
        <Stat label="Seats drawn" value={fmtInt(draw.seatsAllocated)} />
        <Stat
          label="Your chance"
          value={fmtOneIn(draw.probability)}
          sub={fmtPct(draw.probability, 1)}
          tone="teal"
        />
        <Stat label="Draw time" value={`${draw.durationMs} ms`} sub="server, full size" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border hairline bg-ink-900/50 p-4">
          <p className="text-sm font-semibold text-fg">Published win rate by Pechvogel counter</p>
          <p className="mb-3 text-xs text-fg-3">Proof that loyalty works — on this very draw.</p>
          <ColumnChart
            title="Win rate by Pechvogel counter"
            data={columns}
            format={(v) => fmtPct(v, v < 0.1 ? 1 : 0)}
            highlightKey={String(Math.min(member.pechvogel, 10))}
          />
        </div>
        <div className="rounded-2xl border hairline bg-ink-900/50 p-4">
          <p className="text-sm font-semibold text-fg">Verify it yourself</p>
          <dl className="mt-3 space-y-2 text-xs">
            <div>
              <dt className="text-fg-3">Revealed seed</dt>
              <dd>
                <Mono>{draw.seed}</Mono>
              </dd>
            </div>
            <div>
              <dt className="text-fg-3">Your pseudonymous entry</dt>
              <dd>
                <Mono>{o.id}</Mono> · weight {o.weight.toFixed(2)} · race time {o.key.toFixed(6)}
              </dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setVerified(verifyEntry(draw.seed, draw.commitment, o))}
          >
            <Fingerprint className="size-3.5" aria-hidden /> Verify in my browser
          </Button>
          {verified && (
            <ul className="mt-3 space-y-1.5 text-xs" aria-live="polite">
              <li
                className={verified.commitmentValid ? 'flex gap-2 text-ok' : 'flex gap-2 text-bad'}
              >
                <CheckCircle2 className="size-4 shrink-0" aria-hidden /> SHA-256(seed){' '}
                {verified.commitmentValid ? 'matches' : 'does NOT match'} the published commitment
              </li>
              <li className={verified.keyValid ? 'flex gap-2 text-ok' : 'flex gap-2 text-bad'}>
                <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Your race time −ln(u)/w
                recomputed: {verified.recomputedKey.toFixed(6)}
              </li>
            </ul>
          )}
        </div>
      </div>

      <LetterPanel
        draw={draw}
        defaultLang={
          (['en', 'de', 'es', 'ko', 'tr'].includes(member.language)
            ? member.language
            : 'en') as Lang
        }
      />
    </div>
  );
}

function LetterPanel({ draw, defaultLang }: { draw: DrawResponse; defaultLang: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [letter, setLetter] = useState<AiPayload<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    const ctrl = new AbortController();
    postJson<AiPayload<string>>(
      '/api/ai/ballot-letter',
      { drawId: draw.drawId, fixtureId: draw.fixtureId, memberId: draw.memberId, language: lang },
      ctrl.signal,
    )
      .then((res) => {
        if (id !== req.current) return;
        setLetter(res);
        setError(null);
      })
      .catch((e) => {
        if (id === req.current && !(e instanceof DOMException)) setError(errorMessage(e));
      })
      .finally(() => {
        if (id === req.current) setLoading(false);
      });
    return () => ctrl.abort();
  }, [draw, lang]);

  return (
    <section
      aria-labelledby="letter-title"
      className="rounded-2xl border hairline bg-ink-900/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="letter-title" className="text-sm font-semibold text-fg">
            Your result letter
          </h3>
          <p className="text-xs text-fg-3">
            Gemini writes it in the member’s language — only from the draw’s facts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {letter && !loading && (
            <AiBadge
              source={letter.source}
              model={letter.model}
              latencyMs={letter.latencyMs}
              note={letter.note}
            />
          )}
          <Segmented<Lang>
            label="Letter language"
            size="sm"
            value={lang}
            onChange={(v) => {
              setLoading(true);
              setLang(v);
            }}
            options={LANGS}
          />
        </div>
      </div>
      <article className="relative mt-4 rounded-xl border-t-4 border-fcb bg-[#f7f5f0] px-6 py-5 text-[15px] leading-relaxed text-[#1d2230] shadow-inner">
        {loading ? (
          <div className="space-y-2 py-2" aria-busy="true">
            <TypingDots label="Writing your letter" />
            <div className="h-3 w-3/4 rounded bg-black/10" />
            <div className="h-3 w-5/6 rounded bg-black/10" />
            <div className="h-3 w-2/3 rounded bg-black/10" />
          </div>
        ) : error ? (
          <p role="alert" className="text-[#a3122f]">
            {error}
          </p>
        ) : (
          <p className="whitespace-pre-line">{letter?.value}</p>
        )}
        {!loading && letter && letter.source !== 'gemini' && lang !== 'en' && lang !== 'de' && (
          <p className="mt-3 text-xs text-[#5a6070]">
            <Badge tone="neutral" className="bg-black/5 text-[#5a6070] ring-black/10">
              Demo templates cover EN/DE — with a Gemini key the letter arrives in{' '}
              {lang.toUpperCase()}.
            </Badge>
          </p>
        )}
      </article>
    </section>
  );
}
