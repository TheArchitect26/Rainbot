import { BUILD_INFO } from '../utils/buildInfo';
import React, { useState, useEffect } from 'react';
import { X, Activity, Cpu, ShieldCheck, Copy, Check, RotateCcw, AlertTriangle, Eye } from 'lucide-react';
import { DiagnosticsData, localAnalytics } from '../utils/analytics';

interface DiagnosticsModalProps {
  debugHitboxes: boolean;
  onToggleDebugHitboxes: (enabled: boolean) => void;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  debugHitboxes,
  onToggleDebugHitboxes,
  onClose,
}) => {
  const [data, setData] = useState<DiagnosticsData>(() => localAnalytics.getDiagnostics());
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => { const timer = window.setInterval(() => setData(localAnalytics.getDiagnostics()), 1000); return () => clearInterval(timer); }, []);

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(localAnalytics.exportJSON());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError('Clipboard unavailable. Export from a secure browser context.');
    }
  };

  const handleReset = () => {
    if (confirm('Reset all local diagnostics counters? (High score and coins will be preserved).')) {
      localAnalytics.resetDiagnostics();
      setData(localAnalytics.getDiagnostics());
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Diagnostics" className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe bg-black/90 select-none">
      <div className="w-full max-w-lg bg-neutral-950 border-2 border-cyan-400/60 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="text-[10px] text-neutral-400 font-mono">v{BUILD_INFO.version} · {BUILD_INFO.commit} · {BUILD_INFO.rules}</div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="font-arcade text-xl font-black text-white tracking-wider uppercase">
                DEV DIAGNOSTICS
              </h2>
              <span className="text-[10px] text-cyan-300 font-mono">
                PRIVACY-FIRST · 100% LOCAL DEVICE STORAGE
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
          {/* Performance Card */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-arcade text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                <Cpu className="w-4 h-4 text-cyan-400" /> FRAME PERFORMANCE
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {data.fpsMetrics.samples} SAMPLES
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">AVG FPS</span>
                <span className="font-arcade text-lg font-black text-emerald-400 tabular-nums">
                  {data.fpsMetrics.avgFps || 60}
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">MIN FPS</span>
                <span className="font-arcade text-lg font-black text-yellow-400 tabular-nums">
                  {data.fpsMetrics.minFps || 60}
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">&gt;33MS DROPS</span>
                <span className="font-arcade text-lg font-black text-pink-400 tabular-nums">
                  {data.fpsMetrics.spikes30}
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">&gt;50MS JANK</span>
                <span className="font-arcade text-lg font-black text-red-400 tabular-nums">
                  {data.fpsMetrics.spikes50}
                </span>
              </div>
            </div>
          </div>

          {/* Player Behavior Card */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3.5">
            <span className="font-arcade text-xs font-bold text-white block mb-2 uppercase">
              RUNS & PLAYER BEHAVIOR
            </span>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">TOTAL RUNS</span>
                <span className="font-arcade text-base font-black text-white tabular-nums">
                  {data.totalRunsStarted}
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">AVG DURATION</span>
                <span className="font-arcade text-base font-black text-cyan-300 tabular-nums">
                  {Math.round(data.averageRunDurationSeconds)}s
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">RAPID RESTARTS</span>
                <span className="font-arcade text-base font-black text-yellow-300 tabular-nums">
                  {data.rapidRestarts}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center mt-2">
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">AVG DISTANCE</span>
                <span className="font-arcade text-sm font-black text-cyan-400 tabular-nums">
                  {Math.round(data.averageDistance)}m
                </span>
              </div>
              <div className="bg-neutral-950 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-neutral-400 block font-bold">MAX DISTANCE</span>
                <span className="font-arcade text-sm font-black text-pink-400 tabular-nums">
                  {data.maxDistance}m
                </span>
              </div>
            </div>
          </div>

          {/* Hazard Elimination Causes */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3.5">
            <span className="font-arcade text-xs font-bold text-white block mb-2 uppercase flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> ELIMINATION CAUSES
            </span>

            {Object.keys(data.eliminationCauses).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(data.eliminationCauses).map(([cause, count]) => (
                  <div
                    key={cause}
                    className="flex items-center justify-between bg-neutral-950 px-3 py-1.5 rounded-xl border border-white/5 text-[11px]"
                  >
                    <span className="text-neutral-300 font-mono">{cause}</span>
                    <span className="font-arcade font-bold text-red-400 tabular-nums">{count} hits</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500 italic">No eliminations recorded yet.</p>
            )}
          </div>

          {/* Daily Challenge & Tutorial Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3">
              <span className="text-[9px] text-neutral-400 uppercase font-bold block">DAILY CHALLENGE</span>
              <span className="font-arcade text-base font-black text-pink-400 block mt-0.5 tabular-nums">
                {data.dailyChallengeRuns} RUNS
              </span>
              <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                Best: {data.dailyChallengeBest.toLocaleString()} PTS
              </span>
            </div>

            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3">
              <span className="text-[9px] text-neutral-400 uppercase font-bold block">TUTORIAL</span>
              <span className="font-arcade text-base font-black text-cyan-400 block mt-0.5">
                {data.tutorialCompleted ? 'COMPLETED' : 'PENDING'}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                Started: {data.tutorialStarts} · Skipped: {data.tutorialSkips} · Replayed: {data.tutorialReplays}
              </span>
            </div>
          </div>

          {/* Hitbox Wireframe Toggle (Development feature) */}
          <div className="bg-neutral-900 border border-cyan-400/40 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="font-arcade text-xs font-bold text-white block">
                  HITBOX WIREFRAMES
                </span>
                <span className="text-[10px] text-neutral-400">
                  Render 3D runner and obstacle collision boxes
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleDebugHitboxes(!debugHitboxes)}
              className={`px-3.5 py-1.5 rounded-xl font-arcade font-bold text-xs transition-all active:scale-95 cursor-pointer ${
                debugHitboxes
                  ? 'bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                  : 'bg-neutral-800 text-neutral-300 border border-white/10 hover:border-white/20'
              }`}
            >
              {debugHitboxes ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Privacy Note */}
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 text-emerald-300 text-[11px]">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>
              All diagnostics remain strictly on your local browser/device. No telemetry or analytics packets are ever sent over the network.
            </span>
          </div>
        </div>

        <p role="status">{copyError}</p>
        <p className="text-xs text-neutral-400">FPS samples cover active rendering this session. Run duration excludes pauses.</p>
        {/* Footer Actions */}
        <div className="border-t border-white/10 pt-3 flex items-center gap-2">
          <button
            onClick={handleCopyJSON}
            className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copied ? 'COPIED JSON' : 'EXPORT JSON'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            title="Reset Diagnostics"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
