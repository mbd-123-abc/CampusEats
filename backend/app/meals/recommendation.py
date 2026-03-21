"""
Nutrient-aware meal recommendation engine.

Given a venue, the user's nutrient targets, today's consumed totals,
and their dietary profile — returns the best menu item to eat next.

Critical deficit weighting:
  - Identifies which tracked nutrient is furthest from goal (% remaining)
  - Applies a 2x score multiplier to meals that contain that nutrient
  - Bioavailability pairs/inhibitors are applied on top
"""

from __future__ import annotations
from dataclasses import dataclass

from app.nutripath.scoring import calculate_nutrient_deficit, score_meals
from app.nutripath.filters import apply_dietary_filters
from app.nutripath.types import Meal, NutrientProfile, UserProfile, RankedMeal

# Nutrient goals (daily targets in standard units)
NUTRIENT_GOALS: dict[str, float] = {
    "iron":        18.0,
    "protein":     60.0,
    "vitamin_d":   20.0,
    "calcium":     1000.0,
    "vitamin_b12": 2.4,
    "fiber":       25.0,
}

# Bioavailability pairs: nutrient → list of enhancers
BIOAVAILABILITY_PAIRS: dict[str, list[str]] = {
    "iron":    ["vitamin_c"],
    "calcium": ["vitamin_d"],
}

# Bioavailability inhibitors: nutrient → list of inhibitors
BIOAVAILABILITY_INHIBITORS: dict[str, list[str]] = {
    "iron":    ["calcium", "caffeine"],
    "calcium": ["oxalate"],
}

# Pure drink keywords — excluded from food recommendations
DRINK_KEYWORDS = {
    "coffee", "latte", "cappuccino", "americano", "espresso",
    "cold brew", "iced coffee", "macchiato", "flat white",
    "chai", "matcha latte", "frappuccino", "nitro cold brew",
    "smoothie", "juice",
}


def _is_drink(name: str) -> bool:
    lower = name.lower()
    return any(kw in lower for kw in DRINK_KEYWORDS)


@dataclass
class MealRecommendationResult:
    meal_name: str
    reason_code: str          # e.g. "high_iron_match", "best_available", "no_menu_data"
    nutrient_match_scores: dict[str, float]
    overall_score: float


def _build_meal_from_item(item: dict) -> Meal | None:
    """Convert a MenuItem DB row (as dict) into a Meal for scoring."""
    nutrients_raw: dict = item.get("nutrients_json") or {}
    if not isinstance(nutrients_raw, dict):
        return None

    # Detect bioavailability pairs and inhibitors from nutrient composition
    pairs: list[str] = []
    inhibitors: list[str] = []
    for nutrient, enhancers in BIOAVAILABILITY_PAIRS.items():
        for enhancer in enhancers:
            if nutrients_raw.get(enhancer, 0) > 0:
                pairs.append(enhancer)
    for nutrient, inh_list in BIOAVAILABILITY_INHIBITORS.items():
        for inh in inh_list:
            if nutrients_raw.get(inh, 0) > 0:
                inhibitors.append(inh)

    # Build capability set from diet_tags
    properties: set[str] = set()
    tags: list[str] = item.get("diet_tags") or []
    tag_to_props = {
        "vegan":       {"animal_product"},
        "vegetarian":  set(),
        "gluten-free": set(),
        "nut-free":    set(),
        "halal":       {"halal_certified"},
        "kosher":      {"kosher_certified"},
    }
    # Invert: if tag is present, add the capability
    # If NOT vegan, add animal_product to properties
    if "vegan" not in tags:
        properties.add("animal_product")
    if "vegetarian" not in tags and "vegan" not in tags:
        properties.add("contains_red_meat")
        properties.add("contains_fish")
    if "halal" in tags:
        properties.add("halal_certified")
    if "kosher" in tags:
        properties.add("kosher_certified")
    if "gluten-free" not in tags:
        properties.add("contains_gluten")
    if "nut-free" not in tags:
        properties.add("contains_nuts")

    return Meal(
        id=item.get("item_id", ""),
        name=item.get("name", ""),
        location_id=item.get("venue", ""),
        nutrients=NutrientProfile(values={k: float(v) for k, v in nutrients_raw.items()}),
        tags=tags,
        properties=properties,
        prep_time_minutes=5,
        bioavailability_pairs=pairs,
        bioavailability_inhibitors=inhibitors,
    )


