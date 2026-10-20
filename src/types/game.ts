export type Lane = -1 | 0 | 1; // -1: Left, 0: Center, 1: Right

export const LANE_WIDTH = 2.4;
export const LANE_POSITIONS: Record<Lane, number> = {
  [-1]: -LANE_WIDTH,
  [0]: 0,
  [1]: LANE_WIDTH,
};

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type ObstacleType = 
  | 'LOW_BARRIER'    // Jump over
  | 'HIGH_BARRIER'   // Slide under
  | 'FULL_BLOCK'     // Dodge lane
  | 'MOVING_DRONE';  // Moves across lanes

export interface ObstacleInstance {
  id: number;
  type: ObstacleType;
  lane: Lane;
  z: number;
  meshIndex: number;
  width: number;
  height: number;
  yOffset: number;
  initialLane?: Lane;
  moveDirection?: number;
  moveSpeed?: number;
  passed: boolean;
}

export type PowerUpType = 'MAGNET' | 'SHIELD' | 'SPEED_BOOST' | 'DOUBLE_COINS';

export interface PowerUpInstance {
  id: number;
  type: PowerUpType;
  lane: Lane;
  z: number;
  collected: boolean;
  meshIndex: number;
}

export interface CoinInstance {
  id: number;
  lane: Lane;
  z: number;
  y: number;
  collected: boolean;
  meshIndex: number;
}

export type ChaosType = 
  | 'LOW_GRAVITY'
  | 'TURBO_SPEED'
  | 'MOVING_BARRIERS'
  | 'COLOR_SHIFT'
  | 'REVERSED_CONTROLS';

export interface ChaosState {
  active: boolean;
  type: ChaosType | null;
  timeLeft: number;
  duration: number;
  warningTimeLeft: number; // 2s warning countdown before event triggers
  nextWarningType: ChaosType | null;
  name: string;
  description: string;
  accentColor: string;
}

export interface ActivePowerUp {
  type: PowerUpType;
  timeLeft: number;
  duration: number;
}

export interface StageInfo {
  id: string;
  name: string;
  subtitle: string;
  themeColor: string;
  startDistance: number;
}

export interface PlayerStats {
  durationSeconds?: number;
  score: number;
  distance: number;
  coins: number;
  highScore: number;
  totalCoins: number;
  runsPlayed: number;
  chaosSurvived: number;
  obstaclesDodged?: number;
  bossDefeated?: number;
  isDailyChallenge?: boolean;
  stage?: StageInfo;
}

export interface Skin {
  rankOnly?: boolean;
  accessory?: 'NONE' | 'HEADPHONES' | 'STAR_BADGE' | 'LAUREL';
  avatar?: 'CYBER' | 'STREET';
  outfit?: 'TEE' | 'HOODIE' | 'JACKET';
  bottom?: 'SHORTS' | 'JOGGERS';
  hair?: 'QUIFF' | 'CURLS' | 'CAP';
  skinTone?: string;
  hairColor?: string;
  shoeColor?: string;
  custom?: boolean;
  finish?: 'SATIN' | 'CHROME' | 'MATTE';
  id: string;
  name: string;
  tagline: string;
  price: number;
  requiredLevel?: number;
  rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  unlocked: boolean;
}
