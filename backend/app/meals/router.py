from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.db.base import get_db
from app.auth.middleware import get_current_user
from app.db.models import MealLog
from app.meals.schemas import LogMealRequest, MealLogResponse
from app.meals import service

router = APIRouter(prefix="/meals", tags=["meals"])


@router.post("/log", response_model=MealLogResponse, status_code=201)
async def log_meal(
    req: LogMealRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot log meals")
    return await service.log_meal(str(current_user["sub"]), req, db)


@router.get("/today", status_code=200)
async def get_today_nutrients(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns summed effective nutrient amounts from all meal logs today.
    Tie-break for equal scores: first logged entry wins (ORDER BY logged_at ASC).
    """
    user_id = uuid.UUID(current_user["sub"])
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

    return {"nutrients": totals}
