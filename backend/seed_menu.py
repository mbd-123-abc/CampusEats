"""
Seeds permanent/always-available menu items.
Run once: cd backend && python seed_menu.py
Idempotent — safe to re-run.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import settings
from app.db.models import MenuItem

# ---------------------------------------------------------------------------
# Starbucks
# ---------------------------------------------------------------------------

COFFEE_DRINKS = [
    # No milk — dairy-free
    {"name": "Drip Coffee",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Americano",       "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Cold Brew",       "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Iced Coffee",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Milk-based — calcium source
    {"name": "Latte",           "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Cappuccino",      "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Macchiato",       "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Flat White",      "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Chai Latte",      "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Matcha Latte",    "diet_tags": ["vegetarian", "gluten-free"]},
]

# Husky Grind serves "Chai" not "Chai Latte"
HUSKY_GRIND_DRINKS = [
    {"name": "Drip Coffee",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Americano",       "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Cold Brew",       "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Iced Coffee",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Latte",           "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Cappuccino",      "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Macchiato",       "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Flat White",      "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Chai",            "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Matcha Latte",    "diet_tags": ["vegetarian", "gluten-free"]},
]

# Starbucks-only extras (on top of COFFEE_DRINKS)
STARBUCKS_EXTRA_DRINKS = [
    {"name": "Nitro Cold Brew",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Frappuccino",         "diet_tags": ["vegetarian", "gluten-free"]},
]

STARBUCKS_LOCATIONS = [
    "Starbucks — Suzzallo",
    "Starbucks — Population Health",
]

STARBUCKS_BREAKFAST = [
    {"name": "Egg, Pesto & Mozzarella Sandwich",            "diet_tags": ["vegetarian"]},
    {"name": "Bacon, Gouda & Egg Sandwich",                 "diet_tags": []},
    {"name": "Double-Smoked Bacon, Cheddar & Egg Sandwich", "diet_tags": []},
    {"name": "Sausage, Cheddar & Egg Sandwich",             "diet_tags": []},
    {"name": "Turkey Bacon, Cheddar & Egg White Sandwich",  "diet_tags": []},
    {"name": "Impossible™ Breakfast Sandwich",              "diet_tags": ["vegetarian"]},
    {"name": "Bacon, Sausage & Egg Wrap",                   "diet_tags": []},
    {"name": "Spinach, Feta & Egg White Wrap",              "diet_tags": ["vegetarian"]},
    {"name": "Truffle, Mushroom & Brie Egg Bites",          "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Italian Sausage Egg Bites",                   "diet_tags": ["gluten-free"]},
    {"name": "Bacon & Gruyère Egg Bites",                   "diet_tags": ["gluten-free"]},
    {"name": "Egg White & Roasted Red Pepper Egg Bites",    "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Potato, Cheddar & Chive Bakes",               "diet_tags": ["vegetarian"]},
]

STARBUCKS_ALL_DAY = [
    # Coffee — expanded in seed loop via COFFEE_DRINKS
    # Pastries
    {"name": "Cookie Croissant Swirl",              "diet_tags": ["vegetarian"]},
    {"name": "Yuzu Citrus Blossom",                 "diet_tags": ["vegetarian"]},
    {"name": "Cinnamon Pull-Apart",                 "diet_tags": ["vegetarian"]},
    {"name": "Cheese Danish",                       "diet_tags": ["vegetarian"]},
    {"name": "Ham & Swiss Croissant",               "diet_tags": []},
    {"name": "Butter Croissant",                    "diet_tags": ["vegetarian"]},
    {"name": "Chocolate Croissant",                 "diet_tags": ["vegetarian"]},
    # Loaves, muffins & cakes
    {"name": "Chocolate Pistachio Loaf",            "diet_tags": ["vegetarian"]},
    {"name": "Strawberry Matcha Loaf",              "diet_tags": ["vegetarian"]},
    {"name": "Banana, Walnut & Pecan Loaf",         "diet_tags": ["vegetarian"]},
    {"name": "Iced Lemon Loaf",                     "diet_tags": ["vegetarian"]},
    {"name": "Pumpkin & Pepita Loaf",               "diet_tags": ["vegetarian"]},
    {"name": "Cinnamon Coffee Cake",                "diet_tags": ["vegetarian"]},
    {"name": "Blueberry Streusel Muffin",           "diet_tags": ["vegetarian"]},
    {"name": "Petite Vanilla Bean Scone",           "diet_tags": ["vegetarian"]},
    # Bagels
    {"name": "Plain Bagel",                         "diet_tags": ["vegan", "dairy-free"]},
    {"name": "Everything Bagel",                    "diet_tags": ["vegan", "dairy-free"]},
    {"name": "Avocado Spread",                      "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Warm items
    {"name": "Crispy Grilled Cheese on Sourdough",  "diet_tags": ["vegetarian"]},
    {"name": "Ham & Swiss on Baguette",             "diet_tags": []},
    {"name": "Tomato & Mozzarella on Focaccia",     "diet_tags": ["vegetarian"]},
    # Protein boxes
    {"name": "Protein Box (egg & cheese)",          "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Protein Box (peanut butter & banana)","diet_tags": ["vegan"]},
    # Sweets
    {"name": "Birthday Cake Pop",                   "diet_tags": ["vegetarian"]},
    {"name": "Chocolate Cake Pop",                  "diet_tags": ["vegetarian"]},
    {"name": "Dubai Chocolate Bite",                "diet_tags": ["vegetarian"]},
    {"name": "Berry Blondie",                       "diet_tags": ["vegetarian"]},
    {"name": "Chocolate Chip Cookie",               "diet_tags": ["vegetarian"]},
    {"name": "Double Chocolate Brownie",            "diet_tags": ["vegetarian"]},
    {"name": "Marshmallow Dream Bar",               "diet_tags": ["vegetarian"]},
    {"name": "Banana",                              "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
]

# ---------------------------------------------------------------------------
# Husky Grind Cafés (all three)
# ---------------------------------------------------------------------------

HUSKY_GRIND_LOCATIONS = [
    "Husky Grind Café — Alder",
    "Husky Grind Café — Oak",
    "Husky Grind Café — Mercer Court",
]

HUSKY_GRIND_ALL_DAY = [
    # Coffee — expanded in seed loop via COFFEE_DRINKS
    {"name": "Croissant",       "diet_tags": ["vegetarian"]},
    {"name": "Muffin",          "diet_tags": ["vegetarian"]},
    {"name": "Scone",           "diet_tags": ["vegetarian"]},
    {"name": "Salad",           "diet_tags": ["vegetarian"]},
]

HUSKY_GRIND_MEALS = [
    # These are proper meals, not snacks
    {"name": "Toasted Sandwich",    "meal_period": "lunch", "diet_tags": []},
    {"name": "Soup of the Day",     "meal_period": "lunch", "diet_tags": ["vegetarian"]},
    {"name": "Porridge",            "meal_period": "breakfast", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
]

# ---------------------------------------------------------------------------
# By George (Odegaard)
# ---------------------------------------------------------------------------

BY_GEORGE_ALL_DAY = [
    # Coffee — expanded in seed loop via COFFEE_DRINKS
    {"name": "Smoothie",            "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Açai Bowl",           "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Croissant",           "diet_tags": ["vegetarian"]},
    {"name": "Muffin",              "diet_tags": ["vegetarian"]},
    {"name": "Donut",               "diet_tags": ["vegetarian"]},
    {"name": "Grab-and-go Salad",   "diet_tags": ["vegetarian"]},
    {"name": "Sushi Rolls",         "diet_tags": ["pescatarian"]},
]

BY_GEORGE_MEALS = [
    {"name": "Hot Sandwich",    "meal_period": "lunch", "diet_tags": []},
    {"name": "Soup of the Day", "meal_period": "lunch", "diet_tags": ["vegetarian"]},
]

# ---------------------------------------------------------------------------
# Microsoft Café
# ---------------------------------------------------------------------------

MICROSOFT_CAFE_ALL_DAY = [
    # Coffee — expanded in seed loop via COFFEE_DRINKS
    {"name": "Croissant",           "diet_tags": ["vegetarian"]},
    {"name": "Muffin",              "diet_tags": ["vegetarian"]},
    {"name": "Grab-and-go Salad",   "diet_tags": ["vegetarian"]},
    {"name": "Sushi Rolls",         "diet_tags": ["pescatarian"]},
]

MICROSOFT_CAFE_MEALS = [
    {"name": "Toasted Breakfast Sandwich",  "meal_period": "breakfast", "diet_tags": []},
    {"name": "Toasted Sandwich",            "meal_period": "lunch",     "diet_tags": []},
    {"name": "Soup of the Day",             "meal_period": "lunch",     "diet_tags": ["vegetarian"]},
]

# ---------------------------------------------------------------------------
# District Markets
# ---------------------------------------------------------------------------

DISTRICT_MARKET_LOCATIONS = [
    "District Market — Alder",
    "District Market — Oak",
]

DISTRICT_MARKET_ALL_DAY = [
    {"name": "Sushi Rolls",         "diet_tags": ["pescatarian"]},
    {"name": "Fresh Fruit Cup",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt Parfait","diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Hard Boiled Eggs",    "diet_tags": ["vegetarian", "gluten-free", "dairy-free"]},
    {"name": "Grab-and-go Sandwich","diet_tags": []},
    {"name": "Chips & Snacks",      "diet_tags": ["vegan"]},
]

DISTRICT_MARKET_MEALS = [
    {"name": "Deli Hot Food",   "meal_period": "lunch",  "diet_tags": []},
    {"name": "Deli Salad",      "meal_period": "lunch",  "diet_tags": ["vegetarian"]},
]

# ---------------------------------------------------------------------------
# Other venues
# ---------------------------------------------------------------------------

STAPLES = [
    # Husky Den Café
    {"name": "Grab-and-go Snacks",  "venue": "Husky Den Café",      "meal_period": "all day", "diet_tags": []},
    # Etc. — The HUB
    {"name": "Grab-and-go Wrap",    "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": []},
    {"name": "Fresh Fruit Cup",     "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Chips & Snacks",      "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegan"]},
    # Dawg Bites (IMA)
    {"name": "Protein Bar",         "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": []},
    {"name": "Smoothie",            "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Orin's Place (Paccar)
    {"name": "Grab-and-go Snacks",  "venue": "Orin's Place",        "meal_period": "all day", "diet_tags": []},
    # Public Grounds (Parrington)
    {"name": "Grab-and-go Snacks",  "venue": "Public Grounds",      "meal_period": "all day", "diet_tags": []},
    # The Rotunda (Health Sciences)
    {"name": "Grab-and-go Snacks",  "venue": "The Rotunda",         "meal_period": "all day", "diet_tags": []},
    # Tower Café
    {"name": "Grab-and-go Snacks",  "venue": "Tower Café",          "meal_period": "all day", "diet_tags": []},
]

# All venues that serve coffee — will get all 4 COFFEE_DRINKS seeded
COFFEE_VENUES = [
    "Husky Den Café",
    "Dawg Bites",
    "Orin's Place",
    "Public Grounds",
    "The Rotunda",
    "Tower Café",
]


# ---------------------------------------------------------------------------
# Seed runner
# ---------------------------------------------------------------------------

async def seed():
    engine = create_async_engine(
        settings.async_database_url,
        connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(MenuItem).where(MenuItem.always_available == True))
        existing_names = {(i.name, i.venue) for i in result.scalars().all()}
        added = 0

        def add(name, venue, meal_period, diet_tags):
            nonlocal added
            if (name, venue) in existing_names:
                return
            session.add(MenuItem(
                name=name, venue=venue, meal_period=meal_period,
                diet_tags=diet_tags, always_available=True, date=None,
            ))
            added += 1

        # Starbucks
        for loc in STARBUCKS_LOCATIONS:
            for item in COFFEE_DRINKS:
                add(item["name"], loc, "all day", item["diet_tags"])
            for item in STARBUCKS_EXTRA_DRINKS:
                add(item["name"], loc, "all day", item["diet_tags"])
            for item in STARBUCKS_ALL_DAY:
                add(item["name"], loc, "all day", item["diet_tags"])
            for item in STARBUCKS_BREAKFAST:
                add(item["name"], loc, "breakfast", item["diet_tags"])

        # Husky Grind
        for loc in HUSKY_GRIND_LOCATIONS:
            for item in HUSKY_GRIND_DRINKS:
                add(item["name"], loc, "all day", item["diet_tags"])
            for item in HUSKY_GRIND_ALL_DAY:
                add(item["name"], loc, "all day", item["diet_tags"])
            for item in HUSKY_GRIND_MEALS:
                add(item["name"], loc, item["meal_period"], item["diet_tags"])

        # By George
        for item in COFFEE_DRINKS:
            add(item["name"], "By George", "all day", item["diet_tags"])
        for item in BY_GEORGE_ALL_DAY:
            add(item["name"], "By George", "all day", item["diet_tags"])
        for item in BY_GEORGE_MEALS:
            add(item["name"], "By George", item["meal_period"], item["diet_tags"])

        # Microsoft Café
        for item in COFFEE_DRINKS:
            add(item["name"], "Microsoft Café", "all day", item["diet_tags"])
        for item in MICROSOFT_CAFE_ALL_DAY:
            add(item["name"], "Microsoft Café", "all day", item["diet_tags"])
        for item in MICROSOFT_CAFE_MEALS:
            add(item["name"], "Microsoft Café", item["meal_period"], item["diet_tags"])

        # District Markets
        for loc in DISTRICT_MARKET_LOCATIONS:
            for item in DISTRICT_MARKET_ALL_DAY:
                add(item["name"], loc, "all day", item["diet_tags"])
            for item in DISTRICT_MARKET_MEALS:
                add(item["name"], loc, item["meal_period"], item["diet_tags"])

        # Other coffee venues
        for loc in COFFEE_VENUES:
            for item in COFFEE_DRINKS:
                add(item["name"], loc, "all day", item["diet_tags"])

        # Other staples
        for item in STAPLES:
            add(item["name"], item["venue"], item["meal_period"], item["diet_tags"])

        await session.commit()
        print(f"Seeded {added} items ({len(existing_names)} already existed).")

    await engine.dispose()


asyncio.run(seed())
