import * as THREE from 'three';

type Part = { x: number; y: number; z: number; w: number; h: number; d: number; color: number; turn?: number };

/** Four authored roadside silhouettes, one draw call for the active zone. */
export class ZoneScenery {
  private meshes: THREE.InstancedMesh[] = [];
  private parts: Part[][] = [];
  private slices = Array.from({ length: 7 }, (_, i) => -i * 36);
  private transform = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const zones: Part[][] = [[], [], [], []];
    for (const side of [-1, 1]) {
      // Shibuya: low storefronts, broad awnings and vertical illuminated signs.
      zones[0].push(
        { x: side * 8, y: 1.3, z: 0, w: 3, h: 2.6, d: 6, color: 0x263c58 },
        { x: side * 7.6, y: 2.7, z: 0, w: 3.8, h: 0.2, d: 7, color: 0x217f92 },
        { x: side * 6.3, y: 3.8, z: 1, w: 0.45, h: 3, d: 0.4, color: 0xc35785 },
      );
      // Sunset: palms with angular fronds; all stay outside the collision track.
      zones[1].push({ x: side * 7, y: 2, z: 0, w: 0.35, h: 4, d: 0.35, color: 0x845967 });
      for (let angle = 0; angle < 3; angle++) zones[1].push({ x: side * 7, y: 4.1, z: 0, w: 3.6, h: 0.18, d: 0.5, turn: angle * Math.PI / 3, color: 0x52a7a1 });
      // Matrix: repeated circuit frames, confined to the roadside.
      zones[2].push(
        { x: side * 6.2, y: 2.6, z: 0, w: 0.22, h: 5.2, d: 0.4, color: 0x269c70 },
        { x: side * 9, y: 2.6, z: 0, w: 0.22, h: 5.2, d: 0.4, color: 0x269c70 },
        { x: side * 7.6, y: 5.1, z: 0, w: 3, h: 0.22, d: 0.4, color: 0x72dbc0 },
      );
      // Gold: elevated plinths and sculptural monoliths instead of city storefronts.
      zones[3].push(
        { x: side * 7.2, y: 1.3, z: 0, w: 1.8, h: 0.3, d: 1.8, color: 0x966738 },
        { x: side * 7.2, y: 3.6, z: 0, w: 0.65, h: 4, d: 0.65, color: 0xe9c77b },
        { x: side * 7.2, y: 5.8, z: 0, w: 1.6, h: 0.22, d: 1.6, color: 0xf1ddb4 },
      );
    }
    this.parts = zones;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.15 });
    zones.forEach((parts, zone) => {
      const mesh = new THREE.InstancedMesh(box, material, parts.length * 7);
      mesh.frustumCulled = false;
      mesh.visible = zone === 0;
      this.meshes.push(mesh);
      scene.add(mesh);
      for (let slice = 0; slice < 7; slice++) this.writeSlice(zone, slice);
    });
  }

  private writeSlice(zone: number, slice: number) {
    const mesh = this.meshes[zone], parts = this.parts[zone], t = this.transform;
    parts.forEach((part, i) => {
      t.position.set(part.x, part.y, this.slices[slice] + part.z);
      t.rotation.y = part.turn || 0;
      t.scale.set(part.w, part.h, part.d);
      t.updateMatrix();
      mesh.setMatrixAt(slice * parts.length + i, t.matrix);
      mesh.setColorAt(slice * parts.length + i, this.color.setHex(part.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  setZone(zone: number) { this.meshes.forEach((mesh, i) => { mesh.visible = i === zone; }); }
  setQuality(quality: 'low' | 'medium' | 'high') {
    this.meshes.forEach((mesh, zone) => { mesh.count = this.parts[zone].length * (quality === 'low' ? 4 : 7); });
  }
  update(playerZ: number) {
    this.slices.forEach((z, slice) => {
      if (z <= playerZ + 20) return;
      while (this.slices[slice] > playerZ + 20) this.slices[slice] -= 252;
      this.meshes.forEach((_mesh, zone) => this.writeSlice(zone, slice));
    });
  }
  reset() {
    this.slices = this.slices.map((_z, i) => -i * 36);
    this.meshes.forEach((_mesh, zone) => this.slices.forEach((_z, slice) => this.writeSlice(zone, slice)));
  }
}
