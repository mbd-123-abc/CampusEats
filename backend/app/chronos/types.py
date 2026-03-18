from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class WindowType(str, Enum):
    GOLDEN = "golden"   # >= 45 minutes
    MICRO = "micro"     # 15–44 minutes


@dataclass
class CalendarEvent:
    id: str
    title: str
    location_id: str
    start: datetime
    end: datetime


@dataclass
class EatingWindow:
    start: datetime
    end: datetime
    duration_minutes: int
    window_type: WindowType
    preceding_event: Optional[CalendarEvent] = None
    following_event: Optional[CalendarEvent] = None
