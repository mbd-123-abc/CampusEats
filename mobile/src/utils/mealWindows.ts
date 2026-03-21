import { EatingWindow, TimelineBlock, GapCategory } from '../types';

// ---------------------------------------------------------------------------
// Gap classification
// ---------------------------------------------------------------------------

export function classifyGap(minutes: number): GapCategory {
  if (minutes < 15) return 'sprint';
  if (minutes < 35) return 'micro';
  if (minutes < 90) return 'standard';
  return 'deep';
}

// ---------------------------------------------------------------------------
// Slot definitions
// ---------------------------------------------------------------------------

// Anchor meals — standard minGap first, tightMinGap used when schedule is packed
const ANCHOR_SLOTS = [
  { idealHour: 8,  idealMin: 30, minGap: 20, tightMinGap: 15 }, // Breakfast
  { idealHour: 13, idealMin: 0,  minGap: 25, tightMinGap: 20 }, // Lunch
  { idealHour: 19, idealMin: 15, minGap: 25, tightMinGap: 20 }, // Dinner
];

// Standard snacks: one B→L, one L→D
const SNACK_SLOTS = [
  { idealHour: 10, idealMin: 30, minGap: 10 },
  { idealHour: 15, idealMin: 30, minGap: 10 },
];

// Extra snacks used when anchors can't all be placed (tight day)
const EXTRA_SNACK_SLOTS = [
  { idealHour: 9,  idealMin: 0,  minGap: 10 },
  { idealHour: 11, idealMin: 30, minGap: 10 },
  { idealHour: 14, idealMin: 0,  minGap: 10 },
  { idealHour: 17, idealMin: 0,  minGap: 10 },
  { idealHour: 20, idealMin: 30, minGap: 10 },
  { idealHour: 22, idealMin: 30, minGap: 10 },
];

const WALK_BUFFER_MINS = 10;

// ---------------------------------------------------------------------------
// Default windows (no calendar connected)
// ---------------------------------------------------------------------------

export function defaultMealWindows(date = new Date()): EatingWindow[] {
  const d = (h: number, m = 0) => {
    const t = new Date(date); t.setHours(h, m, 0, 0); return t.toISOString();
  };
  return [
    { start: d(8),  end: d(8,  30), duration_minutes: 30, window_type: 'golden', gap_category: 'standard' },
    { start: d(10), end: d(10, 15), duration_minutes: 15, window_type: 'micro',  gap_category: 'micro'    },
    { start: d(12), end: d(12, 45), duration_minutes: 45, window_type: 'golden', gap_category: 'standard' },
    { start: d(15), end: d(15, 15), duration_minutes: 15, window_type: 'micro',  gap_category: 'micro'    },
    { start: d(18), end: d(19),     duration_minutes: 60, window_type: 'golden', gap_category: 'standard' },
  ];
}

export interface CalendarEventRaw {
  id: string;
  title: string;
  start: string;
  end: string;
}

// ---------------------------------------------------------------------------
// Infer day bounds from the actual calendar events
// Early birds: first event before 8am → dayStart = 5am
// Night owls:  last event after 21:00 → dayEnd = 2am next day (26:00)
// ---------------------------------------------------------------------------

function inferDayBounds(events: CalendarEventRaw[], date: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(date);
  const dayEnd   = new Date(date);

  if (events.length === 0) {
    dayStart.setHours(7, 0, 0, 0);
    dayEnd.setHours(22, 0, 0, 0);
    return { dayStart, dayEnd };
  }

  const starts = events.map((e) => new Date(e.start).getHours() + new Date(e.start).getMinutes() / 60);
  const ends   = events.map((e) => new Date(e.end).getHours()   + new Date(e.end).getMinutes()   / 60);
  const firstStart = Math.min(...starts);
  const lastEnd    = Math.max(...ends);

  // dayStart: 30 min before first event, clamped between 5am and 8am
  const startHour = Math.max(5, Math.min(8, firstStart - 0.5));
  dayStart.setHours(Math.floor(startHour), (startHour % 1) * 60, 0, 0);

  // dayEnd: 2h after last event, clamped between 22:00 and 26:00 (2am next day)
  const endHour = Math.min(26, Math.max(22, lastEnd + 2));
  if (endHour >= 24) {
    // next calendar day
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(endHour - 24, 0, 0, 0);
  } else {
    dayEnd.setHours(Math.floor(endHour), (endHour % 1) * 60, 0, 0);
  }

  return { dayStart, dayEnd };
}

// ---------------------------------------------------------------------------
// mealWindowsFromEvents
// ---------------------------------------------------------------------------

