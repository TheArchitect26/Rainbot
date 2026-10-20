import { storage } from '../utils/storage';
import { getDailySeed, getUTCDayString, SeededPRNG } from '../utils/prng';

export interface DailyMission {
  id: string;
  type: 'COINS' | 'DISTANCE' | 'TIME' | 'DODGE' | 'ZONE' | 'RUNS' | 'BOSS';
  title: string;
  description: string;
  target: number;
  current: number;
  rewardCoins: number;
  rewardXP: number;
  completed: boolean;
  claimed: boolean;
}

export interface StoredDailyMissions {
  date: string; // UTC date string 'YYYY-MM-DD'
  missions: DailyMission[];
}

export const ALL_MISSION_TEMPLATES = [
  {
    id: 'collect_coins',
    type: 'COINS' as const,
    title: 'Clout Grinder',
    description: 'Collect 100 Clout Coins across all runs',
    target: 100,
    rewardCoins: 80,
    rewardXP: 150,
  },
  {
    id: 'survive_time',
    type: 'TIME' as const,
    title: 'Attention Span 90s',
    description: 'Survive in a single run for 75 seconds',
    target: 75,
    rewardCoins: 75,
    rewardXP: 140,
  },
  {
    id: 'dodge_obstacles',
    type: 'DODGE' as const,
    title: 'Reflex God',
    description: 'Safely dodge or jump 40 obstacles',
    target: 40,
    rewardCoins: 90,
    rewardXP: 180,
  },
  {
    id: 'reach_zone_2',
    type: 'ZONE' as const,
    title: 'Sunset Surfer',
    description: 'Reach Zone 2 (Synthwave Sunset)',
    target: 300,
    rewardCoins: 70,
    rewardXP: 130,
  },
  {
    id: 'reach_zone_3',
    type: 'ZONE' as const,
    title: 'Matrix Infiltrator',
    description: 'Reach Zone 3 (Quantum Matrix)',
    target: 700,
    rewardCoins: 110,
    rewardXP: 220,
  },
  {
    id: 'complete_runs',
    type: 'RUNS' as const,
    title: 'Daily Triple',
    description: 'Complete 3 full runs today',
    target: 3,
    rewardCoins: 60,
    rewardXP: 120,
  },
  {
    id: 'survive_boss',
    type: 'BOSS' as const,
    title: 'Bypass the Master',
    description: 'Survive an Algorithm Boss encounter',
    target: 1,
    rewardCoins: 120,
    rewardXP: 250,
  },
  {
    id: 'surf_1000m',
    type: 'DISTANCE' as const,
    title: 'Endless Marathon',
    description: 'Run 1,000 meters in a single run',
    target: 1000,
    rewardCoins: 100,
    rewardXP: 200,
  },
];

// Generates 3 rotating daily missions deterministically for the current UTC date
export function generateDailyMissionsForDate(dateStr: string): DailyMission[] {
  const seed = getDailySeed(dateStr);
  const prng = new SeededPRNG(seed);

  // Shuffle template pool and pick 3 distinct missions
  const pool = [...ALL_MISSION_TEMPLATES];
  const selected: DailyMission[] = [];

  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(prng.next() * pool.length);
    const tmpl = pool.splice(idx, 1)[0];
    selected.push({
      ...tmpl,
      current: 0,
      completed: false,
      claimed: false,
    });
  }

  return selected;
}

// Retrieves current daily missions from localStorage, auto-resetting if UTC date changed
export function getOrRefreshDailyMissions(): { date: string; missions: DailyMission[] } {
  const todayUTC = getUTCDayString();
  const raw = storage.getItem('brainrot_daily_missions_v3');

  if (raw) {
    try {
      const data: StoredDailyMissions = JSON.parse(raw);
      if (data.date === todayUTC && Array.isArray(data.missions) && data.missions.length === 3) {
        const templates = generateDailyMissionsForDate(todayUTC);
        return { date: todayUTC, missions: templates.map((template) => {
          const saved = data.missions.find((m) => m && m.id === template.id);
          const current = saved && Number.isFinite(saved.current) ? Math.max(0, saved.current) : 0;
          return { ...template, current, completed: current >= template.target, claimed: current >= template.target && saved?.claimed === true };
        }) };
      }
    } catch {
      // JSON parse error, regenerate
    }
  }

  // Generate for today
  const fresh = generateDailyMissionsForDate(todayUTC);
  const payload: StoredDailyMissions = { date: todayUTC, missions: fresh };
  storage.setItem('brainrot_daily_missions_v3', JSON.stringify(payload));
  return payload;
}

export const INITIAL_DAILY_MISSIONS: DailyMission[] = generateDailyMissionsForDate(getUTCDayString());
