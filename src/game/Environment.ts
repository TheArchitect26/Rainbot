import { ZoneScenery } from './ZoneScenery';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface EnvironmentThemes {
  groundColor: number;
  neonCyan: number;
  neonMagenta: number;
  neonYellow: number;
  fogColor: number;
  ambientSky: number;
  ambientGround: number;
  sunColor: number;
}

export const THEME_NEON_TOKYO: EnvironmentThemes = {
  groundColor: 0x0a0a16,
  neonCyan: 0x06b6d4,
  neonMagenta: 0xec4899,
  neonYellow: 0xfacc15,
  fogColor: 0x080816,
  ambientSky: 0x38bdf8,
  ambientGround: 0x1e1035,
  sunColor: 0xec4899,
};

export const THEME_SYNTHWAVE: EnvironmentThemes = {
  groundColor: 0x180a2a,
  neonCyan: 0xf43f5e,
  neonMagenta: 0xa855f7,
  neonYellow: 0xfb923c,
  fogColor: 0x130624,
  ambientSky: 0xf472b6,
  ambientGround: 0x3b0764,
  sunColor: 0xf97316,
};

export const THEME_QUANTUM_MATRIX: EnvironmentThemes = {
  groundColor: 0x031208,
  neonCyan: 0x22c55e,
  neonMagenta: 0x10b981,
  neonYellow: 0x86efac,
  fogColor: 0x021006,
  ambientSky: 0x4ade80,
  ambientGround: 0x064e3b,
  sunColor: 0x22c55e,
};

export const THEME_CYBER_GOLD: EnvironmentThemes = {
  groundColor: 0x161005,
  neonCyan: 0xf59e0b,
  neonMagenta: 0xef4444,
  neonYellow: 0xfde047,
  fogColor: 0x120c04,
  ambientSky: 0xfbbf24,
  ambientGround: 0x451a03,
  sunColor: 0xfacc15,
};

export const THEME_DEFAULT = THEME_NEON_TOKYO;
export const THEME_MATRIX = THEME_QUANTUM_MATRIX;
export const THEME_VAPORWAVE = THEME_SYNTHWAVE;

interface HoverTrafficCar {
  mesh: THREE.Group;
  speed: number;
  x: number;
  y: number;
}

export class EnvironmentManager {
  public scene: THREE.Scene;
  public hemiLight: THREE.HemisphereLight;
  public dirLight: THREE.DirectionalLight;
  public fog: THREE.Fog;

  private trackSegments: THREE.Group[] = [];
  private numSegments = 7;
  private segmentLength = 36;
  private trackGroup: THREE.Group;
  private cityGroup: THREE.Group;
  private cityBodies!: THREE.InstancedMesh;
  private cityStrips!: THREE.InstancedMesh;
  private cityBeacons!: THREE.InstancedMesh;
  private zoneScenery: ZoneScenery;
  private quality: 'low' | 'medium' | 'high' = 'medium';
  private detailedObjects: THREE.Object3D[] = [];
  private windowMesh!: THREE.InstancedMesh;
  private readonly windowTransform = new THREE.Object3D();
  private rimLight: THREE.DirectionalLight;
  private trafficCars: HoverTrafficCar[] = [];
  private retroSunGroup: THREE.Group;
  private skyDome: THREE.Mesh;
  private railGlowMaterials: THREE.MeshBasicMaterial[] = [];
  private sunMaterial: THREE.MeshBasicMaterial;

