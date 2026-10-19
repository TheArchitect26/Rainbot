/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GraphicsQuality } from './game/GameEngine';
import { GameHUD } from './components/GameHUD';
import { StartScreen } from './components/StartScreen';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { SkinModal } from './components/SkinModal';
import { SettingsModal } from './components/SettingsModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { ProgressionModal } from './components/ProgressionModal';
import { LevelUpModal } from './components/LevelUpModal';
import { ActivePowerUp, ChaosState, GameStatus, PlayerStats, Skin } from './types/game';
import { DailyMission, getOrRefreshDailyMissions } from './types/missions';
import {
  BossState,
  getXPRequiredForLevel,
  LEVEL_MILESTONES,
  PlayerProgression,
  XPGainBreakdown,
} from './types/progression';
import { AVAILABLE_SKINS } from './data/skins';
import { sounds } from './audio/SoundEffects';
import { getUTCDayString } from './utils/prng';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Persistence: High Score, Total Coins, Skins
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('brainrot_high_score') || '0', 10);
  });
  const [totalCoins, setTotalCoins] = useState<number>(() => {
    return parseInt(localStorage.getItem('brainrot_total_coins') || '0', 10);
  });
  const [skins, setSkins] = useState<Skin[]>(() => {
    const saved = localStorage.getItem('brainrot_unlocked_skins');
    if (saved) {
      try {
        const unlockedIds: string[] = JSON.parse(saved);
        return AVAILABLE_SKINS.map((s) => ({
          ...s,
          unlocked: s.unlocked || unlockedIds.includes(s.id),
        }));
      } catch {
        return AVAILABLE_SKINS;
      }
    }
    return AVAILABLE_SKINS;
  });

  const [selectedSkinId, setSelectedSkinId] = useState<string>(() => {
    return localStorage.getItem('brainrot_selected_skin') || 'cyber_glitch';
  });

  // Settings State
  const [isMuted, setIsMuted] = useState<boolean>(() => sounds.getMuted());
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('brainrot_vibration');
    return saved !== null ? saved === 'true' : true;
  });
  const [showOnScreenControls, setShowOnScreenControls] = useState<boolean>(() => {
    const saved = localStorage.getItem('brainrot_touch_controls');
    return saved === 'true'; // Default off on mobile to keep playfield clean, accessible via settings
  });
  const [shadowsEnabled, setShadowsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('brainrot_shadows');
    return saved !== null ? saved === 'true' : true;
  });
  const [quality, setQuality] = useState<GraphicsQuality>(() => {
    return (localStorage.getItem('brainrot_quality') as GraphicsQuality) || 'medium';
  });

  // Daily Missions State (Auto-refreshed based on UTC Date)
  const todayUTC = getUTCDayString();
  const [missionsData, setMissionsData] = useState(() => getOrRefreshDailyMissions());
  const missions = missionsData.missions;

  // Daily Challenge & Endless State
  const [dailyChallengeBest, setDailyChallengeBest] = useState<number>(() => {
    return parseInt(localStorage.getItem(`brainrot_daily_best_${todayUTC}`) || '0', 10);
  });
  const [isDailyChallengeActive, setIsDailyChallengeActive] = useState<boolean>(false);

  // Player Progression State (XP & Levels)
  const [progression, setProgression] = useState<PlayerProgression>(() => {
    const saved = localStorage.getItem('brainrot_progression_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // use default
      }
    }
    return {
      level: 1,
      currentXP: 0,
      xpToNextLevel: getXPRequiredForLevel(1),
      totalXP: 0,
    };
  });

  // Modals & Screen Navigation
  const [gameStatus, setGameStatus] = useState<GameStatus>('MENU');
  const [isSkinModalOpen, setIsSkinModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isMissionsModalOpen, setIsMissionsModalOpen] = useState<boolean>(false);
  const [isProgressionModalOpen, setIsProgressionModalOpen] = useState<boolean>(false);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState<boolean>(false);
  const [newLevelReached, setNewLevelReached] = useState<number>(1);
  const [isNewHigh, setIsNewHigh] = useState<boolean>(false);
  const [xpBreakdown, setXpBreakdown] = useState<XPGainBreakdown | undefined>(undefined);

  // Realtime Game Data
  const [stats, setStats] = useState<PlayerStats>({
    score: 0,
    distance: 0,
    coins: 0,
    highScore: 0,
    totalCoins: 0,
    runsPlayed: 0,
    chaosSurvived: 0,
  });
  const [powerUps, setPowerUps] = useState<ActivePowerUp[]>([]);
  const [chaos, setChaos] = useState<ChaosState>({
    active: false,
    type: null,
    timeLeft: 0,
    duration: 10,
    warningTimeLeft: 0,
    nextWarningType: null,
    name: '',
    description: '',
    accentColor: '#06b6d4',
  });
  const [bossState, setBossState] = useState<BossState>({
    active: false,
    name: 'THE ALGORITHM OVERLORD',
    phase: 1,
    maxPhase: 3,
    timeLeft: 22,
    duration: 22,
    telegraph: null,
    targetLanes: [],
  });

  const currentSelectedSkin = skins.find((s) => s.id === selectedSkinId) || skins[0];
  const unclaimedMissionsCount = missions.filter((m) => m.current >= m.target && !m.claimed).length;

  // Helper to update mission progress and persist to storage
  const updateMissions = useCallback((updater: (prev: DailyMission[]) => DailyMission[]) => {
    setMissionsData((prev) => {
      const updated = updater(prev.missions);
      const payload = { date: todayUTC, missions: updated };
      localStorage.setItem('brainrot_daily_missions_v3', JSON.stringify(payload));
      return payload;
    });
  }, [todayUTC]);

  // Check and grant milestone unlocks
  const checkMilestoneUnlock = useCallback((newLevel: number) => {
    const milestone = LEVEL_MILESTONES.find((m) => m.level === newLevel);
    if (!milestone) return;

    if (milestone.rewardType === 'COINS' && typeof milestone.rewardValue === 'number') {
      const reward = milestone.rewardValue;
      setTotalCoins((prev) => {
        const next = prev + reward;
        localStorage.setItem('brainrot_total_coins', String(next));
        return next;
      });
    } else if (milestone.rewardType === 'SKIN' && typeof milestone.rewardValue === 'string') {
      const skinIdToUnlock = milestone.rewardValue;
      setSkins((prev) => {
        const updated = prev.map((s) => (s.id === skinIdToUnlock ? { ...s, unlocked: true } : s));
        const unlockedIds = updated.filter((s) => s.unlocked).map((s) => s.id);
        localStorage.setItem('brainrot_unlocked_skins', JSON.stringify(unlockedIds));
        return updated;
      });
    }
  }, []);

  // Award XP and calculate rank ascension
  const addPlayerXP = useCallback(
    (xpGain: number) => {
      let levelUps = 0;
      let finalLevel = progression.level;

      setProgression((prev) => {
        let lvl = prev.level;
        let curXP = prev.currentXP + xpGain;
        let reqXP = prev.xpToNextLevel;
        let total = prev.totalXP + xpGain;

        while (curXP >= reqXP) {
          curXP -= reqXP;
          lvl += 1;
          reqXP = getXPRequiredForLevel(lvl);
          levelUps += 1;
        }

        finalLevel = lvl;
        const updated: PlayerProgression = {
          level: lvl,
          currentXP: curXP,
          xpToNextLevel: reqXP,
          totalXP: total,
        };
        localStorage.setItem('brainrot_progression_v3', JSON.stringify(updated));
        return updated;
      });

      return { levelUps, newLevel: finalLevel };
    },
    [progression.level]
  );

  // Track action triggers during live run
  const handleActionTriggered = useCallback(
    (action: string) => {
      if (action === 'DODGE') {
        updateMissions((prev) =>
          prev.map((m) => {
            if (m.type === 'DODGE') {
              const cur = m.current + 1;
              return { ...m, current: cur, completed: cur >= m.target };
            }
            return m;
          })
        );
      }
    },
    [updateMissions]
  );

  // Initialize Game Engine on Mount
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new GameEngine(
      canvasMountRef.current,
      {
        onStatsUpdate: (latestStats) => {
          setStats((prev) => ({
            ...prev,
            score: latestStats.score,
            distance: latestStats.distance,
            coins: latestStats.coins,
            chaosSurvived: latestStats.chaosSurvived,
            obstaclesDodged: latestStats.obstaclesDodged,
            bossDefeated: latestStats.bossDefeated,
            isDailyChallenge: latestStats.isDailyChallenge,
            stage: latestStats.stage,
          }));
        },
        onPowerUpsUpdate: (activeList) => {
          setPowerUps(activeList);
        },
        onChaosUpdate: (chaosState) => {
          setChaos(chaosState);
        },
        onBossUpdate: (bossUpdate) => {
          setBossState(bossUpdate);
        },
        onActionTriggered: handleActionTriggered,
        onGameOver: (finalStats) => {
          setGameStatus('GAMEOVER');

          // Update Wallet Coins
          const currentWallet = parseInt(localStorage.getItem('brainrot_total_coins') || '0', 10);
          const newWallet = currentWallet + finalStats.coins;
          localStorage.setItem('brainrot_total_coins', String(newWallet));
          setTotalCoins(newWallet);

          // Calculate XP Gains
          const distanceXP = Math.floor(finalStats.distance / 5);
          const coinsXP = finalStats.coins * 2;
          const dodgedXP = (finalStats.obstaclesDodged || 0) * 4;
          const bossXP = (finalStats.bossDefeated || 0) * 150;
          const totalRunXP = distanceXP + coinsXP + dodgedXP + bossXP;

          const xpResult = addPlayerXP(totalRunXP);
          const breakdown: XPGainBreakdown = {
            distanceXP,
            coinsXP,
            dodgedXP,
            bossXP,
            totalRunXP,
            levelUps: xpResult.levelUps,
            newLevel: xpResult.newLevel,
          };
          setXpBreakdown(breakdown);

          if (xpResult.levelUps > 0) {
            setNewLevelReached(xpResult.newLevel);
            setIsLevelUpModalOpen(true);
            checkMilestoneUnlock(xpResult.newLevel);
          }

          // Daily Challenge vs Endless Best checking
          if (finalStats.isDailyChallenge) {
            const currentDailyBest = parseInt(
              localStorage.getItem(`brainrot_daily_best_${todayUTC}`) || '0',
              10
            );
            if (finalStats.score > currentDailyBest) {
              localStorage.setItem(`brainrot_daily_best_${todayUTC}`, String(finalStats.score));
              setDailyChallengeBest(finalStats.score);
              setIsNewHigh(true);
            } else {
              setIsNewHigh(false);
            }
          } else {
            const currentBest = parseInt(localStorage.getItem('brainrot_high_score') || '0', 10);
            if (finalStats.score > currentBest) {
              localStorage.setItem('brainrot_high_score', String(finalStats.score));
              setHighScore(finalStats.score);
              setIsNewHigh(true);
            } else {
              setIsNewHigh(false);
            }
          }

          setStats((prev) => ({
            ...prev,
            score: finalStats.score,
            distance: finalStats.distance,
            coins: finalStats.coins,
            highScore: Math.max(
              parseInt(localStorage.getItem('brainrot_high_score') || '0', 10),
              finalStats.score
            ),
            totalCoins: newWallet,
            chaosSurvived: finalStats.chaosSurvived,
            obstaclesDodged: finalStats.obstaclesDodged,
            bossDefeated: finalStats.bossDefeated,
            isDailyChallenge: finalStats.isDailyChallenge,
          }));

          // Update Missions across categories
          updateMissions((prev) =>
            prev.map((m) => {
              let cur = m.current;
              if (m.type === 'COINS') {
                cur += finalStats.coins;
              } else if (m.type === 'DISTANCE') {
                cur = Math.max(cur, finalStats.distance);
              } else if (m.type === 'TIME') {
                const estimatedSeconds = Math.floor(finalStats.distance / 20);
                cur = Math.max(cur, estimatedSeconds);
              } else if (m.type === 'DODGE') {
                cur += finalStats.obstaclesDodged || 0;
              } else if (m.type === 'ZONE') {
                cur = Math.max(cur, finalStats.distance);
              } else if (m.type === 'RUNS') {
                cur += 1;
              } else if (m.type === 'BOSS') {
                cur += finalStats.bossDefeated || 0;
              }
              return {
                ...m,
                current: cur,
                completed: cur >= m.target,
              };
            })
          );
        },
      },
      currentSelectedSkin
    );

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [
    todayUTC,
    currentSelectedSkin,
    handleActionTriggered,
    addPlayerXP,
    checkMilestoneUnlock,
    updateMissions,
  ]);

  // Sync skin changes
  useEffect(() => {
    if (engineRef.current && currentSelectedSkin) {
      engineRef.current.setSkin(currentSelectedSkin);
    }
  }, [selectedSkinId, currentSelectedSkin]);

  // Touch Swipe Gesture Detectors (Responsive, short-swipe threshold ~20px, debounced)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent | TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: performance.now(),
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const start = touchStartRef.current;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - start.x;
    const dy = endY - start.y;
    const elapsed = performance.now() - start.time;

    touchStartRef.current = null;

    // Fast swipe threshold: short flicks >= 20px if fast (< 350ms), or >= 35px if slower
    const minThreshold = elapsed < 350 ? 20 : 35;
    if (Math.abs(dx) < minThreshold && Math.abs(dy) < minThreshold) {
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        engineRef.current?.handleInput('LEFT');
      } else {
        engineRef.current?.handleInput('RIGHT');
      }
    } else {
      if (dy < 0) {
        engineRef.current?.handleInput('JUMP');
      } else {
        engineRef.current?.handleInput('SLIDE');
      }
    }
  };

  // Keyboard controls for desktop fallback & testing
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (gameStatus === 'MENU') {
          e.preventDefault();
          handleStartGame();
          return;
        } else if (gameStatus === 'GAMEOVER') {
          e.preventDefault();
          handleRestartGame();
          return;
        }
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (gameStatus === 'PLAYING') {
          handlePause();
        } else if (gameStatus === 'PAUSED') {
          handleResume();
        }
        return;
      }

      if (gameStatus !== 'PLAYING') return;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        engineRef.current?.handleInput('LEFT');
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        engineRef.current?.handleInput('RIGHT');
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        e.preventDefault();
        engineRef.current?.handleInput('JUMP');
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        engineRef.current?.handleInput('SLIDE');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameStatus]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleStartGame = () => {
    setIsDailyChallengeActive(false);
    setIsNewHigh(false);
    setGameStatus('PLAYING');
    engineRef.current?.reset(currentSelectedSkin, false);
  };

  const handleStartDailyChallenge = () => {
    setIsDailyChallengeActive(true);
    setIsNewHigh(false);
    setGameStatus('PLAYING');
    engineRef.current?.reset(currentSelectedSkin, true);
  };

  const handleRestartGame = () => {
    setIsNewHigh(false);
    setGameStatus('PLAYING');
    engineRef.current?.reset(currentSelectedSkin, isDailyChallengeActive);
  };

  const handlePause = () => {
    setGameStatus('PAUSED');
    engineRef.current?.pause();
  };

  const handleResume = () => {
    setGameStatus('PLAYING');
    engineRef.current?.resume();
  };

  const handleQuitToMenu = () => {
    setGameStatus('MENU');
    sounds.stopBGM();
    engineRef.current?.showMenuShowcase();
  };

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVibration = (enabled: boolean) => {
    setVibrationEnabled(enabled);
    engineRef.current?.setVibration(enabled);
  };

  const handleToggleOnScreenControls = (enabled: boolean) => {
    setShowOnScreenControls(enabled);
    localStorage.setItem('brainrot_touch_controls', String(enabled));
  };

  const handleToggleShadows = (enabled: boolean) => {
    setShadowsEnabled(enabled);
    engineRef.current?.setShadows(enabled);
  };

  const handleChangeQuality = (newQuality: GraphicsQuality) => {
    setQuality(newQuality);
    engineRef.current?.setQuality(newQuality);
  };

  const handleSelectSkin = (skin: Skin) => {
    setSelectedSkinId(skin.id);
    localStorage.setItem('brainrot_selected_skin', skin.id);
  };

  const handleUnlockSkin = (skinId: string) => {
    const skinToUnlock = skins.find((s) => s.id === skinId);
    if (!skinToUnlock || totalCoins < skinToUnlock.price) return;

    const remaining = totalCoins - skinToUnlock.price;
    setTotalCoins(remaining);
    localStorage.setItem('brainrot_total_coins', String(remaining));

    const updatedSkins = skins.map((s) => (s.id === skinId ? { ...s, unlocked: true } : s));
    setSkins(updatedSkins);

    const unlockedIds = updatedSkins.filter((s) => s.unlocked).map((s) => s.id);
    localStorage.setItem('brainrot_unlocked_skins', JSON.stringify(unlockedIds));

    setSelectedSkinId(skinId);
    localStorage.setItem('brainrot_selected_skin', skinId);
  };

  const handleClaimMission = (missionId: string) => {
    const targetMission = missions.find((m) => m.id === missionId);
    if (!targetMission || targetMission.claimed) return;

    const newCoins = totalCoins + targetMission.rewardCoins;
    setTotalCoins(newCoins);
    localStorage.setItem('brainrot_total_coins', String(newCoins));

    sounds.playPowerUp();

    // Award XP
    const xpResult = addPlayerXP(targetMission.rewardXP);
    if (xpResult.levelUps > 0) {
      setNewLevelReached(xpResult.newLevel);
      setIsLevelUpModalOpen(true);
      checkMilestoneUnlock(xpResult.newLevel);
    }

    updateMissions((prev) =>
      prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m))
    );
  };

  return (
    <div
      className="fixed inset-0 w-full h-full h-[100dvh] overflow-hidden bg-black select-none touch-none overscroll-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Isolated Three.js WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Retro cyber scanlines */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30 z-[5]" />

      {/* Screen States */}
      {gameStatus === 'MENU' && (
        <StartScreen
          highScore={highScore}
          dailyChallengeBest={dailyChallengeBest}
          totalCoins={totalCoins}
          selectedSkin={currentSelectedSkin}
          progression={progression}
          unclaimedMissionsCount={unclaimedMissionsCount}
          onStart={handleStartGame}
          onStartDailyChallenge={handleStartDailyChallenge}
          onOpenSkins={() => setIsSkinModalOpen(true)}
          onOpenMissions={() => setIsMissionsModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenProgression={() => setIsProgressionModalOpen(true)}
        />
      )}

      {gameStatus === 'PLAYING' && (
        <GameHUD
          stats={{ ...stats, highScore, totalCoins }}
          powerUps={powerUps}
          chaos={chaos}
          boss={bossState}
          currentStage={stats.stage}
          showOnScreenControls={showOnScreenControls}
          onPause={handlePause}
          onControlInput={(action) => engineRef.current?.handleInput(action)}
        />
      )}

      {gameStatus === 'PAUSED' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestartGame}
          onQuitToMenu={handleQuitToMenu}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {gameStatus === 'GAMEOVER' && (
        <GameOverModal
          stats={{ ...stats, highScore }}
          isNewHigh={isNewHigh}
          selectedSkin={currentSelectedSkin}
          dailyChallengeBest={dailyChallengeBest}
          xpBreakdown={xpBreakdown}
          progression={progression}
          onRestart={handleRestartGame}
          onOpenSkins={() => setIsSkinModalOpen(true)}
          onQuitToMenu={handleQuitToMenu}
        />
      )}

      {/* Modals */}
      {isSkinModalOpen && (
        <SkinModal
          skins={skins}
          selectedSkinId={selectedSkinId}
          totalCoins={totalCoins}
          progression={progression}
          onSelectSkin={handleSelectSkin}
          onUnlockSkin={handleUnlockSkin}
          onClose={() => setIsSkinModalOpen(false)}
        />
      )}

      {isMissionsModalOpen && (
        <DailyMissionsModal
          missions={missions}
          onClaim={handleClaimMission}
          onClose={() => setIsMissionsModalOpen(false)}
        />
      )}

      {isProgressionModalOpen && (
        <ProgressionModal
          progression={progression}
          onClose={() => setIsProgressionModalOpen(false)}
        />
      )}

      {isLevelUpModalOpen && (
        <LevelUpModal
          newLevel={newLevelReached}
          onClose={() => setIsLevelUpModalOpen(false)}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          isMuted={isMuted}
          vibrationEnabled={vibrationEnabled}
          showOnScreenControls={showOnScreenControls}
          shadowsEnabled={shadowsEnabled}
          quality={quality}
          onToggleMute={handleToggleMute}
          onToggleVibration={handleToggleVibration}
          onToggleOnScreenControls={handleToggleOnScreenControls}
          onToggleShadows={handleToggleShadows}
          onChangeQuality={handleChangeQuality}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
    </div>
  );
}
