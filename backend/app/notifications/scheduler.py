from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from app.chronos.types import EatingWindow, CalendarEvent
from app.nutripath.types import NutrientProfile


@dataclass
class Notification:
    user_id: str
    notification_type: str   # "preflight" | "window_alert" | "nutrient_gap"
    scheduled_time: datetime
    payload: dict


def _is_during_class(dt: datetime, class_blocks: list[CalendarEvent]) -> bool:
    return any(e.start <= dt < e.end for e in class_blocks)


def schedule_notifications(
    user_id: str,
    windows: list[EatingWindow],
    consumed: NutrientProfile,
    targets: NutrientProfile,
    class_blocks: list[CalendarEvent] | None = None,
) -> list[Notification]:
    """
    Postconditions:
      - All scheduled_time >= now (never in the past)
      - No notifications during class blocks (DND)
      - Pre-flight 30 min before first window
      - Window-closing alert 10 min before each window opens
      - Nutrient gap catch-up at 18:00 if any deficit > 0
    """
    now = datetime.now(tz=timezone.utc)
    class_blocks = class_blocks or []
    notifications: list[Notification] = []

    sorted_windows = sorted(windows, key=lambda w: w.start)

    # Pre-flight briefing — 30 min before first window
    if sorted_windows:
        first_window = sorted_windows[0]
        preflight_time = max(now, first_window.start - timedelta(minutes=30))
        if not _is_during_class(preflight_time, class_blocks):
            notifications.append(Notification(
                user_id=user_id,
                notification_type="preflight",
                scheduled_time=preflight_time,
                payload={"window_start": first_window.start.isoformat()},
            ))

    # Window-closing alert — 10 min before each window opens
    for window in sorted_windows:
        alert_time = max(now, window.start - timedelta(minutes=10))
        if not _is_during_class(alert_time, class_blocks):
            notifications.append(Notification(
                user_id=user_id,
                notification_type="window_alert",
                scheduled_time=alert_time,
                payload={"window_start": window.start.isoformat(), "window_type": window.window_type},
            ))

    # Nutrient gap catch-up at 18:00 if any deficit > 0
    today = now.date()
    catchup_time = datetime(today.year, today.month, today.day, 18, 0, 0, tzinfo=timezone.utc)
    catchup_time = max(now, catchup_time)

    deficit_exists = any(
        targets.values.get(n, 0) - consumed.values.get(n, 0) > 0
        for n in targets.values
    )
    if deficit_exists and not _is_during_class(catchup_time, class_blocks):
        notifications.append(Notification(
            user_id=user_id,
            notification_type="nutrient_gap",
            scheduled_time=catchup_time,
            payload={"message": "You still have nutrient goals to hit today!"},
        ))

    return notifications
