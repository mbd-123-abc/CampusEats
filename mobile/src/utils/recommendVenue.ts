import * as Location from 'expo-location';
import { api } from '../api/client';
import { GapCategory } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalkingSpeed = 'slow' | 'average' | 'power';
export type StudyIntensity = 'chill' | 'midterm' | 'finals';

export type UserContext = {
  walkingSpeed: WalkingSpeed;
  studyIntensity: StudyIntensity;
  gapMinutes: number;
  gapCategory?: GapCategory;
  minutesSinceLastMeal?: number;  // for hunger score
  nextEventTitle?: string;        // for exam detection
  hardFilters?: string[];
  prefFilters?: string[];
  nextClassLat?: number;
  nextClassLng?: number;
};

export type VenueRecommendation = {
  venueName: string;
  walkMinutes: number;
  actionTimeMinutes: number;   // walkMinutes * 2 + eatMinutes
  reachable: boolean;
  grabAndGo: boolean;
  detourLabel: 'on-your-way' | 'short-detour' | 'detour';
};

// ---------------------------------------------------------------------------
// Venue registry
// ---------------------------------------------------------------------------

type VenueEntry = {
  name: string;
  lat: number;
  lng: number;
  isMealVenue: boolean;
  minGapRequired: number;  // minimum gap (mins) needed to use this venue
  eatMinutes: number;      // avg time to eat here
  deepBreak: boolean;      // has Wi-Fi + outlets — good for 90+ min gaps
};

