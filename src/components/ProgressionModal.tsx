import React from 'react';
import { X, Award, Sparkles, CheckCircle2, Lock, Gift, Coins } from 'lucide-react';
import { getLevelTitle, getXPRequiredForLevel, LEVEL_MILESTONES, PlayerProgression } from '../types/progression';

interface ProgressionModalProps {
  progression: PlayerProgression;
  onClose: () => void;
  onClaimMilestone?: (milestoneLevel: number) => void;
}

export const ProgressionModal: React.FC<ProgressionModalProps> = ({
  progression,
  onClose,
}) => {
  const levelTitle = getLevelTitle(progression.level);
  const xpPct = Math.min(100, Math.floor((progression.currentXP / progression.xpToNextLevel) * 100));

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 pt-safe pb-safe bg-black/85 select-none">
      <div className="w-full max-w-md bg-neutral-950 border border-cyan-400/50 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="font-arcade text-xl font-black text-white tracking-wider uppercase">
                RUNNER RANK & XP
              </h2>
              <span className="text-[10px] text-cyan-400 font-mono font-bold tracking-wide">
                100% FREE PROGRESSION · NO PAYMENTS
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level & XP Hero Card */}
        <div className="my-3 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-purple-950/60 to-pink-950/60 border border-cyan-400/40 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-neutral-400 font-bold uppercase font-arcade">LEVEL</span>
              <span className="font-arcade text-4xl font-black text-white glow-cyan tabular-nums">
                {progression.level}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-arcade font-bold text-pink-400 uppercase tracking-wider block">
                {levelTitle}
              </span>
              <span className="text-[10px] font-mono text-neutral-300">
                Total XP: {progression.totalXP.toLocaleString()}
              </span>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-neutral-300 mb-1">
              <span>Next Level XP</span>
              <span className="text-cyan-300 font-bold tabular-nums">
                {progression.currentXP} / {progression.xpToNextLevel} XP ({xpPct}%)
              </span>
            </div>
            <div className="w-full bg-black/60 h-3 rounded-full border border-white/10 overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Milestone Rewards Timeline */}
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-arcade font-bold text-neutral-300 tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> MILESTONE REWARDS
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">AUTOMATIC ON LEVEL-UP</span>
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto py-1 pr-1">
          {LEVEL_MILESTONES.map((m) => {
            const isReached = progression.level >= m.level;

            return (
              <div
                key={m.level}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  isReached
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-white/10 bg-neutral-900/60 opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-arcade font-black text-sm ${
                      isReached ? 'bg-emerald-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    L{m.level}
                  </div>
                  <div>
                    <h4 className="font-arcade font-bold text-xs text-white">{m.title}</h4>
                    <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                      {m.rewardType === 'COINS' ? (
                        <>
                          <Coins className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400 font-bold">{m.rewardLabel}</span>
                        </>
                      ) : (
                        <>
                          <Gift className="w-3 h-3 text-pink-400" />
                          <span className="text-pink-300 font-bold">{m.rewardLabel}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  {isReached ? (
                    <span className="text-[11px] font-arcade font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> REACH L{m.level}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
