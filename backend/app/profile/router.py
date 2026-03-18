from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db.base import get_db
from app.db.models import UserPreferences
from app.auth.middleware import get_current_user
from app.profile.schemas import SavePreferencesRequest
from app.config import settings
import uuid

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/preferences", status_code=200)
async def get_preferences(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {"hard_filters": [], "preference_filters": [], "nutrient_focus": [], "academic_intensity": None, "walking_speed": None, "meal_plan_type": None}
    return {
        "hard_filters": prefs.hard_filters or [],
        "preference_filters": prefs.preference_filters or [],
        "nutrient_focus": prefs.nutrient_focus or [],
        "academic_intensity": prefs.academic_intensity,
        "walking_speed": prefs.walking_speed,
        "meal_plan_type": prefs.meal_plan_type,
    }


@router.put("/preferences", status_code=200)
async def save_preferences(
    req: SavePreferencesRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]
    values = dict(
        user_id=user_id,
        hard_filters=req.hard_filters,
        preference_filters=req.preference_filters,
        nutrient_focus=req.nutrient_focus,
        likes=req.likes,
        dislikes=req.dislikes,
        pantry_items=req.pantry_items,
        academic_intensity=req.academic_intensity,
        walking_speed=req.walking_speed,
        meal_plan_type=req.meal_plan_type,
        dislike_strictness=req.dislike_strictness,
        show_calories=req.show_calories,
    )
    update_set = {k: v for k, v in values.items() if k != "user_id"}

    if settings.is_sqlite:
        stmt = sqlite_insert(UserPreferences).values(**values).on_conflict_do_update(
            index_elements=["user_id"], set_=update_set
        )
    else:
        stmt = pg_insert(UserPreferences).values(**values).on_conflict_do_update(
            index_elements=["user_id"], set_=update_set
        )
    await db.execute(stmt)
    await db.commit()
    return {"status": "saved"}
