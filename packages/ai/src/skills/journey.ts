import type { JourneyFacts, Mode, PostMatchPreference } from '@fcb/core';
import { z } from 'zod';
import {
  DATA_NOT_INSTRUCTIONS,
  demoLanguage,
  languageName,
  sanitizeUserText,
  wrapUserText,
} from '../guard';
import type { AiContext, AiResult } from '../llm';
import { groundedText, runSkill, structured } from '../run';

/**
 * "Vom Sofa bis zum Sitz" — Gemini turns free text into planner inputs,
 * narrates the deterministic plan, and answers follow-up questions about it.
 */

export interface JourneyIntent {
  originId: string | null;
  mode: Mode | null;
  blockId: string | null;
  withKids: boolean | null;
  wantsFood: boolean | null;
  stepFree: boolean | null;
  seatedBy: number | null;
  postMatch: PostMatchPreference | null;
}

export interface OriginOption {
  id: string;
  label: string;
  keywords: readonly string[];
}

const MODES: readonly Mode[] = ['ubahn', 'bike', 'car', 'fanbus', 'walk'];

const MODE_PATTERNS: [Mode, RegExp][] = [
  ['bike', /\b(bike|bicycle|cycl\w*|rad|fahrrad|radl)\b/i],
  ['fanbus', /\b(fan ?-?club ?bus|fanbus|coach|bus)\b/i],
  ['car', /\b(car|auto|drive|driving|fahre? mit dem auto|parking|parken|p\+r)\b/i],
  ['walk', /\b(walk|on foot|zu fu(ß|ss)|laufen)\b/i],
  ['ubahn', /\b(u-?bahn|u6|subway|metro|tube|train|zug|öffis?|public transport|mvg|s-?bahn)\b/i],
];

export function parseJourneyTextDemo(
  text: string,
  origins: readonly OriginOption[],
): JourneyIntent {
  const t = sanitizeUserText(text).toLowerCase();
  const origin = origins.find((o) => o.keywords.some((k) => t.includes(k.toLowerCase())));
  const mode = MODE_PATTERNS.find(([, re]) => re.test(t))?.[0] ?? null;
  const block = /\bblock\s*(\d{3})\b/i.exec(t)?.[1] ?? null;
  const yes = (re: RegExp) => (re.test(t) ? true : null);
  const noFood = /\b(no food|already (ate|eaten)|schon gegessen|kein essen)\b/i.test(t);
  return {
    originId: origin?.id ?? null,
    mode,
    blockId: block,
    withKids: yes(
      /\b(kids?|child(ren)?|son|daughter|kind(er)?|sohn|tochter|family|familie|nephew|niece)\b/i,
    ),
    wantsFood: noFood
      ? false
      : yes(/\b(eat|food|hungry|bratwurst|wurst|weißwurst|brezn|essen|hunger|beer|bier|snack)\b/i),
    stepFree: yes(
      /\b(wheelchair|rollstuhl|stroller|pram|kinderwagen|step-?free|barrierefrei|crutches|krücken|mobility)\b/i,
    ),
    seatedBy: /\b(choreo|atmosphere|early|früh|stimmung|warm[- ]?up|tifo)\b/i.test(t)
      ? 35
      : /\b(last minute|just in time|knapp|late)\b/i.test(t)
        ? 10
        : null,
    postMatch:
      /\b(asap|quick(ly)? home|straight home|schnell (nach )?(hause|heim)|right after|sofort)\b/i.test(
        t,
      )
        ? 'asap'
        : /\b(no rush|relaxed|stay|bleiben|celebrate|feiern|chill)\b/i.test(t)
          ? 'relaxed'
          : null,
  };
}

const TRI = z.enum(['yes', 'no', 'unknown']);
const toBool = (v: z.infer<typeof TRI>) => (v === 'unknown' ? null : v === 'yes');

