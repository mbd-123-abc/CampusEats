export type WindowType = 'golden' | 'micro';
export type GapCategory = 'sprint' | 'micro' | 'standard' | 'deep';
export type DashboardState = 'normal' | 'in_class' | 'end_of_day';
export type MealMood = 'energized' | 'satisfied' | 'food_coma' | 'bloated' | 'still_hungry';
export type LogSource = 'auto_contextual' | 'manual_search' | 'usual_shortcut' | 'photo';
export type PortionSize = 0.5 | 1.0 | 1.5;

export interface EatingWindow {
  start: string;
  end: string;
  duration_minutes: number;
  window_type: WindowType;
  gap_category: GapCategory;
}

export interface MealRecommendation {
  mealName: string;
  venueName: string;
  walkMinutes: number;
  actionTimeMinutes: number;   // walkMinutes * 2 + eatMinutes
  nutrientMatchScores: Record<string, number>;
  overallScore: number;
}

export interface HeroCardProps {
  minutesUntilWindow: number;
  windowType: WindowType;
  recommendation: MealRecommendation | null;
  dashboardState: DashboardState;
  onGetDirections: () => void;
  onSeeMenu: () => void;
  detourLabel?: 'on-your-way' | 'short-detour' | 'detour';
  nextMealLabel?: string;   // e.g. 'Breakfast', 'Lunch', 'Dinner', 'Snack'
  nextMealTime?: string;    // ISO string of the next window start
}

export interface TimelineBlock {
  startTime: string;
  endTime: string;
  type: 'class' | 'meal_gap';
  label: string;
  gap_category?: GapCategory;
  actionTimeMinutes?: number;  // time-to-action badge value
  nutrientMatchLabel?: string;
  venueHint?: string;
}

export interface TrackedNutrient {
  nutrientName: string;
  currentAmount: number;
  goalAmount: number;
  unit: string;
  forwardLookingHint?: string;
}

export interface NutrientPulseProps {
  trackedNutrients: TrackedNutrient[];
  showCalories: boolean;
}

export interface QuickLogPromptProps {
  show: boolean;
  mealName: string;
  onYes: () => void;    // silent background log — no navigation
  onNo: () => void;     // triggers smart snooze
  onUndo: () => void;   // reverses log within 5s undo window
}

export interface AuthToken {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface NutrientLogEntry {
  nutrientName: string;
  rawAmount: number;
  effectiveAmount: number;
  isEstimated: boolean;
  accuracyScore: number;
}
