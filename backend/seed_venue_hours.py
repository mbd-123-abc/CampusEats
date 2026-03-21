"""
Seeds venue schedules (opens_at / closes_at per day of week).
Run: cd backend && python seed_venue_hours.py
Idempotent — safe to re-run.

Schedule format per venue:
  { "mon": {"open": "HH:MM", "close": "HH:MM"} | null, ... }
  null = closed that day
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import settings
from app.db.models import VenueStatus

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def hours(open_: str, close: str) -> dict:
    return {"open": open_, "close": close}

CLOSED = None  # closed that day


# ---------------------------------------------------------------------------
# Venue schedules
# Keys: mon, tue, wed, thu, fri, sat, sun
# ---------------------------------------------------------------------------

SCHEDULES: dict[str, dict] = {
    "By George": {
        "mon": hours("07:30", "20:00"),
        "tue": hours("07:30", "20:00"),
        "wed": hours("07:30", "20:00"),
        "thu": hours("07:30", "20:00"),
        "fri": hours("07:30", "17:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Center Table": {
        "mon": hours("07:30", "22:00"),
        "tue": hours("07:30", "22:00"),
        "wed": hours("07:30", "22:00"),
        "thu": hours("07:30", "22:00"),
        "fri": hours("07:30", "22:00"),
        "sat": hours("07:30", "22:00"),
        "sun": hours("07:30", "22:00"),
    },
    "Cultivate": {
        "mon": hours("11:00", "20:30"),
        "tue": hours("11:00", "20:30"),
        "wed": hours("11:00", "20:30"),
        "thu": hours("11:00", "20:30"),
        "fri": hours("11:30", "15:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Husky Den Food Court": {
        "mon": hours("10:15", "19:00"),
        "tue": hours("10:15", "19:00"),
        "wed": hours("10:15", "19:00"),
        "thu": hours("10:15", "19:00"),
        "fri": hours("10:15", "16:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Local Point": {
        "mon": hours("07:30", "23:00"),
        "tue": hours("07:30", "23:00"),
        "wed": hours("07:30", "23:00"),
        "thu": hours("07:30", "23:00"),
        "fri": hours("07:30", "23:00"),
        "sat": hours("08:00", "23:00"),
        "sun": hours("08:00", "22:00"),
    },
    "Dawg Bites": {
        "mon": hours("11:30", "21:00"),
        "tue": hours("11:30", "21:00"),
        "wed": hours("11:30", "21:00"),
        "thu": hours("11:30", "21:00"),
        "fri": hours("11:30", "21:00"),
        "sat": CLOSED,
        "sun": hours("11:30", "19:00"),
    },
    "Husky Den Café": {
        "mon": hours("08:00", "17:00"),
        "tue": hours("08:00", "17:00"),
        "wed": hours("08:00", "17:00"),
        "thu": hours("08:00", "17:00"),
        "fri": hours("08:00", "17:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Husky Grind Café — Alder": {
        "mon": hours("07:00", "20:00"),
        "tue": hours("07:00", "20:00"),
        "wed": hours("07:00", "20:00"),
        "thu": hours("07:00", "20:00"),
        "fri": hours("07:00", "20:00"),
        "sat": hours("08:00", "20:00"),
        "sun": hours("08:00", "20:00"),
    },
    "Husky Grind Café — Oak": {
        "mon": hours("07:00", "20:00"),
        "tue": hours("07:00", "20:00"),
        "wed": hours("07:00", "20:00"),
        "thu": hours("07:00", "20:00"),
        "fri": hours("07:00", "20:00"),
        "sat": hours("08:00", "20:00"),
        "sun": hours("08:00", "20:00"),
    },
    "Husky Grind Café — Mercer Court": {
        "mon": hours("07:00", "20:00"),
        "tue": hours("07:00", "20:00"),
        "wed": hours("07:00", "20:00"),
        "thu": hours("07:00", "20:00"),
        "fri": hours("07:00", "20:00"),
        "sat": hours("09:00", "20:00"),
        "sun": hours("09:00", "20:00"),
    },
    "Microsoft Café": {
        "mon": hours("07:30", "17:00"),
        "tue": hours("07:30", "17:00"),
        "wed": hours("07:30", "17:00"),
        "thu": hours("07:30", "17:00"),
        "fri": hours("07:30", "17:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Orin's Place": {
        "mon": hours("07:30", "19:00"),
        "tue": hours("07:30", "19:00"),
        "wed": hours("07:30", "19:00"),
        "thu": hours("07:30", "19:00"),
        "fri": hours("07:30", "15:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Starbucks — Population Health": {
        "mon": hours("07:30", "17:00"),
        "tue": hours("07:30", "17:00"),
        "wed": hours("07:30", "17:00"),
        "thu": hours("07:30", "17:00"),
        "fri": hours("07:30", "17:00"),
        "sat": CLOSED,
        "sun": CLOSED,
    },
    "Starbucks — Suzzallo": {
        "mon": hours("08:00", "19:00"),
        "tue": hours("08:00", "19:00"),
        "wed": hours("08:00", "19:00"),
        "thu": hours("08:00", "19:00"),
        "fri": hours("08:00", "17:00"),
        "sat": CLOSED,
        "sun": hours("13:00", "19:00"),
    },
}


# ---------------------------------------------------------------------------
# Seed runner
# ---------------------------------------------------------------------------

async def seed():
    engine = create_async_engine(
        settings.async_database_url,
        connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Ensure columns exist in SQLite (Alembic handles Postgres)
    if settings.is_sqlite:
        async with engine.begin() as conn:
            for col_def in [
                "ALTER TABLE venue_status ADD COLUMN schedule TEXT",
                "ALTER TABLE venue_status ADD COLUMN override_open INTEGER",
            ]:
                try:
                    await conn.execute(__import__('sqlalchemy').text(col_def))
                except Exception:
                    pass  # column already exists

    async with async_session() as session:
        for venue, schedule in SCHEDULES.items():
            if settings.is_sqlite:
                stmt = (
                    sqlite_insert(VenueStatus)
                    .values(venue=venue, is_open=True, schedule=schedule, override_open=None)
                    .on_conflict_do_update(
                        index_elements=["venue"],
                        set_={"schedule": schedule},
                    )
                )
            else:
                stmt = (
                    pg_insert(VenueStatus)
                    .values(venue=venue, is_open=True, schedule=schedule, override_open=None)
                    .on_conflict_do_update(
                        index_elements=["venue"],
                        set_={"schedule": schedule},
                    )
                )
            await session.execute(stmt)

        await session.commit()
        print(f"Seeded schedules for {len(SCHEDULES)} venues.")

    await engine.dispose()


asyncio.run(seed())