export async function parseJourneyRequest(
  ctx: AiContext,
  text: string,
  origins: readonly OriginOption[],
): Promise<AiResult<JourneyIntent>> {
  const ids = origins.map((o) => o.id);
  const schema = {
    type: 'object',
    properties: {
      originId: { type: 'string', enum: [...ids, 'unknown'] },
      mode: { type: 'string', enum: [...MODES, 'unknown'] },
      blockId: { type: 'string', description: 'Three-digit block number, or empty string' },
      withKids: { type: 'string', enum: ['yes', 'no', 'unknown'] },
      wantsFood: { type: 'string', enum: ['yes', 'no', 'unknown'] },
      stepFree: { type: 'string', enum: ['yes', 'no', 'unknown'] },
      seatedBy: {
        type: 'integer',
        description: 'Minutes before kick-off they want to be seated; 0 if not said',
      },
      postMatch: { type: 'string', enum: ['asap', 'relaxed', 'auto', 'unknown'] },
    },
    required: [
      'originId',
      'mode',
      'blockId',
      'withKids',
      'wantsFood',
      'stepFree',
      'seatedBy',
      'postMatch',
    ],
  };
  const Z = z.object({
    originId: z.string(),
    mode: z.string(),
    blockId: z.string(),
    withKids: TRI,
    wantsFood: TRI,
    stepFree: TRI,
    seatedBy: z.number().int(),
    postMatch: z.enum(['asap', 'relaxed', 'auto', 'unknown']),
  });
  return runSkill(
    ctx,
    async (llm) => {
      const out = await structured(
        llm,
        {
          system: [
            'You extract matchday travel preferences for a fan going to the Allianz Arena.',
            `Known start points (id: label): ${origins.map((o) => `${o.id}: ${o.label}`).join('; ')}.`,
            'Map the fan’s start to the closest known start point, or "unknown". Choreo / atmosphere means seated about 35 minutes early.',
            DATA_NOT_INSTRUCTIONS,
          ].join('\n'),
          prompt: wrapUserText(text),
          temperature: 0,
          maxOutputTokens: 600,
          json: { schema },
        },
        Z,
      );
      return {
        originId: ids.includes(out.originId) ? out.originId : null,
        mode: (MODES as readonly string[]).includes(out.mode) ? (out.mode as Mode) : null,
        blockId: /^\d{3}$/.test(out.blockId) ? out.blockId : null,
        withKids: toBool(out.withKids),
        wantsFood: toBool(out.wantsFood),
        stepFree: toBool(out.stepFree),
        seatedBy: out.seatedBy > 0 && out.seatedBy <= 120 ? out.seatedBy : null,
        postMatch: out.postMatch === 'unknown' ? null : out.postMatch,
      };
    },
    () => parseJourneyTextDemo(text, origins),
  );
}

// ── narration ──────────────────────────────────────────────────────────────

const CROWD_DE: Record<string, string> = {
  calm: 'entspannt',
  busy: 'gut gefüllt',
  packed: 'voll',
  crush: 'sehr voll',
};

export function narrateTemplate(f: JourneyFacts, language: string): string {
  const de = demoLanguage(language) === 'de';
  const p = f.postMatch;
  const parts: string[] = [];
  if (f.switchedFrom || f.alerts.length) {
    parts.push(
      de
        ? `Achtung: ${f.alerts[0] ?? 'Änderung im Netz'}. ${f.switchedFrom ? `Ich habe auf ${f.mode} umgeplant.` : 'Ich habe das eingeplant.'}`
        : `Heads-up: ${f.alerts[0] ?? 'network change'}. ${f.switchedFrom ? `I've re-planned your trip via ${f.mode}.` : "I've planned around it."}`,
    );
  }
  if (de) {
    parts.push(
      `Los geht's um ${f.departClock} ab ${f.origin} mit ${f.mode}${f.crowd ? ` — die Bahn ist dann ${CROWD_DE[f.crowd] ?? f.crowd}${f.crowdWaitMinutes > 0 ? `, rechne mit ${f.crowdWaitMinutes} Min. Wartezeit am Bahnsteig` : ''}` : ''}.`,
      `Am ${f.entrance} wartest du etwa ${f.gateQueueMinutes} Min.${f.kiosk ? ` Essen holst du am besten bei ${f.kiosk.label} (ca. ${f.kiosk.queueMinutes} Min. statt ${f.kiosk.nearestQueueMinutes} am nächstgelegenen Stand).` : ''} Um ${f.seatedClock} bist du am Platz, Anpfiff ist um ${f.kickoffClock}.`,
      p.stayMinutes > 0
        ? `Nach dem Abpfiff: Bleib ${p.stayMinutes} Minuten — die Schlange in Fröttmaning schrumpft von ca. ${p.queueIfLeavingNow} auf ${p.queueMinutes} Min., und du bist trotzdem um ${p.homeClock} zurück.`
        : `Nach dem Abpfiff geht's direkt heim — Ankunft gegen ${p.homeClock}.`,
      `Dafür gibt's ${f.greenPoints} grüne Punkte${f.co2SavedKg > 0 ? ` und ${String(f.co2SavedKg).replace('.', ',')} kg CO₂ gespart gegenüber dem Auto` : ''}.`,
    );
  } else {
    parts.push(
      `Leave ${f.origin} at ${f.departClock} and take the ${f.mode}${f.crowd ? ` — it'll be ${f.crowd}${f.crowdWaitMinutes > 0 ? `, allow ${f.crowdWaitMinutes} min on the platform` : ''}` : ''}.`,
      `Expect about ${f.gateQueueMinutes} min at ${f.entrance}.${f.kiosk ? ` Grab food at ${f.kiosk.label} (~${f.kiosk.queueMinutes} min instead of ~${f.kiosk.nearestQueueMinutes} at the nearest stand).` : ''} You'll be in your seat by ${f.seatedClock} for the ${f.kickoffClock} kick-off.`,
      p.stayMinutes > 0
        ? `After the final whistle, stay ${p.stayMinutes} minutes: the queue at Fröttmaning drops from ~${p.queueIfLeavingNow} to ~${p.queueMinutes} min and you're still home by ${p.homeClock}.`
        : `After the final whistle, head straight home — back by ${p.homeClock}.`,
      `That's ${f.greenPoints} green points${f.co2SavedKg > 0 ? ` and ${f.co2SavedKg} kg CO₂ saved versus driving` : ''}.`,
    );
  }
  return parts.join(' ');
}