/**
 * Assigns meal windows from calendar free gaps.
 *
 * Standard (open schedule): Breakfast + Snack + Lunch + Snack + Dinner
 * Tight schedule: anchors use reduced minGap; missing anchors replaced with
 * extra snack slots so the student always has something to eat.
 *
 * Day bounds are inferred from the actual events:
 *   - Early birds (first class before 8am) → day starts at 5–6am
 *   - Night owls  (last class after 9pm)   → day ends at midnight–2am
 */
export function mealWindowsFromEvents(
  events: CalendarEventRaw[],
  date = new Date(),
): EatingWindow[] {
  const { dayStart, dayEnd } = inferDayBounds(events, date);

  // Sort + merge overlapping events
  const sorted = [...events]
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
    .filter((e) => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date }[] = [];
  for (const ev of sorted) {
    const last = merged[merged.length - 1];
    if (last && ev.start <= last.end) {
      last.end = ev.end > last.end ? ev.end : last.end;
    } else {
      merged.push({ start: new Date(ev.start), end: new Date(ev.end) });
    }
  }

  const busyBoundaries = [
    { start: new Date(0), end: dayStart },
    ...merged,
    { start: dayEnd, end: new Date(8640000000000000) },
  ];

  const freeGaps: { start: Date; end: Date; minutes: number }[] = [];
  for (let i = 0; i < busyBoundaries.length - 1; i++) {
    const s = busyBoundaries[i].end;
    const e = busyBoundaries[i + 1].start;
    const mins = (e.getTime() - s.getTime()) / 60000;
    if (mins >= 10) freeGaps.push({ start: s, end: e, minutes: mins });
  }

  const usedGapTime: { gapIdx: number; usedUntil: Date }[] = [];

  function assignSlot(idealHour: number, idealMin: number, minGap: number): EatingWindow | null {
    // For hours >= 24 (night owl slots), resolve to next-day date
    const idealTime = new Date(date);
    if (idealHour >= 24) {
      idealTime.setDate(idealTime.getDate() + 1);
      idealTime.setHours(idealHour - 24, idealMin, 0, 0);
    } else {
      idealTime.setHours(idealHour, idealMin, 0, 0);
    }

    let bestGapIdx = -1;
    let bestDist = Infinity;

    for (let gi = 0; gi < freeGaps.length; gi++) {
      const gap = freeGaps[gi];
      const used = usedGapTime.find((u) => u.gapIdx === gi);
      const effectiveStart = used ? used.usedUntil : gap.start;
      const effectiveMins = (gap.end.getTime() - effectiveStart.getTime()) / 60000 - WALK_BUFFER_MINS;
      if (effectiveMins < minGap) continue;
      const dist = Math.abs(effectiveStart.getTime() - idealTime.getTime());
      if (dist < bestDist) { bestDist = dist; bestGapIdx = gi; }
    }

    if (bestGapIdx === -1) return null;

    const gap = freeGaps[bestGapIdx];
    const used = usedGapTime.find((u) => u.gapIdx === bestGapIdx);
    const windowStart = used ? used.usedUntil : gap.start;
    const clampedStart = windowStart < idealTime && idealTime < gap.end ? idealTime : windowStart;
    const duration = Math.min(minGap + 10, (gap.end.getTime() - clampedStart.getTime()) / 60000);
    const windowEnd = new Date(clampedStart.getTime() + duration * 60000);
    const durationRounded = Math.round(duration);
    const category = classifyGap(durationRounded);
    if (category === 'sprint') return null;

    const existingUsed = usedGapTime.find((u) => u.gapIdx === bestGapIdx);
    if (existingUsed) existingUsed.usedUntil = windowEnd;
    else usedGapTime.push({ gapIdx: bestGapIdx, usedUntil: windowEnd });

    return {
      start: clampedStart.toISOString(),
      end: windowEnd.toISOString(),
      duration_minutes: durationRounded,
      window_type: minGap >= 20 ? 'golden' : 'micro',
      gap_category: category,
    };
  }

  // 1. Try standard anchor placement
  let breakfast = assignSlot(ANCHOR_SLOTS[0].idealHour, ANCHOR_SLOTS[0].idealMin, ANCHOR_SLOTS[0].minGap);
  let lunch      = assignSlot(ANCHOR_SLOTS[1].idealHour, ANCHOR_SLOTS[1].idealMin, ANCHOR_SLOTS[1].minGap);
  let dinner     = assignSlot(ANCHOR_SLOTS[2].idealHour, ANCHOR_SLOTS[2].idealMin, ANCHOR_SLOTS[2].minGap);

  // 2. Tight schedule: retry failed anchors with reduced minGap
  if ([breakfast, lunch, dinner].filter(Boolean).length < 3) {
    // Reset usedGapTime to only what successful anchors consumed
    usedGapTime.length = 0;
    for (const w of [breakfast, lunch, dinner]) {
      if (!w) continue;
      for (let gi = 0; gi < freeGaps.length; gi++) {
        const gap = freeGaps[gi];
        const wStart = new Date(w.start);
        const wEnd   = new Date(w.end);
        if (wStart >= gap.start && wEnd <= gap.end) {
          const existing = usedGapTime.find((u) => u.gapIdx === gi);
          if (existing) { if (wEnd > existing.usedUntil) existing.usedUntil = wEnd; }
          else usedGapTime.push({ gapIdx: gi, usedUntil: wEnd });
        }
      }
    }
    if (!breakfast) breakfast = assignSlot(ANCHOR_SLOTS[0].idealHour, ANCHOR_SLOTS[0].idealMin, ANCHOR_SLOTS[0].tightMinGap);
    if (!lunch)     lunch     = assignSlot(ANCHOR_SLOTS[1].idealHour, ANCHOR_SLOTS[1].idealMin, ANCHOR_SLOTS[1].tightMinGap);
    if (!dinner)    dinner    = assignSlot(ANCHOR_SLOTS[2].idealHour, ANCHOR_SLOTS[2].idealMin, ANCHOR_SLOTS[2].tightMinGap);
  }

  // 3. Standard snack slots
  const morningSnack   = assignSlot(SNACK_SLOTS[0].idealHour, SNACK_SLOTS[0].idealMin, SNACK_SLOTS[0].minGap);
  const afternoonSnack = assignSlot(SNACK_SLOTS[1].idealHour, SNACK_SLOTS[1].idealMin, SNACK_SLOTS[1].minGap);

  // 4. Extra snacks to replace any still-missing anchors (tight day)
  const anchorCount = [breakfast, lunch, dinner].filter(Boolean).length;
  const extraSnacks: EatingWindow[] = [];
  if (anchorCount < 3) {
    for (const s of EXTRA_SNACK_SLOTS) {
      const w = assignSlot(s.idealHour, s.idealMin, s.minGap);
      if (w) extraSnacks.push(w);
    }
  }

  const rawWindows = [breakfast, morningSnack, lunch, afternoonSnack, dinner, ...extraSnacks]
    .filter((w): w is EatingWindow => w !== null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Enforce minimum 60-minute gap between meals.
  // If a window is too close to the previous one, push it into the next
  // free gap (no class conflict) that starts ≥60 min after the previous meal ends.
  const MIN_GAP_MS = 60 * 60 * 1000;

  function pushIntoNextFreeSlot(w: EatingWindow, earliestStart: Date): EatingWindow | null {
    const durationMs = w.duration_minutes * 60 * 1000;
    for (const gap of freeGaps) {
      // Candidate start: max of gap.start and earliestStart
      const candidateStart = gap.start >= earliestStart ? gap.start : earliestStart;
      if (candidateStart >= gap.end) continue;
      const available = gap.end.getTime() - candidateStart.getTime();
      if (available < durationMs) continue;
      const newEnd = new Date(candidateStart.getTime() + durationMs);
      const durationRounded = w.duration_minutes;
      return {
        ...w,
        start: candidateStart.toISOString(),
        end: newEnd.toISOString(),
        duration_minutes: durationRounded,
        gap_category: classifyGap(durationRounded),
      };
    }
    return null; // no suitable gap found — drop it
  }

  const windows: EatingWindow[] = [];
  for (const w of rawWindows) {
    const prev = windows[windows.length - 1];
    if (!prev) {
      windows.push(w);
      continue;
    }
    const prevEndMs = new Date(prev.end).getTime();
    const wStartMs  = new Date(w.start).getTime();
    if (wStartMs - prevEndMs >= MIN_GAP_MS) {
      windows.push(w);
    } else {
      // Prefer 120 min gap, fall back to 60 min if nothing fits
      const ideal    = new Date(prevEndMs + 120 * 60 * 1000);
      const fallback = new Date(prevEndMs + MIN_GAP_MS);
      const pushed   = pushIntoNextFreeSlot(w, ideal) ?? pushIntoNextFreeSlot(w, fallback);
      if (pushed) windows.push(pushed);
    }
  }

  return windows.length > 0 ? windows : defaultMealWindows(date);
}

// ---------------------------------------------------------------------------
// windowsToBlocks — label windows with meal names
//
// Rules:
//   • Exactly one Breakfast (closest to 8:30, must start before 11:00)
//     — if no window qualifies, the FIRST window of the day becomes Breakfast
//   • Exactly one Lunch (closest to 13:00, after Breakfast)
//   • Exactly one Dinner (closest to 19:15, at or after 16:00, after Lunch)
//   • One Snack between Breakfast→Lunch (closest to 10:30)
//   • One Snack between Lunch→Dinner (closest to 15:30)
//   • Tight schedule: if fewer than 3 anchors placed, add extra snacks to
//     fill the gaps so the student always has something to eat
//   • All remaining windows = Snack
// ---------------------------------------------------------------------------

export function windowsToBlocks(windows: EatingWindow[], walkMinutesPerWindow?: number[]): TimelineBlock[] {
  if (windows.length === 0) return [];

  // windows are already sorted by start time (guaranteed by mealWindowsFromEvents)
  const hourOf = (w: EatingWindow) =>
    new Date(w.start).getHours() + new Date(w.start).getMinutes() / 60;

  const usedIdx = new Set<number>();

  function pickClosest(idealHour: number, candidates: number[]): number {
    return candidates.reduce((best, i) =>
      Math.abs(hourOf(windows[i]) - idealHour) < Math.abs(hourOf(windows[best]) - idealHour) ? i : best
    , candidates[0]);
  }

  // Breakfast: closest to 8:30, before 11:00
  // Fallback: if nothing qualifies, the very first window becomes Breakfast
  const bfCandidates = windows.map((_, i) => i).filter((i) => hourOf(windows[i]) < 11);
  let breakfastIdx = bfCandidates.length > 0 ? pickClosest(8.5, bfCandidates) : 0;
  usedIdx.add(breakfastIdx);

  // Lunch: closest to 13:00, strictly after Breakfast window
  const bfHour = hourOf(windows[breakfastIdx]);
  const luCandidates = windows.map((_, i) => i).filter(
    (i) => !usedIdx.has(i) && hourOf(windows[i]) > bfHour && hourOf(windows[i]) >= 11
  );
  const lunchIdx = luCandidates.length > 0 ? pickClosest(13.0, luCandidates) : -1;
  if (lunchIdx !== -1) usedIdx.add(lunchIdx);

  // Dinner: closest to 19:15, at or after 16:00, strictly after Lunch
  const luHour = lunchIdx !== -1 ? hourOf(windows[lunchIdx]) : bfHour;
  const diCandidates = windows.map((_, i) => i).filter(
    (i) => !usedIdx.has(i) && hourOf(windows[i]) > luHour && hourOf(windows[i]) >= 16
  );
  const dinnerIdx = diCandidates.length > 0 ? pickClosest(19.25, diCandidates) : -1;
  if (dinnerIdx !== -1) usedIdx.add(dinnerIdx);

  // Morning snack: exactly one between Breakfast and Lunch, closest to 10:30
  const luBoundary = lunchIdx !== -1 ? hourOf(windows[lunchIdx]) : 13;
  const mornSnackCandidates = windows.map((_, i) => i).filter(
    (i) => !usedIdx.has(i) && hourOf(windows[i]) > bfHour && hourOf(windows[i]) < luBoundary
  );
  const morningSnackIdx = mornSnackCandidates.length > 0 ? pickClosest(10.5, mornSnackCandidates) : -1;
  if (morningSnackIdx !== -1) usedIdx.add(morningSnackIdx);

  // Afternoon snack: exactly one between Lunch and Dinner, closest to 15:30
  const diBoundary = dinnerIdx !== -1 ? hourOf(windows[dinnerIdx]) : 19.25;
  const aftnSnackCandidates = windows.map((_, i) => i).filter(
    (i) => !usedIdx.has(i) && hourOf(windows[i]) > luBoundary && hourOf(windows[i]) < diBoundary
  );
  const afternoonSnackIdx = aftnSnackCandidates.length > 0 ? pickClosest(15.5, aftnSnackCandidates) : -1;
  if (afternoonSnackIdx !== -1) usedIdx.add(afternoonSnackIdx);

  // Everything else = Snack (tight schedule extras, late-night windows, etc.)
  const labels: string[] = windows.map((_, i) => {
    if (i === breakfastIdx)    return 'Breakfast';
    if (i === lunchIdx)        return 'Lunch';
    if (i === dinnerIdx)       return 'Dinner';
    return 'Snack';
  });

  return windows.map((w, i) => {
    const cat = w.gap_category;
    const walkMins = walkMinutesPerWindow?.[i] ?? 5;
    const eatMins = cat === 'micro' ? 7 : 20;
    return {
      startTime: w.start,
      endTime: w.end,
      type: 'meal_gap' as const,
      label: labels[i],
      gap_category: cat,
      actionTimeMinutes: walkMins * 2 + eatMins,
      nutrientMatchLabel: undefined,
      venueHint: undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// eventsToClassBlocks
// ---------------------------------------------------------------------------

export function eventsToClassBlocks(events: CalendarEventRaw[]): TimelineBlock[] {
  return events.map((e) => ({
    startTime: e.start,
    endTime: e.end,
    type: 'class' as const,
    label: e.title.length > 25 ? e.title.slice(0, 24) + '…' : e.title,
  }));
}
