from pydantic import BaseModel, field_validator, model_validator
from typing import Literal, Optional
import hashlib

PortionSize = Literal[0.5, 1.0, 1.5]
MealMood = Literal["low", "neutral", "high"]
LogSource = Literal["auto_contextual", "manual_search", "usual_shortcut", "photo"]


class NutrientLogEntrySchema(BaseModel):
    nutrient_name: str
    raw_amount: float
    effective_amount: float
    is_estimated: bool
    accuracy_score: float

    @field_validator("accuracy_score")
    @classmethod
    def validate_accuracy(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("accuracy_score must be in [0.0, 1.0]")
        return v

    @field_validator("effective_amount")
    @classmethod
    def validate_effective(cls, v: float) -> float:
        if v < 0:
            raise ValueError("effective_amount must be >= 0")
        return v


class LogMealRequest(BaseModel):
    items: list[str]
    portion_size: Optional[PortionSize] = None
    portion_count: Optional[int] = None
    nutrients: list[NutrientLogEntrySchema] = []
    meal_mood: Optional[MealMood] = None
    source: LogSource = "manual_search"

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list[str]) -> list[str]:
        if len(v) < 1:
            raise ValueError("At least one item is required")
        return v

    @model_validator(mode="after")
    def validate_portion_xor(self) -> "LogMealRequest":
        has_size = self.portion_size is not None
        has_count = self.portion_count is not None
        if has_size == has_count:  # both set or neither set
            raise ValueError("Exactly one of portion_size or portion_count must be set")
        return self

    def items_md5(self) -> str:
        return hashlib.md5(str(sorted(self.items)).encode()).hexdigest()


class MealLogResponse(BaseModel):
    log_id: str
    user_id: str
    items: list[str]
    portion_size: Optional[float]
    portion_count: Optional[int]
    nutrients: list[NutrientLogEntrySchema]
    inhibitors_detected: list[str]
    enhancers_detected: list[str]
    meal_mood: Optional[str]
    source: str
    overall_accuracy_score: float
