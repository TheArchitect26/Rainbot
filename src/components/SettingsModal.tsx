import React, { useState } from 'react';
import { X, Volume2, VolumeX, Smartphone, Eye, Sparkles, Download, Check, Shield } from 'lucide-react';
import { GraphicsQuality } from '../game/GameEngine';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsModalProps {
  isMuted: boolean;
  vibrationEnabled: boolean;
  showOnScreenControls: boolean;
  shadowsEnabled: boolean;
  quality: GraphicsQuality;
  onToggleMute: () => void;
  onToggleVibration: (enabled: boolean) => void;
  onToggleOnScreenControls: (enabled: boolean) => void;
  onToggleShadows: (enabled: boolean) => void;
  onChangeQuality: (quality: GraphicsQuality) => void;
  onReplayTutorial?: () => void;
  onOpenDiagnostics?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isMuted,
  vibrationEnabled,
  showOnScreenControls,
  shadowsEnabled,
  quality,
  onToggleMute,
  onToggleVibration,
  onToggleOnScreenControls,
  onToggleShadows,
  onChangeQuality,
  onReplayTutorial,
  onOpenDiagnostics,
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) setInstallSuccess(true);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/85 select-none">
      <div className="w-full max-w-md bg-neutral-950 border border-cyan-400/40 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="font-arcade text-xl font-black text-white tracking-wider uppercase flex items-center gap-2">
            ⚙️ SETTINGS
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex flex-col gap-3 overflow-y-auto py-3 pr-1 text-sm">
          {/* Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/60 border border-white/10">
            <div className="flex items-center gap-2.5">
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">Game Audio & BGM</div>
                <div className="text-[11px] text-neutral-400">Synthesizer music & SFX</div>
              </div>
            </div>
            <button
              onClick={onToggleMute}
              className={`w-12 h-7 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                !isMuted ? 'bg-cyan-500 justify-end' : 'bg-neutral-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Vibration / Haptics Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/60 border border-white/10">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-pink-400" />
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">Haptic Vibration</div>
                <div className="text-[11px] text-neutral-400">Tactile swipe & collision buzz</div>
              </div>
            </div>
            <button
              onClick={() => onToggleVibration(!vibrationEnabled)}
              className={`w-12 h-7 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                vibrationEnabled ? 'bg-pink-500 justify-end' : 'bg-neutral-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* On-screen Controls (Accessibility) */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/60 border border-white/10">
            <div className="flex items-center gap-2.5">
              <Eye className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">On-Screen Buttons</div>
                <div className="text-[11px] text-neutral-400">Touch pad helper for swiping</div>
              </div>
            </div>
            <button
              onClick={() => onToggleOnScreenControls(!showOnScreenControls)}
              className={`w-12 h-7 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                showOnScreenControls ? 'bg-yellow-400 justify-end' : 'bg-neutral-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Real-time Shadows */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/60 border border-white/10">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">Real-Time Shadows</div>
                <div className="text-[11px] text-neutral-400">Disable for higher FPS on low-end phones</div>
              </div>
            </div>
            <button
              onClick={() => onToggleShadows(!shadowsEnabled)}
              className={`w-12 h-7 rounded-full transition-colors flex items-center p-1 cursor-pointer ${
                shadowsEnabled ? 'bg-purple-500 justify-end' : 'bg-neutral-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>

          {/* Graphics Quality */}
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-white/10">
            <div className="font-bold text-white text-xs sm:text-sm mb-1.5">Resolution & Quality</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => onChangeQuality(q)}
                  className={`py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                    quality === q
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Tutorial & Diagnostics Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {onReplayTutorial && (
              <button
                onClick={() => {
                  onClose();
                  onReplayTutorial();
                }}
                className="py-2.5 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-cyan-400/30 hover:border-cyan-400 text-cyan-300 font-arcade text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow"
              >
                <span>🎓 REPLAY TUTORIAL</span>
              </button>
            )}

            {onOpenDiagnostics && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDiagnostics();
                }}
                className="py-2.5 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 hover:border-cyan-400/60 text-white font-arcade text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow"
              >
                <span>📊 DIAGNOSTICS</span>
              </button>
            )}
          </div>

          {/* PWA Install Banner */}
          {!isInstalled && (isInstallable || isIOS) && (
            <div className="mt-1 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-purple-950/60 border border-cyan-400/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-arcade font-bold text-cyan-300 text-xs sm:text-sm flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-cyan-400" /> INSTALL APP
                  </div>
                  <div className="text-[11px] text-neutral-300">Play offline & fullscreen on home screen</div>
                </div>

                <button
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-black font-arcade font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  {isIOS ? 'HOW TO' : 'INSTALL'}
                </button>
              </div>

              {installSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> App installed successfully!
                </div>
              )}
            </div>
          )}

          {isInstalled && (
            <div className="p-2.5 rounded-xl bg-neutral-900 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> Running in Standalone App Mode
            </div>
          )}
        </div>

        {/* iOS Install Guide Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-cyan-500/50 p-5 shadow-2xl text-center">
              <h3 className="font-arcade text-lg font-bold text-white mb-2">Install on iPhone / iPad</h3>
              <p className="text-xs text-neutral-300 leading-relaxed mb-4 text-left">
                1. Tap the <strong className="text-cyan-400">Share</strong> button (square with arrow) in Safari.<br />
                2. Scroll down and select <strong className="text-cyan-400">Add to Home Screen</strong>.<br />
                3. Tap <strong className="text-cyan-400">Add</strong> in the top-right corner to launch fullscreen!
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-cyan-500 text-black font-arcade font-bold text-xs uppercase cursor-pointer"
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
