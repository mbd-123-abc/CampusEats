import { DashboardState, EatingWindow, TimelineBlock } from '../types';

/**
 * Pure function — calling twice with same inputs returns same state.
 * Postconditions:
 *   - 'in_class' requires an active class block containing now
 *   - 'end_of_day' requires all eating windows to have ended
 *   - 'normal' requires at least one future window and no active class
 */
export function resolveDashboardState(
  now: Date,
  classBlocks: TimelineBlock[],
  eatingWindows: EatingWindow[],
): DashboardState {
  // startTime/endTime are ISO 8601 timestamps — parse directly
  const activeClass = classBlocks.find(
    (b) =>
      b.type === 'class' &&
      new Date(b.startTime) <= now &&
      new Date(b.endTime) > now,
  );
  if (activeClass) return 'in_class';

  const futureWindows = eatingWindows.filter((w) => new Date(w.end) > now);
  if (futureWindows.length === 0) return 'end_of_day';

  return 'normal';
}

export function minutesUntilWindow(now: Date, window: EatingWindow): number {
  const diff = new Date(window.start).getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / 60000));
}