def _find_critical_deficit(
    nutrient_focus: list[str],
    targets: NutrientProfile,
    deficit: NutrientProfile,
) -> str | None:
    """Returns the nutrient with the highest % remaining deficit."""
    worst_nutrient = None
    worst_pct = -1.0
    for nutrient in nutrient_focus:
        target = targets.values.get(nutrient, 0)
        if target <= 0:
            continue
        remaining = deficit.values.get(nutrient, 0)
        pct = remaining / target
        if pct > worst_pct:
            worst_pct = pct
            worst_nutrient = nutrient
    return worst_nutrient


def recommend_meal(
    menu_items: list[dict],
    nutrient_focus: list[str],
    consumed_totals: dict[str, float],
    hard_filters: list[str],
    preference_filters: list[str],
    dislikes: list[str],
    dislike_strictness: str,
    academic_intensity: str,
) -> MealRecommendationResult:
    """
    Core recommendation logic. Pure function — no DB calls.

    Returns the best menu item given the user's nutrient deficit and dietary profile.
    """
    # Build targets and deficit
    targets = NutrientProfile(values={n: NUTRIENT_GOALS.get(n, 100.0) for n in nutrient_focus})
    consumed = NutrientProfile(values={n: consumed_totals.get(n, 0.0) for n in nutrient_focus})
    deficit = calculate_nutrient_deficit(targets, consumed)

    # Filter out pure drinks — only recommend actual food
    food_items = [i for i in menu_items if not _is_drink(i.get("name", ""))]
    # Fall back to all items if every item is a drink (e.g. coffee-only venue)
    candidates = food_items if food_items else menu_items

    # Convert menu items to Meal objects, skip items with no nutrient data
    meals: list[Meal] = []
    for item in candidates:
        meal = _build_meal_from_item(item)
        if meal:
            meals.append(meal)

    if not meals:
        # No nutrient data yet — still return a food item, not a drink
        fallback = candidates[0]["name"] if candidates else "Something from the menu"
        return MealRecommendationResult(
            meal_name=fallback,
            reason_code="no_nutrient_data",
            nutrient_match_scores={},
            overall_score=0.0,
        )

    # Build user profile for filtering + scoring
    user = UserProfile(
        user_id="",
        university_id="uw_seattle",
        hard_filters=hard_filters,
        preference_filters=preference_filters,
        daily_targets=targets,
        nutrient_focus=nutrient_focus,
        home_location_id="",
        academic_intensity=academic_intensity,
        dislike_strictness=dislike_strictness,
        dislikes=dislikes,
    )

    # Apply dietary filters (allergy kill-switch)
    filtered, _ = apply_dietary_filters(meals, user)
    if not filtered:
        filtered = meals  # fallback: ignore preference filters, keep hard filters

    # Score meals — nutripath engine handles bioavailability + deficit weighting
    from app.chronos.types import EatingWindow, WindowType
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    dummy_window = EatingWindow(
        start=now,
        end=now,
        duration_minutes=30,
        window_type=WindowType.GOLDEN,
    )

    ranked: list[RankedMeal] = score_meals(filtered, deficit, user, dummy_window)

    if not ranked:
        return MealRecommendationResult(
            meal_name=filtered[0].name,
            reason_code="best_available",
            nutrient_match_scores={},
            overall_score=0.0,
        )

    # Apply 2x critical deficit multiplier
    critical = _find_critical_deficit(nutrient_focus, targets, deficit)
    if critical:
        for r in ranked:
            meal_has_critical = r.meal.nutrients.values.get(critical, 0) > 0
            if meal_has_critical:
                r.score = min(1.0, r.score * 2.0)
        ranked.sort(key=lambda r: r.score, reverse=True)

    best = ranked[0]

    # Build reason code
    if critical and best.meal.nutrients.values.get(critical, 0) > 0:
        reason_code = f"high_{critical}_match"
    elif best.score > 0.5:
        reason_code = "strong_nutrient_match"
    else:
        reason_code = "best_available"

    return MealRecommendationResult(
        meal_name=best.meal.name,
        reason_code=reason_code,
        nutrient_match_scores={k: round(v, 2) for k, v in best.nutrient_gap_coverage.values.items()},
        overall_score=round(best.score, 2),
    )
