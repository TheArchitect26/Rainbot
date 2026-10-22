import { challengeAtDistance, MAX_CHALLENGE_LEVEL } from '../game/challenges';
import React, { useEffect, useState } from 'react';
import { ActivePowerUp, ChaosState, PlayerStats, StageInfo } from '../types/game';
import { BossState } from '../types/progression';
import { Pause, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';

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
const POWER_LABELS = { SHIELD: 'SHIELD', MAGNET: 'MAGNET', SPEED_BOOST: 'RUSH', DOUBLE_COINS: '2× COINS' };

export const GameHUD: React.FC<GameHUDProps> = ({ stats, ranked = false, showChallenge = true,
  powerUps, chaos, boss, currentStage, showOnScreenControls, onPause, onControlInput }) => {
  const challenge = challengeAtDistance(stats.distance);
  const [stageBanner, setStageBanner] = useState<string | null>(null);
  useEffect(() => {
    if (!currentStage || currentStage.startDistance === 0) { setStageBanner(null); return; }
    setStageBanner(currentStage.name);
    const timer = setTimeout(() => setStageBanner(null), 2500);
    return () => clearTimeout(timer);
  }, [currentStage?.id]);
  // One announcement owns the space. Boss warnings always take precedence.
  const announcement = boss?.active ? boss.telegraph || `SURVIVE · ${Math.ceil(boss.timeLeft)}s`
    : chaos.warningTimeLeft > 0 ? `${chaos.nextWarningType?.replaceAll('_', ' ')} · ${chaos.warningTimeLeft.toFixed(1)}s`
    : chaos.active ? `${chaos.name} · ${Math.ceil(chaos.timeLeft)}s`
    : stageBanner;
  const controls = [
    { action: 'LEFT', name: 'Steer Left', Icon: ArrowLeft },
    { action: 'RIGHT', name: 'Steer Right', Icon: ArrowRight },
    { action: 'SLIDE', name: 'Slide Duck', Icon: ArrowDown },
    { action: 'JUMP', name: 'Jump Up', Icon: ArrowUp },
  ] as const;
  return (
    <div className="game-hud absolute inset-0 pointer-events-none select-none p-3 pt-safe pb-safe pl-safe pr-safe z-10">
      <div className="hud-header">
        <button onClick={onPause} className="hud-pause pointer-events-auto rounded-xl bg-black/80 border border-white/25 flex items-center justify-center text-cyan-200" aria-label="Pause Game"><Pause size={21} /></button>
        <div className="hud-score text-center min-w-0">
          {showChallenge && <div className="hud-challenge text-cyan-100 font-bold">{ranked ? 'RANKED · ' : ''}CHALLENGE {challenge.level}/{MAX_CHALLENGE_LEVEL}<span className="hud-detail"> · {challenge.name}</span></div>}
          <div className="hud-distance font-arcade font-black text-white tabular-nums">{stats.distance.toLocaleString()}<span className="text-xs ml-1 text-cyan-200">m</span></div>
          <div className="hud-detail text-[10px] text-neutral-300">SCORE {stats.score.toLocaleString()}</div>
        </div>
        <div className="hud-wallet rounded-xl bg-black/80 border border-yellow-300/30 px-2 py-2 text-yellow-200 text-sm font-bold tabular-nums" aria-label={`${stats.coins} coins`}>◈ {stats.coins}</div>
      </div>
      {announcement && <div className={`hud-announcement ${boss?.active ? 'hud-boss' : ''}`} role="status">
        {boss?.active && <span className="hud-boss-phase">PHASE {boss.phase}/{boss.maxPhase} · {Math.ceil(boss.timeLeft)}s</span>}
        <span>{announcement}</span>
      </div>}
      {powerUps.length > 0 && <div className="hud-powers">{powerUps.map(power => <span key={power.type}>{POWER_LABELS[power.type]} {Math.ceil(power.timeLeft)}s</span>)}</div>}
      {showOnScreenControls && <div className="hud-controls">{controls.map(({ action, name, Icon }, index) => <button key={action}
        onTouchStart={event => { event.preventDefault(); onControlInput(action); }}
        onClick={() => onControlInput(action)} aria-label={name}
        className={`pointer-events-auto flex items-center justify-center rounded-xl border bg-black/70 text-cyan-100 active:bg-cyan-700 ${index === 2 ? 'hud-control-action' : ''}`}><Icon size={25} /></button>)}</div>}
    </div>
  );
};
