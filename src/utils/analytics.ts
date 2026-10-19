/**
 * Privacy-Conscious Local Diagnostics & Analytics for BRAINROT RUN.
 * 100% On-Device local storage. Zero telemetry or external server transmissions.
 */

export interface RunRecord {
  id: string;
  timestamp: string;
  score: number;
  distance: number;
  coins: number;
  durationSeconds: number;
  eliminatedBy?: string;
  isDailyChallenge: boolean;
  stageName: string;
}

export interface DiagnosticsData {
  totalRunsStarted: number;
  totalRunsCompleted: number;
  totalDurationSeconds: number;
  averageRunDurationSeconds: number;
  maxDistance: number;
  averageDistance: number;
  eliminationCauses: Record<string, number>;
  fpsMetrics: {
    samples: number;
    avgFps: number;
    minFps: number;
    spikes30: number; // Frames taking > 33.3ms (FPS < 30)
    spikes50: number; // Frames taking > 50.0ms (stutter)
  };
  tutorialCompleted: boolean;
  tutorialReplays: number;
  rapidRestarts: number; // Restarts within 8s of gameover
  dailyChallengeRuns: number;
  dailyChallengeBest: number;
  lastUpdated: string;
  recentRuns: RunRecord[];
}

const STORAGE_KEY = 'brainrot_diagnostics_v1';

const DEFAULT_DIAGNOSTICS: DiagnosticsData = {
  totalRunsStarted: 0,
  totalRunsCompleted: 0,
  totalDurationSeconds: 0,
  averageRunDurationSeconds: 0,
  maxDistance: 0,
  averageDistance: 0,
  eliminationCauses: {},
  fpsMetrics: {
    samples: 0,
    avgFps: 60,
    minFps: 60,
    spikes30: 0,
    spikes50: 0,
  },
  tutorialCompleted: false,
  tutorialReplays: 0,
  rapidRestarts: 0,
  dailyChallengeRuns: 0,
  dailyChallengeBest: 0,
  lastUpdated: new Date().toISOString(),
  recentRuns: [],
};

class LocalAnalyticsService {
  private data: DiagnosticsData;
  private currentRunStartTime: number = 0;
  private lastGameOverTime: number = 0;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DiagnosticsData {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_DIAGNOSTICS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_DIAGNOSTICS, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_DIAGNOSTICS };
  }

  private save() {
    if (typeof localStorage === 'undefined') return;
    try {
      this.data.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage quota or disabled
    }
  }

  public recordRunStart(isDailyChallenge: boolean) {
    this.currentRunStartTime = performance.now();
    this.data.totalRunsStarted += 1;

    // Detect rapid restart (started within 8s of last gameover)
    if (this.lastGameOverTime > 0 && performance.now() - this.lastGameOverTime < 8000) {
      this.data.rapidRestarts += 1;
    }

    if (isDailyChallenge) {
      this.data.dailyChallengeRuns += 1;
    }

    this.save();
  }

  public recordRunEnd(
    score: number,
    distance: number,
    coins: number,
    eliminatedBy: string = 'UNKNOWN',
    isDailyChallenge: boolean = false,
    stageName: string = 'ZONE 1'
  ) {
    this.lastGameOverTime = performance.now();
    const durationSeconds = this.currentRunStartTime > 0
      ? Math.max(1, Math.round((performance.now() - this.currentRunStartTime) / 1000))
      : 1;

    this.data.totalRunsCompleted += 1;
    this.data.totalDurationSeconds += durationSeconds;
    this.data.averageRunDurationSeconds = Math.round(
      this.data.totalDurationSeconds / this.data.totalRunsCompleted
    );

    if (distance > this.data.maxDistance) {
      this.data.maxDistance = distance;
    }

    const prevTotalDist = this.data.averageDistance * (this.data.totalRunsCompleted - 1);
    this.data.averageDistance = Math.round((prevTotalDist + distance) / this.data.totalRunsCompleted);

    // Hazard cause breakdown
    const causeKey = eliminatedBy.toUpperCase();
    this.data.eliminationCauses[causeKey] = (this.data.eliminationCauses[causeKey] || 0) + 1;

    if (isDailyChallenge && score > this.data.dailyChallengeBest) {
      this.data.dailyChallengeBest = score;
    }

    // Append to recent runs history (max 10 records)
    const runRecord: RunRecord = {
      id: `run_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      score,
      distance,
      coins,
      durationSeconds,
      eliminatedBy: causeKey,
      isDailyChallenge,
      stageName,
    };

    this.data.recentRuns = [runRecord, ...this.data.recentRuns.slice(0, 9)];
    this.save();
  }

  public recordFPS(currentFps: number, frameTimeMs: number) {
    if (currentFps <= 0 || currentFps > 240) return;

    const m = this.data.fpsMetrics;
    const prevSamples = m.samples;
    const newSamples = Math.min(prevSamples + 1, 1000); // capped rolling window

    // Running average
    m.avgFps = Math.round(((m.avgFps * prevSamples) + currentFps) / newSamples);
    if (currentFps < m.minFps && currentFps > 10) {
      m.minFps = Math.round(currentFps);
    }

    if (frameTimeMs > 33.3) {
      m.spikes30 += 1;
    }
    if (frameTimeMs > 50.0) {
      m.spikes50 += 1;
    }

    m.samples = newSamples;
    // Debounced save every 120 samples
    if (newSamples % 120 === 0) {
      this.save();
    }
  }

  public recordTutorialCompleted(isReplay: boolean) {
    this.data.tutorialCompleted = true;
    if (isReplay) {
      this.data.tutorialReplays += 1;
    }
    this.save();
  }

  public getDiagnostics(): DiagnosticsData {
    return { ...this.data };
  }

  public resetDiagnostics() {
    this.data = { ...DEFAULT_DIAGNOSTICS, lastUpdated: new Date().toISOString() };
    this.save();
  }

  public exportJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }
}

export const localAnalytics = new LocalAnalyticsService();
