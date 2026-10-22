import * as THREE from 'three';
import { Lane, LANE_POSITIONS } from '../types/game';
import { BossState } from '../types/progression';
import { sounds } from '../audio/SoundEffects';

export class BossEncounterManager {
  public group: THREE.Group;
  public state: BossState = {
    active: false,
    name: 'THE ALGORITHM OVERLORD',
    phase: 1,
    maxPhase: 3,
    timeLeft: 22,
    duration: 22,
    telegraph: null,
    targetLanes: [],
  };

  private bossCore: THREE.Mesh;
  private innerEye: THREE.Mesh;
  private ring1: THREE.Mesh;
  private ring2: THREE.Mesh;
  private ring3: THREE.Mesh;
  public warningGroup: THREE.Group;
  private attackZ: number | null = null;
  private attackNumber = 0;
  private previousSafeLane: Lane | null = null;

  private attackTimer: number = 0;
  private currentAttackActive: boolean = false;
  private warningBeams: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.warningGroup = new THREE.Group();
    scene.add(this.group, this.warningGroup);

    // 1. Boss Central Core (Geometric Glitch Octahedron)
    const coreGeo = new THREE.OctahedronGeometry(2.4, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x991b1b,
      emissiveIntensity: 0.6,
      wireframe: false,
    });
    this.bossCore = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.bossCore);

    // Glowing Iris Pupil
    const eyeGeo = new THREE.SphereGeometry(1.0, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.innerEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.innerEye.position.z = 1.1;
    this.bossCore.add(this.innerEye);

    // 2. Three Orbital Glowing Firewall Rings
    const ringGeo = new THREE.TorusGeometry(3.6, 0.08, 8, 32);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true });
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xec4899, wireframe: true });
    const ringMat3 = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true });

    this.ring1 = new THREE.Mesh(ringGeo, ringMat1);
    this.ring2 = new THREE.Mesh(ringGeo, ringMat2);
    this.ring3 = new THREE.Mesh(ringGeo, ringMat3);

    this.group.add(this.ring1, this.ring2, this.ring3);

    // 3. Ground Telegraph Warning Beams
    const warnGeo = new THREE.PlaneGeometry(2.2, 35);
    warnGeo.rotateX(-Math.PI / 2);
    const warnMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(warnGeo, warnMat);
      beam.visible = false;
      this.warningBeams.push(beam);
      this.warningGroup.add(beam);
    }

    this.group.visible = false;
  }

  public triggerBoss() {
    this.state = {
      active: true,
      name: 'THE ALGORITHM OVERLORD',
      phase: 1,
      maxPhase: 3,
      timeLeft: 22,
      duration: 22,
      telegraph: '⚠️ THE ALGORITHM HAS MANIFESTED! SURVIVE 22s!',
      targetLanes: [],
    };
    this.group.visible = true;
    this.attackTimer = 2.0;
    this.attackZ = null;
    this.attackNumber = 0;
    this.previousSafeLane = null;
    this.warningBeams.forEach(beam => { beam.visible = false; });
    sounds.playChaosWarning();
  }

  public update(
    dt: number,
    playerZ: number,
    globalTime: number,
    onBossDefeated: () => void,
    onSpawnTelegraphedObstacle: (type: 'LOW_BARRIER' | 'HIGH_BARRIER' | 'FULL_BLOCK', lane: Lane) => void,
    randomFn: () => number = Math.random,
    warningDistance = 60,
  ) {
    if (!this.state.active) return;

    // Hover 28 units ahead of the runner
    this.group.position.set(0, 4.6 + Math.sin(globalTime * 2) * 0.4, playerZ - 28);

    // Orbiting ring rotations
    this.ring1.rotation.x += dt * 1.8;
    this.ring1.rotation.y += dt * 1.2;

    this.ring2.rotation.y += dt * 2.2;
    this.ring2.rotation.z += dt * 1.5;

    this.ring3.rotation.z += dt * 1.6;
    this.ring3.rotation.x -= dt * 1.4;

    this.bossCore.rotation.y += dt * 1.2;

    // Phase management: Phase 1 (0-7s), Phase 2 (7-14s), Phase 3 (14-22s)
    const elapsed = this.state.duration - this.state.timeLeft;
    if (elapsed > 14) {
      this.state.phase = 3;
    } else if (elapsed > 7) {
      this.state.phase = 2;
    } else {
      this.state.phase = 1;
    }

    // Boss Attack Scheduler
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackZ = playerZ - warningDistance;
      this.executeBossAttack(onSpawnTelegraphedObstacle, randomFn);
      this.attackTimer = 4.2 - this.state.phase * 0.5; // faster as phases escalate
    }

    // Ground-space lane warnings track the actual approaching attack row.
    const distance = this.attackZ === null ? 0 : playerZ - this.attackZ;
    this.warningBeams.forEach((beam, index) => {
      beam.visible = distance > 0.6 && this.state.targetLanes.includes((index - 1) as Lane);
      beam.position.set(LANE_POSITIONS[(index - 1) as Lane], 0.035, playerZ - Math.max(0, distance) / 2);
      beam.scale.z = Math.max(0.01, distance / 35);
    });

    // Advance boss timer
    this.state.timeLeft -= dt;
    if (this.state.timeLeft <= 0) {
      this.defeatBoss(onBossDefeated);
    }
  }

  private executeBossAttack(
    onSpawnTelegraphedObstacle: (type: 'LOW_BARRIER' | 'HIGH_BARRIER' | 'FULL_BLOCK', lane: Lane) => void,
    randomFn: () => number = Math.random
  ) {
    const lanes: Lane[] = [-1, 0, 1];
    const choices = lanes.filter(lane => lane !== this.previousSafeLane);
    const safeLane = choices[Math.floor(randomFn() * choices.length)];
    this.previousSafeLane = safeLane;
    this.attackNumber++;
    const safeName = safeLane === -1 ? 'LEFT' : safeLane === 1 ? 'RIGHT' : 'CENTER';
    const attackedLanes = lanes.filter((l) => l !== safeLane);

    if (this.state.phase === 1) {
      // Phase 1: Targeted Laser Grid leaving 1 safe lane
      this.state.telegraph = `⚠️ LASER STRIKE INCOMING! EVADE TO ${safeLane === -1 ? 'LEFT' : safeLane === 1 ? 'RIGHT' : 'CENTER'} LANE!`;
      this.state.targetLanes = attackedLanes;

      for (const lane of attackedLanes) {
        onSpawnTelegraphedObstacle('FULL_BLOCK', lane);
      }
    } else if (this.state.phase === 2) {
      // Phase 2: Data Wave Sweep (Low barrier sweep across 2 lanes, jump required)
      const wave = this.attackNumber % 2 ? 'LOW_BARRIER' : 'HIGH_BARRIER';
      this.state.telegraph = `${wave === 'LOW_BARRIER' ? 'JUMP' : 'SLIDE'} WAVE · OPEN ${safeName}`;
      this.state.targetLanes = attackedLanes;

      for (const lane of attackedLanes) {
        onSpawnTelegraphedObstacle(wave, lane);
      }
    } else {
      // Phase 3: Triple Overclock assault
      this.state.telegraph = `🔥 SYSTEM OVERCLOCK! SAFE LANE: ${safeLane === -1 ? 'LEFT' : safeLane === 1 ? 'RIGHT' : 'CENTER'}!`;
      this.state.targetLanes = attackedLanes;

      for (const lane of attackedLanes) {
        onSpawnTelegraphedObstacle(lane === attackedLanes[0] ? 'FULL_BLOCK' : randomFn() > 0.5 ? 'LOW_BARRIER' : 'HIGH_BARRIER', lane);
      }
    }
  }

  private defeatBoss(onBossDefeated: () => void) {
    this.state.active = false;
    this.group.visible = false;
    this.attackZ = null;
    this.warningBeams.forEach(beam => { beam.visible = false; });
    this.state.telegraph = null;
    this.state.targetLanes = [];
    sounds.playPowerUp();
    onBossDefeated();
  }

  public reset() {
    this.state.active = false;
    this.group.visible = false;
    this.attackZ = null;
    this.warningBeams.forEach(beam => { beam.visible = false; });
    this.state.telegraph = null;
    this.state.targetLanes = [];
    this.state.timeLeft = 22;
  }
}
