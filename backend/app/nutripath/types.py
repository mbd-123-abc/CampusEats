from dataclasses import dataclass, field
from typing import Callable


@dataclass
class NutrientProfile:
    values: dict[str, float]  # nutrient-agnostic: {"iron": 10.0, "protein": 30.0}


@dataclass
class Meal:
    id: str
    name: str
    location_id: str
    nutrients: NutrientProfile
    tags: list[str]
    properties: set[str]          # capability set for dietary filter evaluation
    prep_time_minutes: int
    bioavailability_pairs: list[str] = field(default_factory=list)
    bioavailability_inhibitors: list[str] = field(default_factory=list)


@dataclass
class RankedMeal:
    meal: Meal
    score: float                  # 0.0–1.0 composite
    nutrient_gap_coverage: NutrientProfile
    route_detour_minutes: int = 0


@dataclass
class UserProfile:
    user_id: str
    university_id: str
    hard_filters: list[str]
    preference_filters: list[str]
    daily_targets: NutrientProfile
    nutrient_focus: list[str]
    home_location_id: str
    academic_intensity: str = "chill"
    dislike_strictness: str = "low"
    dislikes: list[str] = field(default_factory=list)
    meal_plan_type: str = "unlimited"
    walking_speed: str = "average"
