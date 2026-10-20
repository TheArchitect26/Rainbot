import { RunnerCamera } from './RunnerCamera';
import { hitsObstacle } from '../utils/mechanics';
import { storage } from '../utils/storage';
import * as THREE from 'three';
import {
  ActivePowerUp,
  ChaosState,
  ChaosType,
  Lane,
  LANE_POSITIONS,
  ObstacleType,
  PlayerStats,
  PowerUpType,
  Skin,
  StageInfo,
} from '../types/game';
import { BossState } from '../types/progression';
import { CharacterModel } from './CharacterModel';
import {
  EnvironmentManager,
  THEME_CYBER_GOLD,
  THEME_NEON_TOKYO,
  THEME_QUANTUM_MATRIX,
  THEME_SYNTHWAVE,
} from './Environment';
import { ObstacleManager } from './Obstacles';
import { CollectibleManager } from './Collectibles';
import { ParticleSystem } from './Particles';
import { BossEncounterManager } from './BossEncounter';
import { sounds } from '../audio/SoundEffects';
import { getDailySeed, SeededPRNG } from '../utils/prng';
import { localAnalytics } from '../utils/analytics';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onPowerUpsUpdate: (powerUps: ActivePowerUp[]) => void;
  onChaosUpdate: (chaos: ChaosState) => void;
  onBossUpdate?: (boss: BossState) => void;
  onStageChange?: (stage: StageInfo) => void;
  onGameOver: (stats: PlayerStats, eliminationCause?: string) => void;
  onActionTriggered?: (action: string) => void;
  onTutorialStep?: (step: number, title: string, instruction: string, completed: boolean) => void;
  onTutorialComplete?: () => void;
  onPause?: () => void;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

export const STAGES: StageInfo[] = [
  {
    id: 'stage_1',
    name: 'ZONE 1: NEON SHIBUYA',
    subtitle: 'High-speed algorithmic highway',
    themeColor: '#06b6d4',
    startDistance: 0,
  },
  {
    id: 'stage_2',
    name: 'ZONE 2: SYNTHWAVE SUNSET',
    subtitle: 'Dopamine horizon & retro grids',
    themeColor: '#ec4899',
    startDistance: 300,
  },
  {
    id: 'stage_3',
    name: 'ZONE 3: QUANTUM MATRIX',
    subtitle: 'Neural bypass & laser corridors',
    themeColor: '#22c55e',
    startDistance: 700,
  },
  {
    id: 'stage_4',
    name: 'ZONE 4: GOLDEN SIGMA',
    subtitle: 'Ascended cloud infrastructure',
    themeColor: '#facc15',
    startDistance: 1200,
  },
];

export class GameEngine {
  private studioOpen = false;
  public setStudioOpen(open: boolean) { this.studioOpen = open; }

  private readonly runnerCamera = new RunnerCamera();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isMenuMode: boolean = true;
  private isDailyChallenge: boolean = false;
  private prng: SeededPRNG | null = null;

  // Subsystems
  public character: CharacterModel;
  public environment: EnvironmentManager;
  public obstacles: ObstacleManager;
  public collectibles: CollectibleManager;
  public particles: ParticleSystem;
  public boss: BossEncounterManager;
  private callbacks: GameEngineCallbacks;

  // Player State
  private currentLane: Lane = 0;
  private targetLane: Lane = 0;
  private playerX: number = 0;
  private playerY: number = 0;
  private playerZ: number = 0;
  private velY: number = 0;
  private isJumping: boolean = false;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private laneChangeTilt: number = 0;
  private lastLaneChangeTime: number = 0;

  // Speed, Distance, Stats & Progression
  private baseSpeed: number = 16.0;
  private currentSpeed: number = 16.0;
  private distanceTraveled: number = 0;
  private coinsCollected: number = 0;
  private chaosSurvivedCount: number = 0;
  private obstaclesDodgedCount: number = 0;
  private bossDefeatedCount: number = 0;
  private currentStageIndex: number = 0;
  private nextBossTriggerDistance: number = 450;
  private postChaosSafeTimer: number = 0;
  private lastEliminationCause: string = 'COLLISION';

  // Tutorial State
  private isTutorial: boolean = false;
  private tutorialStep: number = 0;
  private tutorialActions = new Set<string>();
  private tutorialHazardId: number | null = null;
  private tutorialCoins = 0;
  private previousZ = 0;
  private elapsedSeconds = 0;
  private simulationTime = 0;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private hudTimer = 0;
  private adaptiveTime = 0;
  private adaptiveFrames = 0;
  private discardFrame = true;
  private obstacleRandom: () => number = Math.random;
  private bossRandom: () => number = Math.random;

  // Diagnostics & Debug
  private lastFrameTime: number = 0;
  private debugHitboxesEnabled: boolean = false;

  // Track spawner
  private spawnCursorZ: number = -25;
  private nextPowerUpDistance: number = 75;

  // Active Power-ups
  private activePowerUps: Map<PowerUpType, number> = new Map();

  // Chaos Events
  private chaosTimer: number = 19;
  private chaosState: ChaosState = {
    active: false,
    type: null,
    timeLeft: 0,
    duration: 10,
    warningTimeLeft: 0,
    nextWarningType: null,
    name: '',
    description: '',
    accentColor: '#06b6d4',
  };

  // Camera Shake, Hitstop & Slow-mo
  private cameraShake: number = 0;
  private hitstopDuration: number = 0;
  private slowMoFactor: number = 1.0;
  private isCrashing: boolean = false;
  private globalTime: number = 0;
  private isInvulnerable: boolean = false;
  private invulnerableTimer: number = 0;

  // Input buffering
  private inputBuffer: ('LEFT' | 'RIGHT' | 'JUMP' | 'SLIDE') | null = null;
  private inputBufferTimer: number = 0;

