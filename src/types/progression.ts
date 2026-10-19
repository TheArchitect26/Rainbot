import { Lane } from './game';
export type { Lane };

export interface PlayerProgression {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
}

export interface LevelMilestone {
  level: number;
  title: string;
  rewardType: 'COINS' | 'SKIN' | 'TITLE';
  rewardValue: number | string;
  rewardLabel: string;
  unlocked: boolean;
}

export interface BossAttack {
  type: 'LASER_GRID' | 'SWEEP_WALL' | 'DRONE_SALVO';
  warnTime: number;
  duration: number;
  blockedLanes: Lane[];
  telegraphMessage: string;
}

export interface BossState {
  active: boolean;
  name: string;
  phase: number;
  maxPhase: number;
  timeLeft: number;
  duration: number;
  telegraph: string | null;
  targetLanes: Lane[];
}

export interface XPGainBreakdown {
  distanceXP: number;
  coinsXP: number;
  dodgedXP: number;
  bossXP: number;
  totalRunXP: number;
  levelUps: number;
  newLevel: number;
}

export const LEVEL_TITLES = [
  { min: 1, max: 4, title: 'Novice Surfer' },
  { min: 5, max: 9, title: 'Glitch Runner' },
  { min: 10, max: 14, title: 'Subway Sigma' },
  { min: 15, max: 19, title: 'Matrix Breaker' },
  { min: 20, max: 29, title: 'Algorithm Slayer' },
  { min: 30, max: 999, title: 'Giga Mascot Supreme' },
];

export function getLevelTitle(level: number): string {
  const match = LEVEL_TITLES.find((t) => level >= t.min && level <= t.max);
  return match ? match.title : 'Digital Legend';
}

export function getXPRequiredForLevel(level: number): number {
  return Math.floor(120 * Math.pow(level, 1.25));
}

export const LEVEL_MILESTONES: LevelMilestone[] = [
  { level: 2, title: 'First Steps', rewardType: 'COINS', rewardValue: 100, rewardLabel: '100 Coins', unlocked: false },
  { level: 3, title: 'Cyber Speed', rewardType: 'COINS', rewardValue: 150, rewardLabel: '150 Coins', unlocked: false },
  { level: 5, title: 'Glitch Runner', rewardType: 'SKIN', rewardValue: 'vapor_sunset', rewardLabel: 'Vapor Wave Skin', unlocked: false },
  { level: 7, title: 'Phantom Cloak', rewardType: 'SKIN', rewardValue: 'glitch_phantom', rewardLabel: 'Glitch Phantom Skin', unlocked: false },
  { level: 10, title: 'Pure Sigma', rewardType: 'SKIN', rewardValue: 'golden_sigma', rewardLabel: 'Pure Sigma Skin', unlocked: false },
  { level: 12, title: 'Samurai Code', rewardType: 'SKIN', rewardValue: 'cyber_samurai', rewardLabel: 'Cyber Samurai Skin', unlocked: false },
  { level: 15, title: 'Capybara Chill', rewardType: 'SKIN', rewardValue: 'capy_vip', rewardLabel: 'Capybara King Skin', unlocked: false },
  { level: 20, title: 'Holographic Legend', rewardType: 'SKIN', rewardValue: 'quantum_hologram', rewardLabel: 'Quantum Hologram Skin', unlocked: false },
];
