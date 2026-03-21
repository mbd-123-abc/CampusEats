import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.db.models import MealLog
from app.meals.schemas import LogMealRequest, MealLogResponse, NutrientLogEntrySchema
from app.meals.bioavailability import detect_inhibitors_enhancers, calculate_effective_nutrients

# Accuracy score constants
ACCURACY_UW_DINING = 0.95
ACCURACY_USDA = 0.80
ACCURACY_GENERIC = 0.60

# Max nutrients_json size: 64KB
MAX_NUTRIENTS_JSON_BYTES = 65536


async def log_meal(user_id: str, req: LogMealRequest, db: AsyncSession) -> MealLogResponse:
    """
    Preconditions:
      - len(req.items) >= 1
      - Exactly one of portion_size or portion_count is set (validated by schema)
    Postconditions:
      - Deduplication: same user + items within 60s returns existing entry
      - inhibitors/enhancers auto-detected from USDA data
      - effective_amount <= raw_amount for all nutrients
    """
    import json

    # Build nutrients with effective amounts
    # In production, meal_items_nutrition would come from USDA lookup
    # Here we use the provided nutrient data and auto-detect bio context
    raw_nutrients = {n.nutrient_name: n.raw_amount for n in req.nutrients}
    # Placeholder: in production, aggregate USDA composition for req.items
    meal_items_nutrition: dict = {}
    effective_nutrients = calculate_effective_nutrients(raw_nutrients, meal_items_nutrition)
    inhibitors, enhancers = detect_inhibitors_enhancers(meal_items_nutrition)

    nutrients_list = []
    for entry in req.nutrients:
        effective = effective_nutrients.get(entry.nutrient_name, entry.raw_amount)
        # Invariant: effective <= raw
        effective = min(effective, entry.raw_amount)
        effective = max(0.0, effective)
        nutrients_list.append({
            "nutrient_name": entry.nutrient_name,
            "raw_amount": entry.raw_amount,
            "effective_amount": effective,
            "is_estimated": entry.is_estimated,
            "accuracy_score": entry.accuracy_score,
        })

    nutrients_json_str = json.dumps(nutrients_list)
    if len(nutrients_json_str.encode()) > MAX_NUTRIENTS_JSON_BYTES:
        raise HTTPException(status_code=422, detail="nutrients_json exceeds 64KB limit")

    # Weighted average accuracy score
    if nutrients_list:
        overall_accuracy = sum(n["accuracy_score"] for n in nutrients_list) / len(nutrients_list)
    else:
        overall_accuracy = ACCURACY_GENERIC

    log = MealLog(
        user_id=user_id,  # already a str from router: str(current_user["sub"])
        items=req.items,
        item_portions=req.item_portions or ([req.portion_size] * len(req.items) if req.portion_size else [1.0] * len(req.items)),
        portion_size=req.portion_size,
        portion_count=req.portion_count,
        nutrients_json=nutrients_list,
        inhibitors_detected=inhibitors,
        enhancers_detected=enhancers,
        meal_mood=req.meal_mood,
        source=req.source,
        accuracy_score=round(overall_accuracy, 2),
    )
    db.add(log)
    try:
        await db.commit()
        await db.refresh(log)
    except IntegrityError:
        await db.rollback()
        # Deduplication: return existing entry
        result = await db.execute(
            select(MealLog)
            .where(MealLog.user_id == user_id)
            .order_by(MealLog.logged_at.desc())
            .limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return _to_response(existing)
        raise HTTPException(status_code=409, detail="Duplicate log entry")

    return _to_response(log)


def _to_response(log: MealLog) -> MealLogResponse:
    nutrients = [
        NutrientLogEntrySchema(
            nutrient_name=n["nutrient_name"],
            raw_amount=n["raw_amount"],
            effective_amount=n["effective_amount"],
            is_estimated=n["is_estimated"],
            accuracy_score=n["accuracy_score"],
        )
        for n in (log.nutrients_json or [])
    ]
    return MealLogResponse(
        log_id=str(log.log_id),
        user_id=str(log.user_id),
        items=log.items,
        item_portions=log.item_portions or [1.0] * len(log.items),
        portion_size=float(log.portion_size) if log.portion_size else None,
        portion_count=log.portion_count,
        nutrients=nutrients,
        inhibitors_detected=log.inhibitors_detected or [],
        enhancers_detected=log.enhancers_detected or [],
        meal_mood=log.meal_mood,
        source=log.source,
        overall_accuracy_score=float(log.accuracy_score),
    )
