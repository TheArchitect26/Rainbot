/**
 * Seeded Pseudo-Random Number Generator (Mulberry32).
 * Guarantees 100% deterministic obstacle and coin sequences for the Daily Challenge mode.
 */

export class SeededPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // Returns pseudo-random float in [0, 1)
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns integer in [min, max]
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  public nextChoice<T>(items: T[]): T {
    const idx = Math.floor(this.next() * items.length);
    return items[idx];
  }
}

// Generates numeric seed from UTC date string 'YYYY-MM-DD'
export function getDailySeed(dateStr?: string): number {
  const d = dateStr || new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < d.length; i++) {
    hash = (hash << 5) - hash + d.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Current UTC Date formatted as YYYY-MM-DD
export function getUTCDayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Seconds until midnight UTC for daily mission & challenge resets
export function getSecondsUntilUTCMidnight(): number {
  const now = new Date();
  const nextUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return Math.max(0, Math.floor((nextUTC.getTime() - now.getTime()) / 1000));
}

export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
