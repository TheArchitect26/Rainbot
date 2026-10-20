import * as THREE from 'three';
import { Lane, LANE_POSITIONS, ObstacleInstance, ObstacleType } from '../types/game';

export class ObstacleManager {
  public group: THREE.Group;
  private obstacles: ObstacleInstance[] = [];
  private meshPool: Map<number, THREE.Group> = new Map();
  private freePool: Map<ObstacleType, THREE.Group[]> = new Map();
  private nextId = 1;
  private random: () => number = Math.random;
  public setRandom(random: () => number) { this.random = random; this.nextId = 1; }
  private debugHitboxesEnabled = false;

  // Shared procedural geometries & materials (100% reused across all spawns)
  private lowBarrierGeo: THREE.BoxGeometry;
  private lowBarrierMat: THREE.MeshStandardMaterial;
  private laserGeo: THREE.CylinderGeometry;
  private laserMat: THREE.MeshBasicMaterial;

  private highPillarGeo: THREE.CylinderGeometry;
  private highBarGeo: THREE.BoxGeometry;
  private highMat: THREE.MeshStandardMaterial;
  private forcefieldGeo: THREE.PlaneGeometry;
  private forcefieldMat: THREE.MeshBasicMaterial;
  private highLaserMat: THREE.MeshBasicMaterial;

  private fullBlockGeo: THREE.BoxGeometry;
  private fullBlockMat: THREE.MeshStandardMaterial;
  private fullBlockHazardMat: THREE.MeshBasicMaterial;
  private hazardGeo: THREE.BoxGeometry;
  private stripeGeo: THREE.PlaneGeometry;
  private stripeMat: THREE.MeshBasicMaterial;

  private droneBodyGeo: THREE.OctahedronGeometry;
  private droneRingGeo: THREE.TorusGeometry;
  private droneMat: THREE.MeshStandardMaterial;
  private droneEyeMat: THREE.MeshBasicMaterial;
  private eyeGeo: THREE.SphereGeometry;
  private spotlightGeo: THREE.ConeGeometry;
  private spotlightMat: THREE.MeshBasicMaterial;

  // Debug wireframe shared geometries & material
  private debugWireframeMat: THREE.LineBasicMaterial;
  private lowDebugGeo: THREE.EdgesGeometry;
  private highDebugGeo: THREE.EdgesGeometry;
  private fullDebugGeo: THREE.EdgesGeometry;
  private droneDebugGeo: THREE.EdgesGeometry;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.freePool.set('LOW_BARRIER', []);
    this.freePool.set('HIGH_BARRIER', []);
    this.freePool.set('FULL_BLOCK', []);
    this.freePool.set('MOVING_DRONE', []);

