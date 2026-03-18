import { EatingWindow, TimelineBlock } from '../types';

// Generates sensible default meal windows when no calendar is connected.
// Breakfast 8–9, Lunch 12–13, Dinner 18–19
export function defaultMealWindows(date = new Date()): EatingWindow[] {
  const d = (h: number, m = 0) => {
    const t = new Date(date);
    t.setHours(h, m, 0, 0);
    return t.toISOString();
  };

  return [
    { start: d(8),  end: d(9),  duration_minutes: 60, window_type: 'golden' },
    { start: d(12), end: d(13), duration_minutes: 60, window_type: 'golden' },
    { start: d(18), end: d(19), duration_minutes: 60, window_type: 'golden' },
  ];
}

// Converts eating windows into timeline meal_gap blocks
export function windowsToBlocks(windows: EatingWindow[]): TimelineBlock[] {
  const labels: Record<number, string> = { 8: 'Breakfast', 12: 'Lunch', 18: 'Dinner' };
  return windows.map((w) => {
    const h = new Date(w.start).getHours();
    const label = labels[h] ?? 'Meal Window';
    return {
      startTime: w.start,
      endTime: w.end,
      type: 'meal_gap' as const,
      label: `${label} — ${w.duration_minutes} min`,
      nutrientMatchLabel: undefined,
      venueHint: undefined,
    };
  });
}
