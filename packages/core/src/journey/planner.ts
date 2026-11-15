import { round } from '../shared/math';
import { clockAt, formatDuration } from '../shared/time';
import { describeBlock, getBlock, type StadiumBlock } from '../seats/stadium';
import {
  FULL_TIME,
  HALF_TIME,
  crowdLevel,
  gateWait,
  inboundAt,
  inboundCurve,
  outboundCurve,
  outboundWait,
  type CrowdLevel,
} from './crowd';
import { DISRUPTIONS, type Disruption, type DisruptionId } from './disruptions';
import {
  MODE_LABEL,
  availableModes,
  getOrigin,
  googleMapsUrl,
  legsDistance,
  legsMinutes,
  type Leg,
  type LegKind,
  type Mode,
  type Origin,
} from './network';
import { ENTRANCES, bestAmenity, nearestAmenity, type AmenityPick, type Entrance } from './venue';

/**
 * "Vom Sofa bis zum Sitz" — the matchday journey planner.
 *
 * Deterministic optimisation over departure times: minimise crowding, queueing
 * and idle time subject to "be in my seat N minutes before kick-off". Gemini
 * narrates the plan and answers questions about it; it never invents times.
 */

export type PostMatchPreference = 'asap' | 'relaxed' | 'auto';

export interface JourneyPreferences {
  /** Minutes before kick-off the fan wants to be in the seat. */
  seatedBy: number;
  wantsFood: boolean;
  withKids: boolean;
  stepFree: boolean;
  postMatch: PostMatchPreference;
}

export const DEFAULT_PREFERENCES: JourneyPreferences = {
  seatedBy: 20,
  wantsFood: true,
  withKids: false,
  stepFree: false,
  postMatch: 'auto',
};

export interface JourneyRequest {
  originId: string;
  mode: Mode;
  blockId: string;
  kickoff: string;
  fixtureLabel?: string;
  preferences?: Partial<JourneyPreferences>;
  disruption?: DisruptionId | null;
}

export type StepKind =
  | 'depart'
  | 'walk'
  | 'ride'
  | 'drive'
  | 'cycle'
  | 'arrive'
  | 'gate'
  | 'food'
  | 'seat'
  | 'kickoff'
  | 'halftime'
  | 'fulltime'
  | 'postmatch'
  | 'return'
  | 'home';

export interface TimelineStep {
  id: string;
  kind: StepKind;
  at: number;
  clock: string;
  title: string;
  detail: string;
  crowd?: CrowdLevel;
  line?: string;
}

export interface PostMatchOption {
  stayMinutes: number;
  label: string;
  queueMinutes: number;
  homeAt: number;
  homeClock: string;
  recommended: boolean;
}

export interface ModeEvaluation {
  mode: Mode;
  modeLabel: string;
  legs: Leg[];
  departAt: number;
  esplanadeAt: number;
  gateAt: number;
  gateQueueMinutes: number;
  seatedAt: number;
  rideWaitMinutes: number;
  crowd: CrowdLevel | null;
  kiosk: AmenityPick | null;
  cost: number;
  doorToSeatMinutes: number;
}

export interface GreenScore {
  points: number;
  co2SavedKg: number;
  breakdown: string[];
}

export interface Alert {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
}

export interface JourneyFacts {
  origin: string;
  block: string;
  fixture: string | null;
  mode: string;
  switchedFrom: string | null;
  departClock: string;
  seatedClock: string;
  kickoffClock: string;
  crowd: CrowdLevel | null;
  crowdWaitMinutes: number;
  entrance: string;
  gateQueueMinutes: number;
  kiosk: { label: string; queueMinutes: number; nearestQueueMinutes: number } | null;
  postMatch: {
    stayMinutes: number;
    queueMinutes: number;
    homeClock: string;
    queueIfLeavingNow: number;
    homeClockIfLeavingNow: string;
  };
  greenPoints: number;
  co2SavedKg: number;
  withKids: boolean;
  alerts: string[];
}

