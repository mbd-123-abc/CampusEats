# Campus Eats

**Version:** 1.0 (MVP)

**Contributors:** Mahika Bagri

---

## Table of Contents

<ul>
  <li><a href="#Layout">Layout</a>
  <li><a href="#Tech-Stack"> Tech Stack</a>
  <li><a href="#System-Architecture"> System Architecture</a>
  <li><a href="#API Overview">API Overview</a>
  <li><a href="#Integrations">Integrations</a>
</ul>

---

## Layout 

```
CampusEats/
├── backend/
│   ├── app/
│   │   ├── auth/           # Login, register, JWT middleware
│   │   ├── meals/          # Logging, recommendation engine, bioavailability
│   │   ├── profile/        # User preferences
│   │   ├── calendar/       # Google OAuth + event sync
│   │   ├── admin/          # Menu CRUD (admin only)
│   │   ├── chronos/        # Eating window + gap detection engine
│   │   ├── nutripath/      # Nutrient scoring, filters, deficit calculation
│   │   ├── db/             # SQLAlchemy models + session
│   │   ├── config.py
│   │   └── main.py
│   ├── migrations/         # Alembic migration versions
│   ├── seed_admin.py
│   ├── seed_menu.py
│   ├── seed_venue_hours.py
│   ├── backfill_nutrients.py
│   ├── requirements.txt
│   └── render.yaml
└── mobile/
    ├── app/                # Expo Router screens (file-based routes)
    │   ├── index.tsx       # Entry / splash
    │   ├── login.tsx
    │   ├── register.tsx
    │   ├── dashboard.tsx
    │   ├── log.tsx
    │   ├── profile.tsx
    │   ├── menu/[venue].tsx
    │   └── admin/menu.tsx
    └── src/
        ├── api/            # Axios client
        ├── components/     # HeroCard, DayTimeline, NutrientPulse, QuickLogPrompt
        ├── hooks/          # useCalendar, useFoodSearch
        ├── screens/        # Screen logic components
        ├── store/          # Zustand auth store
        ├── types/          # Shared TypeScript types
        └── utils/          # dashboardState, mealWindows, recommendVenue, nearestVenue
```

---

## Tech Stack 

