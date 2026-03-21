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
    {"name": "Egg, Pesto & Mozzarella Sandwich",            "diet_tags": ["eggetarian"]},
    {"name": "Bacon, Gouda & Egg Sandwich",                 "diet_tags": []},
    {"name": "Double-Smoked Bacon, Cheddar & Egg Sandwich", "diet_tags": []},
    {"name": "Sausage, Cheddar & Egg Sandwich",             "diet_tags": []},
    {"name": "Turkey Bacon, Cheddar & Egg White Sandwich",  "diet_tags": []},
    {"name": "Impossible™ Breakfast Sandwich",              "diet_tags": ["vegetarian"]},
    {"name": "Bacon, Sausage & Egg Wrap",                   "diet_tags": []},
    {"name": "Spinach, Feta & Egg White Wrap",              "diet_tags": ["eggetarian"]},
    {"name": "Truffle, Mushroom & Brie Egg Bites",          "diet_tags": ["eggetarian", "gluten-free"]},
    {"name": "Italian Sausage Egg Bites",                   "diet_tags": ["gluten-free"]},
    {"name": "Bacon & Gruyère Egg Bites",                   "diet_tags": ["gluten-free"]},
    {"name": "Egg White & Roasted Red Pepper Egg Bites",    "diet_tags": ["eggetarian", "gluten-free"]},
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
    {"name": "Protein Box (egg & cheese)",          "diet_tags": ["eggetarian", "gluten-free"]},
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
    {"name": "Chocolate Bar Donut",   "diet_tags": ["vegetarian"]},
    {"name": "Maple Bar Donut",       "diet_tags": ["vegetarian"]},
    {"name": "Fresh Fruit Cup", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Banana",          "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",    "diet_tags": ["vegetarian", "gluten-free"]},
]

