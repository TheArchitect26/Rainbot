import * as THREE from 'three';
import type { Skin } from '../types/game';

/** Original streetwear mascot, attached to the same animation rig and hitbox. */
export class StreetAvatar {
  readonly eyes = new THREE.Group();
  private skin = new THREE.MeshStandardMaterial({
    color: '#e8ac82',
    roughness: 0.8,
  });
  private hair = new THREE.MeshStandardMaterial({
    color: '#332042',
    roughness: 0.9,
  });
  private shoes = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.6,
  });
  private choices: {
    node: THREE.Object3D;
    field: 'outfit' | 'hair' | 'bottom' | 'accessory';
    value: string;
  }[] = [];

  constructor(
    rig: {
      torso: THREE.Group;
      head: THREE.Group;
      arms: THREE.Group[];
      legs: THREE.Group[];
    },
    suit: THREE.Material,
    trim: THREE.Material,
    glow: THREE.Material,
  ) {
    const sphere = new THREE.SphereGeometry(1, 12, 8);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const white = new THREE.MeshBasicMaterial({ color: '#fffdf5' });
    const ink = new THREE.MeshBasicMaterial({ color: '#211a35' });
    const mesh = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const option = (
      field: 'outfit' | 'hair' | 'bottom' | 'accessory',
      value: string,
      parent: THREE.Object3D,
    ) => {
      const node = new THREE.Group();
      parent.add(node);
      this.choices.push({ node, field, value });
      return node;
    };
    mesh(rig.torso, sphere, suit, 0, -0.02, 0, 0.38, 0.4, 0.25);
    mesh(rig.torso, box, trim, 0, 0.29, 0.02, 0.24, 0.08, 0.3);
    mesh(rig.torso, sphere, glow, -0.15, 0.08, 0.245, 0.055, 0.055, 0.012);
    mesh(rig.head, sphere, this.skin, 0, 0.01, 0, 0.37, 0.39, 0.29);
    mesh(rig.head, sphere, this.skin, -0.36, -0.02, 0, 0.08, 0.12, 0.07);
    mesh(rig.head, sphere, this.skin, 0.36, -0.02, 0, 0.08, 0.12, 0.07);
    mesh(rig.head, sphere, this.skin, 0, -0.04, 0.3, 0.065, 0.065, 0.09);
    rig.head.add(this.eyes);
    for (const x of [-0.14, 0.14]) {
      mesh(this.eyes, sphere, white, x, 0.065, 0.25, 0.125, 0.14, 0.065);
      mesh(
        this.eyes,
        sphere,
        ink,
        x + 0.015,
        0.065,
        0.308,
        0.042,
        0.055,
        0.018,
      );
    }
    const smile = new THREE.TorusGeometry(0.13, 0.014, 4, 12, Math.PI * 0.75);
    const mouth = mesh(rig.head, smile, ink, -0.045, -0.13, 0.27, 1, 0.5, 1);
    mouth.rotation.z = Math.PI * 1.1;
    const quiff = option('hair', 'QUIFF', rig.head);
    for (let i = 0; i < 3; i++) {
      const curl = mesh(
        quiff,
        sphere,
        this.hair,
        -0.2 + i * 0.16,
        0.32 + i * 0.015,
        -0.01,
        0.18,
        0.17,
        0.28,
      );
      curl.rotation.z = -0.4;
    }
    const curls = option('hair', 'CURLS', rig.head);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 6) * Math.PI;
      mesh(
        curls,
        sphere,
        this.hair,
        Math.cos(angle) * 0.3,
        0.18 + Math.sin(angle) * 0.22,
        -0.025,
        0.15,
        0.15,
        0.26,
      );
    }
    const cap = option('hair', 'CAP', rig.head);
    mesh(cap, sphere, trim, 0, 0.29, -0.02, 0.39, 0.16, 0.31);
    mesh(cap, box, trim, 0, 0.27, 0.31, 0.46, 0.05, 0.24);
    const headphones = option('accessory', 'HEADPHONES', rig.head);
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.035, 6, 16, Math.PI),
      trim,
    );
    headband.position.set(0, 0.07, -0.02);
    headphones.add(headband);
    for (const x of [-0.4, 0.4]) {
      mesh(headphones, sphere, trim, x, 0.015, -0.01, 0.11, 0.16, 0.12);
      mesh(headphones, sphere, glow, x * 1.08, 0.015, 0.015, 0.055, 0.1, 0.07);
    }
    const star = option('accessory', 'STAR_BADGE', rig.torso);
    mesh(
      star,
      new THREE.OctahedronGeometry(0.12),
      glow,
      -0.15,
      0.08,
      0.27,
      1,
      1,
      0.3,
    );
    const laurel = option('accessory', 'LAUREL', rig.head);
    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.035, 6, 16),
      glow,
    );
    wreath.rotation.x = Math.PI / 2;
    wreath.position.y = 0.38;
    laurel.add(wreath);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const leaf = mesh(
        laurel,
        sphere,
        glow,
        Math.cos(angle) * 0.32,
        0.41,
        Math.sin(angle) * 0.25,
        0.055,
        0.12,
        0.04,
      );
      leaf.rotation.z = -0.4;
    }
    const hoodie = option('outfit', 'HOODIE', rig.torso);
    mesh(hoodie, sphere, suit, 0, 0.46, -0.19, 0.36, 0.25, 0.22);
    mesh(hoodie, box, trim, 0, -0.15, 0.25, 0.37, 0.13, 0.025);
    for (const x of [-0.075, 0.075])
      mesh(hoodie, box, this.shoes, x, 0.17, 0.26, 0.018, 0.22, 0.018);
    const jacket = option('outfit', 'JACKET', rig.torso);
    for (const x of [-0.12, 0.12]) {
      const lapel = mesh(jacket, box, trim, x, 0.13, 0.25, 0.09, 0.32, 0.035);
      lapel.rotation.z = x < 0 ? -0.25 : 0.25;
    }
    mesh(jacket, box, this.shoes, 0, -0.03, 0.258, 0.025, 0.6, 0.025);
    for (const arm of rig.arms) {
      mesh(arm, sphere, this.skin, 0, -0.27, 0, 0.09, 0.28, 0.09);
      mesh(arm, sphere, this.skin, 0, -0.49, 0.02, 0.115, 0.12, 0.1);
      mesh(arm, sphere, suit, 0, -0.065, 0, 0.13, 0.16, 0.14);
      for (const outfit of ['HOODIE', 'JACKET']) {
        const sleeve = option('outfit', outfit, arm);
        mesh(sleeve, sphere, suit, 0, -0.24, 0, 0.115, 0.25, 0.115);
      }
    }
    for (const leg of rig.legs) {
      mesh(leg, sphere, this.skin, 0, -0.29, 0, 0.09, 0.25, 0.09);
      mesh(leg, box, trim, 0, -0.1, 0, 0.23, 0.23, 0.26);
      const joggers = option('bottom', 'JOGGERS', leg);
      mesh(joggers, box, trim, 0, -0.32, 0, 0.2, 0.45, 0.23);
      mesh(leg, sphere, this.shoes, 0, -0.55, 0.07, 0.15, 0.115, 0.24);
      mesh(leg, box, glow, 0, -0.63, 0.075, 0.29, 0.035, 0.43);
    }
  }

  update(skin?: Skin, enabled = true) {
    this.skin.color.set(skin?.skinTone || '#e8ac82');
    this.hair.color.set(skin?.hairColor || '#332042');
    this.shoes.color.set(skin?.shoeColor || '#f8fafc');
    for (const choice of this.choices) {
      const value =
        skin?.[choice.field] ||
        (
          {
            outfit: 'TEE',
            hair: 'QUIFF',
            bottom: 'SHORTS',
            accessory: 'NONE',
          } as const
        )[choice.field];
      choice.node.visible = enabled && value === choice.value;
    }
  }
}
