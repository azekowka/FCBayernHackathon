import 'server-only';
import {
  interpretSeatMessage,
  offerMessage,
  openingNudge,
  quickReplies,
  releaseConfirmationTemplate,
  type AiSource,
  type SeatChatFacts,
} from '@fcb/ai';
import {
  LIVE_FAN_PROFILES,
  LIVE_HOLDER,
  LIVE_START_AT,
  LIVE_WAITLIST,
  RECYCLING_FIXTURE_ID,
  clockAt,
  createLiveEngine,
  describeBlock,
  getBlock,
  getFixture,
  liveListingFor,
  parseSeatId,
  preferenceMatches,
  type FanStatus,
  type RecyclingEngine,
} from '@fcb/core';
import { getAi } from './ai';
import { seppPrediction } from './insights';

export interface ChatMessage {
  id: number;
  role: 'assistant' | 'fan';
  text: string;
  source?: AiSource;
  confirm?: 'release' | 'gift' | null;
}

export interface FanView {
  id: string;
  name: string;
  city: string;
  rank: number;
  drawPosition: number;
  note: string;
  status: FanStatus;
  offer: null | {
    id: string;
    seatLabel: string;
    expiresInMinutes: number;
    message: string;
    source: AiSource;
  };
  ticket: null | { seatLabel: string; faceValue: number };
}

export interface EngineEvent {
  id: number;
  kind: 'released' | 'skipped' | 'offered' | 'accepted' | 'declined' | 'gifted' | 'kept' | 'info';
  text: string;
  clock: string;
}

export interface LiveState {
  room: string;
  version: number;
  language: 'en' | 'de';
  clock: string;
  holder: {
    name: string;
    seatLabel: string;
    status: SeatChatFacts['status'];
    chat: ChatMessage[];
    quickReplies: string[];
  };
  fans: FanView[];
  events: EngineEvent[];
  thinking: null | 'holder' | 'fan';
  fixture: { label: string; kickoff: string };
}

type Action =
  | { action: 'say'; text: string }
  | { action: 'release'; mode: 'waitlist' | 'youth' }
  | { action: 'keep' }
  | { action: 'respond'; fanId: string; accept: boolean }
  | { action: 'reset'; language?: 'en' | 'de' };

const fixture = getFixture(RECYCLING_FIXTURE_ID);
const seat = parseSeatId(LIVE_HOLDER.seatIds[0] as string);
const block = getBlock(LIVE_HOLDER.blockId);
const SEAT_LABEL = `${describeBlock(block)} · row ${seat.row}, seat ${seat.seat}`;
const SHORT_SEAT = `Block ${block.id} Südkurve, row ${seat.row}`;

/** Engine-log wording per room language (the assistant chat is localised by @fcb/ai). */
const LOG = {
  en: {
    intro:
      'Fri 13:30 · 26 h to kick-off. Sepp’s calendar shows Hamburg; risk model flags his seat.',
    keptNoAsk: 'Sepp is coming — no seat released. The model never asks twice.',
    kept: 'Sepp is coming — no seat released.',
    started: 'Release not possible any more — the match has started.',
    gifted: 'Seat gifted to a Munich youth fan club.',
    released: (seat: string, fee: number) => `Released: ${seat}, standing, €${fee}.`,
    closed: (name: string) => `${name}’s offer is no longer open.`,
    theFan: 'The fan',
    accepted: (name: string, fee: number) =>
      `${name} accepted — ticket moved to their app wallet. Sepp gets €${fee} back.`,
    declined: (name: string) => `${name} passed — no penalty. Moving down the waitlist.`,
    hasSeat: 'already has a seat',
    passed: 'already passed',
    group: (n: number) => `needs ${n} seats together`,
    pref: (p: string) => `wants a ${p} seat`,
    late: 'can’t reach the Arena in time',
    skipped: (rank: number, name: string, why: string) => `#${rank} ${name} skipped — ${why}.`,
    offer: (rank: number, name: string, city: string) =>
      `Offer → #${rank} ${name} (${city}), 60 min to accept.`,
    kickoff: (clock: string) => `Sat 7 Nov · ${clock}`,
    notes: {} as Record<string, string>,
  },
  de: {
    intro:
      'Fr 13:30 · 26 h bis Anpfiff. Sepps Kalender zeigt Hamburg; das Risikomodell markiert seinen Platz.',
    keptNoAsk: 'Sepp kommt — kein Platz freigegeben. Das Modell fragt nie zweimal.',
    kept: 'Sepp kommt — kein Platz freigegeben.',
    started: 'Freigabe nicht mehr möglich — das Spiel hat begonnen.',
    gifted: 'Platz an einen Münchner Jugend-Fanclub gespendet.',
    released: (seat: string, fee: number) => `Freigegeben: ${seat}, Stehplatz, ${fee} €.`,
    closed: (name: string) => `Das Angebot für ${name} ist nicht mehr offen.`,
    theFan: 'Der Fan',
    accepted: (name: string, fee: number) =>
      `${name} hat angenommen — Ticket liegt in der App-Wallet. Sepp bekommt ${fee} € zurück.`,
    declined: (name: string) => `${name} hat abgelehnt — ohne Nachteil. Weiter auf der Warteliste.`,
    hasSeat: 'hat schon einen Platz',
    passed: 'hat schon abgelehnt',
    group: (n: number) => `braucht ${n} Plätze zusammen`,
    pref: (p: string) => (p === 'seated' ? 'möchte einen Sitzplatz' : `möchte einen ${p}-Platz`),
    late: 'erreicht die Arena nicht mehr rechtzeitig',
    skipped: (rank: number, name: string, why: string) => `#${rank} ${name} übersprungen — ${why}.`,
    offer: (rank: number, name: string, city: string) =>
      `Angebot → #${rank} ${name} (${city}), 60 min zum Annehmen.`,
    kickoff: (clock: string) => `Sa., 7. Nov. · ${clock}`,
    notes: {
      'huber-group': 'Braucht 4 Plätze zusammen',
      elif: 'Nur Sitzplatz',
      mia: 'Stehplatz, allein — 9 erfolglose Bewerbungen',
      jonas: 'Erste Saison als Mitglied',
      kofi: 'Zwei Wochen in der Stadt',
    } as Record<string, string>,
  },
};

