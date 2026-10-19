import React, { useState } from 'react';
import { X, Check, Lock, Sparkles, Coins, Award } from 'lucide-react';
import { Skin } from '../types/game';
import { PlayerProgression } from '../types/progression';

interface SkinModalProps {
  skins: Skin[];
  selectedSkinId: string;
  totalCoins: number;
  progression: PlayerProgression;
  onSelectSkin: (skin: Skin) => void;
  onUnlockSkin: (skinId: string) => void;
  onClose: () => void;
}

export const SkinModal: React.FC<SkinModalProps> = ({
  skins,
  selectedSkinId,
  totalCoins,
  progression,
  onSelectSkin,
  onUnlockSkin,
  onClose,
}) => {
  const [previewSkinId, setPreviewSkinId] = useState<string>(selectedSkinId);
  const previewSkin = skins.find((s) => s.id === previewSkinId) || skins[0];

  return (
    <div role="dialog" aria-modal="true" aria-label="Skins" className="absolute inset-0 z-40 flex items-center justify-center p-4 pt-safe pb-safe bg-black/85 select-none">
      <div className="w-full max-w-lg bg-neutral-950 border border-cyan-400/50 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-arcade text-xl font-black text-white tracking-wider uppercase">
                MASCOT CLOSET
              </h2>
              <span className="text-[10px] text-neutral-400 font-mono">
                COSMETICS NEVER ALTER GAMEPLAY HITBOXES
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-yellow-400/40 px-3 py-1 rounded-xl">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="font-arcade text-sm font-bold text-yellow-400 tabular-nums">
                {totalCoins.toLocaleString()}
              </span>
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selected Skin Hero Preview Card */}
        <div className="my-2.5 p-3 rounded-2xl bg-neutral-900/80 border border-white/15 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Color Swatch Orb */}
            <div
              className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center shadow-lg relative overflow-hidden"
              style={{
                backgroundColor: previewSkin.primaryColor,
                borderColor: previewSkin.glowColor,
                boxShadow: `0 0 20px ${previewSkin.glowColor}55`,
              }}
            >
              <div
                className="w-5 h-5 rounded-full absolute -bottom-1 -right-1"
                style={{ backgroundColor: previewSkin.secondaryColor }}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-arcade font-bold text-sm text-white">{previewSkin.name}</span>
                {previewSkin.rarity && (
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded font-arcade ${
                      previewSkin.rarity === 'LEGENDARY'
                        ? 'bg-purple-500/30 text-purple-300 border border-purple-400'
                        : previewSkin.rarity === 'EPIC'
                        ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400'
                        : 'bg-cyan-500/30 text-cyan-300 border border-cyan-400'
                    }`}
                  >
                    {previewSkin.rarity}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-300 mt-0.5 line-clamp-1">{previewSkin.tagline}</p>
            </div>
          </div>

          <div>
            {previewSkin.unlocked ? (
              previewSkin.id === selectedSkinId ? (
                <span className="text-xs font-arcade font-bold text-cyan-400 flex items-center gap-1 px-3 py-1 rounded-xl bg-cyan-950/40 border border-cyan-500/50">
                  <Check className="w-4 h-4" /> EQUIPPED
                </span>
              ) : (
                <button
                  onClick={() => onSelectSkin(previewSkin)}
                  className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-arcade font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  EQUIP
                </button>
              )
            ) : (
              <button
                onClick={() => onUnlockSkin(previewSkin.id)}
                disabled={totalCoins < previewSkin.price}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-arcade font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                  totalCoins >= previewSkin.price
                    ? 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{previewSkin.price} COINS</span>
              </button>
            )}
          </div>
        </div>

        {/* Skins Grid List */}
        <div className="grid grid-cols-2 gap-2.5 overflow-y-auto py-1 pr-1">
          {skins.map((skin) => {
            const isEquipped = skin.id === selectedSkinId;
            const isPreviewing = skin.id === previewSkinId;
            const canAfford = totalCoins >= skin.price;
            const hasLevel = skin.requiredLevel ? progression.level >= skin.requiredLevel : false;

            return (
              <button
                type="button"
                aria-pressed={isPreviewing}
                key={skin.id}
                onClick={() => setPreviewSkinId(skin.id)}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer ${
                  isEquipped
                    ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : isPreviewing
                    ? 'border-pink-500/80 bg-neutral-900/90'
                    : skin.unlocked
                    ? 'border-white/10 bg-neutral-900/60 hover:border-white/30'
                    : 'border-white/5 bg-neutral-900/30 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-arcade font-bold text-xs text-white truncate max-w-[100px]">
                      {skin.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full border border-black/50"
                        style={{ backgroundColor: skin.primaryColor }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-black/50"
                        style={{ backgroundColor: skin.secondaryColor }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-400 line-clamp-1">{skin.tagline}</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                  {skin.unlocked ? (
                    isEquipped ? (
                      <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400 font-mono">OWNED</span>
                    )
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400">
                      <Coins className="w-3 h-3" />
                      <span>{skin.price}</span>
                      {skin.requiredLevel && (
                        <span className="text-neutral-500 font-normal">/ L{skin.requiredLevel}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
