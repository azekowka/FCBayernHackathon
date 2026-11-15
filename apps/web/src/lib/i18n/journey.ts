import type { CrowdLevel, Mode } from '@fcb/core';
import type { Locale } from './config';

/**
 * German wording for the journey planner's output. The planner (in @fcb/core)
 * phrases its facts in English with a small, fixed set of sentence patterns;
 * these rules rebuild each pattern in German, keeping every number and name.
 * Unknown text passes through unchanged, so a new engine sentence degrades
 * to English instead of breaking.
 */

const MODE_DE: Record<string, string> = {
  'U-Bahn (U6)': 'U-Bahn (U6)',
  Bike: 'Fahrrad',
  'Car + P+R': 'Auto + P+R',
  'Fan-club bus': 'Fanclub-Bus',
  'On foot': 'Zu Fuß',
};

const PLACE_DE: Record<string, string> = {
  'Munich Airport (MUC)': 'Flughafen München (MUC)',
  'Garching (TUM campus)': 'Garching (TUM-Campus)',
  'Bus park Allianz Arena': 'Busparkplatz Allianz Arena',
};

const CROWD_DE: Record<string, string> = {
  calm: 'ruhig',
  busy: 'belebt',
  packed: 'voll',
  crush: 'sehr voll',
};

const EXACT_DE: Record<string, string> = {
  'Kick-off': 'Anpfiff',
  'Half-time': 'Halbzeit',
  'Final whistle': 'Abpfiff',
  'Approximate — stoppage time varies.': 'Ungefähr — die Nachspielzeit variiert.',
  'Leave with the crowd': 'Mit der Masse gehen',
  'Stay 15 min — interviews on the big screen': '15 min bleiben — Interviews auf der Videowand',
  'Stay 30 min — post-match show': '30 min bleiben — Show nach dem Spiel',
  'Stay 45 min — let the Esplanade clear': '45 min bleiben — die Esplanade leeren lassen',
  'Bus leaves 45 min after the final whistle': 'Bus fährt 45 min nach Abpfiff',
  'Head back via the Esplanade': 'Über die Esplanade zurück',
  'Head home': 'Ab nach Hause',
  'No queue expected.': 'Keine Wartezeit erwartet.',
  'Lifts serve every tier from there.': 'Von dort fahren Aufzüge in jeden Rang.',
  'Park, then walk': 'Parken, dann zu Fuß',
  'Change to U6': 'Umstieg in die U6',
  'Southbound — against the crowd': 'Richtung Süden — gegen den Strom',
  'Signposted fan walk along Werner-Heisenberg-Allee':
    'Ausgeschilderter Fanweg entlang der Werner-Heisenberg-Allee',
  'Terminates at Kieferngarten': 'Endet in Kieferngarten',
  'Last stop before the closure': 'Letzter Halt vor der Sperrung',
  'Fan walk from the north': 'Fanweg von Norden',
  'Strike — no U-Bahn today': 'Streik — heute keine U-Bahn',
  'A public-transport strike stops MVG U-Bahn, tram and bus services. DB regional trains run. Plan for bike, car-pooling or the fan-club bus.':
    'Ein Streik legt U-Bahn, Tram und Bus der MVG lahm. Regionalzüge der DB fahren. Plane mit Rad, Fahrgemeinschaft oder Fanclub-Bus.',
  'U6 disrupted: Kieferngarten – Fröttmaning': 'U6 gestört: Kieferngarten – Fröttmaning',
  'Trains terminate at Kieferngarten. Follow the signposted fan walk (~28 min) or allow extra time for replacement buses.':
    'Züge enden in Kieferngarten. Folge dem ausgeschilderten Fanweg (~28 min) oder plane Zeit für Ersatzbusse ein.',
  'Heavy rain this afternoon': 'Starkregen am Nachmittag',
  'Thunderstorms expected around kick-off. The Arena roof covers every seat — the Esplanade does not. More fans will take the U6.':
    'Gewitter rund um den Anpfiff erwartet. Das Arena-Dach schützt jeden Platz — die Esplanade nicht. Mehr Fans nehmen die U6.',
  '10 pts for a staggered return (eases the U6 crush)':
    '10 Pkt. für eine gestaffelte Heimfahrt (entlastet die U6)',
  Conditions: 'Die Bedingungen',
};

const mode = (s: string) => MODE_DE[s] ?? s;
const place = (s: string) => PLACE_DE[s] ?? s.replace(/\(standing\)/, '(Stehplatz)');

type Rule = [RegExp, (...m: string[]) => string];

