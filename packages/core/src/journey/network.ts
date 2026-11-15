/**
 * Schematic matchday network. Travel times are typical, illustrative values
 * for the prototype; production would call the Google Maps Routes API and MVG
 * live data through the same `Leg[]` shape.
 */

export type Mode = 'ubahn' | 'bike' | 'car' | 'fanbus' | 'walk';
export type LegKind = 'walk' | 'ubahn' | 'sbahn' | 'regio' | 'bike' | 'car' | 'bus' | 'park';

export interface Leg {
  kind: LegKind;
  from: string;
  to: string;
  line?: string;
  minutes: number;
  distanceKm: number;
  /** The U6 ride into Fröttmaning — the bottleneck the crowd model prices in. */
  crowdSensitive?: boolean;
  note?: string;
}

export interface Origin {
  id: string;
  label: string;
  area: string;
  /** Query string for the Google Maps deep link. */
  mapsQuery: string;
  keywords: string[];
  routes: Partial<Record<Mode, Leg[]>>;
}

export const ARENA_ADDRESS = 'Allianz Arena, Werner-Heisenberg-Allee 25, 80939 München';
export const STATION = 'Fröttmaning';
export const ESPLANADE_MINUTES = 15;

export const MODE_LABEL: Record<Mode, string> = {
  ubahn: 'U-Bahn (U6)',
  bike: 'Bike',
  car: 'Car + P+R',
  fanbus: 'Fan-club bus',
  walk: 'On foot',
};

const esplanade = (): Leg => ({
  kind: 'walk',
  from: STATION,
  to: 'Esplanade',
  minutes: ESPLANADE_MINUTES,
  distanceKm: 1.2,
});

const u6 = (from: string, minutes: number, distanceKm: number): Leg => ({
  kind: 'ubahn',
  from,
  to: STATION,
  line: 'U6',
  minutes,
  distanceKm,
  crowdSensitive: true,
});

const carToArena = (from: string, minutes: number, distanceKm: number): Leg[] => [
  { kind: 'car', from, to: 'P+R Allianz Arena', minutes, distanceKm },
  {
    kind: 'park',
    from: 'P+R Allianz Arena',
    to: 'Esplanade',
    minutes: 12,
    distanceKm: 0.8,
    note: 'Park, then walk',
  },
];

const bikeToArena = (from: string, minutes: number, distanceKm: number): Leg[] => [
  { kind: 'bike', from, to: 'Bike parking Nord', minutes, distanceKm },
  { kind: 'walk', from: 'Bike parking Nord', to: 'Esplanade', minutes: 5, distanceKm: 0.3 },
];

const viaHbfToU6 = (): Leg[] => [
  { kind: 'walk', from: 'München Hbf', to: 'Hauptbahnhof (U)', minutes: 6, distanceKm: 0.3 },
  {
    kind: 'ubahn',
    from: 'Hauptbahnhof',
    to: 'Odeonsplatz',
    line: 'U4/U5',
    minutes: 4,
    distanceKm: 1.8,
  },
  {
    kind: 'walk',
    from: 'Odeonsplatz',
    to: 'Odeonsplatz (U6)',
    minutes: 4,
    distanceKm: 0.2,
    note: 'Change to U6',
  },
  u6('Odeonsplatz', 15, 9.8),
  esplanade(),
];

const fanBus = (from: string, minutes: number, distanceKm: number): Leg[] => [
  {
    kind: 'bus',
    from: `${from} (fan-club meeting point)`,
    to: 'Bus park Allianz Arena',
    minutes,
    distanceKm,
  },
  { kind: 'walk', from: 'Bus park', to: 'Esplanade', minutes: 8, distanceKm: 0.5 },
];

