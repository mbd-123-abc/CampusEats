from typing import Callable
from app.nutripath.types import Meal, UserProfile

# Predicate model — evaluates dietary filters against meal capability properties
# Prevents logical contradictions (e.g. vegan AND pescatarian)
DIETARY_PREDICATES: dict[str, Callable[[set[str]], bool]] = {
    "vegan":        lambda p: "animal_product" not in p,
    "vegetarian":   lambda p: "contains_red_meat" not in p and "contains_fish" not in p,
    "meat-free":    lambda p: "contains_red_meat" not in p,
    "only-seafood": lambda p: "contains_fish" in p and "contains_red_meat" not in p,
    "only-chicken": lambda p: "contains_poultry" in p and "contains_red_meat" not in p,
    "halal":        lambda p: "halal_certified" in p,
    "kosher":       lambda p: "kosher_certified" in p,
    "gluten-free":  lambda p: "contains_gluten" not in p,
    "nut-free":     lambda p: "contains_nuts" not in p,
}


def _meal_satisfies(meal: Meal, filter_tag: str) -> bool:
    predicate = DIETARY_PREDICATES.get(filter_tag)
    if predicate is None:
        return True  # unknown filter — permissive default
    return predicate(meal.properties)


def apply_dietary_filters(meals: list[Meal], user: UserProfile) -> tuple[list[Meal], bool]:
    """
    Returns (filtered_meals, fallback_triggered).

    Hard filters: AND logic — all must be satisfied.
    Preference filters: OR logic — at least one must match.
    Fallback: if preference filters yield empty, relax them but keep hard filters.
    """
    result = []
    for meal in meals:
        if not all(_meal_satisfies(meal, f) for f in user.hard_filters):
            continue
        if user.preference_filters:
            if not any(_meal_satisfies(meal, f) for f in user.preference_filters):
                continue
        result.append(meal)

    fallback = False
    if not result and user.preference_filters:
        result = [m for m in meals if all(_meal_satisfies(m, f) for f in user.hard_filters)]
        fallback = True

    return result, fallback
