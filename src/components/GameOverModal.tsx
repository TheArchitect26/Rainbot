import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Trophy, Coins, Zap, Share2, Sparkles, Check, Home, Award, ShieldAlert } from 'lucide-react';
import { PlayerStats, Skin } from '../types/game';
import { PlayerProgression, XPGainBreakdown } from '../types/progression';

interface GameOverModalProps {
  stats: PlayerStats;
  isNewHigh: boolean;
  selectedSkin: Skin;
  dailyChallengeBest?: number;
  xpBreakdown?: XPGainBreakdown;
  progression?: PlayerProgression;
  eliminationCause?: string;
  onRestart: () => void;
  onOpenSkins: () => void;
  onQuitToMenu?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  isNewHigh,
  selectedSkin: _selectedSkin,
  dailyChallengeBest = 0,
  xpBreakdown,
  progression,
  eliminationCause,
  onRestart,
  onOpenSkins,
  onQuitToMenu,
}) => {
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    if (isNewHigh) {
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#06b6d4', '#ec4899', '#facc15', '#ffffff', '#a855f7'],
      });
    }
  }, [isNewHigh]);

  const handleShareScore = async () => {
    const modeLabel = stats.isDailyChallenge ? "today's Seeded Daily Challenge" : 'BRAINROT RUN';
    const shareText = `I ran ${stats.distance}m and scored ${stats.score.toLocaleString()} PTS in ${modeLabel}! Can you escape the algorithm?`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BRAINROT RUN: Escape the Algorithm',
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2400);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Game over" className="absolute inset-0 z-30 flex items-center justify-center p-4 pt-safe pb-safe bg-black/85 select-none overflow-y-auto">
      <div className="w-full max-w-sm bg-neutral-950 border-2 border-red-500/50 rounded-3xl p-5 shadow-[0_0_50px_rgba(239,68,68,0.3)] flex flex-col items-center text-center my-auto">
        {/* Mode Tag */}
        {stats.isDailyChallenge ? (
          <div className="bg-pink-600/30 border border-pink-400 text-pink-300 text-[10px] font-arcade font-black px-3 py-0.5 rounded-full uppercase tracking-wider mb-1">
            📅 SEEDED DAILY CHALLENGE
          </div>
        ) : null}

        {/* Banner */}
        <div className="text-red-500 font-arcade font-black text-2xl sm:text-3xl tracking-wider uppercase drop-shadow-md">
          ALGORITHM CAUGHT YOU!
        </div>
        <p className="text-neutral-400 text-xs mt-0.5">
          Attention span drained · Feed refreshed
        </p>

        {eliminationCause && (
          <div className="mt-1 px-2.5 py-0.5 rounded-full bg-red-950/70 border border-red-500/30 text-[10px] text-red-300 font-mono font-bold tracking-wider uppercase">
            ⚡ Hazard: {eliminationCause.replace('_', ' ')}
          </div>
        )}

        {/* New Personal Best celebration */}
        {isNewHigh && (
          <div className="mt-3 bg-gradient-to-r from-yellow-500/30 via-pink-500/30 to-cyan-500/30 border border-yellow-400 px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg animate-bounce">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-arcade font-black text-yellow-300 tracking-wider">
              {stats.isDailyChallenge ? 'NEW DAILY BEST!' : 'NEW PERSONAL BEST!'}
            </span>
          </div>
        )}

        {/* Main Stats Summary Cards */}
        <div className="grid grid-cols-2 gap-2.5 w-full mt-3.5">
          <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-2.5 flex flex-col items-center">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">DISTANCE</span>
            <span className="font-arcade text-2xl font-black text-cyan-400 tabular-nums">
              {stats.distance}
              <span className="text-xs font-normal text-cyan-500 ml-0.5">m</span>
            </span>
          </div>

          <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-2.5 flex flex-col items-center">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">SCORE</span>
            <span className="font-arcade text-2xl font-black text-yellow-400 tabular-nums">
              {stats.score.toLocaleString()}
            </span>
          </div>

          <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-2.5 flex flex-col items-center">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Coins className="w-3 h-3 text-yellow-400" /> COINS
            </span>
            <span className="font-arcade text-xl font-bold text-yellow-400 tabular-nums">
              +{stats.coins}
            </span>
          </div>

          <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-2.5 flex flex-col items-center">
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-pink-400" /> CHAOS SURVIVED
            </span>
            <span className="font-arcade text-xl font-bold text-pink-400 tabular-nums">
              {stats.chaosSurvived}
            </span>
          </div>
        </div>

        {/* Boss and Dodge Counters if any */}
        {(stats.bossDefeated || 0) > 0 || (stats.obstaclesDodged || 0) > 0 ? (
          <div className="grid grid-cols-2 gap-2 w-full mt-2">
            {(stats.bossDefeated || 0) > 0 && (
              <div className="bg-red-950/60 border border-red-500/40 rounded-xl py-1 px-2 flex items-center justify-center gap-1.5 text-[10px] text-red-300 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>BOSS OVERCOME!</span>
              </div>
            )}
            {(stats.obstaclesDodged || 0) > 0 && (
              <div className="bg-neutral-900 border border-white/10 rounded-xl py-1 px-2 flex items-center justify-center gap-1 text-[10px] text-cyan-300 font-bold col-span-1">
                <span>DODGED: {stats.obstaclesDodged}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* XP Gain Breakdown Banner */}
        {xpBreakdown && (
          <div className="w-full bg-neutral-900/95 border border-cyan-400/40 rounded-2xl p-2.5 mt-2.5 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-arcade font-bold text-white uppercase tracking-wider">
                  XP EARNED
                </span>
              </div>
              <span className="font-arcade font-black text-sm text-cyan-300 tabular-nums">
                +{xpBreakdown.totalRunXP} XP
              </span>
            </div>

            {progression && (
              <div className="mt-1.5">
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                  <span>Level {progression.level}</span>
                  <span>{progression.currentXP} / {progression.xpToNextLevel} XP</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-0.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (progression.currentXP / progression.xpToNextLevel) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* All-time record or Daily best badge */}
        <div className="w-full bg-neutral-900 border border-cyan-500/20 rounded-xl py-1.5 px-3.5 mt-2.5 flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            {stats.isDailyChallenge ? "Today's Daily Best:" : 'All-Time Best:'}
          </span>
          <span className="font-arcade font-bold text-cyan-400 tabular-nums">
            {(stats.isDailyChallenge ? dailyChallengeBest : stats.highScore).toLocaleString()} PTS
          </span>
        </div>

        {/* Large Touch-friendly PLAY AGAIN CTA Button */}
        <div className="flex flex-col gap-2 w-full mt-3.5">
          <button
            onClick={onRestart}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 text-black font-arcade font-black text-lg uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(6,182,212,0.5)] cursor-pointer"
          >
            <RotateCcw className="w-5 h-5 stroke-[2.5]" />
            <span>PLAY AGAIN</span>
          </button>

          {/* Secondary buttons: Share score, Skins & Menu */}
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={handleShareScore}
              className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              {copiedToast ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-cyan-400" />}
              <span>{copiedToast ? 'COPIED!' : 'SHARE'}</span>
            </button>

            <button
              onClick={onOpenSkins}
              className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>SKINS</span>
            </button>

            {onQuitToMenu && (
              <button
                onClick={onQuitToMenu}
                className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-xs font-bold flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-md"
                aria-label="Back to Menu"
              >
                <Home className="w-4 h-4 text-neutral-300" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