export const ORIGINS: readonly Origin[] = [
  {
    id: 'marienplatz',
    label: 'Marienplatz',
    area: 'Altstadt, München',
    mapsQuery: 'Marienplatz, München',
    keywords: ['marienplatz', 'city', 'centre', 'center', 'altstadt', 'innenstadt'],
    routes: {
      ubahn: [
        { kind: 'walk', from: 'Start', to: 'Marienplatz (U)', minutes: 3, distanceKm: 0.2 },
        u6('Marienplatz', 16, 10.5),
        esplanade(),
      ],
      bike: bikeToArena('Marienplatz', 42, 11.5),
      car: carToArena('Marienplatz', 25, 13),
    },
  },
  {
    id: 'hbf',
    label: 'München Hauptbahnhof',
    area: 'Maxvorstadt, München',
    mapsQuery: 'München Hauptbahnhof',
    keywords: ['hauptbahnhof', 'hbf', 'central station', 'main station', 'train station'],
    routes: {
      ubahn: [
        { kind: 'walk', from: 'Start', to: 'Hauptbahnhof (U)', minutes: 5, distanceKm: 0.3 },
        {
          kind: 'ubahn',
          from: 'Hauptbahnhof',
          to: 'Odeonsplatz',
          line: 'U4/U5',
          minutes: 4,
          distanceKm: 1.8,
        },
        {
          kind: 'walk',
          from: 'Odeonsplatz',
          to: 'Odeonsplatz (U6)',
          minutes: 4,
          distanceKm: 0.2,
          note: 'Change to U6',
        },
        u6('Odeonsplatz', 15, 9.8),
        esplanade(),
      ],
      bike: bikeToArena('Hauptbahnhof', 45, 12.5),
      car: carToArena('Hauptbahnhof', 28, 14),
    },
  },
  {
    id: 'schwabing',
    label: 'Münchner Freiheit',
    area: 'Schwabing, München',
    mapsQuery: 'Münchner Freiheit, München',
    keywords: ['schwabing', 'münchner freiheit', 'muenchner freiheit', 'freiheit', 'leopoldstraße'],
    routes: {
      ubahn: [
        { kind: 'walk', from: 'Start', to: 'Münchner Freiheit (U)', minutes: 4, distanceKm: 0.3 },
        u6('Münchner Freiheit', 10, 6.4),
        esplanade(),
      ],
      bike: bikeToArena('Münchner Freiheit', 26, 7),
      car: carToArena('Münchner Freiheit', 18, 8),
      walk: [
        { kind: 'walk', from: 'Münchner Freiheit', to: 'Esplanade', minutes: 85, distanceKm: 7 },
      ],
    },
  },
  {
    id: 'garching',
    label: 'Garching (TUM campus)',
    area: 'Garching bei München',
    mapsQuery: 'Garching-Forschungszentrum',
    keywords: ['garching', 'tum', 'campus', 'forschungszentrum', 'university'],
    routes: {
      ubahn: [
        {
          kind: 'walk',
          from: 'Start',
          to: 'Garching-Forschungszentrum (U)',
          minutes: 6,
          distanceKm: 0.4,
        },
        {
          kind: 'ubahn',
          from: 'Garching-Forschungszentrum',
          to: STATION,
          line: 'U6',
          minutes: 9,
          distanceKm: 7.5,
          note: 'Southbound — against the crowd',
        },
        esplanade(),
      ],
      bike: bikeToArena('Garching', 30, 9),
      car: carToArena('Garching', 15, 10),
    },
  },
  {
    id: 'airport',
    label: 'Munich Airport (MUC)',
    area: 'Flughafen München',
    mapsQuery: 'Flughafen München',
    keywords: ['airport', 'flughafen', 'muc', 'plane', 'landing', 'flight'],
    routes: {
      ubahn: [
        {
          kind: 'sbahn',
          from: 'Flughafen München',
          to: 'Marienplatz',
          line: 'S8',
          minutes: 41,
          distanceKm: 37,
        },
        {
          kind: 'walk',
          from: 'Marienplatz (S)',
          to: 'Marienplatz (U6)',
          minutes: 5,
          distanceKm: 0.2,
          note: 'Change to U6',
        },
        u6('Marienplatz', 16, 10.5),
        esplanade(),
      ],
      car: carToArena('Flughafen München', 30, 32),
    },
  },
  {
    id: 'augsburg',
    label: 'Augsburg Hbf',
    area: 'Augsburg',
    mapsQuery: 'Augsburg Hauptbahnhof',
    keywords: ['augsburg'],
    routes: {
      ubahn: [
        {
          kind: 'regio',
          from: 'Augsburg Hbf',
          to: 'München Hbf',
          line: 'RE',
          minutes: 38,
          distanceKm: 62,
        },
        ...viaHbfToU6(),
      ],
      car: carToArena('Augsburg', 55, 72),
      fanbus: fanBus('Augsburg', 60, 72),
    },
  },
  {
    id: 'rosenheim',
    label: 'Rosenheim',
    area: 'Rosenheim',
    mapsQuery: 'Rosenheim Bahnhof',
    keywords: ['rosenheim', 'chiemgau'],
    routes: {
      ubahn: [
        {
          kind: 'regio',
          from: 'Rosenheim',
          to: 'München Hbf',
          line: 'RE',
          minutes: 50,
          distanceKm: 65,
        },
        ...viaHbfToU6(),
      ],
      car: carToArena('Rosenheim', 50, 68),
      fanbus: fanBus('Rosenheim', 65, 68),
    },
  },
  {
    id: 'nuremberg',
    label: 'Nürnberg Hbf',
    area: 'Nürnberg',
    mapsQuery: 'Nürnberg Hauptbahnhof',
    keywords: ['nürnberg', 'nuremberg', 'nuernberg', 'franken'],
    routes: {
      ubahn: [
        {
          kind: 'regio',
          from: 'Nürnberg Hbf',
          to: 'München Hbf',
          line: 'ICE',
          minutes: 66,
          distanceKm: 170,
        },
        ...viaHbfToU6(),
      ],
      car: carToArena('Nürnberg', 100, 165),
      fanbus: fanBus('Nürnberg', 115, 165),
    },
  },
];

export function getOrigin(id: string): Origin {
  const o = ORIGINS.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown origin: ${id}`);
  return o;
}

export function availableModes(origin: Origin): Mode[] {
  return (Object.keys(origin.routes) as Mode[]).filter((m) => (origin.routes[m]?.length ?? 0) > 0);
}

export function legsMinutes(legs: readonly Leg[]): number {
  return legs.reduce((a, l) => a + l.minutes, 0);
}

export function legsDistance(legs: readonly Leg[]): number {
  return legs.reduce((a, l) => a + l.distanceKm, 0);
}

export function googleMapsUrl(origin: Origin, mode: Mode): string {
  const travelmode =
    mode === 'bike'
      ? 'bicycling'
      : mode === 'car'
        ? 'driving'
        : mode === 'walk'
          ? 'walking'
          : 'transit';
  const params = new URLSearchParams({
    api: '1',
    origin: origin.mapsQuery,
    destination: ARENA_ADDRESS,
    travelmode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
