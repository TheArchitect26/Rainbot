import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

export class ParticleSystem {
  public points: THREE.Points;
  private maxParticles = 300;
  private particles: Particle[] = [];
  private free: Particle[] = Array.from({ length: 300 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, color: new THREE.Color(), size: .3 }));
  private scratchColor = new THREE.Color();
  private positions: Float32Array;
  private colors: Float32Array;
  private geometry: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Particle sprite using procedural circle
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const rad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    rad.addColorStop(0, 'rgba(255,255,255,1)');
    rad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.35,
      map: texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  public emit(x: number, y: number, z: number, count: number, hexColor: number, speed = 4, life = 0.5) {
    const col = this.scratchColor.setHex(hexColor);
    for (let i = 0; i < count; i++) {
      if (!this.free.length) break;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.6);

      const particle = this.free.pop()!;
      particle.color.copy(col);
      particle.x = x; particle.y = y; particle.z = z;
      particle.vx = Math.sin(phi) * Math.cos(theta) * s;
      particle.vy = Math.abs(Math.cos(phi)) * s * .8 + 1;
      particle.vz = Math.sin(phi) * Math.sin(theta) * s;
      particle.life = life; particle.maxLife = life;
      this.particles.push(particle);
    }
  }

  public emitTrail(x: number, y: number, z: number, hexColor: number) {
    if (this.particles.length >= this.maxParticles) return;
    const particle = this.free.pop()!;
    particle.color.setHex(hexColor);
    particle.x = x + (Math.random() - .5) * .3;
    particle.y = y + .05; particle.z = z + .3;
    particle.vx = (Math.random() - .5) * .5;
    particle.vy = Math.random() * .6; particle.vz = 2;
    particle.life = .25; particle.maxLife = .25;
    this.particles.push(particle);
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.free.push(p);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.8 * dt * 0.4; // slight gravity
    }

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        const alpha = p.life / p.maxLife;
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;

        this.colors[i * 3] = p.color.r * alpha;
        this.colors[i * 3 + 1] = p.color.g * alpha;
        this.colors[i * 3 + 2] = p.color.b * alpha;
      } else {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -999;
        this.positions[i * 3 + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  public clear() {
    this.free.push(...this.particles);
    this.particles.length = 0;
    for (let i = 0; i < this.maxParticles * 3; i++) {
      this.positions[i] = 0;
      this.colors[i] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
