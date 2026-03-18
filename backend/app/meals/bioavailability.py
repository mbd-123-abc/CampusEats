from typing import Callable

# Thresholds for auto-detection from USDA composition data
CALCIUM_INHIBITOR_THRESHOLD_MG = 150
CAFFEINE_INHIBITOR_THRESHOLD_MG = 100
VITAMIN_C_ENHANCER_THRESHOLD_MG = 25


def iron_absorption_model(raw_iron_mg: float, context: dict) -> float:
    """
    Postconditions:
      - result in [0, raw_iron_mg]
      - Inhibitors reduce absorption; enhancers increase it (capped at raw)
    """
    absorption_rate = 0.18  # USDA baseline non-heme iron absorption

    calcium_mg = context.get("calcium", 0)
    caffeine_mg = context.get("caffeine", 0)
    vitamin_c_mg = context.get("vitamin_c", 0)

    if calcium_mg > 300:
        absorption_rate *= 0.5
    elif calcium_mg > 150:
        absorption_rate *= 0.75

    if caffeine_mg > 100:
        absorption_rate *= 0.6

    if vitamin_c_mg > 75:
        absorption_rate = min(absorption_rate * 3.0, 1.0)
    elif vitamin_c_mg > 25:
        absorption_rate = min(absorption_rate * 1.5, 1.0)

    effective = raw_iron_mg * absorption_rate
    return min(raw_iron_mg, round(effective, 2))


def calcium_absorption_model(raw_calcium_mg: float, context: dict) -> float:
    """Calcium absorption is reduced by high oxalate foods."""
    absorption_rate = 0.30
    if context.get("oxalate_high", False):
        absorption_rate *= 0.5
    effective = raw_calcium_mg * absorption_rate
    return min(raw_calcium_mg, round(effective, 2))


# Registry — nutrients without a model fall back to raw amount (identity)
ABSORPTION_MODELS: dict[str, Callable[[float, dict], float]] = {
    "iron": iron_absorption_model,
    "calcium": calcium_absorption_model,
}


def _build_bioavailability_context(meal_items_nutrition: dict) -> dict:
    """
    Builds inhibitor/enhancer context from USDA average composition data.
    meal_items_nutrition: aggregated nutrient totals across all logged items.
    """
    return {
        "calcium": meal_items_nutrition.get("calcium", 0),
        "caffeine": meal_items_nutrition.get("caffeine", 0),
        "vitamin_c": meal_items_nutrition.get("vitamin_c", 0),
        "oxalate_high": meal_items_nutrition.get("oxalate_high", False),
    }


def detect_inhibitors_enhancers(meal_items_nutrition: dict) -> tuple[list[str], list[str]]:
    """
    Auto-detects inhibitors and enhancers from USDA composition data.
    Returns (inhibitors, enhancers) — never from user input.
    """
    inhibitors = []
    enhancers = []

    if meal_items_nutrition.get("calcium", 0) > CALCIUM_INHIBITOR_THRESHOLD_MG:
        inhibitors.append("calcium")
    if meal_items_nutrition.get("caffeine", 0) > CAFFEINE_INHIBITOR_THRESHOLD_MG:
        inhibitors.append("caffeine")
    if meal_items_nutrition.get("vitamin_c", 0) > VITAMIN_C_ENHANCER_THRESHOLD_MG:
        enhancers.append("vitamin_c")

    return inhibitors, enhancers


def calculate_effective_nutrients(raw: dict[str, float], meal_items_nutrition: dict) -> dict[str, float]:
    """
    Postconditions:
      - effective[n] <= raw[n] for all n
      - Nutrients without a model return raw value unchanged
    """
    context = _build_bioavailability_context(meal_items_nutrition)
    result = {}
    for nutrient, amount in raw.items():
        model = ABSORPTION_MODELS.get(nutrient)
        result[nutrient] = model(amount, context) if model else amount
    return result