const VENUES: VenueEntry[] = [
  // Full dining halls
  { name: 'Center Table',                    lat: 47.6583, lng: -122.3148, isMealVenue: true,  minGapRequired: 30, eatMinutes: 20, deepBreak: true  },
  { name: 'Local Point',                     lat: 47.6548, lng: -122.3175, isMealVenue: true,  minGapRequired: 30, eatMinutes: 20, deepBreak: true  },
  { name: 'Cultivate',                       lat: 47.6571, lng: -122.3155, isMealVenue: true,  minGapRequired: 30, eatMinutes: 20, deepBreak: true  },
  { name: 'By George',                       lat: 47.6564, lng: -122.3144, isMealVenue: true,  minGapRequired: 25, eatMinutes: 20, deepBreak: true  },
  { name: 'Microsoft Café',                  lat: 47.6534, lng: -122.3084, isMealVenue: true,  minGapRequired: 25, eatMinutes: 20, deepBreak: true  },
  { name: 'Husky Grind Café — Alder',        lat: 47.6553, lng: -122.3163, isMealVenue: true,  minGapRequired: 20, eatMinutes: 20, deepBreak: true  },
  { name: 'Husky Grind Café — Oak',          lat: 47.6587, lng: -122.3094, isMealVenue: true,  minGapRequired: 20, eatMinutes: 20, deepBreak: true  },
  { name: 'Husky Grind Café — Mercer Court', lat: 47.6617, lng: -122.3133, isMealVenue: true,  minGapRequired: 20, eatMinutes: 20, deepBreak: true  },
  { name: 'District Market — Alder',         lat: 47.6553, lng: -122.3163, isMealVenue: true,  minGapRequired: 15, eatMinutes: 7,  deepBreak: false },
  { name: 'District Market — Oak',           lat: 47.6587, lng: -122.3094, isMealVenue: true,  minGapRequired: 15, eatMinutes: 7,  deepBreak: false },
  // Grab-and-go / snack
  { name: 'Husky Den Food Court',            lat: 47.6556, lng: -122.3049, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: true  },
  { name: 'Husky Den Café',                  lat: 47.6556, lng: -122.3049, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: false },
  { name: 'Dawg Bites',                      lat: 47.6527, lng: -122.3010, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: false },
  { name: "Orin's Place",                    lat: 47.6553, lng: -122.3068, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: false },
  { name: 'Public Grounds',                  lat: 47.6580, lng: -122.3120, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: true  },
  { name: 'The Rotunda',                     lat: 47.6499, lng: -122.3079, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: false },
  { name: 'Tower Café',                      lat: 47.6609, lng: -122.3145, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: true  },
  { name: 'Starbucks — Population Health',   lat: 47.6491, lng: -122.3072, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: false },
  { name: 'Starbucks — Suzzallo',            lat: 47.6560, lng: -122.3096, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: true  },
  { name: 'Etc. — The HUB',                  lat: 47.6556, lng: -122.3049, isMealVenue: false, minGapRequired: 10, eatMinutes: 7,  deepBreak: true  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALK_MPS: Record<WalkingSpeed, number> = { slow: 1.1, average: 1.4, power: 1.8 };

// Base min gap per study intensity — hunger score can lower this
const BASE_MIN_GAP: Record<StudyIntensity, number> = { chill: 25, midterm: 18, finals: 12 };

// Exam keywords — triggers pre-game / recovery logic
const EXAM_KEYWORDS = ['exam', 'final', 'midterm', 'quiz', 'test'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toWalkMinutes(meters: number, speed: WalkingSpeed): number {
  return Math.max(1, Math.round(meters / WALK_MPS[speed] / 60));
}

function detourMeters(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  vLat: number, vLng: number,
): number {
  const direct = haversineMeters(fromLat, fromLng, toLat, toLng);
  const via = haversineMeters(fromLat, fromLng, vLat, vLng)
            + haversineMeters(vLat, vLng, toLat, toLng);
  return Math.max(0, via - direct);
}

function getDetourLabel(extraMeters: number, speed: WalkingSpeed): VenueRecommendation['detourLabel'] {
  const mins = extraMeters / WALK_MPS[speed] / 60;
  if (mins < 1)  return 'on-your-way';
  if (mins <= 3) return 'short-detour';
  return 'detour';
}

function isExamEvent(title?: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return EXAM_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * Hunger score modifier.
 * >3 hours since last meal → lower the effective minGap by 20% and add ranking bonus.
 */
function hungerModifier(minutesSinceLastMeal: number): { minGapMultiplier: number; rankBonus: number } {
  if (minutesSinceLastMeal > 180) return { minGapMultiplier: 0.8, rankBonus: -200 }; // hungry — easier to qualify, ranked higher
  if (minutesSinceLastMeal > 120) return { minGapMultiplier: 0.9, rankBonus: -100 };
  return { minGapMultiplier: 1.0, rankBonus: 0 };
}

async function venueHasCompatibleItems(
  venueName: string,
  hardFilters: string[],
  prefFilters: string[],
): Promise<boolean> {
  try {
    const { data } = await api.get(`/admin/menu/${encodeURIComponent(venueName)}`);
    const items: { diet_tags: string[] }[] = data.items ?? [];
    if (items.length === 0) return false;
    return items.some((item) => {
      if (hardFilters.length > 0 && !hardFilters.every((t) => item.diet_tags.includes(t))) return false;
      if (prefFilters.length > 0 && !prefFilters.some((t) => item.diet_tags.includes(t))) return false;
      return true;
    });
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Core recommendation
// ---------------------------------------------------------------------------

export async function recommendVenue(ctx: UserContext): Promise<VenueRecommendation> {
  const hardFilters = ctx.hardFilters ?? [];
  const prefFilters = ctx.prefFilters ?? [];
  const gapCategory = ctx.gapCategory ?? 'standard';
  const examMode = isExamEvent(ctx.nextEventTitle);

  const fallback: VenueRecommendation = {
    venueName: 'Husky Grind Café — Alder',
    walkMinutes: 5,
    actionTimeMinutes: 5 * 2 + 20,
    reachable: true,
    grabAndGo: false,
    detourLabel: 'on-your-way',
  };

  // Sprint gaps (<15 min) — no food suggestion
  if (gapCategory === 'sprint') return fallback;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return fallback;

  let pos;
  try {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    return fallback;
  }
  const { latitude, longitude } = pos.coords;

  const mps = WALK_MPS[ctx.walkingSpeed];
  const hunger = hungerModifier(ctx.minutesSinceLastMeal ?? 0);
  const baseMin = BASE_MIN_GAP[ctx.studyIntensity];
  const effectiveMinGap = Math.round(baseMin * hunger.minGapMultiplier);
  const maxWalkMin = Math.max(2, ctx.gapMinutes / 2 - 5);
  const maxWalkMeters = maxWalkMin * 60 * mps;
  const hasNextClass = ctx.nextClassLat != null && ctx.nextClassLng != null;

  type Scored = { venue: VenueEntry; dist: number; score: number; extraMeters: number };
  const scored: Scored[] = [];

  for (const venue of VENUES) {
    const dist = haversineMeters(latitude, longitude, venue.lat, venue.lng);
    if (dist > maxWalkMeters) continue;

    const walkMins = toWalkMinutes(dist, ctx.walkingSpeed);
    const actionTime = walkMins * 2 + venue.eatMinutes;

    // Venue requires more gap than available
    if (venue.minGapRequired > ctx.gapMinutes) continue;
    // Action time must fit in the gap
    if (actionTime > ctx.gapMinutes) continue;

    const extra = hasNextClass
      ? detourMeters(latitude, longitude, ctx.nextClassLat!, ctx.nextClassLng!, venue.lat, venue.lng)
      : 0;
    const extraMins = extra / mps / 60;

    // Micro gaps: only on-the-way venues (<2 min detour)
    if (gapCategory === 'micro' && extraMins > 2) continue;
    // Tight gaps: hide >5 min detour
    if (ctx.gapMinutes < effectiveMinGap && extraMins > 5) continue;

    let score = dist + extra * 1.5 + hunger.rankBonus;

    // Gap category preferences
    if (gapCategory === 'micro') {
      // Micro: strongly prefer grab-and-go
      if (venue.isMealVenue) score += 500;
    } else if (gapCategory === 'deep') {
      // Deep break: prefer deepBreak venues (Wi-Fi + outlets)
      if (!venue.deepBreak) score += 400;
      if (!venue.isMealVenue) score += 200;
    } else {
      // Standard: prefer meal venues unless gap is tight
      if (ctx.gapMinutes < effectiveMinGap && venue.isMealVenue) score += 300;
      if (ctx.gapMinutes >= effectiveMinGap && !venue.isMealVenue) score += 400;
    }

    // Exam mode: pre-game → grab-and-go; recovery → high-protein sit-down
    if (examMode) {
      if (venue.isMealVenue) score -= 150; // prefer quick options before exam
    }

    scored.push({ venue, dist, score, extraMeters: extra });
  }

  scored.sort((a, b) => a.score - b.score);

  for (const { venue, dist, extraMeters } of scored) {
    const compatible = await venueHasCompatibleItems(venue.name, hardFilters, prefFilters);
    if (!compatible) continue;
    const walkMins = toWalkMinutes(dist, ctx.walkingSpeed);
    return {
      venueName: venue.name,
      walkMinutes: walkMins,
      actionTimeMinutes: walkMins * 2 + venue.eatMinutes,
      reachable: true,
      grabAndGo: !venue.isMealVenue,
      detourLabel: getDetourLabel(extraMeters, ctx.walkingSpeed),
    };
  }

  // Fallback: closest venue regardless of filters
  let closest = VENUES[0];
  let minDist = Infinity;
  for (const v of VENUES) {
    const d = haversineMeters(latitude, longitude, v.lat, v.lng);
    if (d < minDist) { minDist = d; closest = v; }
  }
  const walkMins = toWalkMinutes(minDist, ctx.walkingSpeed);
  return {
    venueName: closest.name,
    walkMinutes: walkMins,
    actionTimeMinutes: walkMins * 2 + closest.eatMinutes,
    reachable: false,
    grabAndGo: !closest.isMealVenue,
    detourLabel: 'detour',
  };
}
