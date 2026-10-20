import * as THREE from 'three';
import { CoinInstance, Lane, LANE_POSITIONS, PowerUpInstance, PowerUpType } from '../types/game';

export class CollectibleManager {
  public group: THREE.Group;
  private coins: CoinInstance[] = [];
  private powerUps: PowerUpInstance[] = [];
  private coinMeshPool: Map<number, THREE.Mesh> = new Map();
  private powerUpMeshPool: Map<number, THREE.Group> = new Map();

  // Recycled meshes with shared GPU resources
  private freeCoins: THREE.Mesh[] = [];
  private freePowerUps: Map<PowerUpType, THREE.Group[]> = new Map();

  private nextCoinId = 1;
  private nextPowerUpId = 1;

  // Shared Coin geometry & material
  private coinGeo: THREE.CylinderGeometry;
  private coinMat: THREE.MeshStandardMaterial;

  // Shared PowerUp geometries & materials
  private gemGeo: THREE.OctahedronGeometry;
  private haloGeo: THREE.TorusGeometry;
  private powerUpMaterials: Map<PowerUpType, { gemMat: THREE.MeshStandardMaterial; haloMat: THREE.MeshBasicMaterial }> = new Map();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.freePowerUps.set('MAGNET', []);
    this.freePowerUps.set('SHIELD', []);
    this.freePowerUps.set('SPEED_BOOST', []);
    this.freePowerUps.set('DOUBLE_COINS', []);

