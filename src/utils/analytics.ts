import { storage } from '../utils/storage';
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
  tutorialStarts: number;
  tutorialSkips: number;
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
    avgFps: 0,
    minFps: 0,
    spikes30: 0,
    spikes50: 0,
  },
  tutorialCompleted: false,
  tutorialReplays: 0,
  tutorialStarts: 0,
  tutorialSkips: 0,
  rapidRestarts: 0,
  dailyChallengeRuns: 0,
  dailyChallengeBest: 0,
  lastUpdated: new Date().toISOString(),
  recentRuns: [],
};

export class LocalAnalyticsService {
  private data: DiagnosticsData;
  private runActive = false;
  private lastGameOverTime: number | null = null;

  constructor() {
    this.data = this.loadData();
  }

  private fresh(): DiagnosticsData {
    return structuredClone(DEFAULT_DIAGNOSTICS);
  }

  private loadData(): DiagnosticsData {
    const fresh = this.fresh();
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return fresh;
      for (const key of Object.keys(fresh) as (keyof DiagnosticsData)[]) {
        if (typeof fresh[key] === 'number' && Number.isFinite(saved[key]) && saved[key] >= 0) {
          Object.assign(fresh, { [key]: saved[key] });
        }
      }
      fresh.tutorialCompleted = saved.tutorialCompleted === true;
      fresh.eliminationCauses = Object.fromEntries(
        Object.entries(saved.eliminationCauses || {}).filter(
          ([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
        ),
      ) as Record<string, number>;
      fresh.recentRuns = Array.isArray(saved.recentRuns)
        ? saved.recentRuns.filter((r: RunRecord) => r && Number.isFinite(r.distance)).slice(0, 10)
        : [];
      // Legacy FPS statistics used a broken capped average. Start a clearly scoped session sample.
    } catch {
      /* Corrupt/older data: retain valid defaults. */
    }
    return fresh;
  }

  private save() {
    this.data.lastUpdated = new Date().toISOString();
    storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  public recordRunStart(isDailyChallenge: boolean) {
    this.runActive = true;
    this.data.totalRunsStarted++;
    if (this.lastGameOverTime !== null && performance.now() - this.lastGameOverTime < 8000)
      this.data.rapidRestarts++;
    this.lastGameOverTime = null; // A single death can contribute at most one rapid restart.
    if (isDailyChallenge) this.data.dailyChallengeRuns++;
    this.save();
  }

  public abandonRun() {
    this.runActive = false;
  }

  public recordRunEnd(
    score: number,
    distance: number,
    coins: number,
    eliminatedBy = 'UNKNOWN',
    isDailyChallenge = false,
    stageName = 'ZONE 1',
    durationSeconds = 0,
  ) {
    if (!this.runActive) return;
    this.runActive = false;
    this.lastGameOverTime = performance.now();
    const n = this.data.totalRunsCompleted;
    this.data.averageDistance += (distance - this.data.averageDistance) / (n + 1);
    this.data.totalRunsCompleted++;
    this.data.totalDurationSeconds += durationSeconds;
    this.data.averageRunDurationSeconds = this.data.totalDurationSeconds / (n + 1);
    this.data.maxDistance = Math.max(this.data.maxDistance, distance);
    const cause = eliminatedBy.toUpperCase();
    this.data.eliminationCauses[cause] = (this.data.eliminationCauses[cause] || 0) + 1;
    if (isDailyChallenge)
      this.data.dailyChallengeBest = Math.max(this.data.dailyChallengeBest, score);
    this.data.recentRuns.unshift({
      id: `run_${Date.now()}_${this.data.totalRunsCompleted}`,
      timestamp: new Date().toISOString(),
      score,
      distance,
      coins,
      durationSeconds,
      eliminatedBy: cause,
      isDailyChallenge,
      stageName,
    });
    this.data.recentRuns.length = Math.min(10, this.data.recentRuns.length);
    this.save();
  }

  public recordFPS(_currentFps: number, frameTimeMs: number) {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) return;
    const m = this.data.fpsMetrics;
    // Harmonic FPS: total frames / elapsed active rendering time. Never cap the denominator.
    const elapsed = m.samples ? (1000 * m.samples) / m.avgFps : 0;
    m.samples++;
    m.avgFps = (1000 * m.samples) / (elapsed + frameTimeMs);
    const fps = 1000 / frameTimeMs;
    m.minFps = m.samples === 1 ? fps : Math.min(m.minFps, fps);
    if (frameTimeMs > 1000 / 30) m.spikes30++;
    if (frameTimeMs > 50) m.spikes50++;
    if (m.samples % 300 === 0) this.save();
  }

  public recordTutorialStart(isReplay: boolean) {
    this.data.tutorialStarts++;
    if (isReplay) this.data.tutorialReplays++;
    this.save();
  }
  public recordTutorialSkipped() {
    this.data.tutorialSkips++;
    this.save();
  }
  public recordTutorialCompleted() {
    this.data.tutorialCompleted = true;
    this.save();
  }
  public getDiagnostics(): DiagnosticsData {
    return structuredClone(this.data);
  }
  public resetDiagnostics() {
    this.data = this.fresh();
    this.save();
  }
  public exportJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }
}
export const localAnalytics = new LocalAnalyticsService();