const NARRATE_SYSTEM = [
  'You are the FC Bayern matchday companion ("Vom Sofa bis zum Sitz"). Summarise a personal matchday plan for a fan.',
  'Friendly, concrete, 4–6 sentences, no markdown, no emoji. Mention departure time, crowd advice, entrance queue, food tip if any,',
  'when they will be seated, the post-match recommendation with the queue comparison, and green points. If there are alerts or a switched mode, lead with them.',
  'Use ONLY the facts. Never invent times, numbers, places or services.',
].join('\n');

export async function narrateJourney(
  ctx: AiContext,
  facts: JourneyFacts,
  language = 'en',
): Promise<AiResult<string>> {
  return runSkill(
    ctx,
    (llm) =>
      groundedText(
        llm,
        {
          system: NARRATE_SYSTEM,
          prompt: `Language: ${languageName(language)}.\n<facts>\n${JSON.stringify(facts, null, 1)}\n</facts>`,
          temperature: 0.6,
          maxOutputTokens: 900,
        },
        facts,
        1_200,
      ),
    () => narrateTemplate(facts, language),
  );
}

// ── Q&A ────────────────────────────────────────────────────────────────────

export interface TimelineLine {
  clock: string;
  title: string;
  detail: string;
}

export function answerTemplate(
  question: string,
  f: JourneyFacts,
  timeline: readonly TimelineLine[],
  language: string,
): string {
  const q = sanitizeUserText(question).toLowerCase();
  const de = demoLanguage(language) === 'de';
  const step = (re: RegExp) => timeline.find((s) => re.test(s.title) || re.test(s.detail));
  if (/\b(toilet|wc|loo|klo|toilette|restroom|bathroom)/.test(q)) {
    const ht = step(/half-time|halbzeit/i);
    return ht
      ? `${ht.title} (${ht.clock}): ${ht.detail}`
      : de
        ? 'Toiletten gibt es in jedem Umlauf.'
        : 'There are toilets on every concourse.';
  }
  if (/\b(eat|food|hungry|essen|kiosk|beer|bier|wurst|snack|drink)/.test(q)) {
    if (!f.kiosk)
      return de
        ? 'Du hast angegeben, dass du nichts essen willst — sag Bescheid, dann plane ich einen Stopp ein.'
        : "You said you'd skip food — tell me and I'll add a stop.";
    return de
      ? `${f.kiosk.label}: ca. ${f.kiosk.queueMinutes} Min. Schlange statt ${f.kiosk.nearestQueueMinutes} am nächstgelegenen Stand.`
      : `${f.kiosk.label}: about ${f.kiosk.queueMinutes} min queue instead of ${f.kiosk.nearestQueueMinutes} at the nearest stand.`;
  }
  if (
    /\b(home|back|zurück|heim|after the (match|game)|nach dem spiel|leave the (arena|stadium)|getting home)/.test(
      q,
    )
  ) {
    const p = f.postMatch;
    return de
      ? `Direkt nach Abpfiff: ca. ${p.queueIfLeavingNow} Min. Schlange, zu Hause gegen ${p.homeClockIfLeavingNow}. Mit ${p.stayMinutes} Min. Puffer: ca. ${p.queueMinutes} Min., zu Hause gegen ${p.homeClock}.`
      : `Leaving at the whistle: ~${p.queueIfLeavingNow} min queue, home around ${p.homeClockIfLeavingNow}. Staying ${p.stayMinutes} min: ~${p.queueMinutes} min queue, home around ${p.homeClock}.`;
  }
  if (/\b(when|leave|depart|start|los|aufbrechen|losgehen|wann)/.test(q)) {
    return de
      ? `Starte um ${f.departClock} ab ${f.origin}, dann bist du um ${f.seatedClock} am Platz.`
      : `Leave ${f.origin} at ${f.departClock} and you'll be in your seat by ${f.seatedClock}.`;
  }
  if (/\b(crowd|full|busy|packed|voll|gedränge|u6)/.test(q)) {
    return f.crowd
      ? de
        ? `Zu deiner Zeit ist die U6 ${CROWD_DE[f.crowd] ?? f.crowd}${f.crowdWaitMinutes > 0 ? ` (ca. ${f.crowdWaitMinutes} Min. Wartezeit)` : ''}.`
        : `At your time the U6 will be ${f.crowd}${f.crowdWaitMinutes > 0 ? ` (about ${f.crowdWaitMinutes} min platform wait)` : ''}.`
      : de
        ? 'Auf deiner Route spielt die U6-Auslastung keine Rolle.'
        : "Your route doesn't depend on the U6 crowds.";
  }
  if (/\b(gate|entrance|eingang|tor|security)/.test(q)) {
    return de
      ? `${f.entrance}: ca. ${f.gateQueueMinutes} Min. an den Drehkreuzen. Ticket in der App bereithalten.`
      : `${f.entrance}: about ${f.gateQueueMinutes} min at the turnstiles. Have your app ticket ready.`;
  }
  if (/\b(rain|regen|weather|wetter|cold|kalt)/.test(q)) {
    return de
      ? 'Das Arena-Dach deckt alle Plätze ab — nur auf der Esplanade wirst du nass. Regenjacke einpacken.'
      : 'The Arena roof covers every seat — only the Esplanade is open to the sky. Bring a rain jacket.';
  }
  return de
    ? `Kurz gesagt: Start ${f.departClock}, am Platz ${f.seatedClock}, zurück gegen ${f.postMatch.homeClock}. Frag mich zu Essen, Toiletten, Eingang, Gedränge oder Heimweg.`
    : `In short: leave at ${f.departClock}, seated by ${f.seatedClock}, home around ${f.postMatch.homeClock}. Ask me about food, toilets, your entrance, crowds or getting home.`;
}

export async function answerJourneyQuestion(
  ctx: AiContext,
  input: {
    question: string;
    facts: JourneyFacts;
    timeline: readonly TimelineLine[];
    language?: string;
  },
): Promise<AiResult<string>> {
  const language = input.language ?? 'en';
  const grounding = { facts: input.facts, timeline: input.timeline };
  return runSkill(
    ctx,
    (llm) =>
      groundedText(
        llm,
        {
          system: [
            'You answer a fan’s question about their personal matchday plan at the Allianz Arena.',
            'Answer in 1–3 sentences using ONLY the plan facts and timeline. If the plan does not contain the answer, say so briefly and suggest what you can help with.',
            'No markdown, no emoji. Never invent times, numbers or services.',
            DATA_NOT_INSTRUCTIONS,
          ].join('\n'),
          prompt: `Language: ${languageName(language)}.\n<plan>\n${JSON.stringify(grounding, null, 1)}\n</plan>\n${wrapUserText(input.question)}`,
          temperature: 0.4,
          maxOutputTokens: 500,
        },
        grounding,
        700,
      ),
    () => answerTemplate(input.question, input.facts, input.timeline, language),
  );
}
