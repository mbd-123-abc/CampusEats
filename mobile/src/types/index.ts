export type WindowType = 'golden' | 'micro';
export type DashboardState = 'normal' | 'in_class' | 'end_of_day';
export type MealMood = 'low' | 'neutral' | 'high';
export type LogSource = 'auto_contextual' | 'manual_search' | 'usual_shortcut' | 'photo';
export type PortionSize = 0.5 | 1.0 | 1.5;

export interface EatingWindow {
  start: string;          // ISO 8601 UTC
  end: string;            // ISO 8601 UTC
  duration_minutes: number;
  window_type: WindowType;
}

export interface MealRecommendation {
  mealName: string;
  venueName: string;
  walkMinutes: number;
  nutrientMatchScores: Record<string, number>;  // all values in [0.0, 1.0]
  overallScore: number;                          // [0.0, 1.0]
}

export interface HeroCardProps {
  minutesUntilWindow: number;
  windowType: WindowType;
  recommendation: MealRecommendation | null;
  dashboardState: DashboardState;
  onGetDirections: () => void;
  onSeeMenu: () => void;
}

export interface TimelineBlock {
  startTime: string;      // ISO 8601 UTC — NOT bare "HH:MM"
  endTime: string;        // ISO 8601 UTC
  type: 'class' | 'meal_gap';
  label: string;
  nutrientMatchLabel?: string;   // only for meal_gap
  venueHint?: string;            // only for meal_gap
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
