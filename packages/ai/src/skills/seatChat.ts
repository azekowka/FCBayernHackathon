import { z } from 'zod';
import {
  DATA_NOT_INSTRUCTIONS,
  demoLanguage,
  languageName,
  sanitizeUserText,
  wrapUserText,
} from '../guard';
import { ungroundedNumbers } from '../grounding';
import { LlmError, type AiContext, type AiResult } from '../llm';
import { groundedText, runSkill, structured } from '../run';

/**
 * "Kein Platz bleibt leer" release assistant. Gemini holds the conversation
 * and classifies intent; the app executes an action only after the fan taps a
 * confirmation button (human in the loop). The model can never release a seat.
 */

export interface SeatChatFacts {
  holderFirstName: string;
  fixture: string;
  kickoffLabel: string;
  seatLabel: string;
  faceValue: number;
  calendarNote: string | null;
  /** Plain-language reasons from the explainable no-show model. */
  reasons: string[];
  status: 'open' | 'released' | 'gifted' | 'kept';
  language: string;
}

export const SEAT_INTENTS = ['release', 'gift', 'keep', 'why', 'question', 'unknown'] as const;
export type SeatIntent = (typeof SEAT_INTENTS)[number];

export interface SeatChatTurn {
  intent: SeatIntent;
  reply: string;
  needsConfirmation: boolean;
}

const QUICK = {
  en: {
    release: 'Release my seat',
    gift: 'Gift to a youth fan club',
    keep: "I'm coming",
    why: 'Why are you asking?',
  },
  de: {
    release: 'Platz freigeben',
    gift: 'An Jugend-Fanclub verschenken',
    keep: 'Ich komme',
    why: 'Warum fragst du?',
  },
} as const;

export function quickReplies(language: string): string[] {
  return Object.values(QUICK[demoLanguage(language)]);
}

const SYSTEM_BASE = [
  'You are the FC Bayern app assistant for "Kein Platz bleibt leer" (no seat stays empty).',
  'You help a season-ticket holder decide what to do with a seat they might not use: release it to the ballot waitlist (face value back, loyalty credit kept),',
  'gift it to a youth fan club, or keep it. Be brief (max 3 sentences), warm, respectful, never pushy or guilt-tripping; accept "I am coming" gracefully.',
  'Never claim an action has happened — actions only happen when the fan taps a confirmation button in the app.',
  'Never mention prices other than the face value in the facts. Never invent numbers. No markdown, no emoji.',
  'If asked why you are asking: explain using the reasons in the facts and that the estimate is computed on the fan’s phone from signals they opted into.',
  DATA_NOT_INSTRUCTIONS,
].join('\n');

function factsBlock(f: SeatChatFacts): string {
  return `<facts>\n${JSON.stringify(f, null, 1)}\n</facts>`;
}

// ── opening nudge ──────────────────────────────────────────────────────────

export function openingNudgeTemplate(f: SeatChatFacts): string {
  const why = f.calendarNote ? f.calendarNote.replace(/\s*\(.*\)\s*$/, '') : (f.reasons[0] ?? '');
  if (demoLanguage(f.language) === 'de') {
    return `Servus ${f.holderFirstName}! ${f.fixture}, ${f.kickoffLabel}${why ? ` — laut deinem Kalender: ${why}` : ''}. Falls du es nicht schaffst, gebe ich deinen Platz (${f.seatLabel}) mit einem Tipp an einen Fan auf der Warteliste weiter. Du behältst deinen Treuebonus und bekommst ${f.faceValue} € zurück. Was möchtest du tun?`;
  }
  return `Servus ${f.holderFirstName}! ${f.fixture}, ${f.kickoffLabel}${why ? ` — your calendar says: ${why}` : ''}. If you can't make it, I can pass your spot (${f.seatLabel}) to a fan on the waitlist in one tap. You keep your loyalty credit and get €${f.faceValue} back. What would you like to do?`;
}

export async function openingNudge(
  ctx: AiContext,
  facts: SeatChatFacts,
): Promise<AiResult<string>> {
  return runSkill(
    ctx,
    (llm) =>
      groundedText(
        llm,
        {
          system: SYSTEM_BASE,
          prompt: `Write the first message of the conversation in ${languageName(facts.language)}: greet the fan, mention the match and why you are checking in (calendar note or top reason), and offer the options.\n${factsBlock(facts)}`,
          temperature: 0.7,
          maxOutputTokens: 600,
        },
        facts,
        600,
      ),
    () => openingNudgeTemplate(facts),
  );
}

// ── intent classification ─────────────────────────────────────────────────

const ATTENDING =
  /\b(i'?m coming|i am coming|i('| wi)ll (be there|come|go)|ich komme|bin dabei|ich bin da|see you (there|saturday)|wir sehen uns)\b/i;