    // Coin geometry: stylized thick coin
    this.coinGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 16);
    this.coinGeo.rotateX(Math.PI / 2);

    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x713f12,
      emissiveIntensity: 0.3,
    });

    // Shared power-up assets
    this.gemGeo = new THREE.OctahedronGeometry(0.55);
    this.haloGeo = new THREE.TorusGeometry(0.65, 0.04, 8, 24);

    const colors: Record<PowerUpType, number> = {
      SHIELD: 0x06b6d4,
      MAGNET: 0xec4899,
      SPEED_BOOST: 0xfacc15,
      DOUBLE_COINS: 0x8b5cf6,
    };

    (Object.keys(colors) as PowerUpType[]).forEach((type) => {
      const col = colors[type];
      const gemMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.15,
        metalness: 0.9,
        emissive: col,
        emissiveIntensity: 0.5,
      });
      const haloMat = new THREE.MeshBasicMaterial({ color: col });
      this.powerUpMaterials.set(type, { gemMat, haloMat });
      for (let i = 0; i < 2; i++) {
        const group = this.createPowerUpMesh(type);
        group.visible = false;
        this.group.add(group);
        this.freePowerUps.get(type)!.push(group);
      }
    });
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.freeCoins.push(mesh);
    }
  }

  public spawnCoin(lane: Lane, z: number, y: number = 0.8): CoinInstance {
    const id = this.nextCoinId++;
    let mesh: THREE.Mesh;

    if (this.freeCoins.length > 0) {
      mesh = this.freeCoins.pop()!;
      mesh.visible = true;
    } else {
      mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
      mesh.castShadow = true;
      this.group.add(mesh);
    }

    mesh.position.set(LANE_POSITIONS[lane], y, z);
    mesh.rotation.set(0, 0, 0);

    this.coinMeshPool.set(id, mesh);

    const instance: CoinInstance = {
      id,
      lane,
      z,
      y,
      collected: false,
      meshIndex: id,
    };
    this.coins.push(instance);
    return instance;
  }

  public spawnCoinRow(lane: Lane, startZ: number, count = 5, spacing = 2.2, y = 0.8) {
    for (let i = 0; i < count; i++) {
      this.spawnCoin(lane, startZ - i * spacing, y);
    }
  }

  public spawnCoinArc(lane: Lane, startZ: number, count = 5, spacing = 2.0) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const y = 0.8 + Math.sin(t * Math.PI) * 1.6;
      this.spawnCoin(lane, startZ - i * spacing, y);
    }
  }

  public spawnPowerUp(type: PowerUpType, lane: Lane, z: number): PowerUpInstance {
    const id = this.nextPowerUpId++;
    const pool = this.freePowerUps.get(type);
    let group: THREE.Group;

    if (pool && pool.length > 0) {
      group = pool.pop()!;
      group.visible = true;
    } else {
      group = this.createPowerUpMesh(type);
      this.group.add(group);
    }

    group.position.set(LANE_POSITIONS[lane], 1.2, z);
    group.rotation.set(0, 0, 0);

    this.powerUpMeshPool.set(id, group);

    const instance: PowerUpInstance = {
      id,
      type,
      lane,
      z,
      collected: false,
      meshIndex: id,
    };
    this.powerUps.push(instance);
    return instance;
  }

  private createPowerUpMesh(type: PowerUpType): THREE.Group {
    const group = new THREE.Group();
    const mats = this.powerUpMaterials.get(type)!;

    const gem = new THREE.Mesh(this.gemGeo, mats.gemMat);
    gem.castShadow = true;
    group.add(gem);

    const halo = new THREE.Mesh(this.haloGeo, mats.haloMat);
    group.add(halo);

    return group;
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    hasMagnet: boolean,
    time: number
  ) {
    // 1. Update Coins (spin and magnet attraction)
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      const mesh = this.coinMeshPool.get(coin.id);
      if (!mesh) continue;

      mesh.rotation.y += dt * 3.5;

      // Magnet effect: fly towards player if within 14 units
      if (hasMagnet && !coin.collected) {
        const distZ = Math.abs(mesh.position.z - playerZ);
        if (distZ < 14) {
          mesh.position.x = THREE.MathUtils.damp(mesh.position.x, playerX, 10, dt);
          mesh.position.y = THREE.MathUtils.damp(mesh.position.y, playerY + 0.6, 10, dt);
          mesh.position.z = THREE.MathUtils.damp(mesh.position.z, playerZ, 12, dt);
        }
      }

      // Cleanup if behind player -> Recycle into free pool
      if (mesh.position.z > playerZ + 12 || coin.collected) {
        mesh.visible = false;
        this.coinMeshPool.delete(coin.id);
        this.freeCoins.push(mesh);
        this.coins.splice(i, 1);
      }
    }

    // 2. Update Power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      const group = this.powerUpMeshPool.get(pu.id);
      if (!group) continue;

      group.rotation.y += dt * 2.8;
      group.position.y = 1.2 + Math.sin(time * 5 + pu.id) * 0.2;

      // Cleanup -> Recycle into free pool
      if (group.position.z > playerZ + 12 || pu.collected) {
        group.visible = false;
        this.powerUpMeshPool.delete(pu.id);
        this.freePowerUps.get(pu.type)?.push(group);
        this.powerUps.splice(i, 1);
      }
    }
  }

  public getActiveCoins(): CoinInstance[] {
    return this.coins;
  }

  public getCoinMesh(id: number): THREE.Mesh | undefined {
    return this.coinMeshPool.get(id);
  }

  public getActivePowerUps(): PowerUpInstance[] {
    return this.powerUps;
  }

  public getPowerUpMesh(id: number): THREE.Group | undefined {
    return this.powerUpMeshPool.get(id);
  }

  public removeCoin(id: number) {
    const idx = this.coins.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const mesh = this.coinMeshPool.get(id);
      if (mesh) {
        mesh.visible = false;
        this.freeCoins.push(mesh);
        this.coinMeshPool.delete(id);
      }
      this.coins.splice(idx, 1);
    }
  }

  public removePowerUp(id: number) {
    const idx = this.powerUps.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const pu = this.powerUps[idx];
      const group = this.powerUpMeshPool.get(id);
      if (group) {
        group.visible = false;
        this.freePowerUps.get(pu.type)?.push(group);
        this.powerUpMeshPool.delete(id);
      }
      this.powerUps.splice(idx, 1);
    }
  }

  public clear() {
    this.nextCoinId = 1;
    this.nextPowerUpId = 1;
    for (const [, mesh] of this.coinMeshPool) {
      mesh.visible = false;
      this.freeCoins.push(mesh);
    }
    this.coinMeshPool.clear();
    this.coins = [];

    for (const [id, group] of this.powerUpMeshPool) {
      const pu = this.powerUps.find((p) => p.id === id);
      if (pu) {
        group.visible = false;
        this.freePowerUps.get(pu.type)?.push(group);
      }
    }
    this.powerUpMeshPool.clear();
    this.powerUps = [];
  }
}
