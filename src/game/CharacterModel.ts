import { StreetAvatar } from './StreetAvatar';
import { finishMaterial } from '../utils/skinStudio';
import type { Skin } from '../types/game';
import * as THREE from 'three';

export interface SkinColors {
  appearance?: Skin;
  finish?: Skin['finish'];
  primary: number;
  secondary: number;
  glow: number;
  accent: number;
}

export type MascotExpression = 'RUN' | 'JUMP' | 'SLIDE' | 'CRASH' | 'IDLE';

export class CharacterModel {
  public group: THREE.Group;
  public shadowDisk: THREE.Mesh;
  public shieldMesh: THREE.Mesh;
  public magnetRing: THREE.Mesh;
  public boostAura: THREE.Mesh;

  // Mascot anatomy
  private headGroup: THREE.Group;
  private torsoGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftLegGroup: THREE.Group;
  private rightLegGroup: THREE.Group;
  private jetpackGroup: THREE.Group;
  private leftEarGroup: THREE.Group;
  private rightEarGroup: THREE.Group;
  private antennaGroup: THREE.Group;
  private antennaBobble: THREE.Mesh;

  // Jetpack & Thrusters
  private leftThrusterGlow: THREE.Mesh;
  private rightThrusterGlow: THREE.Mesh;

  // Comical Crash Dizzy Stars
  private dizzyStarsGroup: THREE.Group;

  // Expressive Dynamic Canvas Visor
  private visorCanvas: HTMLCanvasElement;
  private visorCtx: CanvasRenderingContext2D;
  private visorTexture: THREE.CanvasTexture;
  private visorMesh: THREE.Mesh;
  private currentExpression: MascotExpression = 'IDLE';
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  private runCycleTime: number = 0;
  private squashFactor: number = 1.0;
  private materialsToUpdate: THREE.MeshStandardMaterial[] = [];
  private street: StreetAvatar;
  private streetNodes: THREE.Object3D[] = [];
  private cyberNodes: THREE.Object3D[] = [];
  private isStreet = false;
  private glowColorHex: string = '#22d3ee';

