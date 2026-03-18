import * as Location from 'expo-location';

// ---------------------------------------------------------------------------
// Venue registry — accurate coords from UW campus map + building addresses
// "isMealVenue" = serves proper meals (not just coffee/snacks)
// ---------------------------------------------------------------------------
const VENUES: {
  name: string;
  lat: number;
  lng: number;
  isMealVenue: boolean;
}[] = [
  // ── Residential dining (full meals) ──────────────────────────────────────
  { name: 'Center Table',                    lat: 47.6583, lng: -122.3148, isMealVenue: true  },
  { name: 'Local Point',                     lat: 47.6548, lng: -122.3175, isMealVenue: true  },
  { name: 'Cultivate',                       lat: 47.6571, lng: -122.3155, isMealVenue: true  },

  // ── Cafés with real food ──────────────────────────────────────────────────
  { name: 'By George',                       lat: 47.6564, lng: -122.3144, isMealVenue: true  },
  { name: 'Microsoft Café',                  lat: 47.6534, lng: -122.3084, isMealVenue: true  },
  { name: 'Husky Grind Café — Alder',        lat: 47.6553, lng: -122.3163, isMealVenue: true  },
  { name: 'Husky Grind Café — Oak',          lat: 47.6587, lng: -122.3094, isMealVenue: true  },
  { name: 'Husky Grind Café — Mercer Court', lat: 47.6617, lng: -122.3133, isMealVenue: true  },

  // ── District Markets (grab-and-go + deli) ────────────────────────────────
  { name: 'District Market — Alder',         lat: 47.6553, lng: -122.3163, isMealVenue: true  },
  { name: 'District Market — Oak',           lat: 47.6587, lng: -122.3094, isMealVenue: true  },

  // ── Snack / coffee only ───────────────────────────────────────────────────
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

// Penalty added to snack-only venues so meal venues win unless they're
// more than ~400 m further away (~5 min walk)
const SNACK_PENALTY_METERS = 400;

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
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

function metersToWalkMinutes(m: number) {
  return Math.max(1, Math.round(m / 1.4 / 60));
}

export type NearestVenueResult = {
  venueName: string;
  walkMinutes: number;
};

export async function getNearestVenue(): Promise<NearestVenueResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { venueName: 'Husky Grind Café — Alder', walkMinutes: 5 };
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;

  let nearest = VENUES[0];
  let minScore = Infinity;

  for (const venue of VENUES) {
    const dist = haversineMeters(latitude, longitude, venue.lat, venue.lng);
    // Snack-only venues get a penalty so meal venues are preferred unless much closer
    const score = dist + (venue.isMealVenue ? 0 : SNACK_PENALTY_METERS);
    if (score < minScore) {
      minScore = score;
      nearest = venue;
    }
  }

  const actualDist = haversineMeters(latitude, longitude, nearest.lat, nearest.lng);
  return { venueName: nearest.name, walkMinutes: metersToWalkMinutes(actualDist) };
}