  // Settings
  private vibrationEnabled: boolean = true;
  private shadowsEnabled: boolean = true;
  private quality: GraphicsQuality = 'medium';

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks, initialSkin: Skin) {
    this.container = container;
    this.callbacks = callbacks;

    const savedVib = storage.getItem('brainrot_vibration');
    if (savedVib !== null) this.vibrationEnabled = savedVib === 'true';

    const savedQuality = storage.getItem('brainrot_quality') as GraphicsQuality | null;
    if (savedQuality && ['low', 'medium', 'high'].includes(savedQuality))
      this.quality = savedQuality;

    const savedShadows = storage.getItem('brainrot_shadows');
    if (savedShadows !== null) this.shadowsEnabled = savedShadows === 'true';

    this.scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 220);
    this.updateCameraFOV(width, height);
    this.camera.position.set(0, 2.2, 4.2);

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(width, height);

    const targetDpr =
      this.quality === 'high'
        ? Math.min(window.devicePixelRatio, 2.0)
        : this.quality === 'medium'
          ? Math.min(window.devicePixelRatio, 1.5)
          : 1.0;
    this.renderer.setPixelRatio(isHeadless ? 1 : targetDpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !isHeadless && this.shadowEnabledForDevice();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.environment = new EnvironmentManager(this.scene, this.renderer);
    this.character = new CharacterModel({
      primary: parseInt(initialSkin.primaryColor.replace('#', '0x')),
      secondary: parseInt(initialSkin.secondaryColor.replace('#', '0x')),
      glow: parseInt(initialSkin.glowColor.replace('#', '0x')),
      accent: 0xffffff,
      finish: initialSkin.finish,
      appearance: initialSkin,
    });

    this.character.setShadowsEnabled(this.renderer.shadowMap.enabled);
    this.scene.add(this.character.group);

    this.obstacles = new ObstacleManager(this.scene);
    this.collectibles = new CollectibleManager(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.boss = new BossEncounterManager(this.scene);

    this.renderer.compile(this.scene, this.camera);
    this.populateInitialTrack();

    window.addEventListener('resize', this.onWindowResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.pauseForBackground();
    });

    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.renderer.compile(this.scene, this.camera);
      if (this.isRunning) this.callbacks.onPause?.();
    });

    this.startMenuShowcase();
  }

  private shadowEnabledForDevice(): boolean {
    return this.shadowsEnabled && this.quality !== 'low';
  }

  private updateCameraFOV(width: number, height: number) {
    const aspect = width / height;
    this.camera.aspect = aspect;

    if (aspect < 1.0) {
      const targetHFOVDeg = 65;
      const targetHFOVRad = (targetHFOVDeg * Math.PI) / 180;
      const vFOVRad = 2 * Math.atan(Math.tan(targetHFOVRad / 2) / aspect);
      this.camera.fov = THREE.MathUtils.clamp((vFOVRad * 180) / Math.PI, 65, 88);
    } else {
      this.camera.fov = 60;
    }
    this.camera.updateProjectionMatrix();
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.updateCameraFOV(width, height);
    this.renderer.setSize(width, height);
  };

  public pauseForBackground() {
    if (this.isRunning && !this.isPaused && !this.isCrashing) {
      this.pause();
      this.callbacks.onPause?.();
    }
  }

  private onVisibilityChange = () => {
    if (document.hidden) this.pauseForBackground();
  };

  public setVibration(enabled: boolean) {
    this.vibrationEnabled = enabled;
    storage.setItem('brainrot_vibration', String(enabled));
  }

  public getVibration(): boolean {
    return this.vibrationEnabled;
  }

  private triggerHaptic(pattern: number | number[]) {
    if (!this.vibrationEnabled || typeof navigator === 'undefined') return;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore
    }
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    storage.setItem('brainrot_quality', quality);

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    const targetDpr =
      quality === 'high'
        ? Math.min(window.devicePixelRatio, 2.0)
        : quality === 'medium'
          ? Math.min(window.devicePixelRatio, 1.5)
          : 1.0;
    this.renderer.setPixelRatio(isHeadless ? 1 : targetDpr);
    this.renderer.shadowMap.enabled = !isHeadless && this.shadowEnabledForDevice();
    this.character.setShadowsEnabled(this.renderer.shadowMap.enabled);
  }

  public setShadows(enabled: boolean) {
    this.shadowsEnabled = enabled;
    storage.setItem('brainrot_shadows', String(enabled));
    this.renderer.shadowMap.enabled = this.shadowEnabledForDevice();
    this.character.setShadowsEnabled(this.renderer.shadowMap.enabled);
  }

  public setDebugHitboxes(enabled: boolean) {
    this.debugHitboxesEnabled = enabled;
    this.obstacles.setDebugHitboxes(enabled);
    this.character.setDebugHitbox(enabled, this.isSliding);
  }

  public getDebugHitboxes(): boolean {
    return this.debugHitboxesEnabled;
  }

  private getRandom(): number {
    return this.prng ? this.prng.next() : Math.random();
  }

  private populateInitialTrack() {
    if (this.isTutorial) return;
    while (this.spawnCursorZ > -180) {
      this.spawnNextEncounter();
    }
  }

  private spawnNextEncounter() {
    if (this.isTutorial || this.boss.state.active) return;

    // Generous spacing early in run (< 200m) to give beginners plenty of reaction time
    const spacing =
      this.distanceTraveled < 200
        ? Math.max(34, this.currentSpeed * 1.35)
        : Math.max(28, this.currentSpeed * 1.15);

    this.spawnCursorZ -= spacing;
    const z = this.spawnCursorZ;

    // Power-up check
    if (Math.abs(z) > this.nextPowerUpDistance) {
      this.nextPowerUpDistance += 95 + this.getRandom() * 45;
      const powerUpTypes: PowerUpType[] = ['MAGNET', 'SHIELD', 'SPEED_BOOST', 'DOUBLE_COINS'];
      const chosenType = powerUpTypes[Math.floor(this.getRandom() * powerUpTypes.length)];
      const lane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      this.collectibles.spawnPowerUp(chosenType, lane, z);
      return;
    }

    // Post-chaos safe transition buffer: avoid brutal double blocks right as controls switch
    if (this.postChaosSafeTimer > 0) {
      const lane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      if (this.getRandom() > 0.4) {
        this.obstacles.spawnObstacle('LOW_BARRIER', lane, z);
        this.collectibles.spawnCoinArc(lane, z + 2, 5, 1.5);
      } else {
        this.collectibles.spawnCoinRow(lane, z + 2, 5, 1.8);
      }
      return;
    }

    const roll = this.getRandom();

    // Early game (< 120m) only serves single barriers to let player learn smoothly
    if (this.distanceTraveled < 120) {
      const lane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      if (roll < 0.5) {
        this.obstacles.spawnObstacle('LOW_BARRIER', lane, z);
        this.collectibles.spawnCoinArc(lane, z + 2, 5, 1.5);
      } else {
        this.obstacles.spawnObstacle('HIGH_BARRIER', lane, z);
        this.collectibles.spawnCoinRow(lane, z + 2, 4, 1.3, 0.4);
      }
      return;
    }

    if (roll < 0.28) {
      const lane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      this.obstacles.spawnObstacle('LOW_BARRIER', lane, z);
      this.collectibles.spawnCoinArc(lane, z + 2, 5, 1.5);
    } else if (roll < 0.52) {
      const lane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      this.obstacles.spawnObstacle('HIGH_BARRIER', lane, z);
      this.collectibles.spawnCoinRow(lane, z + 2, 4, 1.3, 0.4);
    } else if (roll < 0.76) {
      const blockedLane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      this.obstacles.spawnObstacle('FULL_BLOCK', blockedLane, z);
      const openLane = (blockedLane === 0 ? 1 : 0) as Lane;
      this.collectibles.spawnCoinRow(openLane, z + 2, 4, 1.6);
    } else if (roll < 0.9) {
      this.obstacles.spawnObstacle('MOVING_DRONE', 0, z, true);
    } else {
      const safeLane = (Math.floor(this.getRandom() * 3) - 1) as Lane;
      const allLanes: Lane[] = [-1, 0, 1];
      for (const l of allLanes) {
        if (l !== safeLane) {
          const type: ObstacleType = this.getRandom() > 0.5 ? 'LOW_BARRIER' : 'FULL_BLOCK';
          this.obstacles.spawnObstacle(type, l, z);
        }
      }
      this.collectibles.spawnCoinRow(safeLane, z + 3, 5, 1.8);
    }
  }

  // --- Input Handling ---

  public handleInput(action: 'LEFT' | 'RIGHT' | 'JUMP' | 'SLIDE') {
    if (!this.isRunning || this.isPaused || this.isCrashing) return;

    // Debounce physical gestures using a monotonic input clock. Simulation time can
    // stand still between rendered frames; it must not swallow a later real swipe.
    // Accepted inputs still affect the same fixed-step simulation and seeded RNGs.
    const now = performance.now();

    let finalAction = action;
    if (this.chaosState.active && this.chaosState.type === 'REVERSED_CONTROLS') {
      if (action === 'LEFT') finalAction = 'RIGHT';
      else if (action === 'RIGHT') finalAction = 'LEFT';
    }

    if (finalAction === 'LEFT') {
      if (now - this.lastLaneChangeTime < 75) return;
      if (this.currentLane > -1) {
        this.currentLane = (this.currentLane - 1) as Lane;
        this.targetLane = this.currentLane;
        this.laneChangeTilt = 0.35;
        this.lastLaneChangeTime = now;
        sounds.playLaneChange();
        this.triggerHaptic(12);
        this.callbacks.onActionTriggered?.('LEFT');
        if (this.isTutorial) this.tutorialActions.add('LEFT');
        if (this.isTutorial) this.tutorialActions.add('LANE');
      }
    } else if (finalAction === 'RIGHT') {
      if (now - this.lastLaneChangeTime < 75) return;
      if (this.currentLane < 1) {
        this.currentLane = (this.currentLane + 1) as Lane;
        this.targetLane = this.currentLane;
        this.laneChangeTilt = -0.35;
        this.lastLaneChangeTime = now;
        sounds.playLaneChange();
        this.triggerHaptic(12);
        this.callbacks.onActionTriggered?.('RIGHT');
        if (this.isTutorial) this.tutorialActions.add('RIGHT');
        if (this.isTutorial) this.tutorialActions.add('LANE');
      }
    } else if (finalAction === 'JUMP') {
      if (!this.isJumping) {
        this.isJumping = true;
        this.isSliding = false;
        const isLowGrav = this.chaosState.active && this.chaosState.type === 'LOW_GRAVITY';
        this.velY = isLowGrav ? 16.5 : 12.8;
        sounds.playJump();
        this.triggerHaptic(16);
        this.particles.emit(this.playerX, 0.1, this.playerZ, 12, 0x06b6d4, 3, 0.4);
        this.callbacks.onActionTriggered?.('JUMP');
        if (this.isTutorial) this.tutorialActions.add('JUMP');
      } else {
        this.inputBuffer = 'JUMP';
        this.inputBufferTimer = 0.22;
      }
    } else if (finalAction === 'SLIDE') {
      if (this.isJumping) {
        this.velY = -18;
      }
      this.isSliding = true;
      this.slideTimer = 0.75;
      sounds.playSlide();
      this.triggerHaptic(18);
      this.particles.emit(this.playerX, 0.05, this.playerZ + 0.3, 14, 0xfacc15, 3.5, 0.3);
      this.callbacks.onActionTriggered?.('SLIDE');
      if (this.isTutorial) this.tutorialActions.add('SLIDE');
    }
  }

  // --- Chaos Events System ---

  private updateChaos(dt: number) {
    if (!this.chaosState.active && this.chaosState.warningTimeLeft <= 0) {
      this.chaosTimer -= dt;
      if (this.chaosTimer <= 2.0 && this.chaosState.warningTimeLeft <= 0) {
        const events: ChaosType[] = [
          'LOW_GRAVITY',
          'TURBO_SPEED',
          'MOVING_BARRIERS',
          'COLOR_SHIFT',
          'REVERSED_CONTROLS',
        ];
        const nextType = events[Math.floor(this.getRandom() * events.length)];
        this.chaosState.warningTimeLeft = 2.0;
        this.chaosState.nextWarningType = nextType;
        sounds.playChaosWarning();
        this.triggerHaptic([30, 50, 30]);
        this.callbacks.onChaosUpdate({ ...this.chaosState });
      }
    }

    if (this.chaosState.warningTimeLeft > 0) {
      this.chaosState.warningTimeLeft -= dt;
      if (this.chaosState.warningTimeLeft <= 0) {
        this.triggerChaos(this.chaosState.nextWarningType!);
      } else if (this.hudTimer === 0) {
        this.callbacks.onChaosUpdate({ ...this.chaosState });
      }
    }

    if (this.chaosState.active) {
      this.chaosState.timeLeft -= dt;
      if (this.chaosState.timeLeft <= 0) {
        this.endChaos();
      } else if (this.hudTimer === 0) {
        this.callbacks.onChaosUpdate({ ...this.chaosState });
      }
    }
  }

  private triggerChaos(type: ChaosType) {
    sounds.playChaosDrop();
    this.triggerHaptic([50, 80, 50]);

    this.cameraShake = 0.45;

    let name = '';
    let description = '';
    let accentColor = '#06b6d4';

    if (type === 'LOW_GRAVITY') {
      name = 'GRAVITY GLITCH';
      description = 'ALGORITHM CORRUPTED: Float high above obstacles!';
      accentColor = '#38bdf8';
    } else if (type === 'TURBO_SPEED') {
      name = 'ALGORITHM OVERCLOCK';
      description = 'HYPER-SPEED ENGAGED: 1.4x Forward Velocity!';
      accentColor = '#ef4444';
    } else if (type === 'MOVING_BARRIERS') {
      name = 'GLITCH DRIFT';
      description = 'BARRIERS OSCILLATING ACROSS LANES!';
      accentColor = '#f59e0b';
    } else if (type === 'COLOR_SHIFT') {
      name = 'HYPERSPACE SHIFT';
      description = 'SPECTRUM INVERSION: Reality re-rendering!';
      accentColor = '#a855f7';
      const themes = [THEME_QUANTUM_MATRIX, THEME_SYNTHWAVE, THEME_CYBER_GOLD];
      this.environment.setTheme(themes[Math.floor(this.getRandom() * themes.length)]);
    } else if (type === 'REVERSED_CONTROLS') {
      name = 'SYNAPSE REVERSAL';
      description = 'WARNING: Left and Right steers are SWAPPED!';
      accentColor = '#ec4899';
    }

    this.chaosState = {
      active: true,
      type,
      timeLeft: 9.5,
      duration: 9.5,
      warningTimeLeft: 0,
      nextWarningType: null,
      name,
      description,
      accentColor,
    };

    this.callbacks.onChaosUpdate({ ...this.chaosState });
  }

  private endChaos() {
    if (this.chaosState.active) this.chaosSurvivedCount++;
    this.syncStageTheme();
    this.chaosState = {
      active: false,
      type: null,
      timeLeft: 0,
      duration: 10,
      warningTimeLeft: 0,
      nextWarningType: null,
      name: '',
      description: '',
      accentColor: '#06b6d4',
    };
    this.chaosTimer = 19 + this.getRandom() * 6;
    this.callbacks.onChaosUpdate({ ...this.chaosState });
  }

  private syncStageTheme() {
    if (this.currentStageIndex === 0) this.environment.setTheme(THEME_NEON_TOKYO);
    else if (this.currentStageIndex === 1) this.environment.setTheme(THEME_SYNTHWAVE);
    else if (this.currentStageIndex === 2) this.environment.setTheme(THEME_QUANTUM_MATRIX);
    else if (this.currentStageIndex >= 3) this.environment.setTheme(THEME_CYBER_GOLD);
  }

  // --- Start Menu Showcase Mode ---
  private startMenuShowcase() {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    if (this.gameOverTimer !== null) clearTimeout(this.gameOverTimer);
    localAnalytics.abandonRun();
    this.isMenuMode = true;
    this.isRunning = false;

    let lastTime = performance.now();
    const showcaseLoop = (time: number) => {
      if (!this.isMenuMode) return;
      this.animFrameId = requestAnimationFrame(showcaseLoop);

      const rawDt = (time - lastTime) / 1000;
      lastTime = time;
      const dt = Math.min(rawDt, 0.05);

      if (document.hidden || this.studioOpen) return;
      this.globalTime += dt;
      this.character.animate(dt, 'IDLE', 1.0, 0, this.globalTime);

      const floatY = 1.9 + (this.reducedMotion.matches ? 0 : Math.sin(this.globalTime * 1.5) * 0.04);
      const floatX = this.reducedMotion.matches ? 0 : Math.sin(this.globalTime * 0.8) * 0.12;
      this.camera.position.set(floatX, floatY, this.playerZ + 3.8);
      this.camera.lookAt(0, 1.15, this.playerZ);

      this.environment.update(this.playerZ, dt, this.globalTime);
      this.renderer.render(this.scene, this.camera);
    };

    this.animFrameId = requestAnimationFrame(showcaseLoop);
  }

  // --- Main Gameplay Loop ---

  public start() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.isMenuMode = false;
    this.isRunning = true;
    this.isPaused = false;
    this.isCrashing = false;
    this.slowMoFactor = 1.0;
    this.currentStageIndex = 0;
    this.syncStageTheme();
    sounds.startBGM();

    let lastTime = performance.now();
    let accumulator = 0;

    const loop = (time: number) => {
      this.animFrameId = requestAnimationFrame(loop);
      const rawDt = (time - lastTime) / 1000;
      lastTime = time;

      if (!this.isRunning || this.isPaused || document.hidden) return;
      if (this.discardFrame) {
        this.discardFrame = false;
        return;
      }
      localAnalytics.recordFPS(1000 / (rawDt * 1000), rawDt * 1000);
      this.adaptiveTime += rawDt;
      this.adaptiveFrames++;
      if (this.adaptiveTime >= 3) {
        if (this.adaptiveFrames / this.adaptiveTime < 40 && this.renderer.getPixelRatio() > 0.75) {
          this.renderer.setPixelRatio(Math.max(0.75, this.renderer.getPixelRatio() - 0.25));
          this.renderer.shadowMap.enabled = false;
          this.character.setShadowsEnabled(false);
        }
        this.adaptiveTime = 0;
        this.adaptiveFrames = 0;
      }
      // Fixed 120Hz simulation keeps seeded scheduling independent of display refresh rate.
      accumulator += Math.min(rawDt, 0.25) * this.slowMoFactor;
      while (accumulator >= 1 / 120 && !this.isPaused && this.isRunning) {
        this.update(1 / 120);
        accumulator -= 1 / 120;
      }
      this.render();
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public pause() {
    this.isPaused = true;
    sounds.stopBGM();
  }

  public resume() {
    this.isPaused = false;
    this.discardFrame = true;
    if (this.isRunning && !this.isCrashing) sounds.startBGM();
  }

  public setSkin(skin: Skin) {
    this.character.updateSkin({
      primary: parseInt(skin.primaryColor.replace('#', '0x')),
      secondary: parseInt(skin.secondaryColor.replace('#', '0x')),
      glow: parseInt(skin.glowColor.replace('#', '0x')),
      accent: 0xffffff,
      finish: skin.finish,
      appearance: skin,
    });
  }

  private update(dt: number) {
    this.globalTime += dt;

    if (this.hitstopDuration > 0) {
      this.hitstopDuration -= dt;
      return;
    }

    if (this.inputBuffer) {
      this.inputBufferTimer -= dt;
      if (this.inputBufferTimer <= 0) {
        this.inputBuffer = null;
      }
    }

    if (this.isInvulnerable) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    if (this.postChaosSafeTimer > 0) {
      this.postChaosSafeTimer -= dt;
    }

    this.simulationTime += dt;
    if (!this.isCrashing) this.elapsedSeconds += dt;
    this.previousZ = this.playerZ;
    this.hudTimer += dt;
    const publishHUD = this.hudTimer >= 0.1;
    if (publishHUD) this.hudTimer = 0;
    if (this.debugHitboxesEnabled) this.character.setDebugHitbox(true, this.isSliding);
    if (
      this.isTutorial &&
      this.tutorialStep === 1 &&
      this.tutorialActions.has('LEFT') &&
      this.tutorialActions.has('RIGHT')
    )
      this.advanceTutorial();

    if (
      this.isTutorial &&
      this.tutorialStep === 4 &&
      this.collectibles.getActiveCoins().length === 0
    )
      this.prepareTutorialStep();

    // 1. Calculate Speed (Balanced ramp with beginner-friendly 16.0 base speed)
    let speedMult = 1.0;
    if (this.activePowerUps.has('SPEED_BOOST')) {
      speedMult *= 1.45;
    }
    if (this.chaosState.active && this.chaosState.type === 'TURBO_SPEED') {
      speedMult *= 1.35;
    }
    const baseSpeed = this.isTutorial ? 14.0 : 16.0;
    const speedRamp = this.isTutorial ? 0 : Math.min(this.distanceTraveled * 0.007, 8.0);
    this.currentSpeed = (baseSpeed + speedRamp) * speedMult;

    // 2. Advance player forward
    if (
      !this.isCrashing &&
      !(this.isTutorial && (this.tutorialStep === 1 || this.tutorialStep === 6))
    ) {
      const moveZ = this.currentSpeed * dt;
      this.playerZ -= moveZ;
      this.distanceTraveled += moveZ;

      if (!this.boss.state.active && this.playerZ - 180 < this.spawnCursorZ) {
        this.spawnNextEncounter();
      }

      // Check Stage Transition milestones
      const nextStageIndex = STAGES.findIndex((s, idx) => {
        const nextStage = STAGES[idx + 1];
        if (!nextStage) return true;
        return (
          this.distanceTraveled >= s.startDistance &&
          this.distanceTraveled < nextStage.startDistance
        );
      });

      if (nextStageIndex !== -1 && nextStageIndex !== this.currentStageIndex) {
        this.currentStageIndex = nextStageIndex;
        if (!this.chaosState.active) {
          this.syncStageTheme();
        }
        this.callbacks.onStageChange?.(STAGES[this.currentStageIndex]);
      }

      // Trigger Algorithm Boss battle encounter at distance milestones
      if (!this.boss.state.active && this.distanceTraveled >= this.nextBossTriggerDistance) {
        this.nextBossTriggerDistance += 600;
        this.obstacles.clear(); // Boss safe lanes must not overlap old normal encounters.
        this.collectibles.clear();
        this.spawnCursorZ = this.playerZ - 60;
        this.chaosState.active = false;
        this.chaosState.warningTimeLeft = 0;
        this.syncStageTheme();
        this.boss.triggerBoss();
      }
    }

    // 3. Lane Switching Physics
    const targetX = LANE_POSITIONS[this.targetLane];
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 17, dt);
    this.laneChangeTilt = THREE.MathUtils.damp(this.laneChangeTilt, 0, 8, dt);

    // 4. Jump & Gravity Physics
    if (this.isJumping) {
      const isLowGrav = this.chaosState.active && this.chaosState.type === 'LOW_GRAVITY';
      const gravity = isLowGrav ? 18 : 34;

      this.playerY += this.velY * dt;
      this.velY -= gravity * dt;

      if (this.playerY <= 0) {
        this.playerY = 0;
        this.velY = 0;
        this.isJumping = false;
        this.character.triggerLandingSquash();

        if (this.inputBuffer === 'JUMP') {
          this.inputBuffer = null;
          this.handleInput('JUMP');
        }
      }
    }

    // 5. Slide Physics & Sparks
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      } else {
        this.particles.emitTrail(this.playerX, 0.05, this.playerZ, 0xfacc15);
      }
    }

    if (!this.isJumping && !this.isSliding && !this.isCrashing) {
      if (Math.sin(this.globalTime * 20) > 0.8) {
        this.particles.emitTrail(this.playerX, 0.02, this.playerZ, 0x06b6d4);
      }
    }

    // 6. Character transformations & animation
    this.character.group.position.set(this.playerX, this.playerY, this.playerZ);

    const animStatus = this.isCrashing
      ? 'CRASH'
      : this.isSliding
        ? 'SLIDE'
        : this.isJumping
          ? 'JUMP'
          : 'RUN';
    this.character.animate(
      dt,
      animStatus,
      this.currentSpeed / 22,
      this.laneChangeTilt,
      this.globalTime,
    );

    this.character.shieldMesh.visible = this.activePowerUps.has('SHIELD');
    this.character.magnetRing.visible = this.activePowerUps.has('MAGNET');
    this.character.boostAura.visible =
      this.activePowerUps.has('SPEED_BOOST') ||
      (this.chaosState.active && this.chaosState.type === 'TURBO_SPEED');

    // 7. Update Subsystems & Boss
    this.environment.update(this.playerZ, dt, this.globalTime);
    const movingBarriersChaos =
      this.chaosState.active && this.chaosState.type === 'MOVING_BARRIERS';
    this.obstacles.update(dt, this.playerZ, movingBarriersChaos, this.globalTime);
    this.collectibles.update(
      dt,
      this.playerX,
      this.playerY,
      this.playerZ,
      this.activePowerUps.has('MAGNET'),
      this.globalTime,
    );
    this.particles.update(dt);
    if (!this.isTutorial && !this.boss.state.active) this.updateChaos(dt);

    // Update Boss Battle
    if (this.boss.state.active) {
      this.boss.update(
        dt,
        this.playerZ,
        this.globalTime,
        () => {
          // Boss Defeated!
          this.bossDefeatedCount++;
          this.spawnCursorZ = this.playerZ - 60;
          this.chaosTimer = 19;
          this.coinsCollected += 150;
          this.activePowerUps.set('SPEED_BOOST', 6);
          this.cameraShake = 0.6;
          this.particles.emit(0, 4.0, this.playerZ - 28, 50, 0xfacc15, 8, 1.2);
          this.callbacks.onActionTriggered?.('BOSS_DEFEATED');
        },
        (type, lane) => {
          // Spawn Boss telegraphed hazard 35 units ahead
          this.obstacles.spawnObstacle(
            type,
            lane,
            this.playerZ - Math.max(36, this.currentSpeed * 2),
          );
        },
        this.bossRandom,
      );
      if (publishHUD) this.callbacks.onBossUpdate?.({ ...this.boss.state });
    } else if (publishHUD) {
      this.callbacks.onBossUpdate?.({ ...this.boss.state });
    }

    // 8. Powerup Timers
    const powerUpsList: ActivePowerUp[] | null = publishHUD ? [] : null;
    for (const [type, timeLeft] of this.activePowerUps.entries()) {
      const nextTime = timeLeft - dt;
      if (nextTime <= 0) {
        this.activePowerUps.delete(type);
      } else {
        this.activePowerUps.set(type, nextTime);
        const maxDur = type === 'SPEED_BOOST' ? 6 : type === 'DOUBLE_COINS' ? 12 : 10;
        powerUpsList?.push({ type, timeLeft: nextTime, duration: maxDur });
      }
    }
    if (powerUpsList) this.callbacks.onPowerUpsUpdate(powerUpsList);

    // 9. Precision Collision Detection & Obstacle Dodging Counter
    if (!this.isCrashing) {
      this.checkCollisions();
    }

    // Stable horizon and limited lane follow leave the approaching lanes readable.
    const isBoosting =
      this.activePowerUps.has('SPEED_BOOST') ||
      (this.chaosState.active && this.chaosState.type === 'TURBO_SPEED');
    const rig = this.runnerCamera;
    rig.update(dt, this.playerX, isBoosting, this.globalTime, !this.reducedMotion.matches, this.cameraShake);
    this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 7, dt);
    this.camera.position.set(rig.x, rig.y, this.playerZ + rig.offsetZ);
    this.camera.lookAt(rig.lookX, rig.lookY, this.playerZ - rig.lookAhead);

    // 11. Dispatch stats to React UI
    const score = Math.floor(this.distanceTraveled) + this.coinsCollected * 10;

    if (publishHUD)
      this.callbacks.onStatsUpdate({
        score,
        distance: Math.floor(this.distanceTraveled),
        coins: this.coinsCollected,
        highScore: 0,
        totalCoins: 0,
        runsPlayed: 0,
        chaosSurvived: this.chaosSurvivedCount,
        obstaclesDodged: this.obstaclesDodgedCount,
        bossDefeated: this.bossDefeatedCount,
        isDailyChallenge: this.isDailyChallenge,
        stage: STAGES[this.currentStageIndex],
      });
  }

  private checkCollisions() {
    // 1. Coins
    const activeCoins = this.collectibles.getActiveCoins();
    for (let i = activeCoins.length - 1; i >= 0; i--) {
      const coin = activeCoins[i];
      if (coin.collected) continue;
      const mesh = this.collectibles.getCoinMesh(coin.id);
      if (!mesh) continue;

      const dx = Math.abs(mesh.position.x - this.playerX);
      const dy = Math.abs(mesh.position.y - (this.playerY + 0.9));
      const dz = Math.abs(mesh.position.z - this.playerZ);

      if (dx < 1.15 && dy < 1.35 && dz < 1.2) {
        coin.collected = true;
        sounds.playCoin();
        this.triggerHaptic(8);
        const coinVal = this.activePowerUps.has('DOUBLE_COINS') ? 2 : 1;
        this.coinsCollected += coinVal;
        this.particles.emit(
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
          14,
          0xfacc15,
          4,
          0.4,
        );
        this.collectibles.removeCoin(coin.id);
        if (this.isTutorial && this.tutorialStep === 4 && this.coinsCollected > this.tutorialCoins)
          this.advanceTutorial();
      }
    }

    // 2. Power-ups
    const activePowerUps = this.collectibles.getActivePowerUps();
    for (let i = activePowerUps.length - 1; i >= 0; i--) {
      const pu = activePowerUps[i];
      if (pu.collected) continue;
      const mesh = this.collectibles.getPowerUpMesh(pu.id);
      if (!mesh) continue;

      const dx = Math.abs(mesh.position.x - this.playerX);
      const dy = Math.abs(mesh.position.y - (this.playerY + 0.9));
      const dz = Math.abs(mesh.position.z - this.playerZ);

      if (dx < 1.25 && dy < 1.45 && dz < 1.3) {
        pu.collected = true;
        sounds.playPowerUp();
        this.triggerHaptic([25, 40, 25]);
        const duration = pu.type === 'SPEED_BOOST' ? 6 : pu.type === 'DOUBLE_COINS' ? 12 : 10;
        this.activePowerUps.set(pu.type, duration);
        this.particles.emit(
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
          22,
          0x06b6d4,
          5,
          0.6,
        );
        this.collectibles.removePowerUp(pu.id);
      }
    }

    // 3. Obstacles & Dodging
    if (this.isInvulnerable) return;

    const activeObstacles = this.obstacles.getActiveObstacles();

    for (const obs of activeObstacles) {
      const mesh = this.obstacles.getMesh(obs.id);
      if (!mesh) continue;

      if (obs.passed) continue;
      const collides = hitsObstacle(
        obs.type,
        Math.abs(mesh.position.x - this.playerX),
        mesh.position.z,
        this.previousZ,
        this.playerZ,
        this.playerY,
        this.isSliding,
        mesh.position.y,
      );
      if (
        this.isTutorial &&
        obs.id === this.tutorialHazardId &&
        this.previousZ >= mesh.position.z &&
        this.playerZ <= mesh.position.z
      ) {
        const dx = Math.abs(mesh.position.x - this.playerX);
        if (
          (this.tutorialStep === 2 && dx < 1.35 && this.playerY >= 0.62) ||
          (this.tutorialStep === 3 && dx < 1.35 && this.isSliding && this.playerY < 0.8) ||
          (this.tutorialStep === 5 && dx >= 1.35)
        )
          this.tutorialActions.add('CLEARED');
      }
      if (!collides && mesh.position.z > this.playerZ + 0.52) {
        obs.passed = true;
        this.obstaclesDodgedCount++;
        this.callbacks.onActionTriggered?.('DODGE');
        if (this.isTutorial && obs.id === this.tutorialHazardId) {
          const required =
            this.tutorialStep === 2 ? 'JUMP' : this.tutorialStep === 3 ? 'SLIDE' : 'LANE';
          if (this.tutorialActions.has(required) && this.tutorialActions.has('CLEARED'))
            this.advanceTutorial();
          else this.prepareTutorialStep();
          return;
        }
      }
      if (collides) {
        if (this.activePowerUps.has('SPEED_BOOST')) {
          obs.passed = true;
          sounds.playShieldBreak();
          this.triggerHaptic([30, 40]);
          this.particles.emit(mesh.position.x, 1.2, mesh.position.z, 25, 0xef4444, 6, 0.5);
          this.obstacles.removeObstacle(obs.id);
          this.cameraShake = 0.3;
          return;
        }

        if (this.activePowerUps.has('SHIELD')) {
          obs.passed = true;
          this.activePowerUps.delete('SHIELD');
          sounds.playShieldBreak();
          this.triggerHaptic([35, 60, 35]);
          this.hitstopDuration = 0.05;
          this.cameraShake = 0.5;
          this.isInvulnerable = true;
          this.invulnerableTimer = 1.0;
          this.particles.emit(this.playerX, 1.0, this.playerZ, 30, 0x06b6d4, 6, 0.6);
          this.obstacles.removeObstacle(obs.id);
          return;
        }

        if (this.isTutorial) {
          this.prepareTutorialStep();
          sounds.playShieldBreak();
          this.triggerHaptic([35, 60, 35]);
          this.obstacles.removeObstacle(obs.id);
          this.particles.emit(this.playerX, 1.0, this.playerZ, 20, 0x06b6d4, 5, 0.5);
          return;
        }

        this.lastEliminationCause = obs.type;
        this.triggerGameOver(obs.type);
        return;
      }
    }
  }

  private triggerGameOver(cause?: string) {
    if (this.isCrashing) return;
    this.isCrashing = true;
    this.slowMoFactor = 0.25;
    sounds.playHit();
    sounds.stopBGM();
    this.triggerHaptic([50, 70, 50, 100]);
    this.cameraShake = 0.8;
    this.particles.emit(this.playerX, 1.0, this.playerZ, 45, 0xef4444, 7, 0.8);
    this.character.animate(0.016, 'CRASH', 0, 0, this.globalTime);

    const finalScore = Math.floor(this.distanceTraveled) + this.coinsCollected * 10;

    const stats: PlayerStats = {
      score: finalScore,
      distance: Math.floor(this.distanceTraveled),
      coins: this.coinsCollected,
      highScore: 0,
      totalCoins: 0,
      runsPlayed: 0,
      chaosSurvived: this.chaosSurvivedCount,
      obstaclesDodged: this.obstaclesDodgedCount,
      bossDefeated: this.bossDefeatedCount,
      isDailyChallenge: this.isDailyChallenge,
      stage: STAGES[this.currentStageIndex],
    };

    localAnalytics.recordRunEnd(
      stats.score,
      stats.distance,
      stats.coins,
      cause,
      this.isDailyChallenge,
      stats.stage?.name,
      this.elapsedSeconds,
    );
    this.gameOverTimer = setTimeout(() => {
      this.isRunning = false;
      if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
      this.callbacks.onGameOver(
        { ...stats, durationSeconds: this.elapsedSeconds },
        cause || this.lastEliminationCause,
      );
    }, 550);
  }

  public startTutorial(initialSkin: Skin) {
    this.isTutorial = true;
    this.tutorialStep = 1;
    this.isDailyChallenge = false;
    this.prng = null;

    this.currentLane = 0;
    this.targetLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.velY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.isCrashing = false;
    this.slowMoFactor = 1.0;
    this.slideTimer = 0;
    this.laneChangeTilt = 0;
    this.distanceTraveled = 0;
    this.coinsCollected = 0;
    this.chaosSurvivedCount = 0;
    this.obstaclesDodgedCount = 0;
    this.bossDefeatedCount = 0;
    this.currentStageIndex = 0;
    this.nextBossTriggerDistance = 99999;
    this.currentSpeed = 14.0;
    this.spawnCursorZ = -25;
    this.nextPowerUpDistance = 99999;
    this.cameraShake = 0;
    this.hitstopDuration = 0;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.inputBuffer = null;

    this.activePowerUps.clear();
    this.syncStageTheme();
    this.obstacles.clear();
    this.collectibles.clear();
    this.particles.clear();
    this.boss.reset();

    this.setSkin(initialSkin);
    this.character.group.position.set(0, 0, 0);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.updateCameraFOV(width, height);
    this.runnerCamera.reset();
    this.camera.position.set(0, this.runnerCamera.y, this.runnerCamera.offsetZ);
    this.camera.lookAt(0, this.runnerCamera.lookY, -this.runnerCamera.lookAhead);

    this.resetRuntime();
    this.prepareTutorialStep();
    this.start();
  }

  private prepareTutorialStep() {
    this.obstacles.clear();
    this.collectibles.clear();
    this.tutorialActions.clear();
    this.tutorialCoins = this.coinsCollected;
    this.tutorialHazardId = null;
    const lane = this.targetLane;
    if (this.tutorialStep === 2 || this.tutorialStep === 3 || this.tutorialStep === 5) {
      const type =
        this.tutorialStep === 2
          ? 'LOW_BARRIER'
          : this.tutorialStep === 3
            ? 'HIGH_BARRIER'
            : 'FULL_BLOCK';
      this.tutorialHazardId = this.obstacles.spawnObstacle(type, lane, this.playerZ - 22).id;
    }
    if (this.tutorialStep === 4) this.collectibles.spawnCoinRow(lane, this.playerZ - 12, 7);
    const prompts = [
      [
        'SWIPE LEFT & RIGHT',
        'Swipe both directions (or use arrow keys/buttons). Training waits for you.',
      ],
      ['SWIPE UP TO JUMP', 'Jump over the low barrier in your lane. Missed it? Safely try again.'],
      ['SWIPE DOWN TO SLIDE', 'Slide under the high barrier. Use a down swipe or arrow key.'],
      ['COLLECT CLOUT COINS', 'Stay aligned with the coin stream to collect a coin.'],
      ['DODGE SOLID WALLS', 'Switch to an open lane to pass the solid wall.'],
      ['TUTORIAL COMPLETE!', 'Your controls are ready. Enter the algorithm when ready.'],
    ];
    const [title, instruction] = prompts[this.tutorialStep - 1];
    this.callbacks.onTutorialStep?.(
      Math.min(5, this.tutorialStep),
      title,
      instruction,
      this.tutorialStep === 6,
    );
  }

  private advanceTutorial() {
    if (!this.isTutorial || this.tutorialStep >= 6) return;
    this.tutorialStep++;
    this.prepareTutorialStep();
    if (this.tutorialStep === 6) {
      sounds.stopBGM();
      this.callbacks.onTutorialComplete?.();
    }
  }

  private resetRuntime() {
    if (this.gameOverTimer !== null) clearTimeout(this.gameOverTimer);
    this.environment.reset();
    this.elapsedSeconds = 0;
    this.simulationTime = 0;
    this.globalTime = 0;
    this.previousZ = 0;
    this.lastLaneChangeTime = -1000;
    this.discardFrame = true;
    this.hudTimer = 0.1;
    this.chaosTimer = 19;
    this.postChaosSafeTimer = 0;
    this.chaosState = {
      ...this.chaosState,
      active: false,
      type: null,
      warningTimeLeft: 0,
      timeLeft: 0,
      nextWarningType: null,
    };
    this.callbacks.onChaosUpdate({ ...this.chaosState });
  }

  public reset(initialSkin: Skin, isDailyChallenge: boolean = false) {
    this.resetRuntime();
    this.isTutorial = false;
    this.tutorialStep = 0;
    this.isDailyChallenge = isDailyChallenge;
    if (isDailyChallenge) {
      this.prng = new SeededPRNG(getDailySeed());
      const obstaclePRNG = new SeededPRNG(getDailySeed() ^ 0x1234);
      const bossPRNG = new SeededPRNG(getDailySeed() ^ 0x5678);
      this.obstacleRandom = () => obstaclePRNG.next();
      this.bossRandom = () => bossPRNG.next();
    } else {
      this.prng = null;
      this.obstacleRandom = Math.random;
      this.bossRandom = Math.random;
    }
    this.obstacles.setRandom(this.obstacleRandom);
    localAnalytics.recordRunStart(isDailyChallenge);

    this.currentLane = 0;
    this.targetLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.velY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.isCrashing = false;
    this.slowMoFactor = 1.0;
    this.slideTimer = 0;
    this.laneChangeTilt = 0;
    this.distanceTraveled = 0;
    this.coinsCollected = 0;
    this.chaosSurvivedCount = 0;
    this.obstaclesDodgedCount = 0;
    this.bossDefeatedCount = 0;
    this.currentStageIndex = 0;
    this.nextBossTriggerDistance = 450;
    this.currentSpeed = this.baseSpeed;
    this.spawnCursorZ = -25;
    this.nextPowerUpDistance = 75;
    this.cameraShake = 0;
    this.hitstopDuration = 0;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.inputBuffer = null;

    this.activePowerUps.clear();
    this.syncStageTheme();
    this.obstacles.clear();
    this.collectibles.clear();
    this.particles.clear();
    this.boss.reset();

    this.setSkin(initialSkin);
    this.character.group.position.set(0, 0, 0);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.updateCameraFOV(width, height);
    this.runnerCamera.reset();
    this.camera.position.set(0, this.runnerCamera.y, this.runnerCamera.offsetZ);
    this.camera.lookAt(0, this.runnerCamera.lookY, -this.runnerCamera.lookAhead);

    this.populateInitialTrack();
    this.start();
  }

  public showMenuShowcase() {
    this.startMenuShowcase();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.gameOverTimer !== null) clearTimeout(this.gameOverTimer);
    this.isRunning = false;
    this.isMenuMode = false;
    sounds.stopBGM();
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material)
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(mat);
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) textures.add(value);
        }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.environment.dirLight.shadow.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
