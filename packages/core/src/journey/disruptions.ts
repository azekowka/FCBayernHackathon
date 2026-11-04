import { ESPLANADE_MINUTES, STATION, type Leg, type Mode } from './network';

/**
 * Matchday disruptions the agent can re-plan around. Each one is a pure
 * transformation of routes and crowd parameters, so a re-plan is just
 * `planJourney({ ...request, disruption })`.
 */

export type DisruptionId = 'u6-strike' | 'u6-north-closure' | 'heavy-rain';

export interface Disruption {
  id: DisruptionId;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  unavailableModes: Mode[];
  inbound: { demand: number; capacity: number };
  outbound: { demand: number; capacity: number };
  /** Extra "discomfort minutes" when ranking modes (rain on a bike…). */
  modePenalty: Partial<Record<Mode, number>>;
  /** Road traffic multiplier for car legs. */
  carSlowdown: number;
  transformLegs?: (legs: readonly Leg[]) => Leg[];
}

const KIEFERNGARTEN_WALK: Leg = {
  kind: 'walk',
  from: 'Kieferngarten',
  to: 'Esplanade',
  minutes: 28,
  distanceKm: 2.3,
  note: 'Signposted fan walk along Werner-Heisenberg-Allee',
};

export const DISRUPTIONS: Record<DisruptionId, Disruption> = {
  'u6-strike': {
    id: 'u6-strike',
    title: 'Strike — no U-Bahn today',
    detail:
      'A public-transport strike stops MVG U-Bahn, tram and bus services. DB regional trains run. Plan for bike, car-pooling or the fan-club bus.',
    severity: 'critical',
    unavailableModes: ['ubahn'],
    inbound: { demand: 1, capacity: 1 },
    outbound: { demand: 1, capacity: 1 },
    modePenalty: {},
    carSlowdown: 1.6,
  },
  'u6-north-closure': {
    id: 'u6-north-closure',
    title: 'U6 disrupted: Kieferngarten – Fröttmaning',
    detail:
      'Trains terminate at Kieferngarten. Follow the signposted fan walk (~28 min) or allow extra time for replacement buses.',
    severity: 'warning',
    unavailableModes: [],
    inbound: { demand: 1, capacity: 0.85 },
    outbound: { demand: 1, capacity: 0.75 },
    modePenalty: {},
    carSlowdown: 1.15,
    transformLegs: (legs) =>
      legs.flatMap((leg): Leg[] => {
        if (leg.crowdSensitive && leg.to === STATION) {
          return [
            {
              ...leg,
              to: 'Kieferngarten',
              minutes: Math.max(2, leg.minutes - 2),
              note: 'Terminates at Kieferngarten',
            },
          ];
        }
        if (leg.from === STATION && leg.minutes === ESPLANADE_MINUTES) return [KIEFERNGARTEN_WALK];
        if (leg.line === 'U6' && leg.to === STATION) {
          // Southbound from Garching: stop before the closed section, then walk.
          return [
            { ...leg, to: 'Garching-Hochbrück', minutes: Math.max(2, leg.minutes - 3) },
            { ...KIEFERNGARTEN_WALK, from: 'Garching-Hochbrück', minutes: 32, distanceKm: 2.6 },
          ];
        }
        return [leg];
      }),
  },
  'heavy-rain': {
    id: 'heavy-rain',
    title: 'Heavy rain this afternoon',
    detail:
      'Thunderstorms expected around kick-off. The Arena roof covers every seat — the Esplanade does not. More fans will take the U6.',
    severity: 'info',
    unavailableModes: [],
    inbound: { demand: 1.08, capacity: 1 },
    outbound: { demand: 1.06, capacity: 1 },
    modePenalty: { bike: 25, walk: 30 },
    carSlowdown: 1.25,
  },
};

export function getDisruption(id: DisruptionId): Disruption {
  return DISRUPTIONS[id];
}
