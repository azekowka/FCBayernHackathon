import { normalizeAngle, type Stand, type StadiumBlock } from '../seats/stadium';
import { kioskQueue } from './crowd';

/**
 * Venue layout for wayfinding: entrance zones and concessions placed around
 * the bowl (illustrative positions; production would use the Arena's map).
 */

export interface Entrance {
  zone: Stand;
  label: string;
  /** Walk from the end of the Esplanade (south) to this entrance. */
  extraWalkMinutes: number;
  share: number;
  stepFree: boolean;
}

export const ENTRANCES: Record<Stand, Entrance> = {
  Süd: { zone: 'Süd', label: 'Eingang Süd', extraWalkMinutes: 0, share: 0.27, stepFree: true },
  Ost: { zone: 'Ost', label: 'Eingang Ost', extraWalkMinutes: 4, share: 0.26, stepFree: true },
  West: { zone: 'West', label: 'Eingang West', extraWalkMinutes: 4, share: 0.27, stepFree: true },
  Nord: { zone: 'Nord', label: 'Eingang Nord', extraWalkMinutes: 8, share: 0.2, stepFree: false },
};

export interface Amenity {
  id: string;
  kind: 'kiosk' | 'toilet';
  label: string;
  angle: number;
  tier: StadiumBlock['tier'];
  busyness: number;
}

const KIOSK_NAMES = [
  'Brezn & Bier',
  'Weißwurst-Eck',
  'Currywurst',
  'Veggie Kitchen',
  'Kaffee & Kuchen',
  'Grill Station',
];

export const AMENITIES: readonly Amenity[] = (() => {
  const out: Amenity[] = [];
  const tiers: StadiumBlock['tier'][] = ['lower', 'middle', 'upper'];
  tiers.forEach((tier, ti) => {
    for (let k = 0; k < 8; k++) {
      const angle = k * 45 + 22.5;
      const nearSouthCurve = angle > 45 && angle < 135 && tier === 'lower';
      out.push({
        id: `K-${tier[0]?.toUpperCase()}${k + 1}`,
        kind: 'kiosk',
        label: `${KIOSK_NAMES[(k + ti) % KIOSK_NAMES.length]} ${tier[0]?.toUpperCase()}${k + 1}`,
        angle,
        tier,
        busyness: nearSouthCurve
          ? 1.35
          : tier === 'upper'
            ? 0.9
            : 1 + ((k * 7 + ti * 3) % 5) * 0.06,
      });
      out.push({
        id: `WC-${tier[0]?.toUpperCase()}${k + 1}`,
        kind: 'toilet',
        label: `WC ${tier[0]?.toUpperCase()}${k + 1}`,
        angle: angle + 22.5,
        tier,
        busyness: nearSouthCurve ? 1.25 : 0.85 + ((k * 5 + ti) % 4) * 0.08,
      });
    }
  });
  return out;
})();

function angularDistance(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, 360 - d);
}

export function walkMinutesInside(block: StadiumBlock, amenity: Amenity): number {
  const mid = (block.startAngle + block.endAngle) / 2;
  const tierChange = block.tier === amenity.tier ? 0 : 2;
  return Math.max(1, Math.round(angularDistance(mid, amenity.angle) / 15) + tierChange);
}

export interface AmenityPick {
  amenity: Amenity;
  walkMinutes: number;
  queueMinutes: number;
  totalMinutes: number;
}

/** Best amenity for a block at a time: walking there plus queueing, minimised. */
export function bestAmenity(block: StadiumBlock, kind: Amenity['kind'], at: number): AmenityPick {
  let best: AmenityPick | null = null;
  for (const amenity of AMENITIES) {
    if (amenity.kind !== kind) continue;
    const walkMinutes = walkMinutesInside(block, amenity);
    if (walkMinutes > 6) continue;
    const queueMinutes = kioskQueue(at, amenity.busyness) * (kind === 'toilet' ? 0.6 : 1);
    const totalMinutes = walkMinutes * 2 + queueMinutes;
    if (!best || totalMinutes < best.totalMinutes)
      best = { amenity, walkMinutes, queueMinutes, totalMinutes };
  }
  if (!best) throw new Error(`No ${kind} near block ${block.id}`);
  return best;
}

/** Queue at the nearest amenity — what a fan would get without guidance. */
export function nearestAmenity(
  block: StadiumBlock,
  kind: Amenity['kind'],
  at: number,
): AmenityPick {
  let best: AmenityPick | null = null;
  for (const amenity of AMENITIES) {
    if (amenity.kind !== kind) continue;
    const walkMinutes = walkMinutesInside(block, amenity);
    if (!best || walkMinutes < best.walkMinutes) {
      const queueMinutes = kioskQueue(at, amenity.busyness) * (kind === 'toilet' ? 0.6 : 1);
      best = { amenity, walkMinutes, queueMinutes, totalMinutes: walkMinutes * 2 + queueMinutes };
    }
  }
  return best as AmenityPick;
}