export interface JourneyPlan {
  request: JourneyRequest;
  preferences: JourneyPreferences;
  origin: Origin;
  block: StadiumBlock;
  entrance: Entrance;
  chosen: ModeEvaluation;
  alternatives: ModeEvaluation[];
  timeline: TimelineStep[];
  postMatch: PostMatchOption[];
  inboundCurve: { at: number; load: number; waitMinutes: number; level: CrowdLevel }[];
  outboundCurve: { afterFullTime: number; waitMinutes: number }[];
  green: GreenScore;
  alerts: Alert[];
  disruption: Disruption | null;
  googleMapsUrl: string;
  facts: JourneyFacts;
}

const EXIT_MINUTES: Record<StadiumBlock['tier'], number> = { lower: 6, middle: 9, upper: 12 };
const INSIDE_WALK: Record<StadiumBlock['tier'], number> = { lower: 4, middle: 6, upper: 8 };
const CO2_PER_KM: Record<LegKind, number> = {
  walk: 0,
  bike: 0,
  ubahn: 0.05,
  sbahn: 0.04,
  regio: 0.03,
  bus: 0.03,
  car: 0.15,
  park: 0,
};
const MODE_POINTS: Record<Mode, number> = { ubahn: 15, bike: 25, walk: 25, fanbus: 15, car: 0 };

function entranceFor(block: StadiumBlock, stepFree: boolean): Entrance {
  const own = ENTRANCES[block.entrance];
  if (!stepFree || own.stepFree) return own;
  return ENTRANCES.Ost.extraWalkMinutes <= ENTRANCES.West.extraWalkMinutes
    ? ENTRANCES.Ost
    : ENTRANCES.West;
}

function transformLegs(legs: readonly Leg[], disruption: Disruption | null): Leg[] {
  const base = disruption?.transformLegs ? disruption.transformLegs(legs) : [...legs];
  if (!disruption || disruption.carSlowdown === 1) return base;
  return base.map((l) =>
    l.kind === 'car' ? { ...l, minutes: Math.round(l.minutes * disruption.carSlowdown) } : l,
  );
}

/** Minutes of the legs after the crowd-sensitive U6 ride (usually the Esplanade walk). */
function splitAtCrowdLeg(legs: readonly Leg[]): { crowdIdx: number; after: number } {
  const crowdIdx = legs.findIndex((l) => l.crowdSensitive);
  if (crowdIdx < 0) return { crowdIdx, after: 0 };
  return { crowdIdx, after: legsMinutes(legs.slice(crowdIdx + 1)) };
}

