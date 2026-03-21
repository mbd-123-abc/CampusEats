from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy import select, or_
from pydantic import BaseModel
from typing import Optional
from datetime import date as date_type, datetime, timezone

from app.auth.middleware import get_current_user
from app.db.base import get_db
from app.db.models import MenuItem, VenueStatus
from app.config import settings
from app.meals.nutrients import fetch_nutrients
from slowapi import Limiter
from slowapi.util import get_remote_address

# Day-of-week index → schedule key (Monday=0)
_DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def compute_is_open(vs: VenueStatus) -> bool:
    """Return True if the venue is currently open based on its schedule.
    override_open (if set) takes precedence over the schedule."""
    if vs.override_open is not None:
        return vs.override_open

    schedule = vs.schedule
    if not schedule:
        return vs.is_open  # fall back to stored boolean if no schedule

    now = datetime.now(timezone.utc).astimezone()  # local time
    day_key = _DOW[now.weekday()]
    day_hours = schedule.get(day_key)

    if day_hours is None:
        return False  # closed today

    try:
        open_h, open_m = map(int, day_hours["open"].split(":"))
        close_h, close_m = map(int, day_hours["close"].split(":"))
        open_mins = open_h * 60 + open_m
        close_mins = close_h * 60 + close_m
        now_mins = now.hour * 60 + now.minute
        return open_mins <= now_mins < close_mins
    except Exception:
        return vs.is_open

router = APIRouter(prefix="/admin", tags=["admin"])
limiter = Limiter(key_func=get_remote_address)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("username") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class MenuItemIn(BaseModel):
    name: str
    venue: str
    meal_period: str
    date: Optional[str] = None
    always_available: bool = False
    diet_tags: list[str] = []


class VenueToggle(BaseModel):
    is_open: bool
    override: bool = True  # if False, clears the override and reverts to schedule


@router.post("/menu/items", status_code=201)
@limiter.limit("30/minute")
async def add_menu_item(
    request: Request,
    body: MenuItemIn,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    if body.meal_period not in ("breakfast", "lunch", "dinner", "all day"):
        raise HTTPException(status_code=422, detail="meal_period must be breakfast, lunch, dinner, or all day")
    if not body.always_available and not body.date:
        raise HTTPException(status_code=422, detail="date is required unless always_available is true")

    item = MenuItem(
        name=body.name,
        venue=body.venue,
        meal_period=body.meal_period,
        date=body.date,
        always_available=body.always_available,
        diet_tags=body.diet_tags,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"item_id": str(item.item_id), "name": item.name}


@router.patch("/venues/{venue_name}")
@limiter.limit("30/minute")
async def toggle_venue(
    request: Request,
    venue_name: str,
    body: VenueToggle,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    # override=False clears the override so schedule takes over again
    override_val = body.is_open if body.override else None

    if settings.is_sqlite:
        stmt = (
            sqlite_insert(VenueStatus)
            .values(venue=venue_name, is_open=body.is_open, override_open=override_val)
            .on_conflict_do_update(
                index_elements=["venue"],
                set_={"is_open": body.is_open, "override_open": override_val},
            )
        )
    else:
        stmt = (
            pg_insert(VenueStatus)
            .values(venue=venue_name, is_open=body.is_open, override_open=override_val)
            .on_conflict_do_update(
                index_elements=["venue"],
                set_={"is_open": body.is_open, "override_open": override_val},
            )
        )
    await db.execute(stmt)
    await db.commit()
    return {"venue": venue_name, "is_open": body.is_open, "override": body.override}


@router.get("/ping")
async def admin_ping(admin: dict = Depends(require_admin)):
    return {"status": "ok", "admin": admin["username"]}


# ── Public menu endpoints (no auth) ───────────────────────────────────────

@router.get("/menu/{venue_name}")
@limiter.limit("60/minute")
async def get_venue_menu(request: Request, venue_name: str, db: AsyncSession = Depends(get_db)):
    today = date_type.today().isoformat()

    result = await db.execute(
        select(MenuItem).where(
            MenuItem.venue == venue_name,
            or_(
                MenuItem.always_available == True,
                MenuItem.date == today,
            )
        ).order_by(MenuItem.meal_period, MenuItem.name)
    )
    items = result.scalars().all()

    vs_result = await db.execute(
        select(VenueStatus).where(VenueStatus.venue == venue_name)
    )
    vs = vs_result.scalar_one_or_none()
    is_open = compute_is_open(vs) if vs else True

    # Build today's hours string for the frontend
    today_hours = None
    if vs and vs.schedule:
        from datetime import datetime, timezone
        day_key = _DOW[datetime.now(timezone.utc).astimezone().weekday()]
        day_hours = vs.schedule.get(day_key)
        if day_hours:
            today_hours = f"{day_hours['open']} – {day_hours['close']}"

    return {
        "venue": venue_name,
        "is_open": is_open,
        "today_hours": today_hours,
        "schedule": vs.schedule if vs else None,
        "items": [
            {
                "item_id": str(i.item_id),
                "name": i.name,
                "meal_period": i.meal_period,
                "diet_tags": i.diet_tags,
                "always_available": i.always_available,
                "date": i.date,
            }
            for i in items
        ],
    }
