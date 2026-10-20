import type { Skin } from '../types/game';

export const CUSTOM_SKINS_KEY = 'brainrot_custom_skins_v1';
export const MAX_CUSTOM_SKINS = 8;
export const SKIN_FINISHES = ['SATIN', 'CHROME', 'MATTE'] as const;
export type SkinFinish = (typeof SKIN_FINISHES)[number];
const color = /^#[\da-f]{6}$/i;

/** Treat local saves as untrusted; never accept prices, unlocks or built-in IDs. */
export function normalizeCustomSkin(value: unknown): Skin | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !/^custom_[a-zA-Z0-9_-]{1,64}$/.test(v.id))
    return null;
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 24)
    return null;
  if (
    ![v.primaryColor, v.secondaryColor, v.glowColor].every(
      (c) => typeof c === 'string' && color.test(c),
    )
  )
    return null;
  return {
    id: v.id,
    name: v.name.trim(),
    tagline: 'Made by you · cosmetic only',
    price: 0,
    primaryColor: v.primaryColor as string,
    secondaryColor: v.secondaryColor as string,
    glowColor: v.glowColor as string,
    unlocked: true,
    custom: true,
    finish: SKIN_FINISHES.includes(v.finish as SkinFinish)
      ? (v.finish as SkinFinish)
      : 'SATIN',
  };
}

export function parseCustomSkins(raw: string | null): Skin[] {
  try {
    const saved: unknown = JSON.parse(raw || 'null');
    if (!Array.isArray(saved)) return [];
    const ids = new Set<string>();
    return saved.flatMap((v) => {
      const skin = normalizeCustomSkin(v);
      if (!skin || ids.has(skin.id) || ids.size >= MAX_CUSTOM_SKINS) return [];
      ids.add(skin.id);
      return [skin];
    });
  } catch {
    return [];
  }
}

export function finishMaterial(finish: Skin['finish']) {
  switch (finish) {
    case 'CHROME':
      return { roughness: 0.18, metalness: 0.9 };
    case 'MATTE':
      return { roughness: 0.8, metalness: 0.12 };
    default:
      return { roughness: 0.38, metalness: 0.5 };
  }
}