export class LiveRoom {
  private engine!: RecyclingEngine;
  private state!: LiveState;
  private now = LIVE_START_AT;
  private seq = 0;
  private listeners = new Set<(s: LiveState) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  lastActive = Date.now();

  constructor(
    readonly id: string,
    private language: 'en' | 'de' = 'en',
  ) {
    this.resetSync();
  }

  subscribe(fn: (s: LiveState) => void): () => void {
    this.listeners.add(fn);
    this.lastActive = Date.now();
    return () => {
      this.listeners.delete(fn);
      this.lastActive = Date.now();
    };
  }

  /** Rooms with connected phones are never evicted. */
  get watched(): boolean {
    return this.listeners.size > 0;
  }

  snapshot(): LiveState {
    this.lastActive = Date.now();
    return this.state;
  }

  /** Serialises actions per room so two phones can't interleave. */
  dispatch(a: Action): Promise<LiveState> {
    this.lastActive = Date.now();
    const run = this.queue.then(() => this.apply(a));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private facts(): SeatChatFacts {
    return {
      holderFirstName: LIVE_HOLDER.firstName,
      fixture: `FC Bayern vs ${fixture.opponent}`,
      kickoffLabel: `Sat 7 Nov, ${clockAt(fixture.kickoff, 0)}`,
      seatLabel: SHORT_SEAT,
      faceValue: block.faceValue,
      calendarNote: LIVE_HOLDER.calendarNote,
      reasons: seppPrediction()
        .contributions.slice(0, 3)
        .map((c) => c.label),
      status: this.state.holder.status,
      language: this.language,
    };
  }

  private resetSync() {
    this.engine = createLiveEngine();
    this.now = LIVE_START_AT;
    this.seq = 0;
    this.state = {
      room: this.id,
      // Keep versions monotonic across resets so clients never drop the new state.
      version: this.state ? this.state.version + 1 : 0,
      language: this.language,
      clock: this.clock(),
      holder: {
        name: LIVE_HOLDER.name,
        seatLabel: SEAT_LABEL,
        status: 'open',
        chat: [],
        quickReplies: quickReplies(this.language),
      },
      fans: this.fanViews(),
      events: [
        {
          id: ++this.seq,
          kind: 'info',
          text: this.log.intro,
          clock: this.clock(),
        },
      ],
      thinking: 'holder',
      fixture: {
        label: `FC Bayern vs ${fixture.opponent}`,
        kickoff: this.log.kickoff(clockAt(fixture.kickoff, 0)),
      },
    };
  }

  private get log() {
    return LOG[this.language];
  }

  private clock() {
    return clockAt(fixture.kickoff, this.now);
  }

  private tick(minutes = 1) {
    this.now += minutes;
  }

  private fanViews(prev: FanView[] = []): FanView[] {
    return LIVE_WAITLIST.map((f) => {
      const profile = LIVE_FAN_PROFILES[f.id] ?? { city: '', drawPosition: f.rank, note: '' };
      const old = prev.find((p) => p.id === f.id);
      const status = this.engine.fanStatus(f.id) ?? 'waiting';
      const pending = this.engine.pendingOfferFor(f.id);
      return {
        id: f.id,
        name: f.name,
        city: profile.city,
        rank: f.rank,
        drawPosition: profile.drawPosition,
        note: this.log.notes[f.id] ?? profile.note,
        status,
        offer:
          pending && old?.offer?.id === pending.id
            ? { ...old.offer, expiresInMinutes: pending.expiresAt - this.now }
            : pending
              ? {
                  id: pending.id,
                  seatLabel: SEAT_LABEL,
                  expiresInMinutes: pending.expiresAt - this.now,
                  message: '',
                  source: 'demo' as AiSource,
                }
              : null,
        ticket: status === 'seated' ? { seatLabel: SEAT_LABEL, faceValue: block.faceValue } : null,
      };
    });
  }

  private emit() {
    this.state = {
      ...this.state,
      version: this.state.version + 1,
      clock: this.clock(),
      fans: this.fanViews(this.state.fans),
    };
    for (const l of this.listeners) l(this.state);
  }

  private say(role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}) {
    this.state.holder.chat = [...this.state.holder.chat, { id: ++this.seq, role, text, ...extra }];
  }