const GIFT = /\b(gift|youth|jugend|junior|kids?|kinder|verschenk\w*|donat\w*|spende\w*|schenk\w*)/i;
/** Unambiguous "I can't come / release it" phrases. */
const RELEASE_STRONG =
  /\b(release|freigeb\w*|frei ?geben|can'?t (make|come|go|attend)|cannot (make|come|attend)|won'?t (make|be able)|kann nicht|schaff\w* (es )?nicht|not coming|nicht (kommen|da)|give (it|my seat) (up|away)|pass (it )?on|weitergeb\w*)\b/i;
/** Refusals and "keep it" — checked before generic agreement words. */
const KEEP = /\b(keep|behalt\w*|no thanks|nein danke|nope|nein|no)\b/i;
/** Generic agreement ("yes", "ok", "bitte") — only means release if nothing else matched. */
const RELEASE_WEAK = /\b(yes|ja|jo|ok(ay)?|sure|passt|do it|mach (es|das)|go ahead|bitte)\b/i;
const WHY = /\b(why|warum|wieso|weshalb|how do you know|woher|privacy|datenschutz|data|daten)\b/i;

export function classifySeatMessage(message: string): SeatIntent {
  const m = sanitizeUserText(message);
  if (!m) return 'unknown';
  if (WHY.test(m)) return 'why';
  if (ATTENDING.test(m)) return 'keep';
  if (GIFT.test(m)) return 'gift';
  if (RELEASE_STRONG.test(m)) return 'release';
  if (KEEP.test(m)) return 'keep';
  if (RELEASE_WEAK.test(m)) return 'release';
  return m.includes('?') ? 'question' : 'unknown';
}

export function seatReplyTemplate(intent: SeatIntent, f: SeatChatFacts): string {
  const de = demoLanguage(f.language) === 'de';
  const reasons = f.reasons.slice(0, 3).join('; ');
  switch (intent) {
    case 'release':
      return de
        ? `Alles klar — tippe auf „Platz freigeben", um zu bestätigen. Dein Platz geht an den nächsten passenden Fan auf der Warteliste, du behältst deinen Treuebonus und bekommst ${f.faceValue} € zurück.`
        : `Got it — tap “Release seat” to confirm. Your spot goes to the next eligible fan on the waitlist; you keep your loyalty credit and get €${f.faceValue} back.`;
    case 'gift':
      return de
        ? `Schöne Idee! Tippe auf „An Jugend-Fanclub verschenken" — dann steht am Spieltag ein junges Mitglied eines Münchner Jugend-Fanclubs auf deinem Platz.`
        : `Lovely idea! Tap “Gift to youth fan club” to confirm — a young member of a Munich youth fan club will be in your spot on matchday.`;
    case 'keep':
      return de
        ? `Perfekt, dann bis ${f.kickoffLabel}! Ich frage für dieses Spiel nicht noch einmal. Deine Anreise plant „Vom Sofa bis zum Sitz".`
        : `Perfect — see you ${f.kickoffLabel}! I won't ask again for this match. Your journey plan is waiting in “Vom Sofa bis zum Sitz”.`;
    case 'why':
      return de
        ? `Gute Frage. Gründe: ${reasons}. Die Schätzung wird auf deinem Handy aus Signalen berechnet, denen du zugestimmt hast — der Verein erfährt nur, ob du freigibst.`
        : `Fair question. My reasons: ${reasons}. The estimate is computed on your phone from signals you opted into — the club only learns whether you choose to release.`;
    default:
      return de
        ? `Ich kann deinen Platz an die Warteliste weitergeben, an einen Jugend-Fanclub verschenken oder für dich reservieren. Was passt dir?`
        : `I can pass your spot to the waitlist, gift it to a youth fan club, or keep it for you. What works for you?`;
  }
}

function demoTurn(message: string, f: SeatChatFacts): SeatChatTurn {
  const intent = classifySeatMessage(message);
  return {
    intent,
    reply: seatReplyTemplate(intent, f),
    needsConfirmation: intent === 'release' || intent === 'gift',
  };
}

const TURN_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: [...SEAT_INTENTS], description: 'What the fan wants.' },
    reply: {
      type: 'string',
      description: 'Your reply to the fan, max 3 sentences, in the requested language.',
    },
  },
  required: ['intent', 'reply'],
} as const;

const TurnZ = z.object({ intent: z.enum(SEAT_INTENTS), reply: z.string().min(1).max(700) });

