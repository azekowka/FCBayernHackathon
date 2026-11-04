import type { BallotLetterFacts } from '@fcb/core';
import { demoLanguage, languageName } from '../guard';
import type { AiContext, AiResult } from '../llm';
import { groundedText, pickVariant, runSkill } from '../run';

/**
 * "Losglück mit System" result letter: turns the verifiable draw outcome into a
 * warm, plain-language letter in the member's language.
 */

export interface LetterFacts extends BallotLetterFacts {
  probabilityPercent: number;
  seedShort: string;
  commitmentShort: string;
}

export function letterFacts(f: BallotLetterFacts): LetterFacts {
  return {
    ...f,
    probabilityPercent: Math.round(f.probabilityBefore * 1000) / 10,
    seedShort: f.seed.slice(-12),
    commitmentShort: f.commitment.slice(0, 12),
  };
}

const SYSTEM = [
  'You write result letters for FC Bayern München members after the ticket ballot ("Losglück mit System").',
  'Voice: warm, honest, respectful, a little Bavarian charm ("Servus"), never salesy. Short paragraphs, no headings, no markdown, no emoji.',
  'Use ONLY the facts in <facts>. Never invent numbers, odds, names, prices, dates or promises. Round percentages to at most one decimal.',
  'Structure: greeting with first name; the outcome; why (applications vs seats, their chance, their draw position, loyalty weight);',
  'what changes now (Pechvogel counter and weight; if they lost and have a waitlist position, explain that a released seat may be offered in the app);',
  'their best next chances (if provided); one line on how to verify the draw (seed vs. published SHA-256 commitment, quote the short forms).',
  '110–170 words.',
].join('\n');

function fmt(n: number, lang: 'de' | 'en'): string {
  return n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB');
}

function pct(f: LetterFacts, lang: 'de' | 'en'): string {
  return lang === 'de'
    ? String(f.probabilityPercent).replace('.', ',')
    : String(f.probabilityPercent);
}

