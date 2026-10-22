export type SwipeAction = 'LEFT' | 'RIGHT' | 'JUMP' | 'SLIDE';
export function swipeAction(x: number, y: number, started: number, endX: number, endY: number, now: number): SwipeAction | null {
  const dx = endX - x, dy = endY - y;
  const threshold = now - started < 350 ? 20 : 35;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  return Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'LEFT' : 'RIGHT' : dy < 0 ? 'JUMP' : 'SLIDE';
}
