import type { BlockKind } from './stadium';

/**
 * Smart seat recycling engine — "Kein Platz bleibt leer".
 *
 * Event-sourced and deterministic: the same event log always produces the same
 * state, so the server-side live room, the in-browser stage mode and the
 * Monte-Carlo simulation all run the exact same rules.
 *
 * Rules (published to fans):
 *  1. A released seat is offered to the highest-placed fan on the waitlist
 *     (the ballot's own verifiable draw order) whose group fits and who can
 *     still reach the Arena in time. Face value only — no fees, no surge.
 *  2. Offers expire; the window shrinks as kick-off approaches. Declining or
 *     missing an offer costs nothing but this match.
 *  3. Unused seats in a multi-seat release are re-listed immediately.
 *  4. Holders may instead gift seats to a youth fan club contingent.
 *  5. No new offers once the match has kicked off.
 */

export type Minutes = number; // relative to kick-off (negative = before)
export type SeatPreference = 'any' | 'standing' | 'seated';

export interface WaitlistFan {
  id: string;
  name: string;
  /** Position in the draw's waitlist (1 = next in line). */
  rank: number;
  groupSize: number;
  /** Door-to-seat travel time, coarse and opt-in. */
  travelMinutes: number;
  preference: SeatPreference;
  needsAccessible: boolean;
  pechvogel: number;
}

export type FanStatus = 'waiting' | 'offered' | 'seated' | 'passed' | 'missed';

export interface ListingInput {
  holderId: string;
  seatIds: string[];
  blockId: string;
  kind: BlockKind;
  accessible: boolean;
  faceValue: number;
}

export type ListingStatus = 'open' | 'offered' | 'refilled' | 'donated' | 'unfilled';

export interface Listing extends ListingInput {
  id: string;
  releasedAt: Minutes;
  status: ListingStatus;
  mode: 'waitlist' | 'youth';
  /** Parent listing when this one holds the leftover seats of a split. */
  parentId?: string;
  filledAt?: Minutes;
  fanId?: string;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Offer {
  id: string;
  listingId: string;
  fanId: string;
  seatIds: string[];
  createdAt: Minutes;
  expiresAt: Minutes;
  status: OfferStatus;
  resolvedAt?: Minutes;
}

export type RecyclingEvent =
  | { type: 'release'; at: Minutes; listing: ListingInput; mode?: 'waitlist' | 'youth' }
  | { type: 'accept'; at: Minutes; offerId: string }
  | { type: 'decline'; at: Minutes; offerId: string }
  | { type: 'tick'; at: Minutes };

export type LogKind =
  | 'released'
  | 'donated'
  | 'offered'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'unfilled'
  | 'rejected';

export interface LogEntry {
  seq: number;
  at: Minutes;
  kind: LogKind;
  listingId?: string;
  offerId?: string;
  fanId?: string;
  seats: number;
  message: string;
}

export interface RecyclingStats {
  seatsReleased: number;
  seatsRefilled: number;
  seatsDonated: number;
  seatsUnfilled: number;
  seatsSearching: number;
  offersMade: number;
  offersAccepted: number;
  offersDeclined: number;
  offersExpired: number;
  fansSeated: number;
  /** Median minutes from release to refill. */
  medianMinutesToRefill: number | null;
  /** refilled / (released − donated) */
  refillRate: number;
}

export interface EngineConfig {
  /** Time after which no offers are created (default: kick-off). */
  cutoff: Minutes;
  /** Minutes a fan needs on top of travel time to be in the seat. */
  arrivalBuffer: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = { cutoff: 0, arrivalBuffer: 15 };

/** Offer window in minutes, shrinking towards kick-off. */
export function offerWindowMinutes(minutesToKickoff: number): number {
  if (minutesToKickoff >= 24 * 60) return 60;
  if (minutesToKickoff >= 6 * 60) return 30;
  if (minutesToKickoff >= 2 * 60) return 15;
  if (minutesToKickoff >= 45) return 8;
  return 4;
}

export function preferenceMatches(pref: SeatPreference, kind: BlockKind): boolean {
  if (pref === 'any') return true;
  if (pref === 'standing') return kind === 'standing';
  return kind !== 'standing';
}

interface Queue {
  groupSize: number;
  preference: SeatPreference;
  needsAccessible: boolean;
  fans: number[];
  cursor: number;
}

export interface RecyclingSnapshot {
  now: Minutes;
  listings: Listing[];
  offers: Offer[];
  fanStatus: Record<string, FanStatus>;
  log: LogEntry[];
  stats: RecyclingStats;
}

export class RecyclingEngine {
  readonly config: EngineConfig;
  private readonly fans: WaitlistFan[];
  private readonly fanIndex = new Map<string, number>();
  private readonly status: FanStatus[];
  private readonly queues: Queue[] = [];
  private readonly listings = new Map<string, Listing>();
  private readonly offers = new Map<string, Offer>();
  private readonly log: LogEntry[] = [];
  private readonly events: RecyclingEvent[] = [];
  private listingSeq = 0;
  private offerSeq = 0;
  private logSeq = 0;
  private now: Minutes = Number.NEGATIVE_INFINITY;