function evaluateMode(
  origin: Origin,
  mode: Mode,
  block: StadiumBlock,
  entrance: Entrance,
  prefs: JourneyPreferences,
  disruption: Disruption | null,
): ModeEvaluation {
  const legs = transformLegs(origin.routes[mode] ?? [], disruption);
  const travel = legsMinutes(legs);
  const { crowdIdx, after } = splitAtCrowdLeg(legs);
  const demand = disruption?.inbound.demand ?? 1;
  const capacity = disruption?.inbound.capacity ?? 1;
  const target = -prefs.seatedBy;
  const kidsFactor = prefs.withKids ? 1.6 : 1;
  const penalty = disruption?.modePenalty[mode] ?? 0;

  let best: ModeEvaluation | null = null;
  for (let esplanadeAt = -210; esplanadeAt <= target; esplanadeAt += 5) {
    let rideWait = 0;
    let crowd: CrowdLevel | null = null;
    let crowdPenalty = 0;
    if (crowdIdx >= 0) {
      const p = inboundAt(esplanadeAt - after, demand, capacity);
      rideWait = p.waitMinutes;
      crowd = p.level;
      crowdPenalty = Math.max(0, p.load - 0.85) * 18 * kidsFactor;
    } else if (mode === 'car') {
      // Approach roads jam at the same time the U6 does.
      const p = inboundAt(esplanadeAt - 12, demand, capacity);
      rideWait = Math.max(0, p.load - 0.6) * 12;
    }
    const gateAt = esplanadeAt + entrance.extraWalkMinutes;
    const gateQueueMinutes = gateWait(gateAt, entrance.share, demand);
    const inside = gateAt + gateQueueMinutes + INSIDE_WALK[block.tier];
    const kiosk = prefs.wantsFood ? bestAmenity(block, 'kiosk', inside) : null;
    const seatedAt = inside + (kiosk ? kiosk.totalMinutes + 4 : 0);
    const late = Math.max(0, seatedAt - target);
    const idle = Math.max(0, target - seatedAt);
    const cost =
      rideWait * 1.2 * kidsFactor +
      crowdPenalty +
      gateQueueMinutes * kidsFactor +
      (kiosk?.queueMinutes ?? 0) * 0.5 +
      idle * 0.3 +
      late * 60 +
      penalty;
    const departAt = esplanadeAt - travel - rideWait;
    const candidate: ModeEvaluation = {
      mode,
      modeLabel: MODE_LABEL[mode],
      legs,
      departAt: Math.floor(departAt),
      esplanadeAt,
      gateAt,
      gateQueueMinutes,
      seatedAt: Math.ceil(seatedAt),
      rideWaitMinutes: rideWait,
      crowd,
      kiosk,
      cost,
      doorToSeatMinutes: Math.ceil(seatedAt) - Math.floor(departAt),
    };
    if (!best || cost <= best.cost) best = candidate;
  }
  return best as ModeEvaluation;
}

function postMatchOptions(
  ev: ModeEvaluation,
  block: StadiumBlock,
  prefs: JourneyPreferences,
  disruption: Disruption | null,
  kickoff: string,
): PostMatchOption[] {
  const exit = EXIT_MINUTES[block.tier];
  const { crowdIdx, after } = splitAtCrowdLeg(ev.legs);
  const travel = legsMinutes(ev.legs);
  const od = disruption?.outbound.demand ?? 1;
  const oc = disruption?.outbound.capacity ?? 1;

  const stays = ev.mode === 'fanbus' ? [0] : [0, 15, 30, 45];
  const options = stays.map((s) => {
    let queue = 0;
    let home = FULL_TIME + exit + s;
    if (crowdIdx >= 0) {
      queue = outboundWait(exit + s + after, od, oc);
      home += after + queue + (travel - after);
    } else if (ev.mode === 'car') {
      queue = Math.max(2, 34 * Math.exp(-(exit + s) / 22));
      home += 12 + queue + (travel - 12);
    } else if (ev.mode === 'fanbus') {
      queue = Math.max(0, 45 - exit);
      home += queue + travel;
    } else {
      home += travel;
    }
    const label =
      ev.mode === 'fanbus'
        ? 'Bus leaves 45 min after the final whistle'
        : s === 0
          ? 'Leave with the crowd'
          : s === 15
            ? 'Stay 15 min — interviews on the big screen'
            : s === 30
              ? 'Stay 30 min — post-match show'
              : 'Stay 45 min — let the Esplanade clear';
    return {
      stayMinutes: s,
      label,
      queueMinutes: queue,
      homeAt: Math.round(home),
      homeClock: clockAt(kickoff, Math.round(home)),
      recommended: false,
    };
  });

  let pick = options[0] as PostMatchOption;
  if (prefs.postMatch === 'relaxed') pick = options.find((o) => o.stayMinutes === 30) ?? pick;
  else if (prefs.postMatch === 'auto') {
    const crowdWeight = prefs.withKids ? 2.2 : 1.4;
    pick = options.reduce((a, o) =>
      o.queueMinutes * crowdWeight + o.stayMinutes * 0.45 <
      a.queueMinutes * crowdWeight + a.stayMinutes * 0.45
        ? o
        : a,
    );
  }
  pick.recommended = true;
  return options;
}

