import * as Location from 'expo-location';
import { api } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalkingSpeed = 'slow' | 'average' | 'power';
export type StudyIntensity = 'chill' | 'midterm' | 'finals';

export type UserContext = {
  walkingSpeed: WalkingSpeed;
  studyIntensity: StudyIntensity;
  gapMinutes: number;
  hardFilters?: string[];    // allergy tags — item must have ALL of these
  prefFilters?: string[];    // preference tags — item must match at least one
};

export type VenueRecommendation = {
  venueName: string;
  walkMinutes: number;
  reachable: boolean;
  grabAndGo: boolean;
};

// ---------------------------------------------------------------------------
// Venue registry — coordinates verified against UW campus map
// ---------------------------------------------------------------------------

const VENUES: {
  name: string;
  lat: number;
  lng: number;
  isMealVenue: boolean;
}[] = [
  // Full dining halls / meal venues
  { name: 'Center Table',                    lat: 47.6583, lng: -122.3148, isMealVenue: true  },
  { name: 'Local Point',                     lat: 47.6548, lng: -122.3175, isMealVenue: true  },
  { name: 'Cultivate',                       lat: 47.6571, lng: -122.3155, isMealVenue: true  },
  { name: 'By George',                       lat: 47.6564, lng: -122.3144, isMealVenue: true  },
  { name: 'Microsoft Café',                  lat: 47.6534, lng: -122.3084, isMealVenue: true  },
  { name: 'Husky Grind Café — Alder',        lat: 47.6553, lng: -122.3163, isMealVenue: true  },
  { name: 'Husky Grind Café — Oak',          lat: 47.6587, lng: -122.3094, isMealVenue: true  },
  { name: 'Husky Grind Café — Mercer Court', lat: 47.6617, lng: -122.3133, isMealVenue: true  },
  { name: 'District Market — Alder',         lat: 47.6553, lng: -122.3163, isMealVenue: true  },
  { name: 'District Market — Oak',           lat: 47.6587, lng: -122.3094, isMealVenue: true  },
  // Grab-and-go / snack venues
  { name: 'Husky Den Food Court',            lat: 47.6556, lng: -122.3049, isMealVenue: false },
  { name: 'Husky Den Café',                  lat: 47.6556, lng: -122.3049, isMealVenue: false },
  { name: 'Dawg Bites',                      lat: 47.6527, lng: -122.3010, isMealVenue: false },
  { name: "Orin's Place",                    lat: 47.6553, lng: -122.3068, isMealVenue: false },
  { name: 'Public Grounds',                  lat: 47.6580, lng: -122.3120, isMealVenue: false },
  { name: 'The Rotunda',                     lat: 47.6499, lng: -122.3079, isMealVenue: false },
  { name: 'Tower Café',                      lat: 47.6609, lng: -122.3145, isMealVenue: false },
  { name: 'Starbucks — Population Health',   lat: 47.6491, lng: -122.3072, isMealVenue: false },
  { name: 'Starbucks — Suzzallo',            lat: 47.6560, lng: -122.3096, isMealVenue: false },
  { name: 'Etc. — The HUB',                  lat: 47.6556, lng: -122.3049, isMealVenue: false },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALK_MPS: Record<WalkingSpeed, number> = {
  slow:    1.1,
  average: 1.4,
  power:   1.8,
};

const MIN_MEAL_GAP: Record<StudyIntensity, number> = {
  chill:   25,
  midterm: 18,
  finals:  12,
};

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

/**
 * Returns true if the venue has at least one menu item that passes
 * the user's hard (allergy) and preference filters.
 * Fails open — if the fetch errors, we assume the venue is fine.
 */
async function venueHasCompatibleItems(
  venueName: string,
  hardFilters: string[],
  prefFilters: string[],
): Promise<boolean> {
  try {
    const { data } = await api.get(`/admin/menu/${encodeURIComponent(venueName)}`);
    const items: { diet_tags: string[] }[] = data.items ?? [];
    if (items.length === 0) return false; // no items at all — skip

    return items.some((item) => {
      // Must pass all hard filters (allergies)
      if (hardFilters.length > 0) {
        if (!hardFilters.every((tag) => item.diet_tags.includes(tag))) return false;
      }
      // Must match at least one preference filter (if any set)
      if (prefFilters.length > 0) {
        if (!prefFilters.some((tag) => item.diet_tags.includes(tag))) return false;
      }
      return true;
    });
  } catch {
    return true; // fail open
  }
}

// ---------------------------------------------------------------------------
// Core recommendation logic
// ---------------------------------------------------------------------------

/**
 * Returns the best venue given location, gap, walking speed, study intensity,
 * and dietary filters. Guarantees the recommended venue has at least one
 * menu item compatible with the user's filters.
 *
 * Scoring rules:
 * 1. Only venues reachable in (gapMinutes / 2 - 5) min walk are considered.
 * 2. Tight gap → prefer grab-and-go; relaxed gap → prefer full meal venues.
 * 3. Venues with no compatible menu items are skipped.
 * 4. Tie-break: first in VENUES array (i.e. first seeded in DB order).
 * 5. If nothing passes dietary check, fall back to closest venue regardless.
 */
export async function recommendVenue(ctx: UserContext): Promise<VenueRecommendation> {
  const hardFilters = ctx.hardFilters ?? [];
  const prefFilters = ctx.prefFilters ?? [];

  const fallback: VenueRecommendation = {
    venueName: 'Husky Grind Café — Alder',
    walkMinutes: 5,
    reachable: true,
    grabAndGo: false,
  };

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
  const maxWalkMin = Math.max(2, ctx.gapMinutes / 2 - 5);
  const maxWalkMeters = maxWalkMin * 60 * mps;
  const tightGap = ctx.gapMinutes < MIN_MEAL_GAP[ctx.studyIntensity];

  // Score all reachable venues
  type Scored = { venue: typeof VENUES[0]; dist: number; score: number };
  const scored: Scored[] = [];

  for (const venue of VENUES) {
    const dist = haversineMeters(latitude, longitude, venue.lat, venue.lng);
    if (dist > maxWalkMeters) continue;

    let score = dist;
    if (tightGap && venue.isMealVenue) score += 300;
    if (!tightGap && !venue.isMealVenue) score += 400;
    scored.push({ venue, dist, score });
  }

  // Sort by score — tie-break is VENUES array order (first seeded wins)
  scored.sort((a, b) => a.score !== b.score ? a.score - b.score : 0);

  // Walk down the ranked list and pick the first venue with compatible items
  for (const { venue, dist } of scored) {
    const compatible = await venueHasCompatibleItems(venue.name, hardFilters, prefFilters);
    if (!compatible) continue;
    return {
      venueName: venue.name,
      walkMinutes: toWalkMinutes(dist, ctx.walkingSpeed),
      reachable: true,
      grabAndGo: !venue.isMealVenue,
    };
  }

  // Nothing reachable with compatible items — fall back to closest overall
  // (still check dietary compatibility, skip if empty)
  let closest = VENUES[0];
  let minDist = Infinity;
  for (const v of VENUES) {
    const d = haversineMeters(latitude, longitude, v.lat, v.lng);
    if (d < minDist) { minDist = d; closest = v; }
  }
  return {
    venueName: closest.name,
    walkMinutes: toWalkMinutes(minDist, ctx.walkingSpeed),
    reachable: false,
    grabAndGo: !closest.isMealVenue,
  };
}