  constructor(waitlist: readonly WaitlistFan[], config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.fans = [...waitlist].sort((a, b) => a.rank - b.rank);
    this.status = this.fans.map(() => 'waiting');
    const byKey = new Map<string, Queue>();
    this.fans.forEach((f, i) => {
      if (this.fanIndex.has(f.id)) throw new Error(`Duplicate waitlist fan: ${f.id}`);
      this.fanIndex.set(f.id, i);
      const key = `${f.groupSize}|${f.preference}|${f.needsAccessible}`;
      let q = byKey.get(key);
      if (!q) {
        q = {
          groupSize: f.groupSize,
          preference: f.preference,
          needsAccessible: f.needsAccessible,
          fans: [],
          cursor: 0,
        };
        byKey.set(key, q);
        this.queues.push(q);
      }
      q.fans.push(i);
    });
  }

  static replay(
    waitlist: readonly WaitlistFan[],
    events: readonly RecyclingEvent[],
    config?: Partial<EngineConfig>,
  ) {
    const engine = new RecyclingEngine(waitlist, config);
    for (const e of events) engine.dispatch(e);
    return engine;
  }

  /** Applies one event and returns the log entries it produced. */
  dispatch(event: RecyclingEvent): LogEntry[] {
    const before = this.log.length;
    if (event.at < this.now) {
      this.push(
        event.at,
        'rejected',
        0,
        `Event at ${event.at} is older than the engine clock (${this.now}).`,
      );
      return this.log.slice(before);
    }
    this.events.push(event);
    this.now = event.at;
    this.expireOffers(event.at);

    switch (event.type) {
      case 'release':
        this.release(event.at, event.listing, event.mode ?? 'waitlist');
        break;
      case 'accept':
        this.accept(event.at, event.offerId);
        break;
      case 'decline':
        this.decline(event.at, event.offerId);
        break;
      case 'tick':
        break;
    }

    if (event.at >= this.config.cutoff) this.closeUnfilled(event.at);
    else this.assignOpenListings(event.at);
    return this.log.slice(before);
  }

  getEvents(): readonly RecyclingEvent[] {
    return this.events;
  }

  getFan(id: string): WaitlistFan | undefined {
    const i = this.fanIndex.get(id);
    return i === undefined ? undefined : this.fans[i];
  }

  fanStatus(id: string): FanStatus | undefined {
    const i = this.fanIndex.get(id);
    return i === undefined ? undefined : this.status[i];
  }

  getOffer(id: string): Offer | undefined {
    const o = this.offers.get(id);
    return o ? { ...o, seatIds: [...o.seatIds] } : undefined;
  }

  getListing(id: string): Listing | undefined {
    const l = this.listings.get(id);
    return l ? { ...l, seatIds: [...l.seatIds] } : undefined;
  }

  pendingOfferFor(fanId: string): Offer | undefined {
    for (const o of this.offers.values())
      if (o.fanId === fanId && o.status === 'pending') return { ...o };
    return undefined;
  }

  /** Earliest pending expiry — callers schedule a tick for it. */
  nextExpiry(): Minutes | null {
    let next: number | null = null;
    for (const o of this.offers.values()) {
      if (o.status === 'pending' && (next === null || o.expiresAt < next)) next = o.expiresAt;
    }
    return next;
  }

  stats(): RecyclingStats {
    let seatsReleased = 0;
    let seatsRefilled = 0;
    let seatsDonated = 0;
    let seatsUnfilled = 0;
    let seatsSearching = 0;
    const refillTimes: number[] = [];
    for (const l of this.listings.values()) {
      const n = l.seatIds.length;
      // A split partitions a release's seats between parent and child listings,
      // so summing every listing counts each released seat exactly once.
      seatsReleased += n;
      if (l.status === 'refilled') {
        seatsRefilled += n;
        if (l.filledAt !== undefined) refillTimes.push(l.filledAt - this.rootReleaseTime(l));
      } else if (l.status === 'donated') seatsDonated += n;
      else if (l.status === 'unfilled') seatsUnfilled += n;
      else seatsSearching += n;
    }
    let offersAccepted = 0;
    let offersDeclined = 0;
    let offersExpired = 0;
    for (const o of this.offers.values()) {
      if (o.status === 'accepted') offersAccepted++;
      else if (o.status === 'declined') offersDeclined++;
      else if (o.status === 'expired') offersExpired++;
    }
    refillTimes.sort((a, b) => a - b);
    const mid = Math.floor(refillTimes.length / 2);
    const median =
      refillTimes.length === 0
        ? null
        : refillTimes.length % 2 === 1
          ? (refillTimes[mid] as number)
          : ((refillTimes[mid - 1] as number) + (refillTimes[mid] as number)) / 2;
    const recyclable = seatsReleased - seatsDonated;
    return {
      seatsReleased,
      seatsRefilled,
      seatsDonated,
      seatsUnfilled,
      seatsSearching,
      offersMade: this.offers.size,
      offersAccepted,
      offersDeclined,
      offersExpired,
      fansSeated: this.status.filter((s) => s === 'seated').length,
      medianMinutesToRefill: median,
      refillRate: recyclable > 0 ? seatsRefilled / recyclable : 0,
    };
  }