function greenScore(ev: ModeEvaluation, stayMinutes: number): GreenScore {
  // Baseline: driving the same non-walking distance instead.
  const drivable = legsDistance(ev.legs.filter((l) => l.kind !== 'walk' && l.kind !== 'park'));
  const emitted = ev.legs.reduce((a, l) => a + l.distanceKm * CO2_PER_KM[l.kind], 0);
  const baseline = drivable * CO2_PER_KM.car;
  const saved = Math.max(0, 2 * (baseline - emitted));
  const breakdown = [`${MODE_POINTS[ev.mode]} pts for travelling by ${ev.modeLabel.toLowerCase()}`];
  let points = MODE_POINTS[ev.mode];
  if (stayMinutes >= 15) {
    points += 10;
    breakdown.push('10 pts for a staggered return (eases the U6 crush)');
  }
  return { points, co2SavedKg: round(saved, 1), breakdown };
}

function stepKindForLeg(kind: LegKind): StepKind {
  if (kind === 'car') return 'drive';
  if (kind === 'bike') return 'cycle';
  if (kind === 'walk' || kind === 'park') return 'walk';
  return 'ride';
}

function legTitle(l: Leg): string {
  switch (l.kind) {
    case 'walk':
      return `Walk to ${l.to}`;
    case 'park':
      return `Park at ${l.from}`;
    case 'bike':
      return `Cycle to ${l.to}`;
    case 'car':
      return `Drive to ${l.to}`;
    case 'bus':
      return `Fan-club bus to ${l.to}`;
    default:
      return `${l.line ?? 'Train'} ${l.from} → ${l.to}`;
  }
}

