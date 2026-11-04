import type { AiSource } from '@fcb/ai';
import type { PechvogelStat } from '@fcb/core';

/** Wire types shared by API routes and client components. */

export interface AiPayload<T> {
  value: T;
  source: AiSource;
  model: string | null;
  latencyMs: number;
  note?: string;
}

export interface CommitResponse {
  drawId: string;
  fixtureId: string;
  commitment: string;
  seats: number;
  expectedEntrants: number;
}

export interface DrawResponse {
  drawId: string;
  fixtureId: string;
  memberId: string;
  seed: string;
  commitment: string;
  entrants: number;
  seatsAvailable: number;
  seatsAllocated: number;
  winners: number;
  cutoffRank: number;
  durationMs: number;
  winRateByPechvogel: PechvogelStat[];
  outcome: {
    id: string;
    rank: number;
    won: boolean;
    waitlistPosition: number | null;
    key: number;
    u: number;
    weight: number;
    groupSize: number;
  };
  probability: number;
  baselineProbability: number;
  pechvogelBefore: number;
  pechvogelAfter: number;
  weightAfter: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
