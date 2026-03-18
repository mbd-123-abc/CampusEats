from app.transit.types import DiningLocation, LocationWithWaitTime, SPEED_MULTIPLIERS
from app.chronos.types import EatingWindow
from app.nutripath.types import Meal, UserProfile


def get_route_aware_options(
    window: EatingWindow,
    user: UserProfile,
    locations: list[DiningLocation],
    candidate_meals: list[Meal],
) -> list[LocationWithWaitTime]:
    """
    Returns only locations reachable within the eating window, sorted by detour_minutes.

    Postconditions:
      - transit + wait + min_prep <= window.duration_minutes for all results
      - Sorted ascending by detour_minutes
      - Swipe-only halls excluded for commuter_cash users
    """
    speed_mult = SPEED_MULTIPLIERS.get(user.walking_speed, 1.0)
    results: list[LocationWithWaitTime] = []

    for loc in locations:
        # Exclude swipe-only for commuter_cash
        if user.meal_plan_type == "commuter_cash" and loc.is_swipe_only:
            continue

        adjusted_transit = loc.transit_minutes * speed_mult

        # Find meals available at this location
        meals_here = [m for m in candidate_meals if m.location_id == loc.id]
        if not meals_here:
            continue

        min_prep = min(m.prep_time_minutes for m in meals_here)
        total_time = adjusted_transit + loc.wait_time_minutes + min_prep

        if total_time <= window.duration_minutes:
            detour = adjusted_transit + loc.wait_time_minutes
            results.append(LocationWithWaitTime(
                location=loc,
                transit_minutes=adjusted_transit,
                wait_time_minutes=loc.wait_time_minutes,
                detour_minutes=detour,
            ))

    return sorted(results, key=lambda r: r.detour_minutes)
