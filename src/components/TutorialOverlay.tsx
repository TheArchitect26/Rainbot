import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Sparkles, CheckCircle2 } from 'lucide-react';

export interface TutorialState {
  active: boolean;
  step: number; // 1 to 5
  title: string;
  instruction: string;
  completed: boolean;
}

interface TutorialOverlayProps {
  tutorial: TutorialState;
  onSkip: () => void;
  onFinish: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  tutorial,
  onSkip,
  onFinish,
}) => {
  if (!tutorial.active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 pt-safe pb-safe select-none">
      {/* Top Bar: Step progress & Skip CTA */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/85 border border-cyan-400/60 px-3.5 py-1.5 rounded-full shadow-lg">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-arcade text-xs font-bold text-cyan-300 uppercase tracking-wider">
            {tutorial.completed ? 'TRAINING FINISHED' : `TUTORIAL · STEP ${tutorial.step}/5`}
          </span>
        </div>

        {!tutorial.completed && (
          <button
            onClick={onSkip}
            className="bg-black/85 hover:bg-neutral-900 border border-white/20 text-neutral-300 hover:text-white px-3.5 py-1.5 rounded-full text-xs font-arcade font-bold active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            SKIP TUTORIAL
          </button>
        )}
      </div>

      {/* Center Guidance Prompt Banner */}
      <div className="flex flex-col items-center justify-center my-auto w-full px-2">
        {!tutorial.completed ? (
          <div className="bg-black/90 border-2 border-cyan-400 rounded-3xl p-5 shadow-[0_0_35px_rgba(6,182,212,0.4)] text-center max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            {/* Animated Directional Gesture Icon */}
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center mb-3 shadow-inner">
              {tutorial.step === 1 && (
                <div className="flex gap-2 animate-pulse">
                  <ArrowLeft className="w-7 h-7 text-cyan-300 stroke-[3]" />
                  <ArrowRight className="w-7 h-7 text-cyan-300 stroke-[3]" />
                </div>
              )}
              {tutorial.step === 2 && (
                <div className="animate-bounce">
                  <ArrowUp className="w-8 h-8 text-pink-400 stroke-[3]" />
                </div>
              )}
              {tutorial.step === 3 && (
                <div className="animate-bounce">
                  <ArrowDown className="w-8 h-8 text-yellow-400 stroke-[3]" />
                </div>
              )}
              {tutorial.step === 4 && (
                <span className="text-3xl animate-spin">🪙</span>
              )}
              {tutorial.step === 5 && (
                <div className="flex gap-2 animate-pulse">
                  <ArrowLeft className="w-7 h-7 text-purple-400 stroke-[3]" />
                  <ArrowRight className="w-7 h-7 text-purple-400 stroke-[3]" />
                </div>
              )}
            </div>

            <h3 className="font-arcade text-lg sm:text-xl font-black text-white uppercase tracking-wider glow-cyan">
              {tutorial.title}
            </h3>
            <p className="text-xs text-neutral-300 mt-1 font-sans font-medium leading-relaxed max-w-[280px]">
              {tutorial.instruction}
            </p>

            {/* Gesture Hint Footnote */}
            <div className="mt-3 text-[10px] text-cyan-400/90 font-mono tracking-wide uppercase bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-500/20">
              {tutorial.step === 1 && 'Flick finger left or right'}
              {tutorial.step === 2 && 'Flick finger upwards to leap'}
              {tutorial.step === 3 && 'Flick finger downwards to duck'}
              {tutorial.step === 4 && 'Stay aligned with coin stream'}
              {tutorial.step === 5 && 'Flick to switch to the open lane'}
            </div>
          </div>
        ) : (
          /* Tutorial Completion Celebration Card */
          <div className="bg-black/95 border-2 border-yellow-400 rounded-3xl p-6 shadow-[0_0_40px_rgba(250,204,21,0.5)] text-center max-w-sm flex flex-col items-center pointer-events-auto animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-500 flex items-center justify-center mb-3 shadow-xl animate-bounce">
              <CheckCircle2 className="w-9 h-9 text-black stroke-[2.5]" />
            </div>

            <span className="text-xs font-arcade font-black text-yellow-400 uppercase tracking-widest">
              CERTIFIED CYBER SURFER
            </span>
            <h2 className="font-arcade text-2xl sm:text-3xl font-black text-white uppercase glow-yellow mt-0.5">
              TUTORIAL COMPLETE!
            </h2>
            <p className="text-xs text-neutral-300 mt-1.5 font-sans leading-relaxed">
              You mastered the controls! You are ready to outrun the hyperactive algorithm and climb the leaderboards.
            </p>

            <div className="w-full bg-neutral-900 border border-yellow-400/40 rounded-2xl py-2 px-3 mt-3 flex items-center justify-around text-xs">
              <span className="text-yellow-300 font-bold">+100 COINS BONUS</span>
              <span className="text-cyan-300 font-bold">+150 XP AWARDED</span>
            </div>

            <button
              onClick={onFinish}
              className="w-full h-13 mt-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 text-black font-arcade font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer"
            >
              <span>ENTER THE ALGORITHM</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Spacer */}
      <div className="h-6" />
    </div>
  );
};
