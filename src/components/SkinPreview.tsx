import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CharacterModel } from '../game/CharacterModel';
import type { Skin } from '../types/game';

const colors = (skin: Skin) => ({
  primary: Number.parseInt(skin.primaryColor.slice(1), 16),
  secondary: Number.parseInt(skin.secondaryColor.slice(1), 16),
  glow: Number.parseInt(skin.glowColor.slice(1), 16),
  accent: 0xffffff,
  finish: skin.finish,
  appearance: skin,
});

/** One small, capped preview context, shared across palette changes and disposed on close. */
export function SkinPreview({ skin }: { skin: Skin }) {
  const mount = useRef<HTMLDivElement>(null);
  const model = useRef<CharacterModel | null>(null);
  const initial = useRef(skin);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(240, 180);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 240 / 180, 0.1, 20);
    camera.position.set(2, 1.9, 4.6);
    camera.lookAt(0, 1.2, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    scene.add(key);
    const character = new CharacterModel(colors(initial.current));
    model.current = character;
    scene.add(character.group);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      previous = 0,
      time = 0;
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden || now - previous < 1000 / 30) return;
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (!motion.matches) time += dt;
      character.animate(motion.matches ? 0 : dt, 'IDLE', 0, 0, time);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      model.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          materials.add(material);
          if ('map' in material && material.map instanceof THREE.Texture)
            textures.add(material.map);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    model.current?.updateSkin(colors(skin));
  }, [skin]);
  return (
    <div
      role="img"
      aria-label={`3D preview of ${skin.name}`}
      className="flex justify-center h-[180px] shrink-0"
      ref={mount}
    >
      {failed && (
        <div
          className="self-center rounded-3xl p-6 border-4"
          style={{
            background: skin.primaryColor,
            borderColor: skin.glowColor,
            color: skin.secondaryColor,
          }}
        >
          ◆ {skin.name}
        </div>
      )}
    </div>
  );
}