  private billboardCanvases: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; meme: any }[] = [];
  private laneLineMaterials: THREE.MeshBasicMaterial[] = [];
  private roadMaterials: THREE.MeshStandardMaterial[] = [];
  private currentTheme: EnvironmentThemes = { ...THEME_DEFAULT };
  private billboardTimer = 1;
  private targetFog = new THREE.Color(THEME_DEFAULT.fogColor);
  private targetSky = new THREE.Color(THEME_DEFAULT.ambientSky);
  private targetGround = new THREE.Color(THEME_DEFAULT.ambientGround);
  private targetSun = new THREE.Color(THEME_DEFAULT.sunColor);
  private reflection: THREE.WebGLRenderTarget;
  private targetTheme: EnvironmentThemes = { ...THEME_DEFAULT };

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;

    // 1. Mandatory Studio Environment Reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.reflection = pmremGenerator.fromScene(room, 0.04);
    scene.environment = this.reflection.texture;
    scene.environmentIntensity = 0.55;
    room.dispose();
    pmremGenerator.dispose();

    // 2. Horizon-Matched Fog
    this.fog = new THREE.Fog(THEME_DEFAULT.fogColor, 40, 135);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(THEME_DEFAULT.fogColor);
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), new THREE.ShaderMaterial({
      uniforms: { horizon: { value: this.fog.color } },
      vertexShader: 'varying float elevation; void main(){ elevation = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 horizon; varying float elevation;
        void main(){
          float glow = pow(1.0 - abs(elevation), 8.0);
          vec3 color = mix(vec3(0.004, 0.006, 0.018), horizon * 2.8 + vec3(0.025, 0.02, 0.045), glow);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false,
    }));
    this.skyDome.renderOrder = -100;
    this.scene.add(this.skyDome);

    // 3. Balanced Warm/Cool Studio Lighting
    this.hemiLight = new THREE.HemisphereLight(
      THEME_DEFAULT.ambientSky,
      THEME_DEFAULT.ambientGround,
      1.3
    );
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff6ea, 2.2);
    this.dirLight.position.set(12, 28, 14);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 90;
    this.dirLight.shadow.camera.left = -16;
    this.dirLight.shadow.camera.right = 16;
    this.dirLight.shadow.camera.top = 22;
    this.dirLight.shadow.camera.bottom = -10;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight, this.dirLight.target);
    // A shadow-free cool rim separates the runner from the road at every quality.
    this.rimLight = new THREE.DirectionalLight(0x60a5fa, 1.6);
    this.rimLight.position.set(-8, 6, -12);
    this.scene.add(this.rimLight, this.rimLight.target);

    // 4. Giant Retro Horizon Sun
    this.retroSunGroup = new THREE.Group();
    const sunGeo = new THREE.CircleGeometry(32, 32);
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: THEME_DEFAULT.sunColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const sunMesh = new THREE.Mesh(sunGeo, this.sunMaterial);
    sunMesh.position.set(0, 18, -130);
    this.retroSunGroup.add(sunMesh);
    this.scene.add(this.retroSunGroup);

    // 5. Track & City Groups
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    this.cityGroup = new THREE.Group();
    this.scene.add(this.cityGroup);

    this.buildTrackSegments(renderer);
    this.buildCitySkyline();
    this.buildHoverTraffic();
    this.zoneScenery = new ZoneScenery(this.scene);
    this.setQuality('medium');
    for (const object of [...this.trackSegments, ...this.cityGroup.children, ...this.trafficCars.map((c) => c.mesh)]) object.userData.initialZ = object.position.z;
  }

  private createAnimatedBillboard(title: string, subtitle: string, color: string, badge: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const meme = { title, subtitle, color, badge };
    this.billboardCanvases.push({ canvas, ctx, texture, meme });
    return texture;
  }

  private buildTrackSegments(renderer: THREE.WebGLRenderer) {
    const memes = [
      { title: 'THE ALGORITHM', sub: 'HARVESTING ATTENTION 999k+', color: '#06b6d4', badge: 'VIRAL FYP' },
      { title: 'SKIBIDI OVERLOAD', sub: 'LEVEL 99 MAXIMUM RIZZ', color: '#ec4899', badge: 'TRENDING #1' },
      { title: 'TOUCH GRASS', sub: 'WARNING: OUTSIDE WORLD DETECTED', color: '#22c55e', badge: '404 REALITY' },
      { title: 'SUBWAY SURFING', sub: 'SPLIT SCREEN BRAINROT STREAM', color: '#facc15', badge: 'LIVE NOW' },
      { title: 'SIGMA ZONE', sub: 'NEVER SLEEP · NEVER PAUSE', color: '#a855f7', badge: 'UNSTOPPABLE' },
      { title: 'DOPAMINE HIT', sub: 'ATTENTION SPAN: 0.2 SECONDS', color: '#ef4444', badge: 'CRITICAL' },
    ];

    // Small, deterministic tiled asphalt; no network textures or post-processing.
    const asphalt = document.createElement('canvas');
    asphalt.width = asphalt.height = 128;
    const asphaltContext = asphalt.getContext('2d')!;
    const pixels = asphaltContext.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      const grain = 175 + ((i * 73 ^ (i >> 3) * 19) % 55);
      pixels.data.set([grain, grain, grain, 255], i * 4);
    }
    asphaltContext.putImageData(pixels, 0, 0);
    const roadTexture = new THREE.CanvasTexture(asphalt);
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(3, 12);
    roadTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    roadTexture.colorSpace = THREE.SRGBColorSpace;

    // Baked lateral glow gives neon road spill without extra lights or bloom passes.
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64; glowCanvas.height = 4;
    const glowContext = glowCanvas.getContext('2d')!;
    const gradient = glowContext.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    glowContext.fillStyle = gradient; glowContext.fillRect(0, 0, 64, 4);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    for (let i = 0; i < this.numSegments; i++) {
      const segment = new THREE.Group();
      const zOffset = -i * this.segmentLength;
      segment.position.z = zOffset;

      // Road highway surface
      const roadGeo = new THREE.PlaneGeometry(8.6, this.segmentLength);
      roadGeo.rotateX(-Math.PI / 2);
      const roadMat = new THREE.MeshStandardMaterial({
        color: this.currentTheme.groundColor,
        map: roadTexture,
        roughness: 0.58,
        metalness: 0.32,
      });
      this.roadMaterials.push(roadMat);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.receiveShadow = true;
      segment.add(road);

      // Neon Lane Divider lines
      const lineGeo = new THREE.PlaneGeometry(0.14, this.segmentLength);
      lineGeo.rotateX(-Math.PI / 2);
      const lineMat = new THREE.MeshBasicMaterial({
        color: this.currentTheme.neonCyan,
        transparent: true,
        opacity: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      this.laneLineMaterials.push(lineMat);

      const leftDivider = new THREE.Mesh(lineGeo, lineMat);
      leftDivider.position.set(-1.2, 0.02, 0);
      const rightDivider = new THREE.Mesh(lineGeo, lineMat);
      rightDivider.position.set(1.2, 0.02, 0);
      segment.add(leftDivider, rightDivider);

      // Glowing guardrails
      const railGeo = new THREE.BoxGeometry(0.28, 0.5, this.segmentLength);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.3,
        metalness: 0.85,
      });
      const leftRail = new THREE.Mesh(railGeo, railMat);
      leftRail.position.set(-4.42, 0.25, 0);
      const rightRail = new THREE.Mesh(railGeo, railMat);
      rightRail.position.set(4.42, 0.25, 0);
      segment.add(leftRail, rightRail);

      // Neon light ribbons on guardrails
      const railGlowGeo = new THREE.BoxGeometry(0.1, 0.1, this.segmentLength);
      const railGlowMat = new THREE.MeshBasicMaterial({ color: this.currentTheme.neonMagenta });
      const leftGlow = new THREE.Mesh(railGlowGeo, railGlowMat);
      leftGlow.position.set(-4.28, 0.48, 0);
      const rightGlow = new THREE.Mesh(railGlowGeo, railGlowMat);
      rightGlow.position.set(4.28, 0.48, 0);
      segment.add(leftGlow, rightGlow);
      this.railGlowMaterials.push(railGlowMat);
      const spillGeometry = new THREE.PlaneGeometry(1.8, this.segmentLength);
      spillGeometry.rotateX(-Math.PI / 2);
      const spillMaterial = new THREE.MeshBasicMaterial({ map: glowTexture,
        color: this.currentTheme.neonMagenta, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      this.railGlowMaterials.push(spillMaterial);
      for (const side of [-1, 1]) {
        const spill = new THREE.Mesh(spillGeometry, spillMaterial);
        spill.position.set(side * 3.85, 0.012, 0);
        segment.add(spill);
        this.detailedObjects.push(spill);
      }

      // Holographic Archway over every 2nd segment
      if (i % 2 === 1) {
        const memeIdx = ((i * 2) % memes.length);
        const arch = this.createArchway(memes[memeIdx]);
        arch.position.set(0, 0, 0);
        segment.add(arch);
        this.detailedObjects.push(arch);
      }

      this.trackSegments.push(segment);
      this.trackGroup.add(segment);
    }
  }

  private createArchway(meme: { title: string; sub: string; color: string; badge: string }): THREE.Group {
    const archGroup = new THREE.Group();

    // Pillars on sides
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.28, 6.4, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-4.5, 3.2, 0);
    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(4.5, 3.2, 0);
    archGroup.add(leftPillar, rightPillar);

    // Glowing vertical neon strip on pillars
    const stripGeo = new THREE.BoxGeometry(0.06, 5.8, 0.06);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const leftStrip = new THREE.Mesh(stripGeo, stripMat);
    leftStrip.position.set(-4.36, 3.2, 0);
    const rightStrip = new THREE.Mesh(stripGeo, stripMat);
    rightStrip.position.set(4.36, 3.2, 0);
    archGroup.add(leftStrip, rightStrip);

    // Overhead truss bar
    const trussGeo = new THREE.BoxGeometry(9.6, 0.4, 0.5);
    const truss = new THREE.Mesh(trussGeo, pillarMat);
    truss.position.set(0, 6.2, 0);
    archGroup.add(truss);

    // Animated Holographic Billboard
    const texture = this.createAnimatedBillboard(meme.title, meme.sub, meme.color, meme.badge);
    const bbGeo = new THREE.PlaneGeometry(6.6, 3.0);
    const bbMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const bbMesh = new THREE.Mesh(bbGeo, bbMat);
    bbMesh.position.set(0, 4.6, 0);
    archGroup.add(bbMesh);

    return archGroup;
  }

  private buildCitySkyline() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.cityBodies = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0x101323, roughness: 0.65, metalness: 0.25 }), 44);
    this.cityStrips = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 44);
    this.cityBeacons = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 44);
    this.windowMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 44 * 24);
    for (const mesh of [this.cityBodies, this.cityStrips, this.cityBeacons, this.windowMesh]) {
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
    const color = new THREE.Color();
    for (let i = 0; i < 44; i++) {
      const building = new THREE.Group();
      const height = 18 + Math.random() * 42;
      const width = 5 + Math.random() * 8, depth = 5 + Math.random() * 8;
      building.position.set((i % 2 ? 1 : -1) * (14 + Math.random() * 26), 0, -Math.random() * 240);
      Object.assign(building.userData, { windowIndex: i, windowWidth: width, windowDepth: depth, windowHeight: height });
      this.cityGroup.add(building);
      this.placeWindows(building);
      color.setHex(i % 3 === 0 ? 0x9363b8 : 0x3f8d9c);
      this.cityStrips.setColorAt(i, color);
      this.cityBeacons.setColorAt(i, color);
      for (let w = 0; w < 24; w++)
        this.windowMesh.setColorAt(i * 24 + w, color.setHex(w % 5 === 0 ? 0xd0a777 : i % 2 ? 0x3787ad : 0x735b9e));
    }
  }

  private placeWindows(building: THREE.Object3D) {
    const { windowIndex: index, windowWidth: width, windowDepth: depth, windowHeight: height } = building.userData;
    const t = this.windowTransform, x = building.position.x, z = building.position.z;
    t.position.set(x, height / 2 - 2, z); t.scale.set(width, height, depth); t.updateMatrix();
    this.cityBodies.setMatrixAt(index, t.matrix);
    t.position.set(x + width * 0.48, height * 0.5, z + depth * 0.48); t.scale.set(0.14, height * 0.85, 0.14); t.updateMatrix();
    this.cityStrips.setMatrixAt(index, t.matrix);
    t.position.set(x, height, z); t.scale.set(0.1, 5, 0.1); t.updateMatrix();
    this.cityBeacons.setMatrixAt(index, t.matrix);
    for (let w = 0; w < 24; w++) {
      t.position.set(x + ((w % 3) - 1) * width * 0.27, 2 + Math.floor(w / 3) * (height - 5) / 8, z + depth * 0.5 + 0.03);
      t.scale.set(width * 0.14, 0.65, 0.05); t.updateMatrix();
      this.windowMesh.setMatrixAt(index * 24 + w, t.matrix);
    }
    for (const mesh of [this.cityBodies, this.cityStrips, this.cityBeacons, this.windowMesh]) mesh.instanceMatrix.needsUpdate = true;
  }

  public setQuality(quality: 'low' | 'medium' | 'high') {
    this.quality = quality;
    const towers = quality === 'low' ? 16 : quality === 'medium' ? 28 : 44;
    for (const mesh of [this.cityBodies, this.cityStrips, this.cityBeacons]) mesh.count = towers;
    this.windowMesh.count = towers * 24;
    this.detailedObjects.forEach(object => { object.visible = quality !== 'low'; });
    this.trafficCars.forEach((car, i) => { car.mesh.visible = quality === 'high' || quality === 'medium' && i < 4; });
    this.zoneScenery?.setQuality(quality);
  }

  private buildHoverTraffic() {
    // Distant cyber hover cars cruising in background skies
    const carBodyGeo = new THREE.BoxGeometry(1.6, 0.45, 3.2);
    const carMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2f, metalness: 0.9, roughness: 0.2 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });

    for (let c = 0; c < 8; c++) {
      const carGroup = new THREE.Group();
      const body = new THREE.Mesh(carBodyGeo, carMat);
      carGroup.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.2), headlightMat);
      head.position.set(0, 0, -1.6);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.2), taillightMat);
      tail.position.set(0, 0, 1.6);
      carGroup.add(head, tail);

      const isLeft = c % 2 === 0;
      const x = (isLeft ? -1 : 1) * (18 + Math.random() * 15);
      const y = 8 + Math.random() * 14;
      const z = -Math.random() * 200;

      carGroup.position.set(x, y, z);
      this.scene.add(carGroup);

      this.trafficCars.push({
        mesh: carGroup,
        speed: (25 + Math.random() * 25) * (isLeft ? 1 : -1),
        x,
        y,
      });
    }
  }

  public update(playerZ: number, dt: number, globalTime: number) {
    // Keep illumination and the shadow frustum near the runner throughout long runs.
    this.dirLight.position.z = playerZ + 14;
    this.dirLight.target.position.z = playerZ - 12;
    this.rimLight.position.z = playerZ - 12;
    this.rimLight.target.position.z = playerZ;

    this.zoneScenery.update(playerZ);

    // 1. Recycle Track Segments seamlessly
    const activeDistance = this.segmentLength * this.numSegments;
    for (const segment of this.trackSegments) {
      if (segment.position.z > playerZ + 20) {
        segment.position.z -= activeDistance;
      }
    }

    // 2. Recycle City Towers
    for (const child of this.cityGroup.children) {
      if (child.position.z > playerZ + 30) {
        while (child.position.z > playerZ + 30) child.position.z -= 240;
        this.placeWindows(child);
      }
    }

    // 3. Move Hover Traffic Cars in background
    for (const car of this.trafficCars) {
      car.mesh.position.z += car.speed * dt;
      if (car.mesh.position.z > playerZ + 40) {
        car.mesh.position.z = playerZ - 180;
      } else if (car.mesh.position.z < playerZ - 200) {
        car.mesh.position.z = playerZ + 30;
      }
    }

    // 4. Update Retro Horizon Sun position to follow player forward
    this.retroSunGroup.position.z = playerZ;
    this.skyDome.position.z = playerZ;

    // 5. Animate Holographic Billboards (pulsating borders & scanlines)
    this.billboardTimer += dt;
    const refreshBillboards = this.quality !== 'low' && this.billboardTimer >= (this.quality === 'high' ? 1 / 6 : 1 / 3);
    if (refreshBillboards) this.billboardTimer = 0;
    for (let b = 0; refreshBillboards && b < this.billboardCanvases.length; b++) {
      const { ctx, texture, meme } = this.billboardCanvases[b];
      const pulse = Math.sin(globalTime * 3 + b) * 0.5 + 0.5;

      ctx.fillStyle = '#080816';
      ctx.fillRect(0, 0, 512, 256);

      // Neon Outer Border
      ctx.strokeStyle = meme.color;
      ctx.lineWidth = 8 + pulse * 4;
      ctx.strokeRect(6, 6, 500, 244);

      // Cyber Grid Lines
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 512; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }

      // Badge Pill
      ctx.fillStyle = meme.color;
      ctx.fillRect(180, 24, 152, 28);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(meme.badge, 256, 43);

      // Main Slogan
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 42px sans-serif';
      ctx.fillText(meme.title, 256, 115);

      // Subtitle
      ctx.fillStyle = meme.color;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(meme.subtitle, 256, 172);

      // Scanning line
      const scanY = ((globalTime * 120 + b * 50) % 256);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, scanY, 512, 4);

      texture.needsUpdate = true;
    }

    // 6. Smooth Theme Transitions (interpolating fog & lights)
    this.fog.color.lerp(this.targetFog, dt * 3.5);
    (this.scene.background as THREE.Color).copy(this.fog.color);
    this.hemiLight.color.lerp(this.targetSky, dt * 3.5);
    this.hemiLight.groundColor.lerp(this.targetGround, dt * 3.5);
    this.sunMaterial.color.lerp(this.targetSun, dt * 3.5);
  }

  public setTheme(theme: EnvironmentThemes) {
    this.targetTheme = theme;
    this.zoneScenery.setZone(theme === THEME_SYNTHWAVE ? 1 : theme === THEME_QUANTUM_MATRIX ? 2 : theme === THEME_CYBER_GOLD ? 3 : 0);
    this.targetFog.setHex(theme.fogColor);
    this.targetSky.setHex(theme.ambientSky);
    this.targetGround.setHex(theme.ambientGround);
    this.targetSun.setHex(theme.sunColor);
    for (const mat of this.laneLineMaterials) {
      mat.color.setHex(theme.neonCyan);
    }
    for (const mat of this.railGlowMaterials) mat.color.setHex(theme.neonMagenta);
    for (const mat of this.roadMaterials) {
      mat.color.setHex(theme.groundColor);
    }
  }

  public reset() {
    this.zoneScenery.reset();
    for (const object of this.trackSegments) object.position.z = object.userData.initialZ;
    for (const object of this.cityGroup.children) {
      object.position.z = object.userData.initialZ;
      this.placeWindows(object);
    }
    for (const car of this.trafficCars) car.mesh.position.z = car.mesh.userData.initialZ;
  }

  public dispose() { this.reflection.dispose(); }

  public resetTheme() {
    this.setTheme(THEME_DEFAULT);
  }
}