**Frontend**
- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 54)
- [Expo Router](https://expo.github.io/router/) — file-based navigation
- [Zustand](https://zustand-demo.pmnd.rs/) — auth hydration/state
- [react-native-svg](https://github.com/software-mansion/react-native-svg) — nutrient rings (UI)
- [axios](https://axios-http.com/) — API client

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async Python API
- [SQLAlchemy](https://www.sqlalchemy.org/) (async) + [Alembic](https://alembic.sqlalchemy.org/) — ORM + migrations
- [slowapi](https://github.com/laurentS/slowapi) — rate limiting
- [python-jose](https://github.com/mpdavis/python-jose) + [bcrypt](https://github.com/pyca/bcrypt/) — JWT auth
- [zxcvbn](https://github.com/dwolfhub/zxcvbn-python) — password strength

**Database**
- SQLite (local)
- PostgreSQL 15 (production via Supabase)

**Authentication**
- Redis (storage)
- JWT (bearer tokens) 
- Bcrypt (password hashing) 

---

## System Architecture 

### Navigation

**Unauthorized**
- /(index.tsx) - Entry / splash screen
- /login (login.tsx) - User login
- /register (register.tsx) - Account creation

**Authorized**
- /dashboard (dashboard.tsx) - Main daily flow (Next window Hero Card, timeline, nutrient pulse rings)
- /log (log.tsx) - Manual meal log form (accessed via the Log Meal in top navbar)
- /profile (profile.tsx) — User preferences, dietary filters, and goals (accessed via the Profile in top navbar)
- /menu/[venue] (menu/[venue].tsx) - Dynamic route for viewing the next meal location's full menu for the day

**Admin**
- /admin/menu (admin/menu.tsx) - Admin-only screen for CRUD operations on dining venue menus (accessed via the top navbar in place of Log Meal)

### Logic

- **Chronos** - Calendar Gap Detection + Meal Scheduler (optimizes for 3 meals and 2 snacks, but can fall back onto snacks during high density days) 
- **NurtiPath** - Nutrition Tracker + Smart Goal Setter (tracks your nutrients based on logged meals, and provides feedback)
- **NotificationScheduler** - Schedules all Alerts (meals, goals, geolocation based suggestions)
- **TransitLocator** - Spacial ROuting Engine (calculates wether a meal location is reachable within given time frame) 
  
---

## API Overview 

| Method | Path | Credentials | Description | Category |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | — | Register new user | Auth |
| POST | `/auth/login` | — | Login, returns JWT | Auth |
| POST | `/auth/logout` | JWT | Logout and revoke JWT (jti) | Auth |
| GET | `/profile/preferences` | JWT | Get user preferences | Profile |
| PUT | `/profile/preferences` | JWT | Update preferences | Profile |
| POST | `/notifications/token` | JWT | Register FCM device token for push alerts | Profile |
| GET | `/calendar/status` | JWT | Calendar connection status | Chronos Engine |
| GET | `/calendar/connect-init` | JWT | Start Google OAuth flow | Chronos Engine |
| POST | `/calendar/sync` | JWT | Sync calendar | Chronos Engine |
| GET | `/calendar/events` | JWT | Get synced events | Chronos Engine |
| GET | `/windows` | JWT | Get computed eating windows (`detect_gaps`) | Chronos Engine |
| POST | `/windows/skip` | JWT | Trigger Smart Snooze / skip window | Chronos Engine |
| GET | `/meals/search` | JWT | Search dining DB and USDA fallback | Meals & NutriPath |
| GET | `/meals/frequent` | JWT | Get user's top 3 frequent meals ("The Usual") | Meals & NutriPath |
| GET | `/meals/recommendation` | JWT | Nutrient-aware meal recommendation | Meals & NutriPath |
| GET | `/meals/today` | JWT | Today's nutrient totals | Meals & NutriPath |
| POST | `/meals/log` | JWT | Log a meal (manual or contextual auto-log) | Meals & NutriPath |
| DELETE | `/meals/log/:log_id` | JWT | Undo meal log (5-second grace period) | Meals & NutriPath |
| GET | `/admin/menu/items` | Admin | List menu items | Admin |
| POST | `/admin/menu/items` | Admin | Add menu item | Admin |
| PATCH | `/admin/venues/:venue` | Admin | Toggle venue open/closed (override schedule) | Admin |

---

## Integrations 

| Service | What It Is | System Role |
| --- | --- | --- |
| **Render** | Cloud hosting & deployment platform | Hosts the FastAPI backend. Configured declaratively using a `render.yaml` file located at the repository root for Infrastructure as Code (IaC) automated deployments. |
| **Supabase** | Cloud PostgreSQL database | Serves as the primary database for users, preferences, menus, and meal logs. Connects to the backend via standard Postgres connection strings. |
| **Google Maps** | Geospatial & routing API | Used by the `Transit_Locator` to calculate accurate walking times, distances, and detour minutes between the student's current/next class building and dining locations. Used by students to find meal/dining locations. |
| **Google Calendar** | External calendar provider | Connects via OAuth (`/calendar/connect-init`). The `Chronos_Engine` fetches the student's daily events to calculate free time and detect `GOLDEN` and `MICRO` eating windows. |
| **Firebase Cloud Messaging (FCM)** | Push notification delivery service | Used by the `Notification_Scheduler` to send mobile alerts for pre-flight briefings (30 mins before a window), window closing alerts, and evening nutrient catch-up reminders. |
| **USDA Food Database** | National nutrition & composition database | Acts as the fallback data source for meal logging. Used to auto-estimate missing nutrient values and detect bioavailability inhibitors (caffeine/calcium) and enhancers (Vitamin C) based on food items. |
| **Manual Data Entry (Current) / UW Dining API (Future)** | Dining menu data source | Currently, dining halls, menus, and nutritional info are populated manually via the `/admin` endpoints. In the future, this will be automated by integrating the UW Dining Menu API. |

---