  private event(kind: EngineEvent['kind'], text: string) {
    this.state.events = [
      ...this.state.events,
      { id: ++this.seq, kind, text, clock: this.clock() },
    ].slice(-40);
  }

  async init(): Promise<void> {
    await this.dispatch({ action: 'reset', language: this.language });
  }

  private async apply(a: Action): Promise<LiveState> {
    switch (a.action) {
      case 'reset': {
        if (a.language) this.language = a.language;
        this.resetSync();
        this.emit();
        const res = await openingNudge(getAi(), this.facts());
        this.say('assistant', res.value, { source: res.source });
        this.state.thinking = null;
        this.emit();
        break;
      }
      case 'say': {
        this.say('fan', a.text.slice(0, 500));
        this.state.thinking = 'holder';
        this.tick();
        this.emit();
        const res = await interpretSeatMessage(getAi(), this.facts(), a.text);
        const confirm =
          this.state.holder.status === 'open' && res.value.needsConfirmation
            ? (res.value.intent as 'release' | 'gift')
            : null;
        this.say('assistant', res.value.reply, { source: res.source, confirm });
        if (res.value.intent === 'keep' && this.state.holder.status === 'open') {
          this.state.holder.status = 'kept';
          this.event('kept', this.log.keptNoAsk);
        }
        this.state.thinking = null;
        this.emit();
        break;
      }
      case 'keep': {
        if (this.state.holder.status !== 'open') break;
        this.state.holder.status = 'kept';
        this.event('kept', this.log.kept);
        this.emit();
        break;
      }
      case 'release': {
        if (this.state.holder.status !== 'open') break;
        this.tick();
        const log = this.engine.dispatch({
          type: 'release',
          at: this.now,
          mode: a.mode,
          listing: liveListingFor(),
        });
        if (log.some((l) => l.kind === 'rejected')) {
          this.event('info', this.log.started);
          this.emit();
          break;
        }
        this.state.holder.status = a.mode === 'youth' ? 'gifted' : 'released';
        this.event(
          a.mode === 'youth' ? 'gifted' : 'released',
          a.mode === 'youth' ? this.log.gifted : this.log.released(SHORT_SEAT, block.faceValue),
        );
        const offered = log.find((l) => l.kind === 'offered');
        if (offered?.fanId) this.explainSkips(offered.fanId);
        const recipient = offered?.fanId
          ? LIVE_WAITLIST.find((f) => f.id === offered.fanId)
          : undefined;
        this.say(
          'assistant',
          releaseConfirmationTemplate({
            holderFirstName: LIVE_HOLDER.firstName,
            mode: a.mode,
            faceValue: block.faceValue,
            language: this.language,
            recipient: recipient
              ? {
                  city: LIVE_FAN_PROFILES[recipient.id]?.city ?? 'München',
                  pechvogel: recipient.pechvogel,
                  waitlistRank: recipient.rank,
                }
              : null,
          }),
          { source: 'demo' },
        );
        this.state.thinking = offered ? 'fan' : null;
        this.emit();
        if (offered?.offerId && offered.fanId)
          await this.writeOffer(offered.offerId, offered.fanId);
        break;
      }
      case 'respond': {
        const pending = this.engine.pendingOfferFor(a.fanId);
        if (!pending) break;
        this.tick();
        const log = this.engine.dispatch({
          type: a.accept ? 'accept' : 'decline',
          at: this.now,
          offerId: pending.id,
        });
        const fan = LIVE_WAITLIST.find((f) => f.id === a.fanId);
        if (!log.some((l) => l.kind === (a.accept ? 'accepted' : 'declined'))) {
          // The engine expired or rejected the offer — never announce what didn't happen.
          this.event('info', this.log.closed(fan?.name ?? this.log.theFan));
          this.emit();
          break;
        }
        if (a.accept) {
          this.event('accepted', this.log.accepted(fan?.name ?? this.log.theFan, block.faceValue));
          this.say(
            'assistant',
            this.language === 'de'
              ? `Geschafft: ${fan?.name.split(' ')[0]} aus ${LIVE_FAN_PROFILES[a.fanId]?.city} steht am Samstag auf deinem Platz. ${block.faceValue} € sind unterwegs, dein Treuebonus bleibt. Danke, Sepp!`
              : `Done: ${fan?.name.split(' ')[0]} from ${LIVE_FAN_PROFILES[a.fanId]?.city} will be in your spot on Saturday. €${block.faceValue} is on its way back to you and your loyalty credit stays. Danke, Sepp!`,
            { source: 'demo' },
          );
          this.emit();
        } else {
          this.event('declined', this.log.declined(fan?.name ?? this.log.theFan));
          const next = log.find((l) => l.kind === 'offered');
          if (next?.fanId) this.explainSkips(next.fanId);
          this.state.thinking = next ? 'fan' : null;
          this.emit();
          if (next?.offerId && next.fanId) await this.writeOffer(next.offerId, next.fanId);
        }
        break;
      }
    }
    return this.state;
  }

