/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CUSTOM_SKINS_KEY, MAX_CUSTOM_SKINS, normalizeCustomSkin, parseCustomSkins } from './utils/skinStudio';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { TutorialOverlay, type TutorialState } from './components/TutorialOverlay';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { localAnalytics } from './utils/analytics';
import { awardXP, normalizeProgression } from './utils/mechanics';
import { hasStorageFailure, readNumber, storage } from './utils/storage';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GraphicsQuality, type GameEngineCallbacks } from './game/GameEngine';
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
    return readNumber('brainrot_high_score');
  });
  const [totalCoins, setTotalCoins] = useState<number>(() => {
    return readNumber('brainrot_total_coins');
  });
  const [skins, setSkins] = useState<Skin[]>(() => {
    const saved = storage.getItem('brainrot_unlocked_skins');
    if (saved) {
      try {
        const unlockedIds: string[] = JSON.parse(saved);
        return [...AVAILABLE_SKINS.map((s) => ({
          ...s,
          unlocked: s.unlocked || (Array.isArray(unlockedIds) && unlockedIds.includes(s.id)),
        })), ...parseCustomSkins(storage.getItem(CUSTOM_SKINS_KEY))];
      } catch {
        return [...AVAILABLE_SKINS, ...parseCustomSkins(storage.getItem(CUSTOM_SKINS_KEY))];
      }
    }
    return [...AVAILABLE_SKINS, ...parseCustomSkins(storage.getItem(CUSTOM_SKINS_KEY))];
  });

  const [selectedSkinId, setSelectedSkinId] = useState<string>(() => {
    return storage.getItem('brainrot_selected_skin') || 'cyber_glitch';
  });

  // Settings State
  const [isMuted, setIsMuted] = useState<boolean>(() => sounds.getMuted());
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    const saved = storage.getItem('brainrot_vibration');
    return saved !== null ? saved === 'true' : true;
  });
  const [showOnScreenControls, setShowOnScreenControls] = useState<boolean>(() => {
    const saved = storage.getItem('brainrot_touch_controls');
    return saved === 'true'; // Default off on mobile to keep playfield clean, accessible via settings
  });
  const [shadowsEnabled, setShadowsEnabled] = useState<boolean>(() => {
    const saved = storage.getItem('brainrot_shadows');
    return saved !== null ? saved === 'true' : true;
  });
  const [quality, setQuality] = useState<GraphicsQuality>(() => {
    const value = storage.getItem('brainrot_quality');
    return ['low', 'medium', 'high'].includes(value || '') ? (value as GraphicsQuality) : 'medium';
  });

  // Daily Missions State (Auto-refreshed based on UTC Date)
  const todayUTC = getUTCDayString();
  const [missionsData, setMissionsData] = useState(() => getOrRefreshDailyMissions());
  const missions = missionsData.missions;

  // Daily Challenge & Endless State
  const [dailyChallengeBest, setDailyChallengeBest] = useState<number>(() => {
    return readNumber(`brainrot_daily_best_${todayUTC}`);
  });
  const [isDailyChallengeActive, setIsDailyChallengeActive] = useState<boolean>(false);

  // Player Progression State (XP & Levels)
  const [progression, setProgression] = useState<PlayerProgression>(() => {
    const saved = storage.getItem('brainrot_progression_v3');
    if (saved) {
      try {
        return normalizeProgression(JSON.parse(saved));
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

  const skinsRef = useRef(skins);
  const progressionRef = useRef(progression);
  const missionsRef = useRef(missionsData);
  const [tutorial, setTutorial] = useState<TutorialState>({
    active: false,
    step: 1,
    title: '',
    instruction: '',
    completed: false,
  });
  const tutorialRef = useRef(false);
  const tutorialReplayRef = useRef(false);
  const tutorialRewardRef = useRef(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(
    () => storage.getItem('brainrot_tutorial_completed_v1') === 'true',
  );
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [debugHitboxes, setDebugHitboxes] = useState(false);
  const [engineError, setEngineError] = useState('');
  const [storageWarning, setStorageWarning] = useState(hasStorageFailure);
  const runDayRef = useRef(todayUTC);

  // Modals & Screen Navigation
  const [gameStatus, setGameStatus] = useState<GameStatus>('MENU');
  const {
    needRefresh: [needsUpdate],
    updateServiceWorker,
  } = useRegisterSW();
  const [eliminationCause, setEliminationCause] = useState('');
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

  const currentSelectedSkin = skins.find((s) => s.id === selectedSkinId && s.unlocked) || skins[0];
  const unclaimedMissionsCount = missions.filter((m) => m.current >= m.target && !m.claimed).length;

  // Helper to update mission progress and persist to storage
  const updateMissions = useCallback((updater: (prev: DailyMission[]) => DailyMission[]) => {
    const today = getUTCDayString();
    const previous =
      missionsRef.current.date === today ? missionsRef.current : getOrRefreshDailyMissions();
    const payload = { date: today, missions: updater(previous.missions) };
    missionsRef.current = payload;
    storage.setItem('brainrot_daily_missions_v3', JSON.stringify(payload));
    setMissionsData(payload);
  }, []);

  // Check and grant milestone unlocks
  const checkMilestoneUnlock = useCallback((newLevel: number) => {
    const milestone = LEVEL_MILESTONES.find((m) => m.level === newLevel);
    if (!milestone) return;

    if (milestone.rewardType === 'COINS' && typeof milestone.rewardValue === 'number') {
      const reward = milestone.rewardValue;
      const next = readNumber('brainrot_total_coins') + reward;
      storage.setItem('brainrot_total_coins', String(next));
      setTotalCoins(next);
    } else if (milestone.rewardType === 'SKIN' && typeof milestone.rewardValue === 'string') {
      const skinIdToUnlock = milestone.rewardValue;
      const updated = skinsRef.current.map((s) =>
        s.id === skinIdToUnlock ? { ...s, unlocked: true } : s,
      );
      skinsRef.current = updated;
      storage.setItem(
        'brainrot_unlocked_skins',
        JSON.stringify(updated.filter((s) => s.unlocked).map((s) => s.id)),
      );
      setSkins(updated);
    }
  }, []);

  // Compute synchronously from the latest ref; React updater functions must remain pure.
  const addPlayerXP = useCallback(
    (xpGain: number) => {
      const result = awardXP(progressionRef.current, xpGain);
      progressionRef.current = result.next;
      storage.setItem('brainrot_progression_v3', JSON.stringify(result.next));
      setProgression(result.next);
      for (const level of result.levels) checkMilestoneUnlock(level);
      return result;
    },
    [checkMilestoneUnlock],
  );

  const engineCallbacks: GameEngineCallbacks = {
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
    onPause: () => setGameStatus('PAUSED'),
    onTutorialStep: (step, title, instruction, completed) =>
      setTutorial({ active: true, step, title, instruction, completed }),
    onTutorialComplete: () => {
      localAnalytics.recordTutorialCompleted();
      if (storage.getItem('brainrot_tutorial_rewarded_v1') !== 'true') {
        storage.setItem('brainrot_tutorial_rewarded_v1', 'true');
        const wallet = readNumber('brainrot_total_coins') + 100;
        storage.setItem('brainrot_total_coins', String(wallet));
        setTotalCoins(wallet);
        addPlayerXP(150);
      }
      storage.setItem('brainrot_tutorial_completed_v1', 'true');
      storage.setItem('brainrot_tutorial_seen_v1', 'true');
      setTutorialCompleted(true);
    },
    onGameOver: (finalStats, cause) => {
      setEliminationCause(cause || 'COLLISION');
      setGameStatus('GAMEOVER');

      // Update Wallet Coins
      const currentWallet = readNumber('brainrot_total_coins');
      const newWallet = currentWallet + finalStats.coins;
      storage.setItem('brainrot_total_coins', String(newWallet));
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
      }

      // Daily Challenge vs Endless Best checking
      if (finalStats.isDailyChallenge) {
        const currentDailyBest = readNumber(`brainrot_daily_best_${runDayRef.current}`);
        if (finalStats.score > currentDailyBest) {
          storage.setItem(`brainrot_daily_best_${runDayRef.current}`, String(finalStats.score));
          setDailyChallengeBest(finalStats.score);
          setIsNewHigh(true);
        } else {
          setIsNewHigh(false);
        }
      } else {
        const currentBest = readNumber('brainrot_high_score');
        if (finalStats.score > currentBest) {
          storage.setItem('brainrot_high_score', String(finalStats.score));
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
        highScore: Math.max(readNumber('brainrot_high_score'), finalStats.score),
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
            const estimatedSeconds = Math.floor(finalStats.durationSeconds || 0);
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
        }),
      );
    },
  };
  const callbacksRef = useRef(engineCallbacks);
  callbacksRef.current = engineCallbacks;
  // Exactly one engine per mounted canvas. Handlers always observe the latest React state.
  useEffect(() => {
    if (!canvasMountRef.current) return;
    let engine: GameEngine;
    try {
      const callbacks = Object.fromEntries(
        Object.keys(callbacksRef.current).map((key) => [
          key,
          (...args: unknown[]) => {
            const handler = callbacksRef.current[key as keyof GameEngineCallbacks] as (
              ...values: unknown[]
            ) => void;
            handler?.(...args);
          },
        ]),
      ) as unknown as GameEngineCallbacks;
      engine = new GameEngine(canvasMountRef.current, callbacks, currentSelectedSkin);
      engineRef.current = engine;
    } catch {
      setEngineError(
        'Unable to start WebGL. Please reload, enable hardware acceleration, or try another browser. Your saved progress is preserved.',
      );
      return;
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) engineRef.current?.pauseForBackground();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [
      ...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'),
    ];
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isLevelUpModalOpen) setIsLevelUpModalOpen(false);
        else if (isDiagnosticsOpen) setIsDiagnosticsOpen(false);
        else if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        else if (isSkinModalOpen) setIsSkinModalOpen(false);
        else if (isMissionsModalOpen) setIsMissionsModalOpen(false);
        else if (isProgressionModalOpen) setIsProgressionModalOpen(false);
        else if (gameStatus === 'PAUSED') handleResume();
        else if (gameStatus === 'GAMEOVER') handleQuitToMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = controls();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => {
      document.removeEventListener('keydown', trap, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [
    gameStatus,
    isSkinModalOpen,
    isSettingsModalOpen,
    isMissionsModalOpen,
    isProgressionModalOpen,
    isLevelUpModalOpen,
    isDiagnosticsOpen,
  ]);

  useEffect(() => {
    const refreshDay = () => {
      setStorageWarning(hasStorageFailure());
      if (missionsRef.current.date === getUTCDayString()) return;
      const fresh = getOrRefreshDailyMissions();
      missionsRef.current = fresh;
      setMissionsData(fresh);
      setDailyChallengeBest(readNumber(`brainrot_daily_best_${getUTCDayString()}`));
    };
    const timer = window.setInterval(refreshDay, 30000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setStudioOpen(isSkinModalOpen);
  }, [isSkinModalOpen]);

  // Sync skin changes
  useEffect(() => {
    if (engineRef.current && currentSelectedSkin) {
      engineRef.current.setSkin(currentSelectedSkin);
    }
  }, [selectedSkinId, currentSelectedSkin]);

  // Touch Swipe Gesture Detectors (Responsive, short-swipe threshold ~20px, debounced)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent | TouchEvent) => {
    touchStartRef.current = null;
    if (gameStatus !== 'PLAYING' || (e.target as HTMLElement).closest('button, [role="dialog"]'))
      return;
    if (e.touches.length === 1) {
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
      if (
        e.repeat ||
        isSettingsModalOpen ||
        isSkinModalOpen ||
        isMissionsModalOpen ||
        isProgressionModalOpen ||
        isDiagnosticsOpen ||
        isLevelUpModalOpen ||
        engineError
      )
        return;
      if (
        (e.code === 'Space' || e.code === 'Enter') &&
        (e.target as HTMLElement)?.closest?.('button, input, select, textarea')
      )
        return;
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
    [
      gameStatus,
      isSettingsModalOpen,
      isSkinModalOpen,
      isMissionsModalOpen,
      isProgressionModalOpen,
      isDiagnosticsOpen,
      isLevelUpModalOpen,
      engineError,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const startTutorial = (replay = false) => {
    tutorialRef.current = true;
    tutorialReplayRef.current = replay;
    tutorialRewardRef.current = storage.getItem('brainrot_tutorial_rewarded_v1') !== 'true';
    localAnalytics.abandonRun();
    localAnalytics.recordTutorialStart(replay);
    setIsDailyChallengeActive(false);
    setIsNewHigh(false);
    setGameStatus('PLAYING');
    engineRef.current?.startTutorial(currentSelectedSkin);
  };

  const handleStartGame = () => {
    if (storage.getItem('brainrot_tutorial_seen_v1') !== 'true') {
      startTutorial();
      return;
    }
    tutorialRef.current = false;
    setTutorial((prev) => ({ ...prev, active: false }));
    runDayRef.current = getUTCDayString();
    setIsDailyChallengeActive(false);
    setIsNewHigh(false);
    setGameStatus('PLAYING');
    engineRef.current?.reset(currentSelectedSkin, false);
  };

  const handleStartDailyChallenge = () => {
    tutorialRef.current = false;
    setTutorial((prev) => ({ ...prev, active: false }));
    runDayRef.current = getUTCDayString();
    setDailyChallengeBest(readNumber(`brainrot_daily_best_${runDayRef.current}`));
    setIsDailyChallengeActive(true);
    setIsNewHigh(false);
    setGameStatus('PLAYING');
    engineRef.current?.reset(currentSelectedSkin, true);
  };

  const handleRestartGame = () => {
    if (tutorialRef.current) {
      startTutorial(tutorialReplayRef.current);
      return;
    }
    runDayRef.current = getUTCDayString();
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
    tutorialRef.current = false;
    setTutorial((prev) => ({ ...prev, active: false }));
    updateMissions((missions) => missions);
    setDailyChallengeBest(readNumber(`brainrot_daily_best_${getUTCDayString()}`));
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
    storage.setItem('brainrot_touch_controls', String(enabled));
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
    if (!skinsRef.current.some((s) => s.id === skin.id && s.unlocked)) return;
    setSelectedSkinId(skin.id);
    storage.setItem('brainrot_selected_skin', skin.id);
  };

  const handleSaveCustomSkin = (draft: Skin): boolean => {
    const skin = normalizeCustomSkin(draft);
    if (!skin) return false;
    const existing = skinsRef.current.find(s => s.id === skin.id);
    if (!existing && skinsRef.current.filter(s => s.custom).length >= MAX_CUSTOM_SKINS) return false;
    const updated = existing
      ? skinsRef.current.map(s => s.id === skin.id ? skin : s)
      : [...skinsRef.current, skin];
    skinsRef.current = updated;
    setSkins(updated);
    storage.setItem(CUSTOM_SKINS_KEY, JSON.stringify(updated.filter(s => s.custom)));
    handleSelectSkin(skin);
    return true;
  };

  const handleDeleteCustomSkin = (id: string) => {
    if (!skinsRef.current.some(s => s.id === id && s.custom)) return;
    const updated = skinsRef.current.filter(s => s.id !== id);
    skinsRef.current = updated;
    setSkins(updated);
    storage.setItem(CUSTOM_SKINS_KEY, JSON.stringify(updated.filter(s => s.custom)));
    if (selectedSkinId === id) handleSelectSkin(updated[0]);
  };

  const handleUnlockSkin = (skinId: string) => {
    const skinToUnlock = skinsRef.current.find((s) => s.id === skinId);
    if (
      !skinToUnlock ||
      skinToUnlock.unlocked ||
      readNumber('brainrot_total_coins') < skinToUnlock.price
    )
      return;

    const remaining = readNumber('brainrot_total_coins') - skinToUnlock.price;
    setTotalCoins(remaining);
    storage.setItem('brainrot_total_coins', String(remaining));

    const updatedSkins = skinsRef.current.map((s) =>
      s.id === skinId ? { ...s, unlocked: true } : s,
    );
    skinsRef.current = updatedSkins;
    setSkins(updatedSkins);

    const unlockedIds = updatedSkins.filter((s) => s.unlocked).map((s) => s.id);
    storage.setItem('brainrot_unlocked_skins', JSON.stringify(unlockedIds));

    setSelectedSkinId(skinId);
    storage.setItem('brainrot_selected_skin', skinId);
  };

  const handleClaimMission = (missionId: string) => {
    const targetMission = missionsRef.current.missions.find((m) => m.id === missionId);
    if (missionsRef.current.date !== getUTCDayString()) {
      updateMissions((m) => m);
      return;
    }
    if (!targetMission || targetMission.claimed || targetMission.current < targetMission.target)
      return;
    updateMissions((prev) => prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)));

    const newCoins = readNumber('brainrot_total_coins') + targetMission.rewardCoins;
    setTotalCoins(newCoins);
    storage.setItem('brainrot_total_coins', String(newCoins));

    sounds.playPowerUp();

    // Award XP
    const xpResult = addPlayerXP(targetMission.rewardXP);
    if (xpResult.levelUps > 0) {
      setNewLevelReached(xpResult.newLevel);
      setIsLevelUpModalOpen(true);
    }
  };

  return (
    <div
      className="fixed inset-0 w-full h-full h-[100dvh] overflow-hidden bg-black select-none touch-none overscroll-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
      }}
    >
      {/* Isolated Three.js WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Retro cyber scanlines */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30 z-[5]" />

      {/* Screen States */}
      {engineError && (
        <div role="alert" className="absolute inset-0 z-50 bg-black text-white p-8">
          {engineError}
          <button className="block p-4" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      {gameStatus === 'MENU' && (
        <StartScreen
          highScore={highScore}
          dailyChallengeBest={dailyChallengeBest}
          totalCoins={totalCoins}
          selectedSkin={currentSelectedSkin}
          progression={progression}
          unclaimedMissionsCount={unclaimedMissionsCount}
          isTutorialCompleted={tutorialCompleted}
          onStartTutorial={() => startTutorial(tutorialCompleted)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
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
          showOnScreenControls={showOnScreenControls || tutorial.active}
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
          eliminationCause={eliminationCause}
          xpBreakdown={xpBreakdown}
          progression={progression}
          onRestart={handleRestartGame}
          onOpenSkins={() => setIsSkinModalOpen(true)}
          onQuitToMenu={handleQuitToMenu}
        />
      )}

      {tutorial.active && gameStatus === 'PLAYING' && (
        <TutorialOverlay
          tutorial={tutorial}
          rewardGranted={tutorialRewardRef.current}
          onSkip={() => {
            localAnalytics.recordTutorialSkipped();
            storage.setItem('brainrot_tutorial_seen_v1', 'true');
            tutorialRef.current = false;
            setTutorial((prev) => ({ ...prev, active: false }));
            handleStartGame();
          }}
          onFinish={handleStartGame}
        />
      )}
      {isDiagnosticsOpen && (
        <DiagnosticsModal
          debugHitboxes={debugHitboxes}
          onToggleDebugHitboxes={(enabled) => {
            setDebugHitboxes(enabled);
            engineRef.current?.setDebugHitboxes(enabled);
          }}
          onClose={() => setIsDiagnosticsOpen(false)}
        />
      )}
      {needsUpdate &&
        !Capacitor.isNativePlatform() &&
        (gameStatus === 'MENU' || gameStatus === 'GAMEOVER') && (
          <button
            onClick={() => void updateServiceWorker(true)}
            className="absolute bottom-2 left-2 z-50 rounded-xl bg-cyan-400 text-black p-3"
          >
            Update game (reload)
          </button>
        )}
      {storageWarning && (
        <p
          role="status"
          className="absolute top-0 left-0 right-0 z-50 bg-amber-950 text-amber-100 text-xs p-2 text-center"
        >
          Device storage is unavailable. Progress is saved for this session only.
        </p>
      )}
      {/* Modals */}
      {isSkinModalOpen && (
        <SkinModal
          skins={skins}
          selectedSkinId={selectedSkinId}
          totalCoins={totalCoins}
          progression={progression}
          onSelectSkin={handleSelectSkin}
          onSaveCustomSkin={handleSaveCustomSkin}
          onDeleteCustomSkin={handleDeleteCustomSkin}
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
        <LevelUpModal newLevel={newLevelReached} onClose={() => setIsLevelUpModalOpen(false)} />
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
          onReplayTutorial={() => startTutorial(true)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          onChangeQuality={handleChangeQuality}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
    </div>
  );
}
