import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Award, Sparkles, Check, Gift } from 'lucide-react';
import { getLevelTitle, LEVEL_MILESTONES } from '../types/progression';
import { sounds } from '../audio/SoundEffects';

interface LevelUpModalProps {
  newLevel: number;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ newLevel, onClose }) => {
  const levelTitle = getLevelTitle(newLevel);
  const milestone = LEVEL_MILESTONES.find((m) => m.level === newLevel);

  useEffect(() => {
    sounds.playPowerUp();
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#06b6d4', '#ec4899', '#facc15', '#ffffff', '#a855f7'],
    });
  }, [newLevel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 select-none animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm bg-neutral-950 border-2 border-yellow-400 rounded-3xl p-6 shadow-[0_0_60px_rgba(250,204,21,0.4)] flex flex-col items-center text-center">
        {/* Banner */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-yellow-400 to-pink-500 flex items-center justify-center shadow-xl animate-bounce mb-3">
          <Award className="w-9 h-9 text-black stroke-[2.5]" />
        </div>

        <span className="text-xs font-arcade font-black text-yellow-400 tracking-widest uppercase">
          RANK ASCENSION
        </span>
        <h2 className="font-arcade text-3xl sm:text-4xl font-black text-white glow-yellow mt-0.5">
          LEVEL {newLevel}!
        </h2>

        <div className="mt-1 px-3 py-1 rounded-full bg-pink-950/60 border border-pink-500/50 text-pink-300 font-arcade font-bold text-xs">
          {levelTitle}
        </div>

        {/* Milestone Reward if any */}
        {milestone ? (
          <div className="w-full mt-4 p-3 rounded-2xl bg-gradient-to-r from-yellow-950/40 via-purple-950/40 to-cyan-950/40 border border-yellow-400/50 flex items-center justify-center gap-2">
            <Gift className="w-5 h-5 text-yellow-400 animate-pulse" />
            <div className="text-left">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">REWARD UNLOCKED</span>
              <span className="text-xs font-arcade font-bold text-yellow-300">{milestone.rewardLabel}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
            Your reaction speed and algorithmic evasion rank has increased!
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full h-13 mt-5 rounded-2xl bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 text-black font-arcade font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(250,204,21,0.5)] cursor-pointer"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>AWESOME!</span>
        </button>
      </div>
    </div>
  );
};
