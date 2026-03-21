"""
Shared USDA FDC nutrient fetching utility.
Used by backfill_nutrients.py and admin/router.py (fire-and-forget on item add).
"""
import os
import httpx

USDA_API_KEY = os.environ.get("EXPO_PUBLIC_USDA_API_KEY", "YvIMrMfcHfv8sZXDfeEHx0dqjwJatjyLJt7FcpQv")
USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

NUTRIENT_IDS: dict[int, str] = {
    203: "protein",
    204: "fat",
    205: "carbohydrates",
    208: "calories",
    291: "fiber",
    301: "calcium",
    303: "iron",
    324: "vitamin_d",
    418: "vitamin_b12",
}


def _parse_nutrients(food: dict) -> dict[str, float]:
    nutrients: dict[str, float] = {}
    for n in food.get("foodNutrients", []):
        raw_id = n.get("nutrientId") or n.get("nutrientNumber")
        nid = int(raw_id) if raw_id is not None else None
        key = NUTRIENT_IDS.get(nid) if nid else None

        if not key:
            nm = (n.get("nutrientName") or "").lower()
            if "protein" in nm:                                   key = "protein"
            elif "iron, fe" in nm or nm == "iron":                key = "iron"
            elif "total lipid" in nm or nm == "fat":              key = "fat"
            elif "carbohydrate" in nm:                            key = "carbohydrates"
            elif "energy" in nm or "calorie" in nm:               key = "calories"
            elif "fiber" in nm:                                   key = "fiber"
            elif "calcium" in nm:                                 key = "calcium"
            elif "vitamin d" in nm:                               key = "vitamin_d"
            elif "vitamin b-12" in nm or "cobalamin" in nm:       key = "vitamin_b12"

        val = n.get("value") or n.get("amount")
        if key and val is not None:
            nutrients[key] = float(val)

    return nutrients


async def fetch_nutrients(name: str) -> dict[str, float] | None:
    """Query USDA FDC for a food item by name. Returns per-100g nutrients or None."""
    clean = name.replace("™", "").replace("&", "and").replace("(", "").replace(")", "")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                USDA_URL,
                params={"query": clean, "pageSize": 5, "api_key": USDA_API_KEY},
            )
            resp.raise_for_status()
            foods = resp.json().get("foods", [])
            if not foods:
                return None

            best = next(
                (f for f in foods if f.get("dataType") in ("SR Legacy", "Foundation", "Survey (FNDDS)")),
                foods[0],
            )
            result = _parse_nutrients(best)
            return result or None
    except Exception:
        return None