export async function interpretSeatMessage(
  ctx: AiContext,
  facts: SeatChatFacts,
  message: string,
): Promise<AiResult<SeatChatTurn>> {
  return runSkill(
    ctx,
    async (llm) => {
      const out = await structured(
        llm,
        {
          system: SYSTEM_BASE,
          prompt: [
            `Classify the fan's message and reply in ${languageName(facts.language)}.`,
            'intent: release = wants to give the seat to the waitlist; gift = wants to give it to a youth fan club; keep = is coming / wants to keep it;',
            'why = asks why you are asking or about data; question = any other question; unknown = unclear.',
            'For release/gift: tell them to tap the confirmation button. Do not say it is done.',
            factsBlock(facts),
            wrapUserText(message),
          ].join('\n'),
          temperature: 0.3,
          maxOutputTokens: 800,
          json: { schema: TURN_SCHEMA as unknown as Record<string, unknown> },
        },
        TurnZ,
      );
      const bad = ungroundedNumbers(out.reply, facts);
      if (bad.length) throw new LlmError(`invented numbers: ${bad.join(', ')}`, 'ungrounded');
      return {
        intent: out.intent,
        reply: out.reply,
        needsConfirmation: out.intent === 'release' || out.intent === 'gift',
      };
    },
    () => demoTurn(message, facts),
  );
}

// ── confirmation & offer messages ─────────────────────────────────────────

export interface ReleaseOutcomeFacts {
  holderFirstName: string;
  mode: 'waitlist' | 'youth';
  recipient: { city: string; pechvogel: number; waitlistRank: number } | null;
  faceValue: number;
  language: string;
}

export function releaseConfirmationTemplate(f: ReleaseOutcomeFacts): string {
  const de = demoLanguage(f.language) === 'de';
  if (f.mode === 'youth') {
    return de
      ? `Danke, ${f.holderFirstName}! Dein Platz geht an einen Münchner Jugend-Fanclub. Dein Treuebonus bleibt erhalten.`
      : `Thank you, ${f.holderFirstName}! Your spot is going to a Munich youth fan club. Your loyalty credit stays intact.`;
  }
  if (!f.recipient) {
    return de
      ? `Danke, ${f.holderFirstName}! Dein Platz ist freigegeben — ich suche den nächsten passenden Fan. Die ${f.faceValue} € bekommst du, sobald er besetzt ist.`
      : `Thank you, ${f.holderFirstName}! Your spot is released — I'm finding the next eligible fan. You'll get €${f.faceValue} back once it's taken.`;
  }
  return de
    ? `Danke, ${f.holderFirstName}! Ein Mitglied aus ${f.recipient.city}, das ${f.recipient.pechvogel}-mal leer ausgegangen ist, hat gerade das Angebot für deinen Platz bekommen. Treuebonus bleibt, ${f.faceValue} € kommen zurück, sobald angenommen.`
    : `Thank you, ${f.holderFirstName}! A member from ${f.recipient.city} who missed out ${f.recipient.pechvogel} times just got the offer for your spot. Your loyalty credit stays, and €${f.faceValue} comes back once they accept.`;
}

export interface OfferFacts {
  fanFirstName: string;
  fixture: string;
  kickoffLabel: string;
  seatLabel: string;
  faceValue: number;
  minutesToAccept: number;
  drawPosition: number;
  pechvogel: number;
  language: string;
}

export function offerMessageTemplate(f: OfferFacts): string {
  if (demoLanguage(f.language) === 'de') {
    return `${f.fanFirstName}, dein Warten zahlt sich aus! Für ${f.fixture} (${f.kickoffLabel}) ist ein Platz frei geworden: ${f.seatLabel}, ${f.faceValue} € zum Nennwert. Du bist dran, weil du der nächste passende Fan auf der Warteliste bist (Ziehungsposition ${f.drawPosition.toLocaleString('de-DE')}). Du hast ${f.minutesToAccept} Minuten zum Annehmen.`;
  }
  return `${f.fanFirstName}, your patience pays off! A spot just opened up for ${f.fixture} (${f.kickoffLabel}): ${f.seatLabel}, €${f.faceValue} at face value. It's yours because you're the next eligible fan on the waitlist (draw position ${f.drawPosition.toLocaleString('en-GB')}). You have ${f.minutesToAccept} minutes to accept.`;
}

export async function offerMessage(ctx: AiContext, facts: OfferFacts): Promise<AiResult<string>> {
  return runSkill(
    ctx,
    (llm) =>
      groundedText(
        llm,
        {
          system: [
            'You write push-notification style messages in the FC Bayern app when a released seat is offered to a fan on the waitlist.',
            'Joyful but factual, max 3 sentences, no emoji, no markdown. Mention match, seat, face value, why they are next (draw position) and the time to accept.',
            'Use only the facts. Never invent numbers.',
          ].join('\n'),
          prompt: `Language: ${languageName(facts.language)}.\n<facts>\n${JSON.stringify(facts, null, 1)}\n</facts>`,
          temperature: 0.7,
          maxOutputTokens: 500,
        },
        facts,
        500,
      ),
    () => offerMessageTemplate(facts),
  );
}
