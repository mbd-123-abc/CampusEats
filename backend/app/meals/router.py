from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.db.base import get_db
from app.auth.middleware import get_current_user
from app.db.models import MealLog
from app.meals.schemas import LogMealRequest, MealLogResponse
from app.meals import service
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/meals", tags=["meals"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/log", response_model=MealLogResponse, status_code=201)
@limiter.limit("30/minute")
async def log_meal(
    request: Request,
    req: LogMealRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot log meals")
    return await service.log_meal(str(current_user["sub"]), req, db)


@router.get("/today", status_code=200)
@limiter.limit("60/minute")
async def get_today_nutrients(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns summed effective nutrient amounts from all meal logs today.
    Tie-break for equal scores: first logged entry wins (ORDER BY logged_at ASC).
    """
    user_id = current_user["sub"]  # str — works for both SQLite and Postgres
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(MealLog)
        .where(MealLog.user_id == user_id)
        .where(MealLog.logged_at >= today_start)
        .order_by(MealLog.logged_at.asc())
    )
    logs = result.scalars().all()

    # Sum effective amounts across all today's logs
    totals: dict[str, float] = {}
    for log in logs:
        for entry in (log.nutrients_json or []):
            name = entry.get("nutrient_name", "")
            amount = float(entry.get("effective_amount", entry.get("raw_amount", 0)))
            totals[name] = totals.get(name, 0.0) + amount

    last_logged_at = logs[-1].logged_at.isoformat() if logs else None
    return {"nutrients": totals, "last_logged_at": last_logged_at}


@router.get("/recommendation", status_code=200)
@limiter.limit("30/minute")
async def get_meal_recommendation(
    request: Request,
    venue: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the best menu item to eat at the given venue based on the user's
    nutrient deficit for today. Requires JWT auth — never leaks nutritional
    data to unauthenticated requests.
    """
    from app.db.models import MenuItem, UserPreferences, MealLog
    from app.meals.recommendation import recommend_meal, NUTRIENT_GOALS
    from datetime import timezone
    from sqlalchemy import or_
    from datetime import date as date_type

    user_id = current_user["sub"]
    today = date_type.today().isoformat()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Fetch menu items for this venue
    menu_result = await db.execute(
        select(MenuItem).where(
            MenuItem.venue == venue,
            or_(MenuItem.always_available == True, MenuItem.date == today),
        )
    )
    menu_items = [
        {
            "item_id": str(i.item_id),
            "name": i.name,
            "venue": i.venue,
            "diet_tags": i.diet_tags or [],
            "nutrients_json": i.nutrients_json or {},
        }
        for i in menu_result.scalars().all()
    ]

    # Fetch user preferences
    prefs_result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    prefs = prefs_result.scalar_one_or_none()
    nutrient_focus = (prefs.nutrient_focus or []) if prefs else []
    hard_filters = (prefs.hard_filters or []) if prefs else []
    preference_filters = (prefs.preference_filters or []) if prefs else []
    dislikes = (prefs.dislikes or []) if prefs else []
    dislike_strictness = (prefs.dislike_strictness or "low") if prefs else "low"
    academic_intensity = (prefs.academic_intensity or "chill") if prefs else "chill"

    # Default focus if user hasn't set any
    if not nutrient_focus:
        nutrient_focus = ["iron", "protein"]

    # Fetch today's consumed totals
    logs_result = await db.execute(
        select(MealLog)
        .where(MealLog.user_id == user_id)
        .where(MealLog.logged_at >= today_start)
    )
    consumed_totals: dict[str, float] = {}
    for log in logs_result.scalars().all():
        for entry in (log.nutrients_json or []):
            name = entry.get("nutrient_name", "")
            amount = float(entry.get("effective_amount", entry.get("raw_amount", 0)))
            consumed_totals[name] = consumed_totals.get(name, 0.0) + amount

    result = recommend_meal(
        menu_items=menu_items,
        nutrient_focus=nutrient_focus,
        consumed_totals=consumed_totals,
        hard_filters=hard_filters,
        preference_filters=preference_filters,
        dislikes=dislikes,
        dislike_strictness=dislike_strictness,
        academic_intensity=academic_intensity,
    )

    return {
        "meal_name": result.meal_name,
        "reason_code": result.reason_code,
        "nutrient_match_scores": result.nutrient_match_scores,
        "overall_score": result.overall_score,
        "venue": venue,
    }
