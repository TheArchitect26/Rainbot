import { challengeAtDistance, MAX_CHALLENGE_LEVEL } from '../game/challenges';
import React, { useEffect, useState } from 'react';
import {
  ActivePowerUp,
  ChaosState,
  PlayerStats,
  StageInfo,
} from '../types/game';
import { BossState } from '../types/progression';
import {
  Shield,
  Magnet,
  Zap,
  Coins,
  Pause,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface GameHUDProps {
  ranked?: boolean;
  showChallenge?: boolean;
  stats: PlayerStats;
  powerUps: ActivePowerUp[];
  chaos: ChaosState;
  boss?: BossState;
  currentStage?: StageInfo;
  showOnScreenControls: boolean;
  onPause: () => void;
  onControlInput: (action: 'LEFT' | 'RIGHT' | 'JUMP' | 'SLIDE') => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  ranked = false,
  showChallenge = true,
  powerUps,
  chaos,
  boss,
  currentStage,
  showOnScreenControls,
  onPause,
  onControlInput,
}) => {
  const challenge = challengeAtDistance(stats.distance);
  const [stageBanner, setStageBanner] = useState<string | null>(null);

  useEffect(() => {
    if (currentStage && currentStage.startDistance > 0) {
      setStageBanner(`⚡ ${currentStage.name} ⚡`);
      const timer = setTimeout(() => setStageBanner(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStage?.id]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-4 pt-safe pb-safe pl-safe pr-safe z-10">
      {/* Top Header Cluster with Max Legibility */}
      <div className="flex flex-col items-center w-full">
        {showChallenge && (
          <div className="text-center bg-black/90 rounded-lg px-2 py-1 mb-1 max-w-full text-[10px] text-cyan-200">
            <span className="font-bold">
              {ranked ? 'RANKED · ' : ''}CHALLENGE {challenge.level}/
              {MAX_CHALLENGE_LEVEL} · {challenge.name}
            </span>
            <span className="block text-neutral-300 [@media(max-height:500px)]:hidden">
              {challenge.skill}
            </span>
          </div>
        )}
        {/* Main top bar */}
        <div className="flex items-center justify-between w-full">
          {/* Top-Left: Large Pause button */}
          <button
            onClick={onPause}
            className="pointer-events-auto w-12 h-12 rounded-2xl bg-black/80 border-2 border-white/20 text-white active:scale-90 transition-transform shadow-2xl flex items-center justify-center cursor-pointer hover:border-cyan-400"
            aria-label="Pause Game"
          >
            <Pause className="w-5 h-5 text-cyan-300 fill-cyan-300" />
          </button>

          {/* Top-Center: Distance score & Current Stage */}
          <div className="flex flex-col items-center">
            {/* Zone Tag */}
            {currentStage && (
              <span
                className="text-[10px] font-arcade font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-black/85 border mb-0.5"
                style={{
                  color: currentStage.themeColor,
                  borderColor: `${currentStage.themeColor}88`,
                }}
              >
                {currentStage.name}
              </span>
            )}

            <div className="bg-black/85 border-2 border-cyan-400/50 px-5 py-1.5 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.35)] flex items-baseline gap-1.5">
              <span className="font-arcade text-3xl sm:text-4xl font-black text-white tabular-nums tracking-wider text-stroke-thick glow-cyan">
                {stats.distance}
              </span>
              <span className="text-sm font-black text-cyan-400 uppercase tracking-widest font-arcade">
                m
              </span>
            </div>

            <div className="mt-0.5 text-xs font-mono text-yellow-300 font-black tracking-wider bg-black/70 px-2 py-0.2 rounded-md">
              SCORE: {stats.score.toLocaleString()}
            </div>
          </div>

          {/* Top-Right: Coins collected */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-black/85 border-2 border-yellow-400/50 px-3.5 py-2 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.3)]">
            <span className="text-lg">🪙</span>
            <span className="font-arcade text-xl sm:text-2xl font-black text-yellow-300 tabular-nums glow-yellow">
              {stats.coins}
            </span>
          </div>
        </div>

        {/* Stage Transition Milestone Toast */}
        {stageBanner && (
          <div className="mt-2.5 animate-bounce bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 border-2 border-white px-5 py-2 rounded-2xl shadow-2xl text-center">
            <span className="text-sm font-arcade font-black text-white uppercase tracking-wider drop-shadow-md">
              {stageBanner}
            </span>
          </div>
        )}

        {/* Active Power-up indicators directly below score */}
        {powerUps.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-2 pointer-events-none flex-wrap max-w-sm">
            {powerUps.map((pu) => {
              let label = 'SHIELD';
              let icon = <Shield className="w-3.5 h-3.5 text-cyan-300" />;
              let borderColor = 'border-cyan-400';
              let textColor = 'text-cyan-300';
              let progressColor = '#22d3ee';

              if (pu.type === 'MAGNET') {
                label = 'MAGNET';
                icon = <Magnet className="w-3.5 h-3.5 text-pink-300" />;
                borderColor = 'border-pink-400';
                textColor = 'text-pink-300';
                progressColor = '#f472b6';
              } else if (pu.type === 'SPEED_BOOST') {
                label = 'RUSH';
                icon = <Zap className="w-3.5 h-3.5 text-yellow-300" />;
                borderColor = 'border-yellow-400';
                textColor = 'text-yellow-300';
                progressColor = '#facc15';
              } else if (pu.type === 'DOUBLE_COINS') {
                label = '2X COINS';
                icon = <Coins className="w-3.5 h-3.5 text-purple-300" />;
                borderColor = 'border-purple-400';
                textColor = 'text-purple-300';
                progressColor = '#c084fc';
              }

              return (
                <div
                  key={pu.type}
                  className={`bg-black/90 border-2 ${borderColor} px-3 py-1 rounded-xl flex flex-col items-center shadow-2xl min-w-[76px]`}
                >
                  <div className="flex items-center gap-1.5">
                    {icon}
                    <span
                      className={`text-[11px] font-black uppercase font-arcade ${textColor}`}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] font-mono text-white font-black tabular-nums">
                      {Math.ceil(pu.timeLeft)}s
                    </span>
                  </div>
                  <div className="w-full bg-white/20 h-1 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full transition-all duration-100 ease-linear rounded-full"
                      style={{
                        width: `${(pu.timeLeft / pu.duration) * 100}%`,
                        backgroundColor: progressColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chaos Event Telegraph (2s warning) */}
        {chaos.warningTimeLeft > 0 && (
          <div className="animate-pulse bg-red-600 border-2 border-white text-white px-4 py-1.5 rounded-2xl shadow-2xl text-center mt-2 max-w-[300px]">
            <span className="text-xs font-arcade font-black tracking-widest uppercase flex items-center justify-center gap-1.5 drop-shadow">
              ⚠️ {chaos.nextWarningType?.replace('_', ' ')} IN{' '}
              {chaos.warningTimeLeft.toFixed(1)}s
            </span>
          </div>
        )}

        {/* Chaos Active Banner */}
        {chaos.active && (
          <div
            className="bg-black/90 border-2 px-3.5 py-2 rounded-2xl shadow-2xl text-center flex flex-col items-center w-full max-w-[300px] mt-2"
            style={{ borderColor: chaos.accentColor }}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className="text-xs font-arcade font-black tracking-wider uppercase text-stroke-thick"
                style={{ color: chaos.accentColor }}
              >
                ⚡ {chaos.name}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/20 text-white tabular-nums">
                {Math.ceil(chaos.timeLeft)}s
              </span>
            </div>
            <p className="text-[11px] text-neutral-200 truncate max-w-[280px] mt-0.5 font-medium">
              {chaos.description}
            </p>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full transition-all duration-100 ease-linear rounded-full"
                style={{
                  width: `${(chaos.timeLeft / chaos.duration) * 100}%`,
                  backgroundColor: chaos.accentColor,
                }}
              />
            </div>
          </div>
        )}

        {/* Algorithm Boss Encounter Active Banner */}
        {boss?.active && (
          <div className="w-full max-w-[320px] mt-2 bg-black/95 border-2 border-red-500 rounded-2xl p-2.5 shadow-[0_0_25px_rgba(239,68,68,0.5)] flex flex-col items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[11px] font-arcade font-black text-red-400 tracking-wider uppercase">
                  {boss.name}
                </span>
              </div>
              <span className="text-[10px] font-mono font-black text-yellow-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-500/40">
                PHASE {boss.phase}/{boss.maxPhase}
              </span>
            </div>

            {/* Boss Encounter Survival Bar */}
            <div className="w-full bg-neutral-900 h-2 rounded-full mt-1.5 overflow-hidden border border-red-500/30">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-pink-500 transition-all duration-100 ease-linear rounded-full"
                style={{
                  width: `${(boss.timeLeft / boss.duration) * 100}%`,
                }}
              />
            </div>

            {/* Boss Attack Telegraph */}
            {boss.telegraph && (
              <div className="mt-1.5 px-2.5 py-0.5 rounded bg-red-600 text-white font-arcade font-black text-[10px] uppercase tracking-wider animate-bounce">
                {boss.telegraph}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle and lower viewport is completely unobstructed */}
      <div className="flex-1" />

      {/* Optional on-screen touch control buttons for accessibility */}
      {showOnScreenControls && (
        <div className="w-full flex items-end justify-between pointer-events-none pb-2">
          {/* Steer buttons */}
          <div className="pointer-events-auto flex gap-2.5">
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onControlInput('LEFT');
              }}
              onClick={() => onControlInput('LEFT')}
              className="w-14 h-14 rounded-2xl bg-black/75 active:bg-cyan-500/60 border-2 border-cyan-400/60 flex items-center justify-center text-white active:scale-90 transition-transform shadow-2xl"
              aria-label="Steer Left"
            >
              <ArrowLeft className="w-7 h-7 text-cyan-300 stroke-[2.5]" />
            </button>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onControlInput('RIGHT');
              }}
              onClick={() => onControlInput('RIGHT')}
              className="w-14 h-14 rounded-2xl bg-black/75 active:bg-cyan-500/60 border-2 border-cyan-400/60 flex items-center justify-center text-white active:scale-90 transition-transform shadow-2xl"
              aria-label="Steer Right"
            >
              <ArrowRight className="w-7 h-7 text-cyan-300 stroke-[2.5]" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="pointer-events-auto flex gap-2.5">
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onControlInput('SLIDE');
              }}
              onClick={() => onControlInput('SLIDE')}
              className="w-14 h-14 rounded-2xl bg-black/75 active:bg-yellow-500/60 border-2 border-yellow-400/60 flex items-center justify-center text-white active:scale-90 transition-transform shadow-2xl"
              aria-label="Slide Duck"
            >
              <ArrowDown className="w-7 h-7 text-yellow-300 stroke-[2.5]" />
            </button>
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onControlInput('JUMP');
              }}
              onClick={() => onControlInput('JUMP')}
              className="w-14 h-14 rounded-2xl bg-black/75 active:bg-pink-500/60 border-2 border-pink-400/60 flex items-center justify-center text-white active:scale-90 transition-transform shadow-2xl"
              aria-label="Jump Up"
            >
              <ArrowUp className="w-7 h-7 text-pink-300 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
