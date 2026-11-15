'use client';

import { clockAt, formatMatchDate, getFixture, verifyEntry, type MemberProfile } from '@fcb/core';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Dices,
  Fingerprint,
  Lock,
  RotateCcw,
  Ticket,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { AiBadge, TypingDots } from '@/components/ui/AiBadge';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Segmented, SelectField } from '@/components/ui/controls';
import { Badge, Button, Mono, Panel, Stat } from '@/components/ui/primitives';
import { errorMessage, postJson } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
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
const DATE_TAG = { en: 'en-GB', de: 'de-DE' } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function Stepper({ phase, labels }: { phase: Phase; labels: string[] }) {
  const step = phase === 'idle' || phase === 'committing' ? 0 : phase === 'done' ? 2 : 1;
  return (
    <ol className="flex items-center gap-2" aria-hidden>
      {labels.map((l, i) => {
        const done = i < step || (i === 2 && phase === 'done');
        const current = i === step && phase !== 'done';
        return (
          <li key={l} className="flex items-center gap-2">
            {i > 0 && (
              <span className="h-px w-5 overflow-hidden bg-line-strong sm:w-8">
                <span
                  className="block h-full origin-left bg-fcb transition-transform duration-500 ease-[var(--ease-out)]"
                  style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
                />
              </span>
            )}
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium transition-colors duration-200',
                done || current ? 'text-fg' : 'text-fg-3',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-200',
                  done
                    ? 'bg-fcb text-white'
                    : current
                      ? 'bg-fcb/15 text-bad ring-1 ring-fcb/40'
                      : 'bg-ink-750 text-fg-3',
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{l}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DrawPanel({
  member,
  candidateIds,
}: {
  member: MemberProfile;
  candidateIds: string[];
}) {
  const t = useT();
  const f = useFormat();
  const { locale } = useLocale();
  const td = t.ballot.draw;
  const [fixtureId, setFixtureId] = useState(candidateIds[0] ?? '');
  const activeFixtureId = candidateIds.includes(fixtureId) ? fixtureId : (candidateIds[0] ?? '');
  const fixture = activeFixtureId ? getFixture(activeFixtureId) : null;
  const [phase, setPhase] = useState<Phase>('idle');
  const [commit, setCommit] = useState<CommitResponse | null>(null);
  const [draw, setDraw] = useState<DrawResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        new Promise((r) => setTimeout(r, 1300)),
      ]);
      setDraw(res);
      setPhase('done');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('committed');
    }
  };

  const copyCommitment = async () => {
    if (!commit) return;
    try {
      await navigator.clipboard.writeText(commit.commitment);
      toast.success(td.copied, { description: td.copiedSub });
    } catch {
      /* Clipboard can be blocked (permissions, insecure origin) — nothing to undo. */
    }
  };

  return (
    <Panel
      id="draw"
      title={
        <span className="inline-flex items-center gap-2">
          <Dices className="size-4 text-bad" aria-hidden /> {td.title}
        </span>
      }
      subtitle={td.sub}
      actions={
        <div className="flex items-center gap-3">
          <Stepper phase={phase} labels={td.steps} />
          {phase !== 'idle' && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" aria-hidden /> {td.newDraw}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <SelectField
          label={td.match}
          value={activeFixtureId}
          onChange={(e) => {
            setFixtureId(e.target.value);
            reset();
          }}
          disabled={phase === 'committing' || phase === 'drawing'}
        >
          {candidateIds.map((id) => {
            const fx = getFixture(id);
            return (
              <option key={id} value={id}>
                {fx.opponent} — {formatMatchDate(fx.kickoff, DATE_TAG[locale])}
              </option>
            );
          })}
        </SelectField>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={doCommit}
            disabled={phase !== 'idle' || !fixture}
            variant={phase === 'idle' || phase === 'committing' ? 'primary' : 'secondary'}
          >
            {phase === 'committing' ? (
              <TypingDots label={t.common.thinking} />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}{' '}
            {td.commit}
          </Button>
          <Button
            onClick={doDraw}
            disabled={phase !== 'committed'}
            variant={phase === 'committed' || phase === 'drawing' ? 'primary' : 'secondary'}
          >
            <Dices className="size-4" aria-hidden /> {td.run}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 flex animate-pop items-center gap-2 rounded-xl bg-fcb/10 px-3 py-2 text-sm text-bad ring-1 ring-fcb/25 ring-inset"
        >
          <AlertTriangle className="size-4" aria-hidden /> {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {commit && (
          <motion.div
            key="commit"
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="mt-5 rounded-2xl bg-ink-800 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-medium text-fg-3">
                <Fingerprint className="size-3.5 text-bad" aria-hidden /> {td.committed}
              </p>
              <button
                type="button"
                onClick={copyCommitment}
                className="press -m-1 rounded-lg p-1.5 text-fg-3 hover:bg-ink-700 hover:text-fg"
                aria-label={td.copy}
                title={td.copy}
              >
                <Copy className="size-3.5" aria-hidden />
              </button>
            </div>
            <Mono className="mt-2 block text-fg">{commit.commitment}</Mono>
            <p className="mt-2 text-xs text-fg-3">
              {td.seatsExpected(f.int(commit.seats), f.int(commit.expectedEntrants))}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'drawing' && commit && (
        <div
          role="status"
          className="relative mt-5 animate-pop overflow-hidden rounded-2xl bg-fg p-8 text-center text-inverse"
        >
          <div
            aria-hidden
            className="absolute inset-0 animate-[shimmer_1.2s_linear_infinite] bg-[linear-gradient(110deg,transparent_30%,rgb(220_5_45/0.25)_50%,transparent_70%)] bg-[length:200%_100%]"
          />
          <p className="relative text-sm opacity-75">{td.drawing}</p>
          <p className="display relative mt-2 text-6xl">
            <DrawCounter target={commit.expectedEntrants} />
          </p>
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

/** Rolls from 0 to the number of applications once mounted. */
function DrawCounter({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return <AnimatedNumber value={value} />;
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
  const t = useT();
  const f = useFormat();
  const { locale } = useLocale();
  const td = t.ballot.draw;
  const [verified, setVerified] = useState<ReturnType<typeof verifyEntry> | null>(null);
  const o = draw.outcome;
  const columns = draw.winRateByPechvogel.map((s) => {
    const label = s.pechvogel === 10 ? '10+' : String(s.pechvogel);
    return {
      key: String(s.pechvogel),
      label,
      value: s.rate,
      detail: td.chartDetail(label, f.int(s.winners), f.int(s.entrants)),
    };
  });

  return (
    <div className="mt-6 grid gap-5">
      {o.won ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', duration: 0.6, bounce: 0.25 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fcb to-fcb-700 text-white shadow-[0_30px_60px_-30px_rgb(220_5_45/0.9)]"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(70%_100%_at_100%_0%,rgb(255_255_255/0.2),transparent_60%)]"
          />
          <div className="relative grid grid-cols-[1fr_auto]">
            <div className="p-6">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase opacity-90">
                <Ticket className="size-4" aria-hidden /> {td.youreIn}
              </p>
              <p className="display mt-3 text-3xl leading-none md:text-4xl">
                FC Bayern vs {fixtureLabel}
              </p>
              <p className="mt-3 text-sm opacity-90">
                {formatMatchDate(kickoff, DATE_TAG[locale])} · {clockAt(kickoff, 0)} ·{' '}
                {td.seatsTogether(o.groupSize)} · {td.faceValue}
              </p>
              <p className="mt-5 text-sm">
                {td.pechvogelWin(draw.pechvogelBefore, draw.pechvogelAfter)}
              </p>
            </div>
            {/* Perforated stub. */}
            <div className="relative flex w-24 flex-col items-center justify-center border-l-2 border-dashed border-white/35 p-4 text-center md:w-28">
              <span
                aria-hidden
                className="absolute -top-3 -left-3 size-6 rounded-full bg-ink-850"
              />
              <span
                aria-hidden
                className="absolute -bottom-3 -left-3 size-6 rounded-full bg-ink-850"
              />
              <p className="text-[10px] tracking-widest uppercase opacity-80">{td.drawNo}</p>
              <p className="display tabular mt-1 text-2xl">{f.int(o.rank)}</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="rounded-2xl bg-ink-800 p-6 ring-1 ring-line ring-inset"
        >
          <p className="text-xs font-semibold tracking-widest text-fg-3 uppercase">
            {td.notThisTime}
          </p>
          <p className="display mt-2 text-4xl leading-none text-fg">
            {td.waitlist(f.int(o.waitlistPosition ?? 0))}
          </p>
          <p className="mt-3 max-w-2xl text-sm text-fg-2">
            {td.lossBody(
              f.int(o.rank),
              f.int(draw.entrants),
              draw.pechvogelBefore,
              draw.pechvogelAfter,
              f.dec(draw.weightAfter, 2),
            )}
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={td.applications} value={f.int(draw.entrants)} />
        <Stat label={td.seatsDrawn} value={f.int(draw.seatsAllocated)} />
        <Stat
          label={td.yourChance}
          value={f.oneIn(draw.probability)}
          sub={f.pct(draw.probability, 1)}
          tone="red"
        />
        <Stat label={td.drawTime} value={`${draw.durationMs} ms`} sub={td.serverFull} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-ink-800 p-4 md:p-5">
          <p className="text-sm font-semibold text-fg">{td.chartTitle}</p>
          <p className="mb-3 text-xs text-fg-3">{td.chartSub}</p>
          <ColumnChart
            title={td.chartTitle}
            data={columns}
            format={(v) => f.pct(v, v < 0.1 ? 1 : 0)}
            highlightKey={String(Math.min(member.pechvogel, 10))}
          />
        </div>
        <div className="rounded-2xl bg-ink-800 p-4 md:p-5">
          <p className="text-sm font-semibold text-fg">{td.verifyTitle}</p>
          <dl className="mt-3 space-y-3 text-xs">
            <div>
              <dt className="text-fg-3">{td.seed}</dt>
              <dd className="mt-0.5">
                <Mono>{draw.seed}</Mono>
              </dd>
            </div>
            <div>
              <dt className="text-fg-3">{td.entry}</dt>
              <dd className="mt-0.5 text-fg-2">
                <Mono>{o.id}</Mono> · {td.weight} {f.dec(o.weight, 2)} · {td.raceTime}{' '}
                <span className="tabular">{o.key.toFixed(6)}</span>
              </dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setVerified(verifyEntry(draw.seed, draw.commitment, o))}
          >
            <Fingerprint className="size-3.5" aria-hidden /> {td.verify}
          </Button>
          {verified && (
            <ul className="mt-3 space-y-1.5 text-xs" aria-live="polite">
              {[
                {
                  ok: verified.commitmentValid,
                  text: verified.commitmentValid ? td.commitOk : td.commitBad,
                },
                { ok: verified.keyValid, text: td.keyOk(verified.recomputedKey.toFixed(6)) },
              ].map((row, i) => (
                <li
                  key={row.text}
                  className={cn('flex animate-rise gap-2', row.ok ? 'text-ok' : 'text-bad')}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {row.ok ? (
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <XCircle className="size-4 shrink-0" aria-hidden />
                  )}
                  {row.text}
                </li>
              ))}
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
  const t = useT();
  const td = t.ballot.draw;
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
    <section aria-labelledby="letter-title" className="rounded-2xl bg-ink-800 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="letter-title" className="text-sm font-semibold text-fg">
            {td.letterTitle}
          </h3>
          <p className="text-xs text-fg-3">{td.letterSub}</p>
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
            label={td.letterLang}
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
      <article className="relative mt-4 overflow-hidden rounded-xl bg-[#fbfaf7] px-6 py-6 text-[15px] leading-relaxed text-[#1d2230] shadow-[0_0_0_1px_rgb(10_20_40/0.06),0_12px_32px_-16px_rgb(10_20_40/0.25)] md:px-8">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-fcb" />
        <div
          className={cn(
            'transition-[opacity,filter] duration-200',
            loading && letter ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-0',
          )}
        >
          {loading && !letter ? (
            <div className="space-y-2.5 py-1" aria-busy="true">
              <TypingDots label={td.writing} />
              <div className="h-3 w-3/4 rounded bg-black/[0.07]" />
              <div className="h-3 w-5/6 rounded bg-black/[0.07]" />
              <div className="h-3 w-2/3 rounded bg-black/[0.07]" />
            </div>
          ) : error ? (
            <p role="alert" className="text-[#a3122f]">
              {error}
            </p>
          ) : (
            <p className="whitespace-pre-line" aria-busy={loading}>
              {letter?.value}
            </p>
          )}
        </div>
        {!loading && letter && letter.source !== 'gemini' && lang !== 'en' && lang !== 'de' && (
          <p className="mt-4">
            <Badge tone="neutral" className="bg-black/5 text-[#5a6070] ring-black/10">
              {td.templatesNote(lang.toUpperCase())}
            </Badge>
          </p>
        )}
      </article>
    </section>
  );
}
