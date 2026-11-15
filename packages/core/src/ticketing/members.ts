import type { MemberProfile } from './types';

/** Fictional demo members. Any resemblance to real fans is coincidental. */
export const DEMO_MEMBERS: readonly MemberProfile[] = [
  {
    id: 'lena',
    name: 'Lena Hofmann',
    firstName: 'Lena',
    memberSince: 2012,
    pechvogel: 7,
    city: 'München',
    country: 'Germany',
    language: 'de',
    groupSize: 1,
    persona: 'Member for 14 years. Seven “no”s in a row since her last match.',
    preferences: {
      'fcb-bvb-2026-11-21': 3,
      'fcb-psg-2026-11-25': 3,
      'fcb-wob-2026-12-05': 1,
      'fcb-fch-2026-12-15': 2,
      'fcb-b04-2027-01-16': 3,
      'fcb-koe-2027-02-03': 2,
      'fcb-rbl-2027-02-13': 2,
      'fcb-vfb-2027-03-20': 2,
      'fcb-sge-2027-04-10': 1,
      'fcb-hsv-2027-05-08': 3,
    },
    avatarHue: 352,
  },
  {
    id: 'kofi',
    name: 'Kofi Mensah',
    firstName: 'Kofi',
    memberSince: 2023,
    pechvogel: 2,
    city: 'Accra',
    country: 'Ghana',
    language: 'en',
    groupSize: 1,
    fanClub: 'Red Lions Accra',
    persona: 'International member planning his first trip to the Allianz Arena.',
    preferences: {
      'fcb-bvb-2026-11-21': 3,
      'fcb-psg-2026-11-25': 3,
      'fcb-wob-2026-12-05': 2,
      'fcb-fch-2026-12-15': 2,
      'fcb-b04-2027-01-16': 2,
      'fcb-koe-2027-02-03': 1,
      'fcb-rbl-2027-02-13': 2,
      'fcb-vfb-2027-03-20': 1,
      'fcb-sge-2027-04-10': 1,
      'fcb-hsv-2027-05-08': 2,
    },
    avatarHue: 28,
  },
  {
    id: 'huber',
    name: 'Familie Huber',
    firstName: 'Anna',
    memberSince: 2005,
    pechvogel: 4,
    city: 'Rosenheim',
    country: 'Germany',
    language: 'de',
    groupSize: 4,
    companions: [
      { name: 'Thomas', pechvogel: 4, memberSince: 2005 },
      { name: 'Mia (12)', pechvogel: 4, memberSince: 2019 },
      { name: 'Ben (9)', pechvogel: 2, memberSince: 2022 },
    ],
    persona: 'Family of four applying together — weekend afternoons only, the kids have school.',
    preferences: {
      'fcb-bvb-2026-11-21': 1,
      'fcb-wob-2026-12-05': 3,
      'fcb-b04-2027-01-16': 1,
      'fcb-rbl-2027-02-13': 1,
      'fcb-vfb-2027-03-20': 3,
      'fcb-sge-2027-04-10': 3,
      'fcb-hsv-2027-05-08': 2,
    },
    avatarHue: 140,
  },
  {
    id: 'yuna',
    name: 'Yuna Park',
    firstName: 'Yuna',
    memberSince: 2019,
    pechvogel: 11,
    city: 'Seoul',
    country: 'South Korea',
    language: 'ko',
    groupSize: 2,
    companions: [{ name: 'Minho', pechvogel: 3, memberSince: 2024 }],
    persona: 'Watches at 3 a.m. in Seoul. Eleven unsuccessful applications and counting.',
    preferences: {
      'fcb-bvb-2026-11-21': 3,
      'fcb-psg-2026-11-25': 3,
      'fcb-b04-2027-01-16': 2,
      'fcb-rbl-2027-02-13': 2,
      'fcb-vfb-2027-03-20': 1,
      'fcb-hsv-2027-05-08': 2,
    },
    avatarHue: 212,
  },
  {
    id: 'jonas',
    name: 'Jonas Weber',
    firstName: 'Jonas',
    memberSince: 2026,
    pechvogel: 0,
    city: 'Garching',
    country: 'Germany',
    language: 'en',
    groupSize: 1,
    persona: 'Joined this season. First application ever — the baseline everyone is compared to.',
    preferences: {
      'fcb-bvb-2026-11-21': 3,
      'fcb-psg-2026-11-25': 3,
      'fcb-fch-2026-12-15': 2,
      'fcb-b04-2027-01-16': 2,
      'fcb-koe-2027-02-03': 2,
      'fcb-hsv-2027-05-08': 2,
    },
    avatarHue: 265,
  },
];

export function getMember(id: string): MemberProfile {
  const m = DEMO_MEMBERS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown member: ${id}`);
  return m;
}

/** Stable pseudonymous entry id — published lists never show names. */
export function entryIdFor(memberId: string, fixtureId: string): string {
  let h = 2166136261;
  const s = `${memberId}|${fixtureId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `M-${(h >>> 0).toString(36).toUpperCase().padStart(7, '0')}`;
}
