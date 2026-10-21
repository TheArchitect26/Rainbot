import type { Lane, ObstacleType } from '../types/game';

export const RULES_VERSION = 'challenge-3';
export const LEVEL_DISTANCE = 150;
export const MAX_CHALLENGE_LEVEL = 12;
export const MAX_RUN_SPEED = 36 * 1.45 * 1.35;
export const COMPOUND_GATE_SECONDS = 1.25;
export const SLALOM_REACTION_SECONDS = 0.72;
export const CHALLENGES = [
  {
    level: 1,
    name: 'First Steps',
    skill: 'Learn jumps, slides and lane changes',
    speed: 18,
    patterns: ['SINGLE'],
  },
  {
    level: 2,
    name: 'Lane Artist',
    skill: 'Read the open lane',
    speed: 19.5,
    patterns: ['SINGLE', 'SLALOM'],
  },
  {
    level: 3,
    name: 'Air Time',
    skill: 'Jump across full-width low gates',
    speed: 21,
    patterns: ['SINGLE', 'SLALOM', 'JUMP_GATE'],
  },
  {
    level: 4,
    name: 'Under the Feed',
    skill: 'Slide through overhead gates',
    speed: 22.5,
    patterns: ['SLALOM', 'JUMP_GATE', 'SLIDE_GATE'],
  },
  {
    level: 5,
    name: 'Drone District',
    skill: 'Track moving hazards',
    speed: 24,
    patterns: ['SLALOM', 'DRONE', 'SLIDE_GATE'],
  },
  {
    level: 6,
    name: 'Switch Rhythm',
    skill: 'Time alternating jump and slide gates',
    speed: 25.5,
    patterns: ['SLALOM', 'DRONE', 'RHYTHM', 'MIXED_GATE'],
  },
  {
    level: 7,
    name: 'Cross Traffic',
    skill: 'Chain adjacent safe lanes',
    speed: 27,
    patterns: ['SLALOM', 'DRONE', 'RHYTHM', 'MIXED_GATE'],
  },
  {
    level: 8,
    name: 'Pressure Test',
    skill: 'Keep your rhythm through boss pressure',
    speed: 28.5,
    patterns: ['SLALOM', 'DRONE', 'RHYTHM', 'JUMP_GATE', 'MIXED_GATE'],
  },
  {
    level: 9,
    name: 'Signal Storm',
    skill: 'Read warnings before committing',
    speed: 30,
    patterns: ['SLALOM', 'DRONE', 'RHYTHM', 'SLIDE_GATE', 'MIXED_GATE'],
  },
  {
    level: 10,
    name: 'Overclock',
    skill: 'Combine precise movement and timing',
    speed: 32,
    patterns: ['SLALOM', 'DRONE', 'RHYTHM', 'MIXED_GATE'],
  },
  {
    level: 11,
    name: 'Last Firewall',
    skill: 'Master all hazards at high speed',
    speed: 34,
    patterns: [
      'SLALOM',
      'DRONE',
      'RHYTHM',
      'JUMP_GATE',
      'SLIDE_GATE',
      'MIXED_GATE',
    ],
  },
  {
    level: 12,
    name: 'Algorithm Breaker',
    skill: 'Maximum difficulty · survive the full mix',
    speed: 36,
    patterns: [
      'SLALOM',
      'DRONE',
      'RHYTHM',
      'JUMP_GATE',
      'SLIDE_GATE',
      'MIXED_GATE',
    ],
  },
] as const;
export function challengeAtDistance(distance: number) {
  const safe = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  return CHALLENGES[
    Math.min(MAX_CHALLENGE_LEVEL - 1, Math.floor(safe / LEVEL_DISTANCE))
  ];
}
export type ChallengePattern = (typeof CHALLENGES)[number]['patterns'][number];
export interface ChallengeRow {
  offset: number;
  hazards: { lane: Lane; type: ObstacleType }[];
  safeLane?: Lane;
}
const LANES: Lane[] = [-1, 0, 1];

/** Construct solvable rows once per encounter, using only the run's seeded RNG.
 * Full-width gates reserve 1.25 seconds even at stacked boost + turbo speed, enough for the shorter low-gravity jump and landing.
 * Slalom lanes are adjacent; drones never share a row with a forced corridor. */
export function makeChallengePattern(
  pattern: ChallengePattern,
  speed: number,
  random: () => number,
): ChallengeRow[] {
  const lane = (Math.floor(random() * 3) - 1) as Lane;
  const gap = Math.max(
    18,
    speed *
      1.45 *
      1.35 *
      (pattern === 'SLALOM' ? SLALOM_REACTION_SECONDS : COMPOUND_GATE_SECONDS),
  );
  if (pattern === 'SLALOM') {
    const second = (lane === 0 ? (random() < 0.5 ? -1 : 1) : 0) as Lane;
    return [lane, second].map((safeLane, i) => ({
      offset: gap * i,
      safeLane,
      hazards: LANES.filter((l) => l !== safeLane).map((l) => ({
        lane: l,
        type: 'FULL_BLOCK',
      })),
    }));
  }
  if (pattern === 'MIXED_GATE') {
    const shift = lane + 1;
    const types: ObstacleType[] = ['FULL_BLOCK', 'LOW_BARRIER', 'HIGH_BARRIER'];
    return [
      {
        offset: 0,
        hazards: LANES.map((l, i) => ({
          lane: l,
          type: types[(i + shift) % 3],
        })),
      },
    ];
  }
  if (pattern === 'DRONE')
    return [{ offset: 0, hazards: [{ lane: 0, type: 'MOVING_DRONE' }] }];
  if (pattern === 'SINGLE')
    return [
      {
        offset: 0,
        hazards: [
          { lane, type: random() < 0.5 ? 'LOW_BARRIER' : 'HIGH_BARRIER' },
        ],
      },
    ];
  const rows: ObstacleType[] =
    pattern === 'RHYTHM'
      ? ['LOW_BARRIER', 'HIGH_BARRIER']
      : [pattern === 'JUMP_GATE' ? 'LOW_BARRIER' : 'HIGH_BARRIER'];
  // Reserve a landing/recovery gap after gates as well as between them.
  return rows.map((type, i) => ({
    offset: i * gap,
    hazards: LANES.map((l) => ({ lane: l, type })),
  }));
}

/** Every third encounter demands an action, so camping in a lane cannot bypass a run.
 * Random choice remains seeded; early training is handled separately by the engine. */
export function chooseChallengePattern(distance: number, encounter: number, random: () => number): ChallengePattern {
  if (encounter % 3 === 2) return Math.floor(encounter / 3) % 2 === 0 ? 'JUMP_GATE' : 'SLIDE_GATE';
  const pool = challengeAtDistance(distance).patterns;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function encounterSpacing(speed: number, level: number) {
  // Reserve input time even with both speed modifiers; pressure rises with tiers.
  return speed * 1.45 * 1.35 * Math.max(0.72, 1.05 - (level - 1) * 0.03);
}
