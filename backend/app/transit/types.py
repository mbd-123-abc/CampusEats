from dataclasses import dataclass

SPEED_MULTIPLIERS = {
    "slow": 1.4,
    "average": 1.0,
    "power": 0.7,
}


@dataclass
class DiningLocation:
    id: str
    name: str
    transit_minutes: float        # base transit time from user's current location
    wait_time_minutes: float
    meal_plan_types_accepted: list[str]  # e.g. ["unlimited", "14_per_week", "commuter_cash"]
    is_swipe_only: bool = False


@dataclass
class LocationWithWaitTime:
    location: DiningLocation
    transit_minutes: float        # adjusted for walking speed
    wait_time_minutes: float
    detour_minutes: float