HUSKY_GRIND_MEALS = [
    # These are proper meals, not snacks
    {"name": "Toasted Sandwich",    "meal_period": "lunch", "diet_tags": []},
    {"name": "Soup of the Day",     "meal_period": "lunch", "diet_tags": ["vegetarian"]},
    {"name": "Porridge",            "meal_period": "breakfast", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
]

# Common grab-and-go snacks found at most campus cafés
COMMON_SNACKS = [
    {"name": "Chocolate Bar Donut",       "diet_tags": ["vegetarian"]},
    {"name": "Maple Bar Donut",           "diet_tags": ["vegetarian"]},
    {"name": "Fresh Fruit Cup",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Banana",              "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",        "diet_tags": ["vegetarian", "gluten-free"]},
]

# ---------------------------------------------------------------------------
# By George (Odegaard)
# ---------------------------------------------------------------------------

BY_GEORGE_ALL_DAY = [
    # Coffee — expanded in seed loop via COFFEE_DRINKS
    # Starbucks-style items (By George carries the same lineup)
    {"name": "Egg, Pesto & Mozzarella Sandwich",            "diet_tags": ["eggetarian"]},
    {"name": "Bacon, Gouda & Egg Sandwich",                 "diet_tags": []},
    {"name": "Spinach, Feta & Egg White Wrap",              "diet_tags": ["eggetarian"]},
    {"name": "Butter Croissant",                            "diet_tags": ["vegetarian"]},
    {"name": "Chocolate Croissant",                         "diet_tags": ["vegetarian"]},
    {"name": "Blueberry Streusel Muffin",                   "diet_tags": ["vegetarian"]},
    {"name": "Iced Lemon Loaf",                             "diet_tags": ["vegetarian"]},
    {"name": "Plain Bagel",                                 "diet_tags": ["vegan", "dairy-free"]},
    {"name": "Everything Bagel",                            "diet_tags": ["vegan", "dairy-free"]},
    {"name": "Avocado Spread",                              "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Protein Box (egg & cheese)",                  "diet_tags": ["eggetarian", "gluten-free"]},
    # By George exclusives
    {"name": "Smoothie",            "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Açai Bowl",           "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Donut",               "diet_tags": ["vegetarian"]},
    {"name": "Grab-and-go Salad",   "diet_tags": ["vegetarian"]},
    {"name": "Sushi Rolls",         "diet_tags": ["pescatarian"]},
    # Common snacks
    {"name": "Chocolate Bar Donut",       "diet_tags": ["vegetarian"]},
    {"name": "Maple Bar Donut",           "diet_tags": ["vegetarian"]},
    {"name": "Fresh Fruit Cup",     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Banana",              "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",        "diet_tags": ["vegetarian", "gluten-free"]},
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
    {"name": "Greek Yogurt",        "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Hard Boiled Eggs",    "diet_tags": ["vegetarian", "gluten-free", "dairy-free"]},
    {"name": "Grab-and-go Sandwich","diet_tags": []},
    {"name": "Chips & Snacks",      "diet_tags": ["vegan"]},
    {"name": "Chocolate Bar Donut",       "diet_tags": ["vegetarian"]},
    {"name": "Maple Bar Donut",           "diet_tags": ["vegetarian"]},
    {"name": "Banana",              "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
]

DISTRICT_MARKET_MEALS = [
    {"name": "Deli Hot Food",   "meal_period": "lunch",  "diet_tags": []},
    {"name": "Deli Salad",      "meal_period": "lunch",  "diet_tags": ["vegetarian"]},
]

# ---------------------------------------------------------------------------
# Center Table (Willow Hall)
# ---------------------------------------------------------------------------

CENTER_TABLE_BREAKFAST = [
    # Plant-based
    {"name": "Plant-Based Scrambled Eggs",      "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Plant-Based Sausage Patty",       "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Plant Powered Sausage & Egg",     "diet_tags": ["eggetarian", "gluten-free"]},
    {"name": "Plant-Powered Egg & Cheese",      "diet_tags": ["eggetarian"]},
    # Egg-based
    {"name": "Cage-Free Scrambled Eggs",        "diet_tags": ["eggetarian", "gluten-free", "dairy-free"]},
    {"name": "Classic Breakfast Sandwich",      "diet_tags": []},   # egg + meat
    {"name": "Sausage, Egg & Cheese",           "diet_tags": []},   # egg + meat
    {"name": "Bacon, Egg & Cheese",             "diet_tags": []},   # egg + meat
    # Meat sides — chicken sausage has beef casing so not halal/kosher
    {"name": "Bacon",                           "diet_tags": []},
    {"name": "Chicken Sausage Link",            "diet_tags": []},  # beef casing
    {"name": "Hashbrowns",                      "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Bars & fruit
    {"name": "Waffle Bar",                      "diet_tags": ["vegetarian"]},
    {"name": "Cereal Bar",                      "diet_tags": ["vegetarian"]},
    {"name": "Salad Bar",                       "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Whole Fruit",                     "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
]

DINING_HALL_LUNCH_DINNER = [
    # Pizza
    {"name": "Cheese Pizza",                        "diet_tags": ["vegetarian"]},
    {"name": "Pepperoni Pizza",                     "diet_tags": []},
    # Burgers
    {"name": "Classic Dub Burger",                  "diet_tags": []},           # beef, chicken, or veggie patty
    {"name": "Smokestack Burger",                   "diet_tags": []},           # beef
    {"name": "Hellfire Burger",                     "diet_tags": []},           # beef
    {"name": "Lil Dub Burger",                      "diet_tags": []},           # beef
    # Chicken
    {"name": "Chicken Sandwich",                    "diet_tags": []},
    {"name": "Nashville Hot Chicken Sandwich",      "diet_tags": []},
    {"name": "Dub Me Tenders",                      "diet_tags": []},           # chicken
    # Fish
    {"name": "Fish and Chips",                      "diet_tags": []},           # fish
    # Sides
    {"name": "Fries",                               "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Deli sandwiches
    {"name": "Turkey Cheddar Sandwich",             "diet_tags": []},           # turkey
    {"name": "BLTC Sandwich",                       "diet_tags": []},           # bacon
    {"name": "Italian Club Sandwich",               "diet_tags": []},           # salami, ham
    {"name": "Ham and Havarti Sandwich",            "diet_tags": []},           # ham
    {"name": "Tofu Goddess Sandwich",               "diet_tags": ["vegan"]},
    {"name": "Roasted Vegetable Wrap",              "diet_tags": ["vegan"]},
    {"name": "Caprese Sandwich",                    "diet_tags": ["vegetarian"]},
    {"name": "Tuna Salad Sandwich",                 "diet_tags": ["pescatarian"]},
    {"name": "Toasted Cheese",                      "diet_tags": ["vegetarian"]},
    {"name": "Tomato Soup",                         "diet_tags": ["vegetarian"]},
]

# ---------------------------------------------------------------------------
# Other venues
# ---------------------------------------------------------------------------

STAPLES = [
    # Husky Den Café
    {"name": "Grab-and-go Snacks",  "venue": "Husky Den Café",      "meal_period": "all day", "diet_tags": []},
    {"name": "Chocolate Bar Donut",       "venue": "Husky Den Café",      "meal_period": "all day", "diet_tags": ["vegetarian"]},
    {"name": "Banana",              "venue": "Husky Den Café",      "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",        "venue": "Husky Den Café",      "meal_period": "all day", "diet_tags": ["vegetarian", "gluten-free"]},
    # Etc. — The HUB
    {"name": "Grab-and-go Wrap",    "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": []},
    {"name": "Fresh Fruit Cup",     "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Chips & Snacks",      "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegan"]},
    {"name": "Chocolate Bar Donut",       "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegetarian"]},
    {"name": "Maple Bar Donut",           "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegetarian"]},
    {"name": "Banana",              "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",        "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Sushi Rolls",         "venue": "Etc. — The HUB",      "meal_period": "all day", "diet_tags": ["pescatarian"]},
    # Dawg Bites (IMA)
    {"name": "Protein Bar",         "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": []},
    {"name": "Smoothie",            "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Banana",              "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",        "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Fresh Fruit Cup",     "venue": "Dawg Bites",          "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Orin's Place (Paccar)
    {"name": "Grab-and-go Snacks",  "venue": "Orin's Place",        "meal_period": "all day", "diet_tags": []},
    {"name": "Chocolate Bar Donut",       "venue": "Orin's Place",        "meal_period": "all day", "diet_tags": ["vegetarian"]},
    {"name": "Banana",              "venue": "Orin's Place",        "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Public Grounds (Parrington)
    {"name": "Grab-and-go Snacks",  "venue": "Public Grounds",      "meal_period": "all day", "diet_tags": []},
    {"name": "Chocolate Bar Donut",       "venue": "Public Grounds",      "meal_period": "all day", "diet_tags": ["vegetarian"]},
    {"name": "Banana",              "venue": "Public Grounds",      "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # The Rotunda (Health Sciences)
    {"name": "Grab-and-go Snacks",  "venue": "The Rotunda",         "meal_period": "all day", "diet_tags": []},
    {"name": "Fresh Fruit Cup",     "venue": "The Rotunda",         "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    {"name": "Greek Yogurt",        "venue": "The Rotunda",         "meal_period": "all day", "diet_tags": ["vegetarian", "gluten-free"]},
    {"name": "Banana",              "venue": "The Rotunda",         "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
    # Tower Café
    {"name": "Grab-and-go Snacks",  "venue": "Tower Café",          "meal_period": "all day", "diet_tags": []},
    {"name": "Chocolate Bar Donut",       "venue": "Tower Café",          "meal_period": "all day", "diet_tags": ["vegetarian"]},
    {"name": "Banana",              "venue": "Tower Café",          "meal_period": "all day", "diet_tags": ["vegan", "gluten-free", "dairy-free"]},
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

        # Center Table / Dining Hall North (same location, both names)
        for item in CENTER_TABLE_BREAKFAST:
            add(item["name"], "Center Table", "breakfast", item["diet_tags"])
        for item in DINING_HALL_LUNCH_DINNER:
            add(item["name"], "Center Table", "lunch", item["diet_tags"])
            add(item["name"], "Center Table", "dinner", item["diet_tags"])

        # Local Point (West Campus Dining Hall) — rename any existing rows first
        await session.execute(
            __import__('sqlalchemy').update(MenuItem)
            .where(MenuItem.venue == "West Campus Dining Hall")
            .values(venue="Local Point")
        )
        for item in CENTER_TABLE_BREAKFAST:
            add(item["name"], "Local Point", "breakfast", item["diet_tags"])
        for item in DINING_HALL_LUNCH_DINNER:
            add(item["name"], "Local Point", "lunch", item["diet_tags"])
            add(item["name"], "Local Point", "dinner", item["diet_tags"])

        # Other staples
        for item in STAPLES:
            add(item["name"], item["venue"], item["meal_period"], item["diet_tags"])

        await session.commit()
        print(f"Seeded {added} items ({len(existing_names)} already existed).")

    await engine.dispose()


asyncio.run(seed())
