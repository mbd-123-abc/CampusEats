"""
Backfills nutrients_json for all menu items using the USDA FDC API.

Run: cd backend && python backfill_nutrients.py

Uses the same API key and nutrient ID mapping as the mobile app's useFoodSearch.ts.
Skips items that already have nutrients_json populated.
"""
import asyncio
import httpx
import json
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import settings
from app.db.models import MenuItem

# Same key as EXPO_PUBLIC_USDA_API_KEY in mobile/.env
USDA_API_KEY = "YvIMrMfcHfv8sZXDfeEHx0dqjwJatjyLJt7FcpQv"
USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

# Same mapping as useFoodSearch.ts
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

# Items that are pure drinks — we'll still store nutrients but flag them
DRINK_KEYWORDS = {
    "coffee", "latte", "cappuccino", "americano", "espresso",
    "cold brew", "iced coffee", "macchiato", "flat white",
    "chai", "matcha latte", "frappuccino", "nitro cold brew",
    "smoothie", "juice",
}


def is_drink(name: str) -> bool:
    lower = name.lower()
    return any(kw in lower for kw in DRINK_KEYWORDS)


def parse_nutrients(food: dict) -> dict[str, float]:
    """Extract per-100g nutrients from an FDC food object."""
    nutrients: dict[str, float] = {}
    for n in food.get("foodNutrients", []):
        raw_id = n.get("nutrientId") or n.get("nutrientNumber")
        nid = int(raw_id) if raw_id is not None else None
        key = NUTRIENT_IDS.get(nid) if nid else None

        # Name-based fallback (same logic as useFoodSearch.ts)
        if not key:
            nm = (n.get("nutrientName") or "").lower()
            if "protein" in nm:                                  key = "protein"
            elif nm in ("iron", "iron, fe") or "iron, fe" in nm: key = "iron"
            elif "total lipid" in nm or nm == "fat":             key = "fat"
            elif "carbohydrate" in nm:                           key = "carbohydrates"
            elif "energy" in nm or "calorie" in nm:              key = "calories"
            elif "fiber" in nm:                                  key = "fiber"
            elif "calcium" in nm:                                key = "calcium"
            elif "vitamin d" in nm:                              key = "vitamin_d"
            elif "vitamin b-12" in nm or "cobalamin" in nm:      key = "vitamin_b12"

        val = n.get("value") or n.get("amount")
        if key and val is not None:
            nutrients[key] = float(val)

    return nutrients


async def fetch_nutrients(client: httpx.AsyncClient, name: str) -> dict[str, float] | None:
    """Query FDC for a food item by name, return per-100g nutrients or None."""
    # Strip special chars that confuse FDC (™, &, parentheses)
    clean = name.replace("™", "").replace("&", "and").replace("(", "").replace(")", "")
    try:
        resp = await client.get(
            USDA_URL,
            params={"query": clean, "pageSize": 5, "api_key": USDA_API_KEY},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        foods = data.get("foods", [])
        if not foods:
            return None

        # Pick the best match — prefer SR Legacy / Foundation foods over branded
        best = None
        for food in foods:
            dt = food.get("dataType", "")
            if dt in ("SR Legacy", "Foundation", "Survey (FNDDS)"):
                best = food
                break
        if best is None:
            best = foods[0]

        nutrients = parse_nutrients(best)
        return nutrients if nutrients else None

    except Exception as e:
        print(f"  FDC error for '{name}': {e}")
        return None


async def backfill():
    engine = create_async_engine(
        settings.async_database_url,
        connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(MenuItem))
        items: list[MenuItem] = result.scalars().all()

    # Deduplicate by name — no need to hit FDC for the same item at every venue
    unique_names: dict[str, dict | None] = {}
    for item in items:
        if item.name not in unique_names:
            unique_names[item.name] = item.nutrients_json  # may already be populated

    print(f"Found {len(items)} menu items, {len(unique_names)} unique names.")

    # Fetch nutrients for items that don't have them yet
    to_fetch = [n for n, v in unique_names.items() if not v]
    print(f"Fetching nutrients for {len(to_fetch)} items from USDA FDC...\n")

    fetched: dict[str, dict] = {}
    async with httpx.AsyncClient() as client:
        for i, name in enumerate(to_fetch):
            print(f"[{i+1}/{len(to_fetch)}] {name}")
            nutrients = await fetch_nutrients(client, name)
            if nutrients:
                fetched[name] = nutrients
                keys_found = list(nutrients.keys())
                print(f"  → {keys_found}")
            else:
                print(f"  → no data found")
            # Respect FDC rate limit (~3 req/s on free tier)
            time.sleep(0.35)

    # Write back to DB
    print(f"\nWriting {len(fetched)} nutrient profiles to DB...")
    async with async_session() as session:
        result = await session.execute(select(MenuItem))
        items = result.scalars().all()
        updated = 0
        for item in items:
            if item.nutrients_json:
                continue  # already has data
            nutrients = fetched.get(item.name)
            if nutrients:
                item.nutrients_json = nutrients
                updated += 1
        await session.commit()
        print(f"Updated {updated} rows.")

    await engine.dispose()
    print("\nDone.")


asyncio.run(backfill())