function buildTimeline(plan: {
  ev: ModeEvaluation;
  origin: Origin;
  block: StadiumBlock;
  entrance: Entrance;
  prefs: JourneyPreferences;
  post: PostMatchOption;
  leaveNow: PostMatchOption;
  kickoff: string;
}): TimelineStep[] {
  const { ev, origin, block, entrance, prefs, post, leaveNow, kickoff } = plan;
  const steps: TimelineStep[] = [];
  const add = (s: Omit<TimelineStep, 'id' | 'clock'>) =>
    steps.push({ ...s, id: `s${steps.length + 1}`, clock: clockAt(kickoff, s.at) });

  add({
    kind: 'depart',
    at: ev.departAt,
    title: `Leave ${origin.label}`,
    detail: `${ev.doorToSeatMinutes} min door to seat via ${ev.modeLabel}.`,
  });
  let t = ev.departAt;
  for (const leg of ev.legs) {
    if (leg.crowdSensitive && ev.rideWaitMinutes >= 1) {
      t += Math.round(ev.rideWaitMinutes);
    }
    add({
      kind: stepKindForLeg(leg.kind),
      at: Math.round(t),
      title: legTitle(leg),
      detail: [
        `${leg.minutes} min`,
        leg.note,
        leg.crowdSensitive && ev.crowd
          ? `Crowd: ${ev.crowd}${ev.rideWaitMinutes >= 1 ? ` (+${Math.round(ev.rideWaitMinutes)} min platform wait)` : ''}`
          : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
      crowd: leg.crowdSensitive ? (ev.crowd ?? undefined) : undefined,
      line: leg.line,
    });
    t += leg.minutes;
  }
  add({
    kind: 'gate',
    at: Math.round(ev.gateAt),
    title: entrance.label,
    detail: `~${Math.max(1, Math.round(ev.gateQueueMinutes))} min at the turnstiles. Have your app ticket ready${prefs.stepFree ? ' · step-free route' : ''}.`,
  });
  if (ev.kiosk) {
    add({
      kind: 'food',
      at: Math.round(ev.gateAt + ev.gateQueueMinutes + INSIDE_WALK[block.tier]),
      title: ev.kiosk.amenity.label,
      detail: `~${Math.round(ev.kiosk.queueMinutes)} min queue, ${ev.kiosk.walkMinutes} min walk from your block.`,
    });
  }
  add({
    kind: 'seat',
    at: ev.seatedAt,
    title: `In your seat — ${describeBlock(block)}`,
    detail: `${-ev.seatedAt} min before kick-off${prefs.seatedBy >= 30 ? ' — in time for the choreo' : ''}.`,
  });
  add({ kind: 'kickoff', at: 0, title: 'Kick-off', detail: 'Servus und viel Spaß!' });
  const wc = bestAmenity(block, 'toilet', HALF_TIME.start - 4);
  add({
    kind: 'halftime',
    at: HALF_TIME.start,
    title: 'Half-time',
    detail: `Shortest queue: ${wc.amenity.label} (~${Math.round(wc.queueMinutes)} min). Tip: go at 43' or after 55'.`,
  });
  add({
    kind: 'fulltime',
    at: FULL_TIME,
    title: 'Final whistle',
    detail: 'Approximate — stoppage time varies.',
  });
  if (post.stayMinutes > 0) {
    add({
      kind: 'postmatch',
      at: FULL_TIME + post.stayMinutes,
      title: post.label,
      detail: `Queue at ${ev.mode === 'ubahn' ? 'Fröttmaning' : 'the exit'} ~${Math.round(post.queueMinutes)} min instead of ~${Math.round(leaveNow.queueMinutes)} min.`,
    });
  }
  add({
    kind: 'return',
    at: FULL_TIME + EXIT_MINUTES[block.tier] + post.stayMinutes,
    title: ev.mode === 'ubahn' ? 'Head back via the Esplanade' : 'Head home',
    detail:
      post.queueMinutes >= 1
        ? `Expect ~${Math.round(post.queueMinutes)} min of queueing.`
        : 'No queue expected.',
  });
  add({
    kind: 'home',
    at: post.homeAt,
    title: `Back at ${origin.label}`,
    detail: `Whole matchday: ${formatDuration(post.homeAt - ev.departAt)} door to door.`,
  });
  return steps;
}

export function planJourney(request: JourneyRequest): JourneyPlan {
  const prefs: JourneyPreferences = { ...DEFAULT_PREFERENCES, ...request.preferences };
  const origin = getOrigin(request.originId);
  const block = getBlock(request.blockId);
  const disruption = request.disruption ? DISRUPTIONS[request.disruption] : null;
  const entrance = entranceFor(block, prefs.stepFree);

  const modes = availableModes(origin).filter((m) => !disruption?.unavailableModes.includes(m));
  if (modes.length === 0)
    throw new Error(`No way to reach the Arena from ${origin.label} with this disruption.`);
  const evaluations = modes.map((m) => evaluateMode(origin, m, block, entrance, prefs, disruption));
  const requested = evaluations.find((e) => e.mode === request.mode);
  const ranked = [...evaluations].sort(
    (a, b) => a.cost + a.doorToSeatMinutes * 0.3 - (b.cost + b.doorToSeatMinutes * 0.3),
  );
  const chosen = requested ?? (ranked[0] as ModeEvaluation);
  const alternatives = ranked.filter((e) => e !== chosen);

  const postMatch = postMatchOptions(chosen, block, prefs, disruption, request.kickoff);
  const post = postMatch.find((o) => o.recommended) as PostMatchOption;
  const leaveNow = postMatch[0] as PostMatchOption;

  const alerts: Alert[] = [];
  if (disruption)
    alerts.push({
      severity: disruption.severity,
      title: disruption.title,
      detail: disruption.detail,
    });
  if (!requested) {
    alerts.push({
      severity: 'warning',
      title: `${MODE_LABEL[request.mode]} isn't an option right now`,
      detail: `Re-planned via ${chosen.modeLabel}${alternatives[0] ? `; plan B: ${alternatives[0].modeLabel}` : ''}.`,
    });
  }
  const better = alternatives[0];
  const penalty = disruption?.modePenalty[chosen.mode] ?? 0;
  if (requested && penalty > 0 && better && better.cost < chosen.cost) {
    alerts.push({
      severity: 'info',
      title: `Consider ${better.modeLabel} today`,
      detail: `${disruption?.title ?? 'Conditions'} make ${chosen.modeLabel.toLowerCase()} less pleasant; ${better.modeLabel} gets you in your seat by ${clockAt(request.kickoff, better.seatedAt)}.`,
    });
  }
  if (prefs.stepFree && entrance.zone !== block.entrance) {
    alerts.push({
      severity: 'info',
      title: `Step-free entry via ${entrance.label}`,
      detail: 'Lifts serve every tier from there.',
    });
  }

  const green = greenScore(chosen, post.stayMinutes);
  const timeline = buildTimeline({
    ev: chosen,
    origin,
    block,
    entrance,
    prefs,
    post,
    leaveNow,
    kickoff: request.kickoff,
  });
  const demand = disruption?.inbound.demand ?? 1;
  const capacity = disruption?.inbound.capacity ?? 1;

  const nearest = chosen.kiosk
    ? nearestAmenity(block, 'kiosk', chosen.gateAt + chosen.gateQueueMinutes)
    : null;
  const facts: JourneyFacts = {
    origin: origin.label,
    block: describeBlock(block),
    fixture: request.fixtureLabel ?? null,
    mode: chosen.modeLabel,
    switchedFrom: requested ? null : MODE_LABEL[request.mode],
    departClock: clockAt(request.kickoff, chosen.departAt),
    seatedClock: clockAt(request.kickoff, chosen.seatedAt),
    kickoffClock: clockAt(request.kickoff, 0),
    crowd: chosen.crowd,
    crowdWaitMinutes: Math.round(chosen.rideWaitMinutes),
    entrance: entrance.label,
    gateQueueMinutes: Math.max(1, Math.round(chosen.gateQueueMinutes)),
    kiosk:
      chosen.kiosk && nearest
        ? {
            label: chosen.kiosk.amenity.label,
            queueMinutes: Math.round(chosen.kiosk.queueMinutes),
            nearestQueueMinutes: Math.round(nearest.queueMinutes),
          }
        : null,
    postMatch: {
      stayMinutes: post.stayMinutes,
      queueMinutes: Math.round(post.queueMinutes),
      homeClock: post.homeClock,
      queueIfLeavingNow: Math.round(leaveNow.queueMinutes),
      homeClockIfLeavingNow: leaveNow.homeClock,
    },
    greenPoints: green.points,
    co2SavedKg: green.co2SavedKg,
    withKids: prefs.withKids,
    alerts: alerts.map((a) => a.title),
  };

  return {
    request,
    preferences: prefs,
    origin,
    block,
    entrance,
    chosen,
    alternatives,
    timeline,
    postMatch,
    inboundCurve: inboundCurve(demand, capacity)
      .filter((p) => p.at % 5 === 0)
      .map((p) => ({
        at: p.at,
        load: round(p.load, 3),
        waitMinutes: round(p.waitMinutes, 1),
        level: crowdLevel(p.load),
      })),
    outboundCurve: outboundCurve(
      disruption?.outbound.demand ?? 1,
      disruption?.outbound.capacity ?? 1,
    )
      .filter((p) => p.afterFullTime % 2 === 0 && p.afterFullTime <= 90)
      .map((p) => ({ afterFullTime: p.afterFullTime, waitMinutes: round(p.waitMinutes, 1) })),
    green,
    alerts,
    disruption,
    googleMapsUrl: googleMapsUrl(origin, chosen.mode),
    facts,
  };
}