  snapshot(
    options: { logLimit?: number; includeFans?: readonly string[] } = {},
  ): RecyclingSnapshot {
    const fanStatus: Record<string, FanStatus> = {};
    const ids = options.includeFans ?? this.fans.map((f) => f.id);
    for (const id of ids) {
      const s = this.fanStatus(id);
      if (s) fanStatus[id] = s;
    }
    const limit = options.logLimit ?? 200;
    return {
      now: this.now,
      listings: [...this.listings.values()].map((l) => ({ ...l, seatIds: [...l.seatIds] })),
      offers: [...this.offers.values()].map((o) => ({ ...o, seatIds: [...o.seatIds] })),
      fanStatus,
      log: this.log.slice(-limit),
      stats: this.stats(),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private rootReleaseTime(l: Listing): Minutes {
    let cur: Listing | undefined = l;
    while (cur?.parentId) cur = this.listings.get(cur.parentId);
    return cur?.releasedAt ?? l.releasedAt;
  }

  private push(
    at: Minutes,
    kind: LogKind,
    seats: number,
    message: string,
    ids: Partial<LogEntry> = {},
  ) {
    this.log.push({ seq: ++this.logSeq, at, kind, seats, message, ...ids });
  }

  private release(at: Minutes, input: ListingInput, mode: 'waitlist' | 'youth') {
    if (input.seatIds.length === 0) {
      this.push(at, 'rejected', 0, 'A release needs at least one seat.');
      return;
    }
    if (at >= this.config.cutoff) {
      this.push(at, 'rejected', input.seatIds.length, 'Releases close at kick-off.');
      return;
    }
    const id = `L${++this.listingSeq}`;
    const listing: Listing = {
      ...input,
      seatIds: [...input.seatIds],
      id,
      releasedAt: at,
      mode,
      status: mode === 'youth' ? 'donated' : 'open',
    };
    this.listings.set(id, listing);
    const n = input.seatIds.length;
    if (mode === 'youth') {
      listing.filledAt = at;
      this.push(
        at,
        'donated',
        n,
        `${n} seat${n > 1 ? 's' : ''} in block ${input.blockId} gifted to a youth fan club.`,
        { listingId: id },
      );
    } else {
      this.push(
        at,
        'released',
        n,
        `${n} seat${n > 1 ? 's' : ''} released in block ${input.blockId}.`,
        { listingId: id },
      );
    }
  }

  private accept(at: Minutes, offerId: string) {
    const offer = this.offers.get(offerId);
    if (!offer || offer.status !== 'pending') {
      this.push(at, 'rejected', 0, `Offer ${offerId} is no longer open.`, { offerId });
      return;
    }
    const listing = this.listings.get(offer.listingId) as Listing;
    const fanIdx = this.fanIndex.get(offer.fanId) as number;
    offer.status = 'accepted';
    offer.resolvedAt = at;
    this.status[fanIdx] = 'seated';

    const fan = this.fans[fanIdx] as WaitlistFan;
    const taken = listing.seatIds.slice(0, fan.groupSize);
    const leftover = listing.seatIds.slice(fan.groupSize);
    listing.seatIds = taken;
    listing.status = 'refilled';
    listing.filledAt = at;
    listing.fanId = fan.id;
    this.push(
      at,
      'accepted',
      taken.length,
      `${fan.name} accepted ${taken.length} seat${taken.length > 1 ? 's' : ''} in block ${listing.blockId}.`,
      {
        listingId: listing.id,
        offerId,
        fanId: fan.id,
      },
    );
    if (leftover.length > 0) {
      const id = `L${++this.listingSeq}`;
      this.listings.set(id, {
        ...listing,
        id,
        seatIds: leftover,
        status: 'open',
        parentId: listing.id,
        fanId: undefined,
        filledAt: undefined,
        releasedAt: at,
      });
    }
  }

  private decline(at: Minutes, offerId: string) {
    const offer = this.offers.get(offerId);
    if (!offer || offer.status !== 'pending') {
      this.push(at, 'rejected', 0, `Offer ${offerId} is no longer open.`, { offerId });
      return;
    }
    offer.status = 'declined';
    offer.resolvedAt = at;
    const fanIdx = this.fanIndex.get(offer.fanId) as number;
    this.status[fanIdx] = 'passed';
    const listing = this.listings.get(offer.listingId) as Listing;
    listing.status = 'open';
    const fan = this.fans[fanIdx] as WaitlistFan;
    this.push(
      at,
      'declined',
      offer.seatIds.length,
      `${fan.name} passed — offering to the next fan in line.`,
      {
        listingId: listing.id,
        offerId,
        fanId: fan.id,
      },
    );
  }

  private expireOffers(at: Minutes) {
    for (const offer of this.offers.values()) {
      if (offer.status !== 'pending' || offer.expiresAt > at) continue;
      offer.status = 'expired';
      offer.resolvedAt = offer.expiresAt;
      const fanIdx = this.fanIndex.get(offer.fanId) as number;
      this.status[fanIdx] = 'missed';
      const listing = this.listings.get(offer.listingId) as Listing;
      listing.status = 'open';
      const fan = this.fans[fanIdx] as WaitlistFan;
      this.push(
        offer.expiresAt,
        'expired',
        offer.seatIds.length,
        `Offer to ${fan.name} expired — moving on.`,
        {
          listingId: listing.id,
          offerId: offer.id,
          fanId: fan.id,
        },
      );
    }
  }

  private closeUnfilled(at: Minutes) {
    for (const l of this.listings.values()) {
      if (l.status !== 'open') continue;
      l.status = 'unfilled';
      this.push(
        at,
        'unfilled',
        l.seatIds.length,
        `Kick-off: ${l.seatIds.length} seat${l.seatIds.length > 1 ? 's' : ''} in block ${l.blockId} could not be refilled.`,
        {
          listingId: l.id,
        },
      );
    }
  }

  private assignOpenListings(at: Minutes) {
    const open = [...this.listings.values()]
      .filter((l) => l.status === 'open')
      .sort((a, b) => a.releasedAt - b.releasedAt || Number(a.id.slice(1)) - Number(b.id.slice(1)));
    for (const listing of open) {
      const fanIdx = this.findCandidate(listing, at);
      if (fanIdx === null) continue;
      const fan = this.fans[fanIdx] as WaitlistFan;
      const minutesToKickoff = -at;
      const expiresAt = Math.min(at + offerWindowMinutes(minutesToKickoff), this.config.cutoff);
      const id = `O${++this.offerSeq}`;
      const seatIds = listing.seatIds.slice(0, fan.groupSize);
      this.offers.set(id, {
        id,
        listingId: listing.id,
        fanId: fan.id,
        seatIds,
        createdAt: at,
        expiresAt,
        status: 'pending',
      });
      this.status[fanIdx] = 'offered';
      listing.status = 'offered';
      this.push(
        at,
        'offered',
        seatIds.length,
        `Offered to ${fan.name} (waitlist #${fan.rank}) — ${expiresAt - at} min to accept.`,
        {
          listingId: listing.id,
          offerId: id,
          fanId: fan.id,
        },
      );
    }
  }

  /** Highest-placed eligible fan, honouring accessibility priority. */
  private findCandidate(listing: Listing, at: Minutes): number | null {
    const n = listing.seatIds.length;
    const minutesToKickoff = -at;
    let bestAccessible: number | null = null;
    let best: number | null = null;
    for (const q of this.queues) {
      if (q.groupSize > n) continue;
      if (!preferenceMatches(q.preference, listing.kind)) continue;
      if (q.needsAccessible && !listing.accessible) continue;
      const head = this.advance(q, minutesToKickoff);
      if (head === null) continue;
      const rank = (this.fans[head] as WaitlistFan).rank;
      if (q.needsAccessible) {
        if (bestAccessible === null || rank < (this.fans[bestAccessible] as WaitlistFan).rank)
          bestAccessible = head;
      } else if (best === null || rank < (this.fans[best] as WaitlistFan).rank) {
        best = head;
      }
    }
    // Accessible spaces go to fans who need them first; otherwise anyone may use them.
    return bestAccessible ?? best;
  }

  /**
   * Moves a queue's cursor past fans who can never be offered again. Both
   * skips are permanent: a fan who has been offered a seat ends up seated,
   * passed or missed — never waiting again — and a fan who is too far away
   * now stays too far away, because the engine clock only moves forward.
   */
  private advance(q: Queue, minutesToKickoff: number): number | null {
    while (q.cursor < q.fans.length) {
      const idx = q.fans[q.cursor] as number;
      const fan = this.fans[idx] as WaitlistFan;
      if (
        this.status[idx] === 'waiting' &&
        fan.travelMinutes + this.config.arrivalBuffer <= minutesToKickoff
      ) {
        return idx;
      }
      q.cursor++;
    }
    return null;
  }
}
