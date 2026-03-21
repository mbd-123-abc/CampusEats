import uuid
from sqlalchemy import (
    Column, String, Integer, Numeric, Text, Boolean,
    ForeignKey, Index, TIMESTAMP, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.types import TypeDecorator, TEXT
from sqlalchemy.sql import func, text
from app.config import settings
from app.db.base import Base

# ---------------------------------------------------------------------------
# Compatibility types — ARRAY and JSONB on Postgres, JSON/Text on SQLite
# ---------------------------------------------------------------------------

class ArrayText(TypeDecorator):
    """Stores a list of strings. Uses native ARRAY on Postgres, JSON on SQLite."""
    impl = TEXT
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import ARRAY
            return dialect.type_descriptor(ARRAY(Text))
        return dialect.type_descriptor(TEXT())

    def process_bind_param(self, value, dialect):
        if dialect.name == "postgresql":
            return value
        import json
        return json.dumps(value or [])

    def process_result_value(self, value, dialect):
        if dialect.name == "postgresql":
            return value
        import json
        if value is None:
            return []
        return json.loads(value) if isinstance(value, str) else value


class FlexJSON(TypeDecorator):
    """Uses JSONB on Postgres, JSON on SQLite."""
    impl = TEXT
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(TEXT())

    def process_bind_param(self, value, dialect):
        if dialect.name == "postgresql":
            return value
        import json
        return json.dumps(value) if value is not None else None

    def process_result_value(self, value, dialect):
        if dialect.name == "postgresql":
            return value
        import json
        if value is None:
            return None
        return json.loads(value) if isinstance(value, str) else value


# UUID column — native on Postgres, String(36) on SQLite
def uuid_col(primary_key=False, foreign_key=None):
    if settings.is_sqlite:
        col_type = String(36)
        kwargs = dict(primary_key=primary_key, default=lambda: str(uuid.uuid4()))
        if foreign_key:
            return Column(col_type, ForeignKey(foreign_key, ondelete="CASCADE"), **kwargs)
        return Column(col_type, **kwargs)
    else:
        col_type = PG_UUID(as_uuid=True)
        kwargs = dict(primary_key=primary_key, default=uuid.uuid4)
        if foreign_key:
            return Column(col_type, ForeignKey(foreign_key, ondelete="CASCADE"), **kwargs)
        return Column(col_type, **kwargs)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    user_id = uuid_col(primary_key=True)
    username = Column(String(30), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    university = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(TIMESTAMP(timezone=True), nullable=True)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id = uuid_col(primary_key=True, foreign_key="users.user_id")
    hard_filters = Column(ArrayText, nullable=False, default=list)
    preference_filters = Column(ArrayText, nullable=False, default=list)
    nutrient_focus = Column(ArrayText, nullable=False, default=list)
    likes = Column(ArrayText, nullable=False, default=list)
    dislikes = Column(ArrayText, nullable=False, default=list)
    pantry_items = Column(ArrayText, nullable=False, default=list)
    academic_intensity = Column(String(10), nullable=False, default="chill")
    walking_speed = Column(String(10), nullable=False, default="average")
    meal_plan_type = Column(String(20), nullable=False, default="unlimited")
    dislike_strictness = Column(String(10), nullable=False, default="low")
    show_calories = Column(Boolean, nullable=False, default=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class MealLog(Base):
    __tablename__ = "meal_logs"

    log_id = uuid_col(primary_key=True)
    user_id = uuid_col(foreign_key="users.user_id")
    logged_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    items = Column(ArrayText, nullable=False)
    item_portions = Column(FlexJSON, nullable=False, default=list)   # per-item multipliers
    portion_size = Column(Numeric(3, 1), nullable=True, default=None)
    portion_count = Column(Integer, nullable=True)
    nutrients_json = Column(FlexJSON, nullable=False, default=list)
    inhibitors_detected = Column(ArrayText, nullable=False, default=list)
    enhancers_detected = Column(ArrayText, nullable=False, default=list)
    meal_mood = Column(String(20), nullable=True)
    source = Column(String(20), nullable=False, default="manual_search")
    accuracy_score = Column(Numeric(3, 2), nullable=False, default=0.60)


class MenuItem(Base):
    __tablename__ = "menu_items"

    item_id = uuid_col(primary_key=True)
    name = Column(String(200), nullable=False)
    venue = Column(String(100), nullable=False)
    meal_period = Column(String(20), nullable=False)
    date = Column(String(10), nullable=True)          # null = always available
    always_available = Column(Boolean, nullable=False, default=False)
    diet_tags = Column(ArrayText, nullable=False, default=list)
    nutrients_json = Column(FlexJSON, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class VenueStatus(Base):
    __tablename__ = "venue_status"

    venue = Column(String(100), primary_key=True)
    is_open = Column(Boolean, nullable=False, default=True)
    # schedule: {"mon": {"open": "07:30", "close": "20:00"} | null, "tue": ..., ...}
    # null for a day means closed. Keys: mon tue wed thu fri sat sun
    schedule = Column(FlexJSON, nullable=True)
    # override_open: if set, overrides schedule-computed is_open (for holidays/special closures)
    override_open = Column(Boolean, nullable=True)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    event_id = uuid_col(primary_key=True)
    user_id = uuid_col(foreign_key="users.user_id")
    google_event_id = Column(String(200), nullable=False, default="")
    title = Column(String(300), nullable=False)
    start_dt = Column(String(35), nullable=False)   # ISO 8601 string
    end_dt = Column(String(35), nullable=False)
    recurrence = Column(Text, nullable=True)         # JSON array of RRULE strings
    imported_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
