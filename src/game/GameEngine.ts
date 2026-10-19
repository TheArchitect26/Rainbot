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

    const savedVib = localStorage.getItem('brainrot_vibration');
    if (savedVib !== null) this.vibrationEnabled = savedVib === 'true';

    const savedQuality = localStorage.getItem('brainrot_quality') as GraphicsQuality | null;
    if (savedQuality) this.quality = savedQuality;

    const savedShadows = localStorage.getItem('brainrot_shadows');
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
      this.pause();
    });

    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.renderer.compile(this.scene, this.camera);
      this.resume();
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

  private onVisibilityChange = () => {
    if (document.hidden && this.isRunning && !this.isPaused) {
      this.pause();
    }
  };

  public setVibration(enabled: boolean) {
    this.vibrationEnabled = enabled;
    localStorage.setItem('brainrot_vibration', String(enabled));
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
    localStorage.setItem('brainrot_quality', quality);

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
    localStorage.setItem('brainrot_shadows', String(enabled));
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
    if (this.isTutorial) return;

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
    } else if (roll < 0.90) {
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
      } else {
        this.callbacks.onChaosUpdate({ ...this.chaosState });
      }
    }

    if (this.chaosState.active) {
      this.chaosState.timeLeft -= dt;
      if (this.chaosState.timeLeft <= 0) {
        this.endChaos();
      } else {
        this.callbacks.onChaosUpdate({ ...this.chaosState });
      }
    }
  }

  private triggerChaos(type: ChaosType) {
    sounds.playChaosDrop();
    this.triggerHaptic([50, 80, 50]);
    this.chaosSurvivedCount++;
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
    this.isMenuMode = true;
    this.isRunning = false;

    let lastTime = performance.now();
    const showcaseLoop = (time: number) => {
      if (!this.isMenuMode) return;
      this.animFrameId = requestAnimationFrame(showcaseLoop);

      const rawDt = (time - lastTime) / 1000;
      lastTime = time;
      const dt = Math.min(rawDt, 0.05);

      this.globalTime += dt;
      this.character.animate(dt, 'IDLE', 1.0, 0, this.globalTime);

      const floatY = 1.9 + Math.sin(this.globalTime * 1.5) * 0.12;
      const floatX = Math.sin(this.globalTime * 0.8) * 0.45;
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

    const loop = (time: number) => {
      this.animFrameId = requestAnimationFrame(loop);
      const rawDt = (time - lastTime) / 1000;
      lastTime = time;

      // Local FPS and frame spike diagnostic sampling
      if (rawDt > 0) {
        const currentFps = Math.min(240, Math.round(1 / rawDt));
        localAnalytics.recordFPS(currentFps, rawDt * 1000);
      }

      const dt = Math.min(rawDt, 0.05) * this.slowMoFactor;

      if (!this.isPaused) {
        this.update(dt);
      }
      this.render();
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
  }

  public setSkin(skin: Skin) {
    this.character.updateSkin({
      primary: parseInt(skin.primaryColor.replace('#', '0x')),
      secondary: parseInt(skin.secondaryColor.replace('#', '0x')),
      glow: parseInt(skin.glowColor.replace('#', '0x')),
      accent: 0xffffff,
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

    // Tutorial step progression triggers
    if (this.isTutorial) {
      if (this.tutorialStep === 1 && this.distanceTraveled >= 35) {
        this.tutorialStep = 2;
        this.callbacks.onTutorialStep?.(
          2,
          'SWIPE UP TO JUMP',
          'Flick upwards to clear low laser barriers.',
          false
        );
      } else if (this.tutorialStep === 2 && this.distanceTraveled >= 85) {
        this.tutorialStep = 3;
        this.callbacks.onTutorialStep?.(
          3,
          'SWIPE DOWN TO SLIDE',
          'Flick downwards to duck under elevated high beams.',
          false
        );
      } else if (this.tutorialStep === 3 && this.distanceTraveled >= 140) {
        this.tutorialStep = 4;
        this.callbacks.onTutorialStep?.(
          4,
          'COLLECT CLOUT COINS',
          'Harvest coins along your lane for score multipliers and skins.',
          false
        );
      } else if (this.tutorialStep === 4 && this.distanceTraveled >= 195) {
        this.tutorialStep = 5;
        this.callbacks.onTutorialStep?.(
          5,
          'DODGE SOLID WALLS',
          'Solid walls cannot be jumped or slid under. Switch to the open lane!',
          false
        );
      } else if (this.tutorialStep === 5 && this.distanceTraveled >= 250) {
        this.tutorialStep = 6;
        sounds.playPowerUp();
        this.callbacks.onTutorialStep?.(
          5,
          'TUTORIAL COMPLETE!',
          'You are ready to outrun the algorithm!',
          true
        );
        this.callbacks.onTutorialComplete?.();
      }
    }

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
    if (!this.isCrashing) {
      const moveZ = this.currentSpeed * dt;
      this.playerZ -= moveZ;
      this.distanceTraveled += moveZ;

      if (this.playerZ - 120 < this.spawnCursorZ) {
        this.spawnNextEncounter();
      }

      // Check Stage Transition milestones
      const nextStageIndex = STAGES.findIndex((s, idx) => {
        const nextStage = STAGES[idx + 1];
        if (!nextStage) return true;
        return this.distanceTraveled >= s.startDistance && this.distanceTraveled < nextStage.startDistance;
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

    const animStatus = this.isCrashing ? 'CRASH' : this.isSliding ? 'SLIDE' : this.isJumping ? 'JUMP' : 'RUN';
    this.character.animate(
      dt,
      animStatus,
      this.currentSpeed / 22,
      this.laneChangeTilt,
      this.globalTime
    );

    this.character.shieldMesh.visible = this.activePowerUps.has('SHIELD');
    this.character.magnetRing.visible = this.activePowerUps.has('MAGNET');
    this.character.boostAura.visible =
      this.activePowerUps.has('SPEED_BOOST') ||
      (this.chaosState.active && this.chaosState.type === 'TURBO_SPEED');

    // 7. Update Subsystems & Boss
    this.environment.update(this.playerZ, dt, this.globalTime);
    const movingBarriersChaos = this.chaosState.active && this.chaosState.type === 'MOVING_BARRIERS';
    this.obstacles.update(dt, this.playerZ, movingBarriersChaos, this.globalTime);
    this.collectibles.update(
      dt,
      this.playerX,
      this.playerY,
      this.playerZ,
      this.activePowerUps.has('MAGNET'),
      this.globalTime
    );
    this.particles.update(dt);
    this.updateChaos(dt);

    // Update Boss Battle
    if (this.boss.state.active) {
      this.boss.update(
        dt,
        this.playerZ,
        this.globalTime,
        () => {
          // Boss Defeated!
          this.bossDefeatedCount++;
          this.coinsCollected += 150;
          this.activePowerUps.set('SPEED_BOOST', 6);
          this.cameraShake = 0.6;
          this.particles.emit(0, 4.0, this.playerZ - 28, 50, 0xfacc15, 8, 1.2);
          this.callbacks.onActionTriggered?.('BOSS_DEFEATED');
        },
        (type, lane) => {
          // Spawn Boss telegraphed hazard 35 units ahead
          this.obstacles.spawnObstacle(type, lane, this.playerZ - 36);
        }
      );
      this.callbacks.onBossUpdate?.({ ...this.boss.state });
    } else {
      this.callbacks.onBossUpdate?.({ ...this.boss.state });
    }

    // 8. Powerup Timers
    const powerUpsList: ActivePowerUp[] = [];
    for (const [type, timeLeft] of this.activePowerUps.entries()) {
      const nextTime = timeLeft - dt;
      if (nextTime <= 0) {
        this.activePowerUps.delete(type);
      } else {
        this.activePowerUps.set(type, nextTime);
        const maxDur = type === 'SPEED_BOOST' ? 6 : type === 'DOUBLE_COINS' ? 12 : 10;
        powerUpsList.push({ type, timeLeft: nextTime, duration: maxDur });
      }
    }
    this.callbacks.onPowerUpsUpdate(powerUpsList);

    // 9. Precision Collision Detection & Obstacle Dodging Counter
    if (!this.isCrashing) {
      this.checkCollisions();
    }

    // 10. Mobile Camera positioning
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShake > 0) {
      shakeX = (Math.random() - 0.5) * this.cameraShake;
      shakeY = (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 7, dt);
    }

    const camTargetX = this.playerX * 0.4 + shakeX;
    const camTargetY = this.playerY * 0.35 + (this.isSliding ? 2.5 : 2.95) + shakeY;
    const isBoosting =
      this.activePowerUps.has('SPEED_BOOST') ||
      (this.chaosState.active && this.chaosState.type === 'TURBO_SPEED');
    const camTargetZ = this.playerZ + (isBoosting ? 5.6 : 4.9);

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camTargetX, 11, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camTargetY, 11, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camTargetZ, 12, dt);

    this.camera.lookAt(this.playerX * 0.2, this.playerY * 0.22 + 1.25, this.playerZ - 10.0);

    // 11. Dispatch stats to React UI
    const multiplier = this.activePowerUps.has('DOUBLE_COINS') ? 2 : 1;
    const score = Math.floor(this.distanceTraveled * multiplier) + this.coinsCollected * 10;

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
    for (const coin of activeCoins) {
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
        this.particles.emit(mesh.position.x, mesh.position.y, mesh.position.z, 14, 0xfacc15, 4, 0.4);
        this.collectibles.removeCoin(coin.id);
      }
    }

    // 2. Power-ups
    const activePowerUps = this.collectibles.getActivePowerUps();
    for (const pu of activePowerUps) {
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
        this.particles.emit(mesh.position.x, mesh.position.y, mesh.position.z, 22, 0x06b6d4, 5, 0.6);
        this.collectibles.removePowerUp(pu.id);
      }
    }

    // 3. Obstacles & Dodging
    if (this.isInvulnerable) return;

    const activeObstacles = this.obstacles.getActiveObstacles();
    const isPlayerSliding = this.isSliding;
    const playerBottom = this.playerY;
    const playerTop = this.playerY + (isPlayerSliding ? 0.45 : 1.75);

    for (const obs of activeObstacles) {
      const mesh = this.obstacles.getMesh(obs.id);
      if (!mesh) continue;

      // Track successfully dodged obstacle as soon as runner moves past it
      if (!obs.passed && mesh.position.z > this.playerZ + 0.5) {
        obs.passed = true;
        this.obstaclesDodgedCount++;
        this.callbacks.onActionTriggered?.('DODGE');
        continue;
      }

      if (obs.passed) continue;

      const dx = Math.abs(mesh.position.x - this.playerX);
      const dz = Math.abs(mesh.position.z - this.playerZ);

      if (dz < 0.52 && dx < 0.95) {
        let collides = false;

        if (obs.type === 'LOW_BARRIER') {
          if (playerBottom < 0.62) {
            collides = true;
          }
        } else if (obs.type === 'HIGH_BARRIER') {
          if (!isPlayerSliding || playerTop > 1.25) {
            collides = true;
          }
        } else if (obs.type === 'FULL_BLOCK') {
          collides = true;
        } else if (obs.type === 'MOVING_DRONE') {
          if (playerTop > 0.8 && playerBottom < 2.3) {
            collides = true;
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
            this.isInvulnerable = true;
            this.invulnerableTimer = 1.8;
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
  }

  private triggerGameOver(cause?: string) {
    this.isCrashing = true;
    this.slowMoFactor = 0.25;
    sounds.playHit();
    sounds.stopBGM();
    this.triggerHaptic([50, 70, 50, 100]);
    this.cameraShake = 0.8;
    this.particles.emit(this.playerX, 1.0, this.playerZ, 45, 0xef4444, 7, 0.8);
    this.character.animate(0.016, 'CRASH', 0, 0, this.globalTime);

    const multiplier = this.activePowerUps.has('DOUBLE_COINS') ? 2 : 1;
    const finalScore = Math.floor(this.distanceTraveled * multiplier) + this.coinsCollected * 10;

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

    setTimeout(() => {
      this.isRunning = false;
      this.callbacks.onGameOver(stats, cause || this.lastEliminationCause);
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
    this.camera.position.set(0, 2.95, 4.9);

    // Scripted Tutorial Obstacles & Coins
    // Step 1: Coins on lanes -1 and 1 to practice lane changing
    this.collectibles.spawnCoin(-1, -18, 0.8);
    this.collectibles.spawnCoin(1, -28, 0.8);

    // Step 2: Jump low barrier at z = -55
    this.obstacles.spawnObstacle('LOW_BARRIER', 0, -55);
    this.collectibles.spawnCoinArc(0, -53, 5, 1.8);

    // Step 3: Slide high barrier at z = -110
    this.obstacles.spawnObstacle('HIGH_BARRIER', 0, -110);
    this.collectibles.spawnCoinRow(0, -108, 4, 1.2, 0.4);

    // Step 4: Coin stream at z = -165
    this.collectibles.spawnCoinRow(0, -165, 7, 2.0, 0.8);

    // Step 5: Dodge solid wall at z = -225
    this.obstacles.spawnObstacle('FULL_BLOCK', 0, -225);
    this.collectibles.spawnCoinRow(-1, -223, 5, 1.8, 0.8);
    this.collectibles.spawnCoinRow(1, -223, 5, 1.8, 0.8);

    this.callbacks.onTutorialStep?.(
      1,
      'SWIPE LEFT & RIGHT',
      'Flick your finger left or right across the screen to switch lanes.',
      false
    );

    this.start();
  }

  public reset(initialSkin: Skin, isDailyChallenge: boolean = false) {
    this.isTutorial = false;
    this.tutorialStep = 0;
    this.isDailyChallenge = isDailyChallenge;
    if (isDailyChallenge) {
      this.prng = new SeededPRNG(getDailySeed());
    } else {
      this.prng = null;
    }

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
    this.camera.position.set(0, 2.95, 4.9);

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
    sounds.stopBGM();
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.dispose();
  }
}
