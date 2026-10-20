/** A relative camera rig: world speed never creates extra follow lag.
 * Jumping and sliding deliberately do not move the horizon. No frame allocations. */
export class RunnerCamera {
  x = 0;
  y = 3.9;
  offsetZ = 6.6;
  lookX = 0;
  readonly lookY = 0.9;
  readonly lookAhead = 18;

  reset() {
    this.x = 0;
    this.y = 3.9;
    this.offsetZ = 6.6;
    this.lookX = 0;
  }

  update(
    dt: number,
    laneX: number,
    boosting: boolean,
    time: number,
    motion: boolean,
    shake: number,
  ) {
    const blend = 1 - Math.exp(-8 * Math.max(0, Math.min(dt, 0.1)));
    const bob = motion ? Math.sin(time * 1.8) * 0.025 : 0;
    const impact = motion
      ? Math.min(Math.max(shake, 0), 0.06) * Math.sin(time * 43)
      : 0;
    this.x += (laneX * 0.14 - this.x) * blend;
    this.y += (3.9 + bob + impact - this.y) * blend;
    this.offsetZ += (6.6 + (boosting ? 0.35 : 0) - this.offsetZ) * blend;
    this.lookX = this.x * 0.5;
  }
}
