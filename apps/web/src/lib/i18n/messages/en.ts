/**
 * English copy. The German dictionary (de.ts) must match this shape exactly —
 * the compiler enforces it through the `Messages` type.
 */
export const en = {
  meta: {
    title: 'Kickoff — fair tickets, full stands, easy matchdays',
    description:
      'Kickoff: three Gemini-powered prototypes for FC Bayern fans — a transparent loyalty ballot, smart seat recycling and a matchday journey agent.',
  },
  common: {
    skip: 'Skip to content',
    brandTagline: 'Fan AI-DEATION prototype',
    home: 'Kickoff home',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    language: 'Language',
    theme: 'Toggle colour theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    aiLive: 'Gemini live',
    aiDemo: 'Demo AI',
    aiLiveTitle: (model: string) => `Live Gemini (${model})`,
    aiDemoTitle: 'No API key — grounded offline templates',
    tryAgain: 'Try again',
    backHome: 'Back to kickoff',
    thinking: 'Thinking',
  },
  nav: {
    ballot: 'Ballot',
    recycling: 'Seat recycling',
    live: 'Live demo',
    journey: 'Journey',
    how: 'How it works',
  },
  footer: {
    blurb:
      'Independent hackathon prototype for the FC Bayern Fan AI-DEATION (with Google Gemini and UnternehmerTUM). Not an official FC Bayern product. All members, tickets and travel data are synthetic and illustrative.',
    products: 'Products',
    principles: 'Principles',
    principleList: [
      'No dynamic pricing — face value only',
      'No biometrics, opt-in signals only',
      'Engines decide, Gemini explains',
    ],
    made: 'Made for the fans in Munich',
  },
  products: {
    ballot: {
      name: 'Losglück mit System',
      tag: 'Fair Seat · Ballot',
      en: 'The transparent, loyalty-aware ballot',
      body: 'See your odds before you apply. Every “no” raises your Pechvogel bonus. Apply smart, then verify the draw yourself — the losers become the recycling waitlist.',
      kpiLabel: 'Klassiker odds, Pechvogel ×7 vs first-timer',
    },
    recycling: {
      name: 'Kein Platz bleibt leer',
      tag: 'Fair Seat · Recycling',
      en: 'Smart seat recycling — dynamic capacity, never dynamic pricing',
      body: 'An explainable model spots seats likely to stay empty. Gemini nudges the holder kindly; one tap sends the seat to the next fan on the waitlist, right up to kick-off.',
      kpiLabel: 'Empty seats back in use, Saturday vs Freiburg',
    },
    journey: {
      name: 'Vom Sofa bis zum Sitz',
      tag: 'Matchday · Journey',
      en: 'The matchday journey agent',
      body: 'When to leave, how full the U6 will be, the quickest gate and kiosk, and a staggered return that skips the Fröttmaning crush. Re-plans live around strikes and closures.',
      kpiLabel: (stay: number) => `U6 queue if you stay ${stay} min after the whistle`,
    },
    open: (name: string) => `Open ${name}`,
  },
  home: {
    badge: 'Built on Google Gemini · grounded by tested engines',
    titleA: 'More fans in the Arena.',
    titleB: 'Not higher prices.',
    lead: 'Kickoff is three working prototypes that make the toughest ticket in football the fairest one — and get every fan from sofa to seat. The engines decide; Gemini explains, in any language.',
    ctaLive: 'Watch the two-phone demo',
    ctaBallot: 'Check your ballot odds',
    arenaLabel: 'Seats handed back to waitlist fans',
    arenaCaption: 'Live simulation · Allianz Arena, 116 blocks',
    arenaRefilled: 'refilled',
    arenaEmpty: 'empty',
    statsLabel: 'The problem in numbers',
    stats: {
      seats: 'Seats in the Allianz Arena',
      seatsSub: 'sold out for 20+ years',
      requests: 'Requests for one home match',
      requestsSub: 'Der Klassiker, 2026/27',
      empty: 'Empty seats on a normal Saturday',
      emptySub: 'season tickets not used (model)',
      extra: 'Extra fans per match with Fair Seat',
      extraSub: 'same seats, same prices',
    },
    productsEyebrow: 'The top three ideas — shipped',
    productsTitle: 'Three products. One fan journey.',
    productsLead:
      'From the ballot to the turnstile to the last U6 home — every step of the matchday, made fair and calm.',
    loopEyebrow: 'Why the jury can trust it',
    loopTitle: 'Engines decide. Gemini explains.',
    loopLead:
      'Every allocation, odds figure and travel time comes from deterministic, unit-tested engines. Gemini turns those facts into warm, multilingual conversation — and a numbers guard throws away any sentence that contains a figure the engine didn’t produce.',
    loop: [
      { t: 'Compute', d: 'Odds, seats and queue minutes come from pure, tested engines.' },
      { t: 'Phrase', d: 'Gemini turns those facts into conversation, in the fan’s language.' },
      { t: 'Verify', d: 'A numbers guard rejects any figure the engine didn’t produce.' },
      { t: 'Fall back', d: 'Timeouts or invented numbers switch to grounded templates.' },
    ],
    howLink: 'How it works',
    principles: [
      {
        t: 'No dynamic pricing',
        d: 'Capacity is dynamic, prices never are. Every recycled seat moves at face value.',
      },
      {
        t: 'Verifiable draws',
        d: 'SHA-256 commitment before the ballot closes; anyone can re-check their entry.',
      },
      {
        t: 'Privacy by design',
        d: 'Opt-in signals only, no biometrics. The no-show estimate is built to run on-device.',
      },
      {
        t: 'Human in the loop',
        d: 'Gemini can suggest a release — only the fan’s tap can execute it.',
      },
      {
        t: 'Numbers guard',
        d: 'Invented numbers trigger a safe, grounded fallback. The UI always shows the source.',
      },
      {
        t: 'Nobody left behind',
        d: 'Works offline in demo mode, step-free routing, youth fan-club gifting.',
      },
    ],
    ctaTitle: 'Two phones. One seat. Zero empty.',
    ctaLead:
      'Sepp releases his Südkurve spot in a Gemini chat — Mia from the waitlist gets the offer seconds later.',
    ctaButton: 'Open the stage demo',
  },
  notFound: {
    code: '404',
    title: 'Offside — this page doesn’t exist.',
    lead: 'The link may be old, or the page moved to another block.',
  },
  error: {
    code: 'VAR check',
    title: 'Something went wrong on our side.',
    lead: 'Nothing you did — try again, and if it persists, reload the page.',
  },
};

export type Messages = typeof en;
