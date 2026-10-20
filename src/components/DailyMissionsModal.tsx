import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Gift, Coins, Award, Clock } from 'lucide-react';
import { DailyMission } from '../types/missions';
import { formatCountdown, getSecondsUntilUTCMidnight } from '../utils/prng';
import { sounds } from '../audio/SoundEffects';

interface DailyMissionsModalProps {
  missions: DailyMission[];
  onClaim: (missionId: string) => void;
  onClose: () => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  missions,
  onClaim,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilUTCMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(getSecondsUntilUTCMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Daily missions" className="absolute inset-0 z-40 flex items-center justify-center p-4 pt-safe pb-safe bg-black/85 select-none">
      <div className="w-full max-w-md bg-neutral-950 border border-cyan-400/50 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-pink-400" />
            <div>
              <h2 className="font-arcade text-xl font-black text-white tracking-wider uppercase">
                DAILY MISSIONS
              </h2>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>RESETS IN {formatCountdown(secondsLeft)} UTC</span>
              </div>
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

        {/* Mission List */}
        <div className="flex flex-col gap-3 overflow-y-auto py-3 pr-1">
          {missions.map((mission) => {
            const isCompleted = mission.current >= mission.target;
            const progressPct = Math.min(100, Math.floor((mission.current / mission.target) * 100));

            return (
              <div
                key={mission.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  mission.claimed
                    ? 'border-white/5 bg-neutral-900/30 opacity-60'
                    : isCompleted
                    ? 'border-pink-500/70 bg-pink-950/20 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                    : 'border-white/10 bg-neutral-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-arcade font-bold text-sm text-white flex items-center gap-1.5">
                      {mission.title}
                      {mission.claimed && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />
                      )}
                    </h3>
                    <p className="text-xs text-neutral-300 mt-0.5">{mission.description}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-lg">
                      <Coins className="w-3 h-3 text-yellow-400" />
                      <span className="font-arcade font-bold text-xs text-yellow-400">
                        +{mission.rewardCoins}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-lg">
                      <Award className="w-3 h-3 text-cyan-400" />
                      <span className="font-arcade font-bold text-[10px] text-cyan-300">
                        +{mission.rewardXP} XP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar & Claim button */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Progress</span>
                      <span className="text-white font-bold tabular-nums">
                        {mission.current} / {mission.target}
                      </span>
                    </div>
                    <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {mission.claimed ? (
                    <span className="text-[11px] font-bold text-neutral-500 px-3 py-1 font-mono uppercase">
                      CLAIMED
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        sounds.playCoin();
                        onClaim(mission.id);
                      }}
                      disabled={!isCompleted}
                      className={`px-4 py-1.5 rounded-xl text-xs font-arcade font-black uppercase tracking-wider transition-all ${
                        isCompleted
                          ? 'bg-gradient-to-r from-pink-500 to-yellow-400 text-black shadow-lg hover:brightness-110 active:scale-95 cursor-pointer animate-pulse'
                          : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      CLAIM
                    </button>
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