const RULES: Rule[] = [
  [/^Leave (.+)$/, (p) => `Abfahrt: ${place(p)}`],
  [/^Walk to (.+)$/, (p) => `Zu Fuß → ${place(p)}`],
  [/^Park at (.+)$/, (p) => `Parken: ${place(p)}`],
  [/^Cycle to (.+)$/, (p) => `Mit dem Rad → ${place(p)}`],
  [/^Drive to (.+)$/, (p) => `Mit dem Auto → ${place(p)}`],
  [/^Fan-club bus to (.+)$/, (p) => `Fanclub-Bus → ${place(p)}`],
  [/^In your seat — (.+)$/, (b) => `Auf deinem Platz — ${place(b)}`],
  [/^Back at (.+)$/, (p) => `Zurück: ${place(p)}`],
  [/^(\d+) min door to seat via (.+)\.$/, (n, m) => `${n} min von Tür zu Sitz mit ${mode(m)}.`],
  [
    /^~(\d+) min at the turnstiles\. Have your app ticket ready( · step-free route)?\.$/,
    (n, sf) =>
      `~${n} min am Drehkreuz. App-Ticket bereithalten${sf ? ' · barrierefreier Weg' : ''}.`,
  ],
  [
    /^~(\d+) min queue, (\d+) min walk from your block\.$/,
    (q, w) => `~${q} min Wartezeit, ${w} min Fußweg von deinem Block.`,
  ],
  [
    /^(\d+) min before kick-off( — in time for the choreo)?\.$/,
    (n, c) => `${n} min vor Anpfiff${c ? ' — rechtzeitig zur Choreo' : ''}.`,
  ],
  [
    /^Shortest queue: (.+) \(~(\d+) min\)\. Tip: go at 43' or after 55'\.$/,
    (a, n) =>
      `Kürzeste Schlange: ${a} (~${n} min). Tipp: in der 43. oder nach der 55. Minute gehen.`,
  ],
  [
    /^Queue at (Fröttmaning|the exit) ~(\d+) min instead of ~(\d+) min\.$/,
    (at, a, b) =>
      `Wartezeit ${at === 'Fröttmaning' ? 'in Fröttmaning' : 'am Ausgang'} ~${a} min statt ~${b} min.`,
  ],
  [/^Expect ~(\d+) min of queueing\.$/, (n) => `Rechne mit ~${n} min Wartezeit.`],
  [/^Whole matchday: (.+) door to door\.$/, (d) => `Ganzer Spieltag: ${d} von Tür zu Tür.`],
  [/^(.+) isn't an option right now$/, (m) => `${mode(m)} ist gerade keine Option`],
  [
    /^Re-planned via (.+?)(?:; plan B: (.+))?\.$/,
    (a, b) => `Neu geplant mit ${mode(a)}${b ? `; Plan B: ${mode(b)}` : ''}.`,
  ],
  [/^Consider (.+) today$/, (m) => `Heute lieber: ${mode(m)}`],
  [
    /^(.+) make (.+) less pleasant; (.+) gets you in your seat by (\d\d:\d\d)\.$/,
    (why, a, b, t) =>
      `${tj(why, 'de')} — ${mode(a.charAt(0).toUpperCase() + a.slice(1))} wird ungemütlich; mit ${mode(b)} sitzt du um ${t} auf deinem Platz.`,
  ],
  [/^Step-free entry via (.+)$/, (e) => `Barrierefreier Zugang über ${e}`],
  [/^(\d+) pts for travelling by (.+)$/, (n, m) => `${n} Pkt. für die Anreise: ${tjMode(m)}`],
  [
    /^Crowd: (\w+)(?: \(\+(\d+) min platform wait\))?$/,
    (c, w) => `Andrang: ${CROWD_DE[c] ?? c}${w ? ` (+${w} min am Bahnsteig)` : ''}`,
  ],
];

function tjMode(lower: string): string {
  const hit = Object.keys(MODE_DE).find((k) => k.toLowerCase() === lower);
  return hit ? (MODE_DE[hit] as string) : lower;
}

/** Translate one planner sentence (or a " · "-joined list of fragments). */
export function tj(text: string, locale: Locale): string {
  if (locale === 'en' || !text) return text;
  if (text.includes(' · ') && !EXACT_DE[text]) {
    return text
      .split(' · ')
      .map((part) => tj(part, locale))
      .join(' · ');
  }
  const exact = EXACT_DE[text];
  if (exact) return exact;
  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (m) return fn(...m.slice(1).map((x) => x ?? ''));
  }
  return place(text);
}

export function modeLabel(m: Mode, label: string, locale: Locale): string {
  return locale === 'de' ? mode(label) : label;
}

export function crowdLabel(c: CrowdLevel, locale: Locale): string {
  if (locale === 'de') return CROWD_DE[c] ?? c;
  return { calm: 'Calm', busy: 'Busy', packed: 'Packed', crush: 'Very full' }[c];
}

export function placeLabel(label: string, locale: Locale): string {
  return locale === 'de' ? place(label) : label;
}

/**
 * German facts for the AI layer: same numbers, German names and sentences, so
 * Gemini (and the offline templates) never mix English planner text into a
 * German reply. Numbers are untouched — the numbers guard still applies.
 */
export function localizeFacts<
  F extends {
    origin: string;
    block: string;
    mode: string;
    switchedFrom: string | null;
    alerts: string[];
  },
>(facts: F, locale: Locale): F {
  if (locale === 'en') return facts;
  return {
    ...facts,
    origin: place(facts.origin),
    block: place(facts.block),
    mode: mode(facts.mode),
    switchedFrom: facts.switchedFrom ? mode(facts.switchedFrom) : null,
    alerts: facts.alerts.map((a) => tj(a, locale)),
  };
}
