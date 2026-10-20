import type { ObstacleType } from '../types/game';
import { getXPRequiredForLevel, type PlayerProgression } from '../types/progression';

/** Forgiving runner half-width .4 plus obstacle half-width .95. Swept Z prevents tunnelling. */
export function hitsObstacle(
  type: ObstacleType,
  dx: number,
  obstacleZ: number,
  previousZ: number,
  playerZ: number,
  y: number,
  sliding: boolean,
  obstacleY = 1.6,
): boolean {
  if (dx >= 1.35 || obstacleZ < playerZ - 0.52 || obstacleZ > previousZ + 0.52) return false;
  const top = y + (sliding ? 0.45 : 1.75);
  if (type === 'LOW_BARRIER') return y < 0.62;
  if (type === 'HIGH_BARRIER') return top > 1.25 && y < 3;
  if (type === 'MOVING_DRONE') return top > obstacleY - 0.75 && y < obstacleY + 0.75;
  return true; // Full walls always require a lane change, including in low gravity.
}

export function normalizeProgression(value: unknown): PlayerProgression {
  const p = value as Partial<PlayerProgression> | null;
  const level =
    Number.isSafeInteger(p?.level) && p!.level! >= 1 && p!.level! <= 10000 ? p!.level! : 1;
  const nonnegative = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
  return {
    level,
    currentXP: Math.min(nonnegative(p?.currentXP), getXPRequiredForLevel(level) - 1),
    totalXP: nonnegative(p?.totalXP),
    xpToNextLevel: getXPRequiredForLevel(level),
  };
}

export function awardXP(previous: PlayerProgression, amount: number) {
  const next = { ...normalizeProgression(previous) };
  const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  next.totalXP += gain;
  next.currentXP += gain;
  const levels: number[] = [];
  while (next.currentXP >= next.xpToNextLevel) {
    next.currentXP -= next.xpToNextLevel;
    levels.push(++next.level);
    next.xpToNextLevel = getXPRequiredForLevel(next.level);
  }
  return { next, levels, levelUps: levels.length, newLevel: next.level };
}
