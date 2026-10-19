import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToMenu: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onQuitToMenu,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div role="dialog" aria-modal="true" aria-label="Paused" className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="w-full max-w-sm bg-neutral-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        <h2 className="font-arcade text-3xl font-black text-cyan-400 tracking-wider uppercase mb-1">
          GAME PAUSED
        </h2>
        <p className="text-neutral-400 text-xs mb-6">Algorithm suspended</p>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-black font-arcade font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>RESUME RUN</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTART</span>
          </button>

          <button
            onClick={onToggleMute}
            className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            <span>SOUND: {isMuted ? 'OFF' : 'ON'}</span>
          </button>

          <button
            onClick={onQuitToMenu}
            className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-400 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-1"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>
        </div>

        <span className="text-[11px] text-neutral-400 font-mono mt-4">
          PRESS <span className="text-cyan-400 font-bold">ESC</span> TO RESUME
        </span>
      </div>
    </div>
  );
};
