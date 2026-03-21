import { useState, useEffect, useRef } from 'react';

const USDA_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';
const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Nutrients we care about — keyed by FDC nutrient number
const NUTRIENT_IDS: Record<number, string> = {
  203: 'protein',
  204: 'fat',
  205: 'carbohydrates',
  208: 'calories',
  291: 'fiber',
  301: 'calcium',
  303: 'iron',
  324: 'vitamin_d',
  418: 'vitamin_b12',
};

export interface FoodPortion {
  description: string; // e.g. "slice", "wing", "cup"
  gramWeight: number;  // grams per 1 unit
}

export interface FoodResult {
  fdcId: number;
  name: string;
  // nutrients per 100g
  nutrients: Record<string, number>;
  // best portion unit from FDC (null if not available)
  portion: FoodPortion | null;
}

export function useFoodSearch(query: string, debounceMs = 500) {
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const url = `${USDA_URL}?query=${encodeURIComponent(query)}&pageSize=8&api_key=${USDA_KEY}`;
        const res = await fetch(url, { signal: abortRef.current.signal });
        if (!res.ok) throw new Error(`USDA API error: ${res.status}`);
        const data = await res.json();
        console.log('FDC Response:', data);

        const foods: FoodResult[] = (data.foods ?? []).map((f: any) => {
          // Bulletproof nutrient extraction — FDC is inconsistent across food types.
          // Priority: nutrientId (branded) → nutrientNumber (SR Legacy) → nutrientName fallback
          const nutrients: Record<string, number> = {};
          for (const n of f.foodNutrients ?? []) {
            const rawId = n.nutrientId ?? n.nutrientNumber;
            const id = rawId != null ? Number(rawId) : NaN;
            let key = !isNaN(id) ? NUTRIENT_IDS[id] : undefined;

            // Name-based fallback for when IDs are missing or mismatched
            if (!key && n.nutrientName) {
              const nm = n.nutrientName.toLowerCase();
              if (nm.includes('protein'))                          key = 'protein';
              else if (nm === 'iron' || nm.includes('iron, fe'))   key = 'iron';
              else if (nm.includes('total lipid') || nm === 'fat') key = 'fat';
              else if (nm.includes('carbohydrate'))                key = 'carbohydrates';
              else if (nm.includes('energy') || nm.includes('calorie')) key = 'calories';
              else if (nm.includes('fiber'))                       key = 'fiber';
              else if (nm.includes('calcium'))                     key = 'calcium';
              else if (nm.includes('vitamin d'))                   key = 'vitamin_d';
              else if (nm.includes('vitamin b-12') || nm.includes('cobalamin')) key = 'vitamin_b12';
            }

            const val = n.value ?? n.amount;
            if (key && val != null) nutrients[key] = val;
          }
          console.log(`FDC Parsed Nutrients [${f.description}]:`, nutrients);

          // Pick best portion from foodMeasures or foodPortions
          let portion: FoodPortion | null = null;
          const measures: any[] = f.foodMeasures ?? f.foodPortions ?? [];
          if (measures.length > 0) {
            const m = measures[0];
            const grams = m.gramWeight ?? m.gram_weight ?? null;
            const desc  = m.disseminationText ?? m.portionDescription ?? m.measureUnit?.name ?? 'serving';
            if (grams && grams > 0) portion = { description: desc.toLowerCase(), gramWeight: grams };
          }

          return { fdcId: f.fdcId, name: f.description, nutrients, portion };
        });

        setResults(foods);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          const msg = err.message ?? 'Search failed';
          console.error('FDC Search error:', err);
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  return { results, loading, error };
}

// ---------------------------------------------------------------------------
// Portion math
// ---------------------------------------------------------------------------

export type QuickPortion = 'side' | 'main' | 'hungry';

const QUICK_MULTIPLIERS: Record<QuickPortion, number> = {
  side:   0.5,   // ~50g
  main:   1.5,   // ~150g
  hungry: 2.5,   // ~250g
};

/**
 * Returns the gram multiplier to apply to per-100g FDC values.
 * - Quick track: uses fixed gram estimates
 * - Digit track: uses FDC portion gramWeight * count / 100
 */
export function calcMultiplier(
  mode: 'quick' | 'digit',
  quickPortion: QuickPortion,
  digitCount: number,
  portion: FoodPortion | null,
): number {
  if (mode === 'quick') return QUICK_MULTIPLIERS[quickPortion];
  if (mode === 'digit' && portion) return (digitCount * portion.gramWeight) / 100;
  // digit mode but no FDC portion — fall back to quick
  return QUICK_MULTIPLIERS[quickPortion];
}

/**
 * Applies multiplier to per-100g nutrients and returns effective amounts.
 */
export function applyPortion(
  nutrients: Record<string, number>,
  multiplier: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(nutrients)) {
    out[k] = Math.round(v * multiplier * 100) / 100;
  }
  return out;
}