export function ballotLetterTemplate(f: LetterFacts, lang: 'de' | 'en'): string {
  const n = (x: number) => fmt(x, lang);
  const group = f.groupSize > 1;
  if (lang === 'de') {
    if (f.won) {
      return [
        `Servus ${f.firstName},`,
        `${pickVariant(f.seed, ['es hat geklappt', 'gute Nachrichten', 'heute ist dein Tag'])}: Deine Bewerbung für ${f.fixture} (${f.kickoff}) war erfolgreich${group ? ` — alle ${f.groupSize} Plätze gehören euch, zusammen` : ''}!`,
        `So lief die Ziehung: ${n(f.entrants)} Bewerbungen für ${n(f.seatsAvailable)} Plätze. Mit deinem Treuegewicht von ${f.weightBefore} lag deine Chance bei ${pct(f, 'de')} % (etwa 1 zu ${f.oneInBefore}), und das Los hat dich auf Position ${n(f.drawPosition)} gesetzt.`,
        `Dein Pechvogel-Zähler springt von ${f.pechvogelBefore} auf ${f.pechvogelAfter} — damit kommen beim nächsten Mal die dran, die am längsten warten.`,
        `Selbst prüfen: Der Seed …${f.seedShort} passt zum SHA-256-Commitment ${f.commitmentShort}…, das wir vor Bewerbungsschluss veröffentlicht haben.`,
        `Mia san mia — wir sehen uns in der Arena!`,
      ].join('\n\n');
    }
    const next = f.nextBest
      .map((x) => `${x.fixture} (${x.kickoff}): etwa 1 zu ${x.oneIn}`)
      .join('; ');
    return [
      `Servus ${f.firstName},`,
      `diesmal hat das Los für ${f.fixture} (${f.kickoff}) leider nicht für dich entschieden. Das ist bitter — ${n(f.entrants)} Bewerbungen kamen auf ${n(f.seatsAvailable)} Plätze.`,
      `Deine Chance lag bei ${pct(f, 'de')} % (etwa 1 zu ${f.oneInBefore}); deine Bewerbung landete auf Position ${n(f.drawPosition)}.${f.waitlistPosition ? ` Du stehst auf Platz ${n(f.waitlistPosition)} der Warteliste: Gibt ein Dauerkarteninhaber seinen Platz frei, bietet dir „Kein Platz bleibt leer" ihn direkt in der App an.` : ''}`,
      `Was sich ändert: Dein Pechvogel-Zähler steigt von ${f.pechvogelBefore} auf ${f.pechvogelAfter}, dein Gewicht von ${f.weightBefore} auf ${f.weightAfter} — für jede kommende Ziehung.`,
      next ? `Deine besten nächsten Chancen: ${next}.` : '',
      `Selbst prüfen: Der Seed …${f.seedShort} passt zum SHA-256-Commitment ${f.commitmentShort}…, veröffentlicht vor Bewerbungsschluss.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  if (f.won) {
    return [
      `Servus ${f.firstName},`,
      `${pickVariant(f.seed, ['great news', 'it worked', "today's your day"])} — your application for ${f.fixture} (${f.kickoff}) was successful${group ? `, and all ${f.groupSize} seats are yours, together` : ''}!`,
      `How it happened: ${n(f.entrants)} applications competed for ${n(f.seatsAvailable)} seats. Your loyalty weight of ${f.weightBefore} gave you a ${pct(f, 'en')}% chance (about 1 in ${f.oneInBefore}), and the draw placed you at position ${n(f.drawPosition)}.`,
      `Your Pechvogel counter goes from ${f.pechvogelBefore} back to ${f.pechvogelAfter}, so the fans who have waited longest get their turn next.`,
      `Check it yourself: seed …${f.seedShort} matches the SHA-256 commitment ${f.commitmentShort}… we published before the ballot closed.`,
      `Mia san mia — see you in the Arena!`,
    ].join('\n\n');
  }
  const next = f.nextBest
    .map((x) => `${x.fixture} (${x.kickoff}): about 1 in ${x.oneIn}`)
    .join('; ');
  return [
    `Servus ${f.firstName},`,
    `this time the draw for ${f.fixture} (${f.kickoff}) didn't go your way. We know that stings — ${n(f.entrants)} applications competed for ${n(f.seatsAvailable)} seats.`,
    `Your chance was ${pct(f, 'en')}% (about 1 in ${f.oneInBefore}); your entry landed at draw position ${n(f.drawPosition)}.${f.waitlistPosition ? ` You're #${n(f.waitlistPosition)} on the waitlist: if a season-ticket holder releases a seat, Kein Platz bleibt leer will offer it to you in the app.` : ''}`,
    `What changes: your Pechvogel counter rises from ${f.pechvogelBefore} to ${f.pechvogelAfter}, lifting your weight from ${f.weightBefore} to ${f.weightAfter} for every future draw.`,
    next ? `Your best next chances: ${next}.` : '',
    `Verify the draw yourself: seed …${f.seedShort} matches the SHA-256 commitment ${f.commitmentShort}… published before the ballot closed.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function writeBallotLetter(
  ctx: AiContext,
  input: { facts: BallotLetterFacts; language?: string },
): Promise<AiResult<string>> {
  const language = input.language ?? input.facts.language;
  const facts = letterFacts(input.facts);
  // Full seed/commitment stay out of the prompt; the short forms are enough to quote.
  const { seed: _seed, commitment: _commitment, ...promptFacts } = facts;
  void _seed;
  void _commitment;
  const prompt = `Write the letter in ${languageName(language)}.\n<facts>\n${JSON.stringify(promptFacts, null, 1)}\n</facts>`;
  return runSkill(
    ctx,
    (llm) =>
      groundedText(llm, { system: SYSTEM, prompt, temperature: 0.7, maxOutputTokens: 1500 }, facts),
    () => ballotLetterTemplate(facts, demoLanguage(language)),
  );
}
