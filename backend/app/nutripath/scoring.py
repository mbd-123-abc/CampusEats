from app.nutripath.types import Meal, RankedMeal, NutrientProfile, UserProfile
from app.chronos.types import EatingWindow, WindowType


def _pair_helps_deficit(pair: str, deficit: NutrientProfile) -> bool:
    """Returns True if a bioavailability pair enhances absorption of a deficit nutrient."""
    return any(pair in nutrient for nutrient in deficit.values if deficit.values[nutrient] > 0)


def _inhibitor_conflicts_deficit(inhibitor: str, deficit: NutrientProfile) -> bool:
    """Returns True if an inhibitor reduces absorption of a deficit nutrient."""
    return any(inhibitor in nutrient for nutrient in deficit.values if deficit.values[nutrient] > 0)


def calculate_nutrient_deficit(targets: NutrientProfile, consumed: NutrientProfile) -> NutrientProfile:
    """
    Postconditions:
      - Each value = max(0, target - consumed) — never negative
      - Nutrients in targets but absent from consumed are fully unmet
    """
    result = {}
    for nutrient, target_val in targets.values.items():
        consumed_val = consumed.values.get(nutrient, 0.0)
        result[nutrient] = max(0.0, target_val - consumed_val)
    return NutrientProfile(values=result)


def score_meals(
    meals: list[Meal],
    deficit: NutrientProfile,
    user: UserProfile,
    window: EatingWindow,
) -> list[RankedMeal]:
    """
    Preconditions:
      - meals is non-empty (caller must check apply_dietary_filters result first)
      - len(meals) <= 200 (DoS guard)
    Postconditions:
      - Returns list sorted descending by score
      - All scores in [0.0, 1.0]
    """
    assert len(meals) <= 200, "caller must pre-filter meals before scoring"

    tracked = user.nutrient_focus
    weight = 1.0 / len(tracked) if tracked else 1.0
    total_deficit = sum(deficit.values.values())
    scored: list[RankedMeal] = []

    for meal in meals:
        # Nutrient-agnostic base score
        nutrition_score = 0.0
        coverage_map: dict[str, float] = {}

        for nutrient in tracked:
            deficit_val = deficit.values.get(nutrient, 0.0)
            meal_val = meal.nutrients.values.get(nutrient, 0.0)
            coverage = min(meal_val / deficit_val, 1.0) if deficit_val > 0 else 0.0
            nutrition_score += weight * coverage
            if deficit_val > 0:
                coverage_map[nutrient] = coverage

        base_score = 0.1 if total_deficit == 0 else nutrition_score

        # Bioavailability boost (capped at 0.3)
        bio_boost = min(
            sum(0.1 for p in meal.bioavailability_pairs if _pair_helps_deficit(p, deficit)),
            0.3,
        )

        # Bioavailability penalty (capped at 0.5)
        bio_penalty = min(
            sum(0.15 for inh in meal.bioavailability_inhibitors if _inhibitor_conflicts_deficit(inh, deficit)),
            0.5,
        )

        raw_score = base_score + bio_boost - bio_penalty

        # Academic intensity modifiers
        if user.academic_intensity == "finals":
            if window.window_type == WindowType.MICRO:
                raw_score += 0.10
            if any(tag in ("omega3", "low-sugar") for tag in meal.tags):
                raw_score += 0.10

        # Dislike penalties
        meal_text = meal.name.lower()
        for dislike in user.dislikes:
            if dislike.lower() in meal_text or dislike.lower() in [t.lower() for t in meal.tags]:
                if user.dislike_strictness == "low":
                    raw_score -= 0.15
                elif user.dislike_strictness == "high":
                    raw_score = -1.0  # will be excluded below
                    break

        if raw_score < 0 and user.dislike_strictness == "high":
            continue  # exclude high-strictness dislike matches

        final_score = max(0.0, min(1.0, raw_score))

        scored.append(RankedMeal(
            meal=meal,
            score=final_score,
            nutrient_gap_coverage=NutrientProfile(values=coverage_map),
        ))

    return sorted(scored, key=lambda r: r.score, reverse=True)


def compute_final_score(nutrition_score: float, route_score: float) -> float:
    """
    Combines nutrition (60%) and route (40%) scores.
    Preconditions: both in [0.0, 1.0]
    Postconditions: result in [0.0, 1.0]
    """
    return round(nutrition_score * 0.6 + route_score * 0.4, 4)