    // 1. Low Barrier assets (Jump over)
    this.lowBarrierGeo = new THREE.BoxGeometry(1.9, 0.65, 0.4);
    this.lowBarrierMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.85,
      roughness: 0.2,
    });
    this.laserGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 8);
    this.laserGeo.rotateZ(Math.PI / 2);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });

    // 2. High Barrier assets (Requires SLIDE underneath)
    this.highPillarGeo = new THREE.CylinderGeometry(0.12, 0.14, 3.2, 8);
    this.highBarGeo = new THREE.BoxGeometry(2.1, 1.2, 0.35);
    this.highMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.25,
    });

    this.forcefieldGeo = new THREE.PlaneGeometry(1.9, 0.9);
    this.forcefieldMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    this.highLaserMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    // 3. Full Block assets (Requires LANE CHANGE)
    this.fullBlockGeo = new THREE.BoxGeometry(2.0, 3.2, 0.6);
    this.fullBlockMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.9,
      roughness: 0.15,
    });
    this.fullBlockHazardMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    this.hazardGeo = new THREE.BoxGeometry(1.6, 0.5, 0.65);
    this.stripeGeo = new THREE.PlaneGeometry(1.5, 0.35);
    this.stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });

    // 4. Moving Drone assets
    this.droneBodyGeo = new THREE.OctahedronGeometry(0.7, 0);
    this.droneRingGeo = new THREE.TorusGeometry(1.0, 0.06, 8, 24);
    this.droneMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.droneEyeMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    this.eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.spotlightGeo = new THREE.ConeGeometry(0.9, 2.2, 8);
    this.spotlightGeo.rotateX(Math.PI);
    this.spotlightMat = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    // Debug wireframe edges
    this.debugWireframeMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    this.lowDebugGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.9, 0.65, 0.5));
    this.highDebugGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.1, 1.4, 0.5));
    this.fullDebugGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.0, 3.2, 0.6));
    this.droneDebugGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.9, 1.5, .5));
    for (const type of this.freePool.keys()) {
      for (let i = 0; i < 8; i++) {
        const mesh = this.createObstacleMesh(type);
        mesh.visible = false;
        this.group.add(mesh);
        this.freePool.get(type)!.push(mesh);
      }
    }
  }

  public setDebugHitboxes(enabled: boolean) {
    this.debugHitboxesEnabled = enabled;
    for (const [, group] of this.meshPool) {
      const debugLine = group.getObjectByName('debug_wireframe');
      if (debugLine) {
        debugLine.visible = enabled;
      }
    }
  }

  private createObstacleMesh(type: ObstacleType): THREE.Group {
    const group = new THREE.Group();

    if (type === 'LOW_BARRIER') {
      const barrier = new THREE.Mesh(this.lowBarrierGeo, this.lowBarrierMat);
      barrier.position.y = 0.325;
      barrier.castShadow = true;

      const laser = new THREE.Mesh(this.laserGeo, this.laserMat);
      laser.position.y = 0.65;

      const debug = new THREE.LineSegments(this.lowDebugGeo, this.debugWireframeMat);
      debug.name = 'debug_wireframe';
      debug.position.y = 0.325;
      debug.visible = this.debugHitboxesEnabled;

      group.add(barrier, laser, debug);
    } else if (type === 'HIGH_BARRIER') {
      const leftPillar = new THREE.Mesh(this.highPillarGeo, this.highMat);
      leftPillar.position.set(-1.0, 1.6, 0);
      const rightPillar = new THREE.Mesh(this.highPillarGeo, this.highMat);
      rightPillar.position.set(1.0, 1.6, 0);

      const bar = new THREE.Mesh(this.highBarGeo, this.highMat);
      bar.position.set(0, 2.4, 0);
      bar.castShadow = true;

      const curtain = new THREE.Mesh(this.forcefieldGeo, this.forcefieldMat);
      curtain.position.set(0, 1.75, 0);

      const edgeLaser = new THREE.Mesh(this.laserGeo, this.highLaserMat);
      edgeLaser.position.set(0, 1.3, 0);

      const debug = new THREE.LineSegments(this.highDebugGeo, this.debugWireframeMat);
      debug.name = 'debug_wireframe';
      debug.position.set(0, 2.3, 0);
      debug.visible = this.debugHitboxesEnabled;

      group.add(leftPillar, rightPillar, bar, curtain, edgeLaser, debug);
    } else if (type === 'FULL_BLOCK') {
      const block = new THREE.Mesh(this.fullBlockGeo, this.fullBlockMat);
      block.position.y = 1.6;
      block.castShadow = true;

      const hazard = new THREE.Mesh(this.hazardGeo, this.fullBlockHazardMat);
      hazard.position.set(0, 2.1, 0);

      const stripe = new THREE.Mesh(this.stripeGeo, this.stripeMat);
      stripe.position.set(0, 1.2, 0.32);

      const debug = new THREE.LineSegments(this.fullDebugGeo, this.debugWireframeMat);
      debug.name = 'debug_wireframe';
      debug.position.y = 1.6;
      debug.visible = this.debugHitboxesEnabled;

      group.add(block, hazard, stripe, debug);
    } else if (type === 'MOVING_DRONE') {
      const body = new THREE.Mesh(this.droneBodyGeo, this.droneMat);
      body.castShadow = true;

      const ring = new THREE.Mesh(this.droneRingGeo, this.droneEyeMat);
      ring.rotation.x = Math.PI / 2;

      const eye = new THREE.Mesh(this.eyeGeo, this.droneEyeMat);
      eye.position.set(0, 0, 0.4);

      const cone = new THREE.Mesh(this.spotlightGeo, this.spotlightMat);
      cone.position.set(0, -1.0, 0);

      const debug = new THREE.LineSegments(this.droneDebugGeo, this.debugWireframeMat);
      debug.name = 'debug_wireframe';
      debug.visible = this.debugHitboxesEnabled;

      group.add(body, ring, eye, cone, debug);
      group.position.y = 1.6;
    }

    return group;
  }

  public spawnObstacle(type: ObstacleType, lane: Lane, z: number, moving = false): ObstacleInstance {
    const id = this.nextId++;
    const pool = this.freePool.get(type);
    let mesh: THREE.Group;

    if (pool && pool.length > 0) {
      mesh = pool.pop()!;
      mesh.visible = true;
    } else {
      mesh = this.createObstacleMesh(type);
      this.group.add(mesh);
    }

    const debugLine = mesh.getObjectByName('debug_wireframe');
    if (debugLine) {
      debugLine.visible = this.debugHitboxesEnabled;
    }

    const x = LANE_POSITIONS[lane];

    if (type === 'MOVING_DRONE' || moving) {
      mesh.position.set(x, 1.6, z);
    } else {
      mesh.position.set(x, 0, z);
    }
    mesh.rotation.set(0, 0, 0);

    this.meshPool.set(id, mesh);

    const instance: ObstacleInstance = {
      id,
      type,
      lane,
      z,
      meshIndex: id,
      width: 1.8,
      height: type === 'LOW_BARRIER' ? 0.72 : type === 'HIGH_BARRIER' ? 2.8 : 3.2,
      yOffset: type === 'HIGH_BARRIER' ? 1.3 : 0,
      initialLane: lane,
      moveDirection: this.random() > 0.5 ? 1 : -1,
      moveSpeed: 2.0 + this.random() * 1.2,
      passed: false,
    };

    this.obstacles.push(instance);
    return instance;
  }

  public update(dt: number, playerZ: number, chaosMovingBarriers: boolean, time: number) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const mesh = this.meshPool.get(obs.id);

      if (!mesh) continue;

      if (obs.type === 'MOVING_DRONE' || chaosMovingBarriers) {
        mesh.position.x += (obs.moveDirection || 1) * (obs.moveSpeed || 2.4) * dt;
        if (mesh.position.x > 2.4) {
          mesh.position.x = 2.4;
          obs.moveDirection = -1;
        } else if (mesh.position.x < -2.4) {
          mesh.position.x = -2.4;
          obs.moveDirection = 1;
        }

        if (obs.type === 'MOVING_DRONE') {
          mesh.position.y = 1.6 + Math.sin(time * 6 + obs.id) * 0.25;
          mesh.rotation.y += dt * 3;
        }
      }

      // Cleanup obstacles passed behind player -> Return to free pool
      if (obs.z > playerZ + 15) {
        this.recycleObstacle(obs, mesh, i);
      }
    }
  }

  private recycleObstacle(obs: ObstacleInstance, mesh: THREE.Group, index: number) {
    mesh.visible = false;
    this.meshPool.delete(obs.id);
    this.freePool.get(obs.type)?.push(mesh);
    this.obstacles.splice(index, 1);
  }

  public getActiveObstacles(): ObstacleInstance[] {
    return this.obstacles;
  }

  public getMesh(id: number): THREE.Group | undefined {
    return this.meshPool.get(id);
  }

  public removeObstacle(id: number) {
    const idx = this.obstacles.findIndex((o) => o.id === id);
    if (idx !== -1) {
      const obs = this.obstacles[idx];
      const mesh = this.meshPool.get(id);
      if (mesh) {
        this.recycleObstacle(obs, mesh, idx);
      } else {
        this.obstacles.splice(idx, 1);
      }
    }
  }

  public clear() {
    for (const [id, mesh] of this.meshPool) {
      const obs = this.obstacles.find((o) => o.id === id);
      if (obs) {
        mesh.visible = false;
        this.freePool.get(obs.type)?.push(mesh);
      }
    }
    this.meshPool.clear();
    this.obstacles = [];
  }
}
