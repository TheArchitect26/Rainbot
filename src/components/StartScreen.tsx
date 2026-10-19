import React from 'react';
import { Play, Sparkles, Settings as SettingsIcon, Gift, Trophy, Download, Award, Calendar } from 'lucide-react';
import { Skin } from '../types/game';
import { getLevelTitle, PlayerProgression } from '../types/progression';
import { getUTCDayString } from '../utils/prng';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface StartScreenProps {
  highScore: number;
  dailyChallengeBest: number;
  totalCoins: number;
  selectedSkin: Skin;
  progression: PlayerProgression;
  unclaimedMissionsCount: number;
  isTutorialCompleted?: boolean;
  onStart: () => void;
  onStartDailyChallenge: () => void;
  onStartTutorial?: () => void;
  onOpenSkins: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
  onOpenProgression: () => void;
  onOpenDiagnostics?: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  dailyChallengeBest,
  totalCoins,
  selectedSkin,
  progression,
  unclaimedMissionsCount,
  isTutorialCompleted,
  onStart,
  onStartDailyChallenge,
  onStartTutorial,
  onOpenSkins,
  onOpenMissions,
  onOpenSettings,
  onOpenProgression,
  onOpenDiagnostics,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const todayStr = getUTCDayString();
  const levelTitle = getLevelTitle(progression.level);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-4 pt-safe pb-safe pl-safe pr-safe select-none pointer-events-none">
      {/* Top Header: Rank, Coins & Modals */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        {/* Left: Player Level & Rank Badge (Clickable to open Progression) */}
        <button
          onClick={onOpenProgression}
          className="flex items-center gap-2 bg-black/75 border border-cyan-400/40 hover:border-cyan-400 px-3 py-1.5 rounded-2xl shadow-xl active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-pink-500 flex items-center justify-center font-arcade font-black text-black text-sm shadow">
            {progression.level}
          </div>
          <div className="text-left">
            <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider block leading-none">
              {levelTitle}
            </span>
            <span className="text-[10px] font-mono text-neutral-300 tabular-nums">
              {progression.currentXP}/{progression.xpToNextLevel} XP
            </span>
          </div>
        </button>

        {/* Center/Right: Coins & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Coins Wallet */}
          <div className="flex items-center gap-1.5 bg-black/75 border border-yellow-400/40 px-3 py-1.5 rounded-2xl shadow-xl">
            <span className="text-base">🪙</span>
            <span className="font-arcade text-base sm:text-lg font-black text-yellow-400 tabular-nums">
              {totalCoins.toLocaleString()}
            </span>
          </div>

          {/* Missions Button with notification badge */}
          <button
            onClick={onOpenMissions}
            className="relative p-2.5 rounded-2xl bg-black/75 border border-pink-400/40 hover:border-pink-400 text-white active:scale-90 transition-transform shadow-xl cursor-pointer"
            aria-label="Daily Missions"
          >
            <Gift className="w-5 h-5 text-pink-400" />
            {unclaimedMissionsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce">
                {unclaimedMissionsCount}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-2xl bg-black/75 border border-white/15 hover:border-white/30 text-white active:scale-90 transition-transform shadow-xl cursor-pointer"
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5 text-neutral-300" />
          </button>
        </div>
      </div>

      {/* Middle: 3D mascot is shown in live animated showcase pose */}
      <div className="my-auto flex flex-col items-center justify-center pointer-events-none" />

      {/* Bottom Control & Play Section */}
      <div className="flex flex-col items-center w-full max-w-sm mx-auto gap-2.5 pointer-events-auto pb-1">
        {/* Bespoke Mobile SVG Title Lockup */}
        <div className="w-full px-2">
          <svg viewBox="0 0 500 130" className="w-full h-auto drop-shadow-[0_0_25px_rgba(6,182,212,0.6)]">
            <defs>
              <linearGradient id="mobileTitleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="40%" stopColor="#ffffff" />
                <stop offset="75%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#facc15" />
              </linearGradient>
            </defs>

            <text
              x="50%"
              y="65"
              textAnchor="middle"
              className="font-arcade font-black text-5xl sm:text-6xl fill-[#ec4899] opacity-75"
              transform="translate(2, 3)"
            >
              BRAINROT RUN
            </text>

            <text
              x="50%"
              y="65"
              textAnchor="middle"
              fill="url(#mobileTitleGrad)"
              className="font-arcade font-black text-5xl sm:text-6xl"
              stroke="#000"
              strokeWidth="2.5"
            >
              BRAINROT RUN
            </text>

            <rect x="90" y="88" width="320" height="28" rx="6" fill="#000000" stroke="#06b6d4" strokeWidth="1.5" />
            <text
              x="50%"
              y="107"
              textAnchor="middle"
              className="font-mono text-xs tracking-[0.25em] font-extrabold fill-cyan-400 uppercase"
            >
              ESCAPE THE ALGORITHM
            </text>
          </svg>
        </div>

        {/* Primary Action Buttons: Play Run & Daily Challenge */}
        <div className="flex flex-col gap-2 w-full">
          {/* Main Endless Run Button */}
          <button
            onClick={onStart}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 text-black font-arcade font-black text-xl uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(6,182,212,0.6)] active:scale-95 transition-all cursor-pointer hover:brightness-110"
          >
            <Play className="w-5 h-5 fill-black stroke-black" />
            <span>PLAY RUN</span>
            <span className="text-xs font-mono font-bold bg-black/20 px-2 py-0.5 rounded-lg ml-1">
              BEST: {highScore.toLocaleString()}
            </span>
          </button>

          {/* Daily Challenge Seeded Mode Button */}
          <button
            onClick={onStartDailyChallenge}
            className="w-full h-12 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border-2 border-yellow-400/50 text-white font-arcade font-black text-sm uppercase tracking-wider flex items-center justify-between px-4 active:scale-95 transition-all cursor-pointer shadow-lg group"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-400 group-hover:rotate-12 transition-transform" />
              <span>DAILY CHALLENGE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-yellow-300 font-bold bg-yellow-950/60 border border-yellow-400/40 px-2 py-0.5 rounded-md">
                {todayStr}
              </span>
              <span className="text-[11px] font-mono text-neutral-300 tabular-nums">
                BEST: {dailyChallengeBest.toLocaleString()}
              </span>
            </div>
          </button>
        </div>

        {/* Secondary Buttons Row: Skins, Rank & Install */}
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={onOpenSkins}
            className="flex-1 py-2 px-2.5 rounded-xl bg-black/75 border border-cyan-500/40 hover:border-cyan-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">Skin: {selectedSkin.name}</span>
          </button>

          <button
            onClick={onOpenProgression}
            className="flex-1 py-2 px-2.5 rounded-xl bg-black/75 border border-purple-500/40 hover:border-purple-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
          >
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span>Rank & Rewards</span>
          </button>

          {!isInstalled && isInstallable && (
            <button
              onClick={() => install()}
              className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-pink-900/60 to-purple-900/60 border border-pink-400/40 text-pink-300 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shadow-md shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-pink-400" />
              <span>Install</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
