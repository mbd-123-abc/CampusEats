from datetime import datetime, timedelta, timezone
from typing import Optional
from app.chronos.types import CalendarEvent, EatingWindow, WindowType


def detect_gaps(
    events: list[CalendarEvent],
    buffer_minutes: float = 10,
    day_start: Optional[datetime] = None,
    day_end: Optional[datetime] = None,
) -> list[EatingWindow]:
    """
    Identifies eating windows from gaps between calendar events.

    Preconditions:
      - All datetime values are timezone-aware UTC
      - buffer_minutes >= 0
    Postconditions:
      - Returns only windows with duration_minutes >= 15
      - GOLDEN iff duration_minutes >= 45; MICRO iff 15 <= duration_minutes < 45
      - No returned window overlaps any input event
    """
    windows: list[EatingWindow] = []
    sorted_events = sorted(events, key=lambda e: e.start)

    def try_add(
        gap_start: datetime,
        gap_end: datetime,
        preceding: Optional[CalendarEvent],
        following: Optional[CalendarEvent],
    ) -> None:
        usable_start = gap_start + timedelta(minutes=buffer_minutes)
        usable_end = gap_end - timedelta(minutes=buffer_minutes)
        duration_minutes = int((usable_end - usable_start).total_seconds() // 60)
        if duration_minutes >= 15:
            window_type = WindowType.GOLDEN if duration_minutes >= 45 else WindowType.MICRO
            windows.append(EatingWindow(
                start=usable_start,
                end=usable_end,
                duration_minutes=duration_minutes,
                window_type=window_type,
                preceding_event=preceding,
                following_event=following,
            ))

    if not sorted_events:
        # Full-day window if no events
        if day_start and day_end:
            try_add(day_start, day_end, None, None)
        return windows

    # Morning gap
    if day_start:
        try_add(day_start, sorted_events[0].start, None, sorted_events[0])

    # Gaps between events
    for i in range(len(sorted_events) - 1):
        try_add(sorted_events[i].end, sorted_events[i + 1].start, sorted_events[i], sorted_events[i + 1])

    # Evening gap
    if day_end:
        try_add(sorted_events[-1].end, day_end, sorted_events[-1], None)

    return windows


def handle_skipped_meal(
    skipped_window: EatingWindow,
    remaining_windows: list[EatingWindow],
    deficit: "NutrientProfile",  # noqa: F821 — forward ref
) -> dict:
    """
    Recalculates recommendations after a student skips a meal.

    Postconditions:
      - next_window.start > now() if next_window is not None
      - Returns evening catch-up plan when no remaining windows exist
    """
    from datetime import timezone as tz
    now = datetime.now(tz=timezone.utc)

    future_windows = [w for w in remaining_windows if w.start > now]

    if not future_windows:
        return {"next_window": None, "evening_catchup": {"deficit": deficit}}

    next_window = future_windows[0]
    return {
        "next_window": next_window,
        "deficit_override": deficit,
        "evening_catchup": {"deficit": deficit},
    }