  constructor(colors: SkinColors) {
    this.group = new THREE.Group();

    // 1. Visor Canvas Texture for Expressive Facial Animations
    this.visorCanvas = document.createElement('canvas');
    this.visorCanvas.width = 256;
    this.visorCanvas.height = 128;
    this.visorCtx = this.visorCanvas.getContext('2d')!;
    this.glowColorHex = '#' + colors.glow.toString(16).padStart(6, '0');
    this.renderVisorFace('IDLE', false, 0);

    this.visorTexture = new THREE.CanvasTexture(this.visorCanvas);
    this.visorTexture.colorSpace = THREE.SRGBColorSpace;

    // Materials with PBR discipline (varied roughness/metalness)
    const primaryMat = new THREE.MeshStandardMaterial({
      color: colors.primary,
      ...finishMaterial(colors.finish),
    });
    this.materialsToUpdate.push(primaryMat);

    const secondaryMat = new THREE.MeshStandardMaterial({
      color: colors.secondary,
      roughness: 0.5,
      metalness: 0.35,
    });
    this.materialsToUpdate.push(secondaryMat);

    const whiteChassisMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.25,
      metalness: 0.6,
    });

    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: 0x181824,
      roughness: 0.4,
      metalness: 0.8,
    });

    const glowMat = new THREE.MeshBasicMaterial({
      color: colors.glow,
    });

    // 2. Mascot Torso (Playful, rounded proportions)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 1.05;

    const chestGeo = new THREE.BoxGeometry(0.74, 0.72, 0.52);
    const chest = new THREE.Mesh(chestGeo, primaryMat);
    chest.castShadow = true;
    this.torsoGroup.add(chest);

    // Mascot Heart / Power Core (Glowing Heart/Diamond badge)
    const coreGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, glowMat);
    core.position.set(0, 0.06, 0.27);
    this.torsoGroup.add(core);

    // Collar detail
    const collarGeo = new THREE.BoxGeometry(0.72, 0.12, 0.5);
    const collar = new THREE.Mesh(collarGeo, secondaryMat);
    collar.position.y = 0.38;
    this.torsoGroup.add(collar);

    // 3. Playful Mascot Head (Chubby, lovable cyber mascot)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.72, 0.05);

    // Rounded mascot helmet
    const headGeo = new THREE.BoxGeometry(0.82, 0.7, 0.66);
    const head = new THREE.Mesh(headGeo, primaryMat);
    head.castShadow = true;
    this.headGroup.add(head);

    // Visor Glass Frame with Expressive Digital Eyes
    const visorGeo = new THREE.BoxGeometry(0.68, 0.38, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({
      map: this.visorTexture,
      transparent: true,
    });
    this.visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.visorMesh.position.set(0, 0.03, 0.34);
    this.headGroup.add(this.visorMesh);

    // 4. Mascot Ears (Bouncy cyber cat/bunny ears)
    const earGeo = new THREE.ConeGeometry(0.14, 0.42, 4);
    earGeo.rotateY(Math.PI / 4);

    this.leftEarGroup = new THREE.Group();
    this.leftEarGroup.position.set(-0.35, 0.38, 0);
    this.leftEarGroup.rotation.z = -0.3;
    const leftEarMesh = new THREE.Mesh(earGeo, secondaryMat);
    leftEarMesh.castShadow = true;
    this.leftEarGroup.add(leftEarMesh);

    // Inner ear glow strip
    const earGlowGeo = new THREE.BoxGeometry(0.06, 0.22, 0.04);
    const leftEarGlow = new THREE.Mesh(earGlowGeo, glowMat);
    leftEarGlow.position.set(0, 0.04, 0.08);
    this.leftEarGroup.add(leftEarGlow);

    this.rightEarGroup = new THREE.Group();
    this.rightEarGroup.position.set(0.35, 0.38, 0);
    this.rightEarGroup.rotation.z = 0.3;
    const rightEarMesh = new THREE.Mesh(earGeo, secondaryMat);
    rightEarMesh.castShadow = true;
    this.rightEarGroup.add(rightEarMesh);

    const rightEarGlow = new THREE.Mesh(earGlowGeo, glowMat);
    rightEarGlow.position.set(0, 0.04, 0.08);
    this.rightEarGroup.add(rightEarGlow);

    this.headGroup.add(this.leftEarGroup, this.rightEarGroup);

    // 5. Wobbly Antenna with glowing bobble
    this.antennaGroup = new THREE.Group();
    this.antennaGroup.position.set(0, 0.4, -0.05);
    const stalkGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6);
    stalkGeo.translate(0, 0.16, 0);
    const stalk = new THREE.Mesh(stalkGeo, darkChassisMat);
    const bobbleGeo = new THREE.SphereGeometry(0.09, 10, 10);
    this.antennaBobble = new THREE.Mesh(bobbleGeo, glowMat);
    this.antennaBobble.position.y = 0.34;
    this.antennaGroup.add(stalk, this.antennaBobble);
    this.headGroup.add(this.antennaGroup);

    // 6. Comical Dizzy Stars (Spinning above mascot head on crash)
    this.dizzyStarsGroup = new THREE.Group();
    this.dizzyStarsGroup.position.set(0, 0.85, 0);
    const starGeo = new THREE.OctahedronGeometry(0.12);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let s = 0; s < 3; s++) {
      const star = new THREE.Mesh(starGeo, starMat);
      const angle = (s / 3) * Math.PI * 2;
      star.position.set(Math.cos(angle) * 0.45, 0, Math.sin(angle) * 0.45);
      this.dizzyStarsGroup.add(star);
    }
    this.dizzyStarsGroup.visible = false;
    this.headGroup.add(this.dizzyStarsGroup);

    this.torsoGroup.add(this.headGroup);

    // 7. Mascot Rocket Backpack
    this.jetpackGroup = new THREE.Group();
    this.jetpackGroup.position.set(0, 0.05, -0.32);
    const packBodyGeo = new THREE.BoxGeometry(0.52, 0.58, 0.24);
    const packBody = new THREE.Mesh(packBodyGeo, whiteChassisMat);
    this.jetpackGroup.add(packBody);

    const thrusterGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.34, 12);
    const leftThruster = new THREE.Mesh(thrusterGeo, secondaryMat);
    leftThruster.position.set(-0.18, -0.22, 0);
    const rightThruster = new THREE.Mesh(thrusterGeo, secondaryMat);
    rightThruster.position.set(0.18, -0.22, 0);
    this.jetpackGroup.add(leftThruster, rightThruster);

    const nozzleGlowGeo = new THREE.SphereGeometry(0.1, 8, 8);
    this.leftThrusterGlow = new THREE.Mesh(nozzleGlowGeo, glowMat);
    this.leftThrusterGlow.position.set(-0.18, -0.36, 0);
    this.rightThrusterGlow = new THREE.Mesh(nozzleGlowGeo, glowMat);
    this.rightThrusterGlow.position.set(0.18, -0.36, 0);
    this.jetpackGroup.add(this.leftThrusterGlow, this.rightThrusterGlow);

    this.torsoGroup.add(this.jetpackGroup);

    // 8. Articulated Arms (Expressive cartoon swinging)
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8);
    armGeo.translate(0, -0.24, 0);
    const gloveGeo = new THREE.SphereGeometry(0.13, 10, 10);
    gloveGeo.translate(0, -0.48, 0.03);

    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.48, 0.28, 0);
    const leftLimb = new THREE.Mesh(armGeo, primaryMat);
    const leftGlove = new THREE.Mesh(gloveGeo, whiteChassisMat);
    leftLimb.castShadow = true;
    this.leftArmGroup.add(leftLimb, leftGlove);

    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.48, 0.28, 0);
    const rightLimb = new THREE.Mesh(armGeo, primaryMat);
    const rightGlove = new THREE.Mesh(gloveGeo, whiteChassisMat);
    rightLimb.castShadow = true;
    this.rightArmGroup.add(rightLimb, rightGlove);

    this.torsoGroup.add(this.leftArmGroup, this.rightArmGroup);
    this.group.add(this.torsoGroup);

    // 9. Mascot Legs & Chunky High-Top Boots
    const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.52, 8);
    legGeo.translate(0, -0.26, 0);
    const bootGeo = new THREE.BoxGeometry(0.24, 0.18, 0.38);
    bootGeo.translate(0, -0.54, 0.1);
    const soleGeo = new THREE.BoxGeometry(0.26, 0.06, 0.4);
    soleGeo.translate(0, -0.63, 0.1);

    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.24, 0.65, 0);
    const leftLeg = new THREE.Mesh(legGeo, secondaryMat);
    const leftBoot = new THREE.Mesh(bootGeo, primaryMat);
    const leftSole = new THREE.Mesh(soleGeo, glowMat);
    leftLeg.castShadow = true;
    this.leftLegGroup.add(leftLeg, leftBoot, leftSole);

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.24, 0.65, 0);
    const rightLeg = new THREE.Mesh(legGeo, secondaryMat);
    const rightBoot = new THREE.Mesh(bootGeo, primaryMat);
    const rightSole = new THREE.Mesh(soleGeo, glowMat);
    rightLeg.castShadow = true;
    this.rightLegGroup.add(rightLeg, rightBoot, rightSole);

    this.group.add(this.leftLegGroup, this.rightLegGroup);

    this.cyberNodes = [
      ...this.torsoGroup.children.filter(n => ![this.headGroup, this.leftArmGroup, this.rightArmGroup].includes(n as THREE.Group)),
      ...this.headGroup.children.filter(n => n !== this.dizzyStarsGroup),
      ...this.leftArmGroup.children, ...this.rightArmGroup.children,
      ...this.leftLegGroup.children, ...this.rightLegGroup.children,
    ];
    const originalNodes = new Set<THREE.Object3D>();
    this.group.traverse(n => originalNodes.add(n));
    this.street = new StreetAvatar({ torso: this.torsoGroup, head: this.headGroup,
      arms: [this.leftArmGroup, this.rightArmGroup], legs: [this.leftLegGroup, this.rightLegGroup] }, primaryMat, secondaryMat, glowMat);
    this.group.traverse(n => { if (!originalNodes.has(n) && originalNodes.has(n.parent!)) this.streetNodes.push(n); });
    this.setAppearance(colors.appearance);

    // 10. Ground Contact Shadow disk
    const shadowGeo = new THREE.CircleGeometry(0.72, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.shadowDisk = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisk.position.y = 0.02;
    this.group.add(this.shadowDisk);

    // 11. Shield Powerup Bubble
    const shieldGeo = new THREE.SphereGeometry(1.25, 24, 24);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.0;
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // 12. Magnet Ring
    const magnetGeo = new THREE.TorusGeometry(0.9, 0.07, 12, 32);
    magnetGeo.rotateX(Math.PI / 2);
    const magnetMat = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.8,
    });
    this.magnetRing = new THREE.Mesh(magnetGeo, magnetMat);
    this.magnetRing.position.y = 1.0;
    this.magnetRing.visible = false;
    this.group.add(this.magnetRing);

    // 13. Boost Aura
    const auraGeo = new THREE.CylinderGeometry(0.85, 1.05, 1.9, 16, 1, true);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.boostAura = new THREE.Mesh(auraGeo, auraMat);
    this.boostAura.position.y = 1.0;
    this.boostAura.visible = false;
    this.group.add(this.boostAura);
  }

  // Draw expressive anime eyes on the visor canvas
  private renderVisorFace(expression: MascotExpression, isBlinking: boolean, lookDirection: number) {
    const ctx = this.visorCtx;
    const w = 256;
    const h = 128;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    // Glowing border outline on visor
    ctx.strokeStyle = this.glowColorHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    const eyeColor = this.glowColorHex;
    ctx.fillStyle = eyeColor;
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    const pupilOffset = lookDirection * 12;

    if (isBlinking) {
      // Blinking closed lines: (- -)
      ctx.beginPath();
      ctx.moveTo(60 + pupilOffset, 64);
      ctx.lineTo(100 + pupilOffset, 64);
      ctx.moveTo(156 + pupilOffset, 64);
      ctx.lineTo(196 + pupilOffset, 64);
      ctx.stroke();
    } else if (expression === 'CRASH') {
      // Comical X_X Eyes
      const drawX = (cx: number) => {
        ctx.beginPath();
        ctx.moveTo(cx - 18, 44);
        ctx.lineTo(cx + 18, 80);
        ctx.moveTo(cx + 18, 44);
        ctx.lineTo(cx - 18, 80);
        ctx.stroke();
      };
      drawX(80);
      drawX(176);
    } else if (expression === 'JUMP') {
      // Determined / Happy squint: ( > < )
      ctx.beginPath();
      // Left eye >
      ctx.moveTo(64, 46);
      ctx.lineTo(96, 64);
      ctx.lineTo(64, 82);
      // Right eye <
      ctx.moveTo(192, 46);
      ctx.lineTo(160, 64);
      ctx.lineTo(192, 82);
      ctx.stroke();
    } else if (expression === 'SLIDE') {
      // Grinning wink: ( ^ ω ^ )
      // Left eye ^
      ctx.beginPath();
      ctx.moveTo(60, 76);
      ctx.lineTo(80, 50);
      ctx.lineTo(100, 76);
      // Right eye ^
      ctx.moveTo(156, 76);
      ctx.lineTo(176, 50);
      ctx.lineTo(196, 76);
      ctx.stroke();
    } else {
      // RUN & IDLE: Big bright expressive anime eyes with white sparkle pupils
      const drawBigEye = (cx: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx + pupilOffset, 64, 18, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + pupilOffset - 5, 54, 7, 0, Math.PI * 2);
        ctx.arc(cx + pupilOffset + 6, 72, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      drawBigEye(80);
      drawBigEye(176);
    }

    if (this.visorTexture) {
      this.visorTexture.needsUpdate = true;
    }
  }

  private setAppearance(skin?: Skin) {
    this.isStreet = skin?.avatar === 'STREET';
    for (const node of this.cyberNodes) node.visible = !this.isStreet;
    for (const node of this.streetNodes) node.visible = this.isStreet;
    this.street.update(skin, this.isStreet);
  }

  public updateSkin(colors: SkinColors) {
    this.setAppearance(colors.appearance);
    if (this.materialsToUpdate[0]) {
      this.materialsToUpdate[0].color.setHex(colors.primary);
      Object.assign(this.materialsToUpdate[0], finishMaterial(colors.finish));
    }
    if (this.materialsToUpdate[1]) {
      this.materialsToUpdate[1].color.setHex(colors.secondary);
    }
    this.glowColorHex = '#' + colors.glow.toString(16).padStart(6, '0');
    (this.antennaBobble.material as THREE.MeshBasicMaterial).color.setHex(colors.glow);
    this.renderVisorFace(this.currentExpression, this.isBlinking, 0);
  }

  public setShadowsEnabled(enabled: boolean) {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child !== this.shadowDisk) {
        child.castShadow = enabled;
      }
    });
  }

  public triggerLandingSquash() {
    this.squashFactor = 0.78;
  }

  public animate(
    dt: number,
    status: 'RUN' | 'JUMP' | 'SLIDE' | 'CRASH' | 'IDLE',
    speedRatio: number,
    tiltAngle: number,
    globalTime: number
  ) {
    // 1. Natural Blinking & Expression update
    const wasBlinking = this.isBlinking;
    this.blinkTimer += dt;
    if (this.blinkTimer > 2.8) {
      this.isBlinking = true;
      if (this.blinkTimer > 2.96) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    }

    this.street.eyes.scale.y = this.isBlinking ? .12 : 1;

    if (this.currentExpression !== status || wasBlinking !== this.isBlinking) {
      this.currentExpression = status;
      const lookDir = Math.max(-1, Math.min(1, tiltAngle * 2.5));
      this.renderVisorFace(status, this.isBlinking, lookDir);
    }

    // 2. Squash and Stretch recovery
    this.squashFactor = THREE.MathUtils.damp(this.squashFactor, 1.0, 12, dt);
    this.group.scale.y = 1.15 * this.squashFactor;
    this.group.scale.x = 1.15 * (1 + (1 - this.squashFactor) * 0.5);
    this.group.scale.z = 1.15 * (1 + (1 - this.squashFactor) * 0.5);

    // 3. Thruster & Aura animations
    const thrusterScale = 1.0 + Math.sin(globalTime * 25) * 0.3;
    this.leftThrusterGlow.scale.set(thrusterScale, thrusterScale * 1.6, thrusterScale);
    this.rightThrusterGlow.scale.set(thrusterScale, thrusterScale * 1.6, thrusterScale);

    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += dt * 2.5;
      this.shieldMesh.rotation.x += dt * 1.2;
    }
    if (this.magnetRing.visible) {
      this.magnetRing.rotation.y += dt * 4.0;
      this.magnetRing.position.y = 1.0 + Math.sin(globalTime * 8) * 0.15;
    }
    if (this.boostAura.visible) {
      this.boostAura.rotation.y -= dt * 6.0;
      (this.boostAura.material as THREE.MeshBasicMaterial).color.setHSL((globalTime * 0.8) % 1, 1, 0.6);
    }

    // Lane tilt lean
    this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, tiltAngle, 14, dt);

    // Antenna & Ear inertia wobble
    const earBounce = Math.sin(globalTime * 14 * Math.max(1, speedRatio)) * 0.15;
    this.leftEarGroup.rotation.x = earBounce;
    this.rightEarGroup.rotation.x = -earBounce;
    this.antennaGroup.rotation.z = Math.sin(globalTime * 10) * 0.2 - tiltAngle * 0.4;

    // 4. State Animations
    if (status === 'IDLE') {
      this.dizzyStarsGroup.visible = false;
      const breath = Math.sin(globalTime * 2.8) * 0.04;
      this.torsoGroup.position.y = THREE.MathUtils.damp(this.torsoGroup.position.y, 1.05 + breath, 8, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, 0.02, 8, dt);
      this.headGroup.rotation.x = Math.sin(globalTime * 1.8) * 0.06;
      this.headGroup.rotation.y = Math.sin(globalTime * 1.2) * 0.15;

      this.leftArmGroup.rotation.x = THREE.MathUtils.damp(this.leftArmGroup.rotation.x, Math.sin(globalTime * 2.8) * 0.1, 8, dt);
      this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, -Math.sin(globalTime * 2.8) * 0.1, 8, dt);
      this.leftArmGroup.rotation.z = -0.15;
      this.rightArmGroup.rotation.z = 0.15;

      this.leftLegGroup.rotation.x = THREE.MathUtils.damp(this.leftLegGroup.rotation.x, 0, 8, dt);
      this.rightLegGroup.rotation.x = THREE.MathUtils.damp(this.rightLegGroup.rotation.x, 0, 8, dt);
      this.shadowDisk.scale.set(1.05, 1.05, 1.05);
      return;
    }

    if (status === 'SLIDE') {
      this.dizzyStarsGroup.visible = false;
      // Low speed-skate slide pose
      this.torsoGroup.position.y = THREE.MathUtils.damp(this.torsoGroup.position.y, 0.4, 20, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, -0.72, 20, dt);
      this.headGroup.rotation.x = 0.55; // looks forward while sliding
      this.leftArmGroup.rotation.x = -1.4;
      this.rightArmGroup.rotation.x = -1.4;
      this.leftLegGroup.rotation.x = 1.35;
      this.rightLegGroup.rotation.x = 1.2;
      this.shadowDisk.scale.set(1.4, 1.4, 1.4);
      return;
    }

    if (status === 'JUMP') {
      this.dizzyStarsGroup.visible = false;
      // Heroic tuck jump pose with dynamic stretch
      this.torsoGroup.position.y = THREE.MathUtils.damp(this.torsoGroup.position.y, 1.05, 12, dt);
      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, 0.2, 12, dt);
      this.headGroup.rotation.x = -0.15;
      this.leftArmGroup.rotation.x = -1.6;
      this.rightArmGroup.rotation.x = -1.6;
      this.leftLegGroup.rotation.x = 0.65;
      this.rightLegGroup.rotation.x = 0.75;
      this.shadowDisk.scale.set(0.55, 0.55, 0.55);
      return;
    }

    if (status === 'CRASH') {
      // Amusing cartoon crash with spinning stars!
      this.dizzyStarsGroup.visible = true;
      this.dizzyStarsGroup.rotation.y += dt * 8;

      this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, -0.6, 12, dt);
      this.torsoGroup.rotation.z = THREE.MathUtils.damp(this.torsoGroup.rotation.z, 0.4, 12, dt);
      this.torsoGroup.position.y = THREE.MathUtils.damp(this.torsoGroup.position.y, 0.5, 12, dt);
      this.headGroup.rotation.z = 0.35;
      this.leftArmGroup.rotation.x = -1.8;
      this.rightArmGroup.rotation.x = 1.2;
      this.leftLegGroup.rotation.x = 1.2;
      this.rightLegGroup.rotation.x = -0.8;
      this.shadowDisk.scale.set(0.6, 0.6, 0.6);
      return;
    }

    // Normal RUN animation: energetic mascot stride
    this.dizzyStarsGroup.visible = false;
    this.runCycleTime += dt * 14 * Math.max(1, speedRatio);

    const legAngle = Math.sin(this.runCycleTime) * 0.85;
    const armAngle = -legAngle * 1.05;
    const bodyBob = Math.abs(Math.sin(this.runCycleTime)) * 0.16;

    this.torsoGroup.position.y = 1.05 + bodyBob;
    this.torsoGroup.rotation.x = 0.14; // forward aerodynamic lean
    this.headGroup.rotation.x = -0.06;
    this.headGroup.rotation.y = 0;
    this.leftArmGroup.rotation.z = 0;
    this.rightArmGroup.rotation.z = 0;

    this.leftLegGroup.rotation.x = legAngle;
    this.rightLegGroup.rotation.x = -legAngle;

    this.leftArmGroup.rotation.x = armAngle;
    this.rightArmGroup.rotation.x = -armAngle;

    this.shadowDisk.scale.set(1, 1, 1);
  }

  public setDebugHitbox(enabled: boolean, isSliding: boolean) {
    let box = this.group.getObjectByName('debug_hitbox') as THREE.LineSegments | undefined;
    if (!box) {
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(.8, 1.75, .64));
      const mat = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      box = new THREE.LineSegments(geo, mat);
      box.name = 'debug_hitbox';
      this.group.add(box);
    }
    box.visible = enabled;
    if (enabled) {
      if (isSliding) {
        box.scale.set(1 / this.group.scale.x, .45 / 1.75 / this.group.scale.y, 1 / this.group.scale.z);
        box.position.set(0, .225 / this.group.scale.y, 0);
      } else {
        box.scale.set(1 / this.group.scale.x, 1 / this.group.scale.y, 1 / this.group.scale.z);
        box.position.set(0, .875 / this.group.scale.y, 0);
      }
    }
  }
}