  private explainSkips(recipientId: string) {
    const recipient = LIVE_WAITLIST.find((f) => f.id === recipientId);
    if (!recipient) return;
    for (const f of LIVE_WAITLIST) {
      if (f.rank >= recipient.rank) break;
      const status = this.engine.fanStatus(f.id);
      let why = '';
      if (status !== 'waiting') why = status === 'seated' ? this.log.hasSeat : this.log.passed;
      else if (f.groupSize > 1) why = this.log.group(f.groupSize);
      else if (!preferenceMatches(f.preference, block.kind)) why = this.log.pref(f.preference);
      else if (f.travelMinutes + 15 > -this.now) why = this.log.late;
      if (why) this.event('skipped', this.log.skipped(f.rank, f.name, why));
    }
    this.event(
      'offered',
      this.log.offer(recipient.rank, recipient.name, LIVE_FAN_PROFILES[recipient.id]?.city ?? ''),
    );
  }

  private async writeOffer(offerId: string, fanId: string) {
    const fan = LIVE_WAITLIST.find((f) => f.id === fanId);
    const offer = this.engine.getOffer(offerId);
    if (!fan || !offer) return;
    const res = await offerMessage(getAi(), {
      fanFirstName: fan.name.split(' ')[0] ?? fan.name,
      fixture: `FC Bayern vs ${fixture.opponent}`,
      kickoffLabel: `Sat 7 Nov, ${clockAt(fixture.kickoff, 0)}`,
      seatLabel: SHORT_SEAT,
      faceValue: block.faceValue,
      minutesToAccept: offer.expiresAt - offer.createdAt,
      drawPosition: LIVE_FAN_PROFILES[fanId]?.drawPosition ?? fan.rank,
      pechvogel: fan.pechvogel,
      language: this.language,
    });
    this.state.fans = this.fanViews(this.state.fans).map((v) =>
      v.id === fanId && v.offer?.id === offerId
        ? { ...v, offer: { ...v.offer, message: res.value, source: res.source } }
        : v,
    );
    this.state.thinking = null;
    this.emit();
  }
}

const globalRooms = globalThis as unknown as { __fanAiRooms?: Map<string, LiveRoom> };
const rooms = (globalRooms.__fanAiRooms ??= new Map<string, LiveRoom>());
const MAX_ROOMS = 50;
const IDLE_MS = 2 * 60 * 60 * 1000;

export const ROOM_ID = /^[a-z0-9-]{1,24}$/;

export async function getRoom(id: string): Promise<LiveRoom> {
  const existing = rooms.get(id);
  if (existing) return existing;
  const now = Date.now();
  for (const [key, room] of rooms) {
    if (!room.watched && now - room.lastActive > IDLE_MS) rooms.delete(key);
  }
  if (rooms.size >= MAX_ROOMS) {
    const oldest = [...rooms.entries()]
      .filter(([, r]) => !r.watched)
      .sort((a, b) => a[1].lastActive - b[1].lastActive)[0];
    if (!oldest) throw new Error('All live rooms are in use — try again later');
    rooms.delete(oldest[0]);
  }
  const room = new LiveRoom(id);
  rooms.set(id, room);
  await room.init();
  return room;
}
