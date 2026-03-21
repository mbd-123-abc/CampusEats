from pydantic import BaseModel, field_validator
from typing import Literal, Optional

HARD_FILTERS = {"nut-free", "gluten-free", "dairy-free"}
PREFERENCE_FILTERS = {"vegan", "vegetarian", "pescatarian", "pollotarian", "eggetarian", "halal", "kosher"}
NUTRIENT_FOCUS_OPTIONS = {"iron", "protein", "vitamin_d", "calcium", "vitamin_b12", "fiber"}

AcademicIntensity = Literal["chill", "midterm", "finals"]
WalkingSpeed = Literal["slow", "average", "power"]
MealPlanType = Literal["unlimited", "14_per_week", "commuter_cash"]
DislikeStrictness = Literal["low", "high"]


class SavePreferencesRequest(BaseModel):
    hard_filters: list[str] = []
    preference_filters: list[str] = []
    nutrient_focus: list[str] = []
    likes: list[str] = []
    dislikes: list[str] = []
    pantry_items: list[str] = []
    academic_intensity: AcademicIntensity = "chill"
    walking_speed: WalkingSpeed = "average"
    meal_plan_type: MealPlanType = "unlimited"
    dislike_strictness: DislikeStrictness = "low"
    show_calories: bool = False

    @field_validator("hard_filters")
    @classmethod
    def validate_hard_filters(cls, v: list[str]) -> list[str]:
        invalid = set(v) - HARD_FILTERS
        if invalid:
            raise ValueError(f"Invalid hard filters: {invalid}")
        return v

    @field_validator("preference_filters")
    @classmethod
    def validate_preference_filters(cls, v: list[str]) -> list[str]:
        invalid = set(v) - PREFERENCE_FILTERS
        if invalid:
            raise ValueError(f"Invalid preference filters: {invalid}")
        return v

    @field_validator("nutrient_focus")
    @classmethod
    def validate_nutrient_focus(cls, v: list[str]) -> list[str]:
        if not v:
            return v
        if len(v) > 3:
            raise ValueError("You can track up to 3 nutrients at a time")
        invalid = set(v) - NUTRIENT_FOCUS_OPTIONS
        if invalid:
            raise ValueError(f"Invalid nutrient focus options: {invalid}")
        return v

    @field_validator("likes", "dislikes")
    @classmethod
    def validate_likes_dislikes(cls, v: list[str]) -> list[str]:
        if len(v) > 20:
            raise ValueError("Maximum 20 items allowed")
        for item in v:
            if len(item) > 50:
                raise ValueError(f"Item '{item[:20]}...' exceeds 50 character limit")
        return v

    @field_validator("pantry_items")
    @classmethod
    def validate_pantry(cls, v: list[str]) -> list[str]:
        if len(v) > 50:
            raise ValueError("Maximum 50 pantry items allowed")
        for item in v:
            if len(item) > 100:
                raise ValueError(f"Pantry item exceeds 100 character limit")
        return v
