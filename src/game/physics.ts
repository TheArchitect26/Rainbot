/** Shared movement tuning: a readable apex, decisive descent and a brief slide. */
export const JUMP_SPEED = 11;
export const JUMP_GRAVITY = 42;
export const LOW_GRAVITY_JUMP_SPEED = 10.5;
export const LOW_GRAVITY = 24;
export const FALL_MULTIPLIER = 1.35;
export const SLIDE_SECONDS = 0.55;
export const SLIDE_COLLISION_HEIGHT = 0.95;
export const DRONE_HEIGHT = 2.2;

/** Exact integration, including an apex crossed during this step. */
export function integrateJump(y: number, velocity: number, gravity: number, dt: number) {
  let remaining = dt;
  if (velocity > 0) {
    const rising = Math.min(remaining, velocity / gravity);
    y += velocity * rising - 0.5 * gravity * rising * rising;
    velocity -= gravity * rising;
    remaining -= rising;
  }
  const fallingGravity = gravity * FALL_MULTIPLIER;
  y += velocity * remaining - 0.5 * fallingGravity * remaining * remaining;
  velocity -= fallingGravity * remaining;
  return { y: Math.max(0, y), velocity: y <= 0 ? 0 : velocity };
}

/** Critically damped lateral movement: acceleration without overshoot or snapping. */
export function integrateLane(x: number, velocity: number, target: number, dt: number) {
  const omega = 28;
  const offset = x - target;
  const spring = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return {
    x: target + (offset + spring * dt) * decay,
    velocity: (velocity - omega * spring * dt) * decay,
  };
}
