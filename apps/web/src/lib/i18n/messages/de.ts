import type { Messages } from './en';

/** Deutsche Texte — gleiche Struktur wie en.ts (vom Compiler erzwungen). */
export const de: Messages = {
  meta: {
    title: 'Kickoff — faire Tickets, volle Ränge, entspannte Spieltage',
    description:
      'Kickoff: drei Gemini-Prototypen für FC-Bayern-Fans — ein transparentes Treue-Losverfahren, smartes Sitzplatz-Recycling und ein Spieltags-Reiseagent.',
  },
  common: {
    skip: 'Zum Inhalt springen',
    brandTagline: 'Prototyp zur Fan AI-DEATION',
    home: 'Kickoff Startseite',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    language: 'Sprache',
    theme: 'Farbschema wechseln',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    aiLive: 'Gemini live',
    aiDemo: 'Demo-KI',
    aiLiveTitle: (model: string) => `Gemini live (${model})`,
    aiDemoTitle: 'Kein API-Schlüssel — geprüfte Offline-Vorlagen',
    tryAgain: 'Erneut versuchen',
    backHome: 'Zurück zum Anstoß',
    thinking: 'Denkt nach',
  },
  nav: {
    ballot: 'Losverfahren',
    recycling: 'Platz-Recycling',
    live: 'Live-Demo',
    journey: 'Anreise',
    how: 'So funktioniert’s',
  },
  footer: {
    blurb:
      'Unabhängiger Hackathon-Prototyp für die FC Bayern Fan AI-DEATION (mit Google Gemini und UnternehmerTUM). Kein offizielles Produkt des FC Bayern. Alle Mitglieder, Tickets und Reisedaten sind synthetisch und illustrativ.',
    products: 'Produkte',
    principles: 'Grundsätze',
    principleList: [
      'Keine dynamischen Preise — nur Nennwert',
      'Keine Biometrie, nur freiwillige Signale',
      'Engines entscheiden, Gemini erklärt',
    ],
    made: 'Gemacht für die Fans in München',
  },
  products: {
    ballot: {
      name: 'Losglück mit System',
      tag: 'Fair Seat · Losverfahren',
      en: 'Das transparente Losverfahren, das Treue belohnt',
      body: 'Sieh deine Chancen, bevor du dich bewirbst. Jedes „Nein“ erhöht deinen Pechvogel-Bonus. Bewirb dich clever und prüfe die Ziehung selbst — wer leer ausgeht, bildet die Warteliste fürs Recycling.',
      kpiLabel: 'Chance auf den Klassiker, Pechvogel ×7 vs. Erstbewerber',
    },
    recycling: {
      name: 'Kein Platz bleibt leer',
      tag: 'Fair Seat · Recycling',
      en: 'Smartes Platz-Recycling — dynamische Kapazität, nie dynamische Preise',
      body: 'Ein erklärbares Modell erkennt Plätze, die wohl leer bleiben. Gemini fragt den Inhaber freundlich; ein Tipp schickt den Platz an den nächsten Fan auf der Warteliste — bis zum Anpfiff.',
      kpiLabel: 'Leere Plätze wieder belegt, Samstag gegen Freiburg',
    },
    journey: {
      name: 'Vom Sofa bis zum Sitz',
      tag: 'Spieltag · Anreise',
      en: 'Der Spieltags-Reiseagent',
      body: 'Wann du losmusst, wie voll die U6 wird, das schnellste Tor und der kürzeste Kiosk — und eine gestaffelte Heimfahrt ohne Gedränge in Fröttmaning. Plant live um Streiks und Sperrungen herum.',
      kpiLabel: (stay: number) => `U6-Wartezeit, wenn du ${stay} Min. nach Abpfiff bleibst`,
    },
    open: (name: string) => `${name} öffnen`,
  },
  home: {
    badge: 'Mit Google Gemini · abgesichert durch getestete Engines',
    titleA: 'Mehr Fans in der Arena.',
    titleB: 'Nicht höhere Preise.',
    lead: 'Kickoff sind drei funktionierende Prototypen, die das begehrteste Ticket im Fußball zum fairsten machen — und jeden Fan vom Sofa bis zum Sitz bringen. Die Engines entscheiden; Gemini erklärt, in jeder Sprache.',
    ctaLive: 'Zwei-Handy-Demo ansehen',
    ctaBallot: 'Deine Los-Chancen prüfen',
    arenaLabel: 'Plätze an Fans auf der Warteliste vergeben',
    arenaCaption: 'Live-Simulation · Allianz Arena, 116 Blöcke',
    arenaRefilled: 'neu belegt',
    arenaEmpty: 'leer',
    statsLabel: 'Das Problem in Zahlen',
    stats: {
      seats: 'Plätze in der Allianz Arena',
      seatsSub: 'seit über 20 Jahren ausverkauft',
      requests: 'Anfragen für ein Heimspiel',
      requestsSub: 'Der Klassiker, 2026/27',
      empty: 'Leere Plätze an einem normalen Samstag',
      emptySub: 'ungenutzte Dauerkarten (Modell)',
      extra: 'Zusätzliche Fans pro Spiel mit Fair Seat',
      extraSub: 'gleiche Plätze, gleiche Preise',
    },
    productsEyebrow: 'Die drei besten Ideen — umgesetzt',
    productsTitle: 'Drei Produkte. Ein Fan-Erlebnis.',
    productsLead:
      'Vom Losverfahren über das Drehkreuz bis zur letzten U6 nach Hause — jeder Schritt des Spieltags, fair und entspannt.',
    loopEyebrow: 'Warum die Jury vertrauen kann',
    loopTitle: 'Engines entscheiden. Gemini erklärt.',
    loopLead:
      'Jede Zuteilung, jede Gewinnchance und jede Reisezeit stammt aus deterministischen, getesteten Engines. Gemini macht daraus ein freundliches Gespräch in vielen Sprachen — und ein Zahlenwächter verwirft jeden Satz mit einer Zahl, die die Engine nicht berechnet hat.',
    loop: [
      {
        t: 'Berechnen',
        d: 'Chancen, Plätze und Wartezeiten kommen aus reinen, getesteten Engines.',
      },
      { t: 'Formulieren', d: 'Gemini macht daraus ein Gespräch, in der Sprache des Fans.' },
      { t: 'Prüfen', d: 'Ein Zahlenwächter verwirft jede Zahl, die die Engine nicht kennt.' },
      { t: 'Absichern', d: 'Bei Timeouts oder erfundenen Zahlen greifen geprüfte Vorlagen.' },
    ],
    howLink: 'So funktioniert’s',
    principles: [
      {
        t: 'Keine dynamischen Preise',
        d: 'Die Kapazität ist dynamisch, die Preise nie. Jeder recycelte Platz geht zum Nennwert.',
      },
      {
        t: 'Überprüfbare Ziehungen',
        d: 'SHA-256-Commitment vor Losschluss; jeder kann seinen Eintrag nachprüfen.',
      },
      {
        t: 'Datenschutz eingebaut',
        d: 'Nur freiwillige Signale, keine Biometrie. Die Prognose läuft direkt auf dem Handy.',
      },
      {
        t: 'Der Mensch entscheidet',
        d: 'Gemini kann eine Freigabe vorschlagen — ausführen kann sie nur der Tipp des Fans.',
      },
      {
        t: 'Zahlenwächter',
        d: 'Erfundene Zahlen lösen eine sichere, geprüfte Vorlage aus. Die Quelle ist immer sichtbar.',
      },
      {
        t: 'Niemand bleibt zurück',
        d: 'Funktioniert offline im Demo-Modus, barrierefreie Wege, Spenden an Jugend-Fanclubs.',
      },
    ],
    ctaTitle: 'Zwei Handys. Ein Platz. Null leer.',
    ctaLead:
      'Sepp gibt seinen Platz in der Südkurve im Gemini-Chat frei — Mia von der Warteliste bekommt das Angebot Sekunden später.',
    ctaButton: 'Bühnen-Demo öffnen',
  },
  notFound: {
    code: '404',
    title: 'Abseits — diese Seite gibt es nicht.',
    lead: 'Der Link ist vielleicht veraltet, oder die Seite ist in einen anderen Block umgezogen.',
  },
  error: {
    code: 'Videobeweis',
    title: 'Bei uns ist etwas schiefgelaufen.',
    lead: 'Nicht deine Schuld — versuch es nochmal, und lade die Seite neu, falls es anhält.',
  },
};
