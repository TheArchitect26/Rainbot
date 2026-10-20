import { hasStorageFailure } from '../utils/storage';
import { useLayoutEffect, useRef, useState } from 'react';
import { X, Check, Coins } from 'lucide-react';
import type { Skin } from '../types/game';
import type { PlayerProgression } from '../types/progression';
import {
  MAX_CUSTOM_SKINS,
  SKIN_FINISHES,
  ACCESSORY_RANKS,
  accessoryForRank,
} from '../utils/skinStudio';
import { SkinPreview } from './SkinPreview';

interface SkinModalProps {
  skins: Skin[];
  selectedSkinId: string;
  totalCoins: number;
  progression: PlayerProgression;
  onSelectSkin: (skin: Skin) => void;
  onUnlockSkin: (id: string) => void;
  onSaveCustomSkin: (skin: Skin) => boolean;
  onDeleteCustomSkin: (id: string) => void;
  onClose: () => void;
}

export function SkinModal({
  skins,
  selectedSkinId,
  totalCoins,
  progression,
  onSelectSkin,
  onUnlockSkin,
  onSaveCustomSkin,
  onDeleteCustomSkin,
  onClose,
}: SkinModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [previewId, setPreviewId] = useState(selectedSkinId);
  const [draft, setDraft] = useState<Skin | null>(null);
  const [message, setMessage] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const selected = skins.find((s) => s.id === previewId) || skins[0];
  const preview = draft || selected;
  const editing = draft !== null;
  useLayoutEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [previewId, editing]);
  const customCount = skins.filter((s) => s.custom).length;
  const create = () => {
    setDeleteId(null);
    setDraft({
      ...selected,
      id: `custom_${crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join('-')}`,
      name: 'My Runner',
      accessory: accessoryForRank(selected.accessory, progression.level),
      custom: true,
      unlocked: true,
      price: 0,
      rarity: undefined,
      requiredLevel: undefined,
    });
    setMessage('');
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Skins"
      className="absolute inset-0 z-40 flex items-center justify-center p-3 pt-safe pb-safe bg-black/85"
    >
      <div
        ref={panel}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-cyan-400/50 bg-neutral-950 p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-arcade text-lg text-white">RUNNER STUDIO</h2>
            <p className="text-xs text-neutral-400">
              Your look. Same skills, same hitbox.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-xl bg-white/10 text-white flex items-center justify-center"
          >
            <X />
          </button>
        </div>
        <SkinPreview skin={preview} />
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-white">{preview.name}</h3>
            <p className="text-xs text-neutral-400">
              {draft ? 'Live preview · save to equip' : preview.tagline}
            </p>
            <p className="text-xs text-cyan-300">
              {preview.finish || 'SATIN'}
              {preview.rarity ? ` · ${preview.rarity}` : ''}
            </p>
          </div>
          <span className="flex items-center gap-1 text-yellow-300 text-sm shrink-0">
            <Coins size={16} />
            {totalCoins.toLocaleString()}
          </span>
        </div>
        {draft ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (onSaveCustomSkin(draft)) {
                setPreviewId(draft.id);
                setDraft(null);
                setMessage(
                  hasStorageFailure()
                    ? 'Runner equipped for this session. Device storage is unavailable.'
                    : 'Runner saved and equipped.',
                );
              } else
                setMessage(
                  'Could not save. Check the name and available slots.',
                );
            }}
          >
            <label className="block text-sm text-white">
              Runner name
              <input
                required
                maxLength={24}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="block w-full rounded-xl bg-neutral-800 px-3 min-h-11 mt-1"
              />
            </label>
            <label className="block text-sm text-white">
              Character
              <select
                aria-label="Character"
                value={draft.avatar || 'CYBER'}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    avatar: e.target.value as Skin['avatar'],
                  })
                }
                className="block w-full bg-neutral-800 rounded-xl min-h-11 px-3 mt-1"
              >
                <option value="STREET">Street runner</option>
                <option value="CYBER">Cyber mascot</option>
              </select>
            </label>
            {draft.avatar === 'STREET' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['outfit', 'Top', ['TEE', 'HOODIE', 'JACKET'], 'TEE'],
                      ['bottom', 'Bottom', ['SHORTS', 'JOGGERS'], 'SHORTS'],
                      [
                        'hair',
                        'Hair style',
                        ['QUIFF', 'CURLS', 'CAP'],
                        'QUIFF',
                      ],
                    ] as const
                  ).map(([key, label, options, fallback]) => (
                    <label key={key} className="text-sm text-white">
                      {label}
                      <select
                        aria-label={label}
                        value={draft[key] || fallback}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.value })
                        }
                        className="block w-full bg-neutral-800 rounded-xl min-h-11 px-2 mt-1"
                      >
                        {options.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['skinTone', 'hairColor', 'shoeColor'] as const).map(
                    (key, index) => (
                      <label key={key} className="text-xs text-neutral-300">
                        {['Skin tone', 'Hair color', 'Shoe color'][index]}
                        <input
                          type="color"
                          aria-label={
                            ['Skin tone', 'Hair color', 'Shoe color'][index]
                          }
                          value={
                            draft[key] ||
                            ['#e8ac82', '#332042', '#f8fafc'][index]
                          }
                          onChange={(e) =>
                            setDraft({ ...draft, [key]: e.target.value })
                          }
                          className="block w-full h-11 mt-1"
                        />
                      </label>
                    ),
                  )}
                </div>
              </>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(['primaryColor', 'secondaryColor', 'glowColor'] as const).map(
                (key, index) => (
                  <label key={key} className="text-xs text-neutral-300">
                    {['Suit color', 'Trim color', 'Glow color'][index]}
                    <input
                      type="color"
                      aria-label={
                        ['Suit color', 'Trim color', 'Glow color'][index]
                      }
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                      className="block w-full h-11 mt-1 cursor-pointer"
                    />
                  </label>
                ),
              )}
            </div>
            {draft.avatar === 'STREET' && (
              <label className="block text-sm text-white">
                Rank accessory
                <select
                  aria-label="Rank accessory"
                  value={draft.accessory || 'NONE'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      accessory: e.target.value as Skin['accessory'],
                    })
                  }
                  className="block w-full bg-neutral-800 rounded-xl min-h-11 px-3 mt-1"
                >
                  {Object.entries(ACCESSORY_RANKS).map(([value, rank]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={progression.level < rank}
                    >
                      {value === 'NONE'
                        ? 'None'
                        : `${value.replace('_', ' ')} · rank ${rank}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm text-white">
              Finish
              <select
                aria-label="Finish"
                value={draft.finish || 'SATIN'}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    finish: e.target.value as Skin['finish'],
                  })
                }
                className="block w-full bg-neutral-800 rounded-xl min-h-11 px-3 mt-1"
              >
                {SKIN_FINISHES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-cyan-300 text-black rounded-xl min-h-11 font-bold"
              >
                Save & equip
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-4 rounded-xl min-h-11 bg-white/10 text-white"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Free · stored on this device · {customCount}/{MAX_CUSTOM_SKINS}{' '}
              custom runners
            </p>
          </form>
        ) : (
          <>
            {selected.unlocked ? (
              <div className="flex gap-2 flex-wrap">
                <button
                  disabled={selected.id === selectedSkinId}
                  onClick={() => onSelectSkin(selected)}
                  className="flex-1 rounded-xl bg-cyan-300 disabled:bg-cyan-950 disabled:text-cyan-200 text-black min-h-11 font-bold flex items-center justify-center gap-1"
                >
                  {selected.id === selectedSkinId ? (
                    <>
                      <Check size={16} />
                      Equipped
                    </>
                  ) : (
                    'Equip'
                  )}
                </button>
                {selected.custom && (
                  <>
                    <button
                      onClick={() => {
                        setDeleteId(null);
                        setDraft({ ...selected });
                        setMessage('');
                      }}
                      className="min-h-11 px-3 bg-white/10 rounded-xl text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(selected.id)}
                      className="min-h-11 px-3 bg-white/10 rounded-xl text-red-300"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div>
                <button
                  disabled={selected.rankOnly || totalCoins < selected.price}
                  onClick={() => onUnlockSkin(selected.id)}
                  className="min-h-11 w-full rounded-xl bg-yellow-300 disabled:bg-neutral-800 disabled:text-neutral-400 text-black font-bold"
                >
                  {selected.rankOnly
                    ? `Earn at rank level ${selected.requiredLevel}`
                    : `Unlock · ${selected.price} coins`}
                </button>
                {selected.requiredLevel && (
                  <p className="text-xs text-neutral-400 mt-2">
                    {selected.rankOnly
                      ? 'Unlocks automatically at rank level'
                      : 'Or unlock free at level'}{' '}
                    {selected.requiredLevel} · current level {progression.level}
                  </p>
                )}
              </div>
            )}
            {deleteId && (
              <div className="mt-3 p-3 rounded-xl bg-red-950 text-white">
                <p>Delete this custom runner? This cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    className="min-h-11 underline"
                    onClick={() => {
                      onDeleteCustomSkin(deleteId);
                      setPreviewId(skins[0].id);
                      setDeleteId(null);
                      setMessage('Custom runner deleted.');
                    }}
                  >
                    Confirm delete
                  </button>
                  <button
                    className="min-h-11 underline"
                    onClick={() => setDeleteId(null)}
                  >
                    Keep runner
                  </button>
                </div>
              </div>
            )}
            <button
              disabled={customCount >= MAX_CUSTOM_SKINS}
              onClick={create}
              className="w-full min-h-11 mt-3 rounded-xl border border-cyan-400 text-cyan-200 disabled:opacity-40"
            >
              Create a runner · {customCount}/{MAX_CUSTOM_SKINS}
            </button>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {skins.map((s) => (
                <button
                  key={s.id}
                  aria-pressed={s.id === selected.id}
                  onClick={() => {
                    setPreviewId(s.id);
                    setDeleteId(null);
                    setMessage('');
                  }}
                  className={`text-left rounded-xl p-3 min-h-20 border ${s.id === selected.id ? 'border-cyan-300 bg-cyan-950/40' : 'border-white/15 bg-neutral-900'}`}
                >
                  <div className="flex gap-1 mb-2" aria-hidden="true">
                    {[s.primaryColor, s.secondaryColor, s.glowColor].map(
                      (c, i) => (
                        <span
                          key={i}
                          className="w-6 h-3 rounded"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                  <span className="block text-sm text-white break-words">
                    {s.name}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {s.custom
                      ? 'Your creation'
                      : s.unlocked
                        ? 'Owned'
                        : s.rankOnly
                          ? `Rank level ${s.requiredLevel} reward`
                          : `${s.price} coins · or level ${s.requiredLevel}`}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <p role="status" className="text-sm text-cyan-200 mt-2">
          {message}
        </p>
      </div>
    </div>
  );
}
