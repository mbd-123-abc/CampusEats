# Campus Eats

**Version:** 1.0 (MVP)
**Contributors:** Mahika Bagri

`Campus Eats` is a mobile app for UW students to track nutrients, find campus dining venues, and get personalized meal recommendations based on their schedule and dietary goals.

### Motivation

College students are busy. Between back-to-back lectures, study sessions, and everything else, eating well is the first thing to slip. Campus Eats connects your Google Calendar to the campus dining map — finding the gaps in your day, recommending the nearest venue, and suggesting the specific meal that best covers your nutrient deficits. It's not a meal planner. It's a real-time co-pilot for eating smarter between classes.

---

### Table of Contents

<details>
<summary>Expand</summary>
<ul>
  <li><a href="#campus-eats">Campus Eats</a>
    <ul>
      <li><a href="#motivation">Motivation</a></li>
      <li><a href="#roadmap">Roadmap</a></li>
    </ul>
  </li>
  <li><a href="#user-guide">User Guide</a>
    <ul>
      <li><a href="#why-use-campus-eats">Why Use Campus Eats?</a></li>
      <li><a href="#core-features-mvp">Core Features (MVP)</a></li>
      <li><a href="#demo">Demo</a></li>
      <li><a href="#feedback-form">Feedback Form</a></li>
    </ul>
  </li>
  <li><a href="#developer-guide">Developer Guide</a>
    <ul>
      <li><a href="#tech-stack">Tech Stack</a></li>
      <li><a href="#prerequisites">Prerequisites</a></li>
      <li><a href="#installation">Installation</a></li>
      <li><a href="#layout">Layout</a></li>
      <li><a href="#api-overview">API Overview</a></li>
      <li><a href="#contributing">Contributing</a></li>
      <li><a href="#bug-reports">Bug Reports</a></li>
    </ul>
  </li>
  <li><a href="#contact">Contact</a>
    <ul>
      <li><a href="#socials">Socials</a></li>
      <li><a href="#acknowledgements">Acknowledgements</a></li>
    </ul>
  </li>
</ul>
</details>

---

### Roadmap

- [x] JWT auth with password strength enforcement
- [x] Manual meal logging with USDA FDC nutrient data
- [x] Nutrient Pulse — real-time daily progress rings
- [x] Google Calendar OAuth integration
- [x] Eating window detection from calendar gaps
- [x] Venue recommendation engine
- [x] Nutrient-aware meal recommendation (Nutri-Bridge)
- [x] Campus menu seeded with dietary tags
- [x] Rate limiting on all endpoints
- [x] Admin menu management
- [ ] Push notifications for meal windows
- [ ] Dining hall live hours / open status
- [ ] Meal history and weekly trends
- [ ] Friends / social logging
- [ ] EAS production build + App Store submission

---

## User Guide

### Why Use Campus Eats?

- **Smart gaps, not guesswork** — connects to your Google Calendar and finds real eating windows between your classes automatically.
- **Nutrient-first recommendations** — doesn't just tell you where to eat, tells you *what* to eat based on what your body is actually missing that day.
- **Built for UW** — every campus venue, their menus, dietary tags, and walking distances are baked in.
- **Dietary filters that actually work** — set hard filters (vegan, nut-free, halal) once and never see a recommendation that violates them.
- **Low friction logging** — search any food by name, pick a portion size, and your nutrient rings update instantly.

### Core Features (MVP)

- **Dashboard** — hero card showing your next recommended meal, countdown to your eating window, and one-tap directions.
- **Day Timeline** — horizontal scroll of your class blocks and meal gaps for the day.
- **Nutrient Pulse** — animated rings tracking your daily progress on iron, protein, vitamin D, calcium, B12, and fiber.
- **Meal Logging** — USDA FDC-powered food search with quick portion sizing.
- **Venue Menu** — browse any campus dining location's current menu filtered by meal period.
- **Profile & Preferences** — set dietary restrictions, nutrient focus, walking speed, and academic intensity.
- **Google Calendar Sync** — one-time OAuth connect, then automatic gap detection every session.

### Demo

> Coming soon — screenshots and walkthrough video will be added here.

### Feedback Form

> Coming soon.

---

## Developer Guide

### Tech Stack

**Frontend**
- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 54)
- [Expo Router](https://expo.github.io/router/) — file-based navigation
- [Zustand](https://zustand-demo.pmnd.rs/) — auth state
- [react-native-svg](https://github.com/software-mansion/react-native-svg) — nutrient rings
- [axios](https://axios-http.com/) — API client

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async Python API
- [SQLAlchemy](https://www.sqlalchemy.org/) (async) + [Alembic](https://alembic.sqlalchemy.org/) — ORM + migrations
- [slowapi](https://github.com/laurentS/slowapi) — rate limiting
- [python-jose](https://github.com/mpdavis/python-jose) + [bcrypt](https://github.com/pyca/bcrypt/) — JWT auth
- [zxcvbn](https://github.com/dwolfhub/zxcvbn-python) — password strength

**Database**
- SQLite (local development)
- PostgreSQL 15 (production via Render)

**Authentication**
- JWT bearer tokens (24h expiry)
- bcrypt password hashing (12 rounds)
- Account lockout after failed attempts

**External APIs**
- [USDA FDC API](https://fdc.nal.usda.gov/) — nutrient data for food logging and menu backfill
- [Google Calendar API](https://developers.google.com/calendar) — OAuth2 readonly calendar access

**Deploy**
- [Render](https://render.com/) — backend + PostgreSQL (`backend/render.yaml`)
- [Expo Go](https://expo.dev/go) / [EAS](https://expo.dev/eas) — mobile

---

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn
- (Optional) Redis — for rate limiting in production
- (Optional) ngrok — for Google Calendar OAuth on a physical device

---

### Installation

#### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` — minimum required:

```env
DATABASE_URL=sqlite+aiosqlite:///./campus_eats.db
JWT_SECRET=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
BCRYPT_ROUNDS=12
REDIS_URL=redis://localhost:6379
```

Run migrations and seed:

```bash
alembic upgrade head
python3 seed_admin.py
python3 seed_menu.py
python3 backfill_nutrients.py   # fetches USDA nutrient data — requires internet
```

Start the server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API docs: `http://localhost:8000/docs`

#### Mobile

```bash
cd mobile
npm install
```

Create `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000
EXPO_PUBLIC_USDA_API_KEY=<free key from https://fdc.nal.usda.gov/api-key-signup>
```

> Use your machine's LAN IP (e.g. `10.0.0.x`), not `localhost` — physical devices can't reach localhost.

```bash
npx expo start
```

Scan the QR code with Expo Go or press `i` for iOS simulator.

#### Google Calendar OAuth (optional)

1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Calendar API**
3. Create OAuth 2.0 credentials → Web application
4. Add your redirect URI to authorized redirect URIs:
   - Local: `http://localhost:8000/calendar/callback`
   - With ngrok: `https://<your-ngrok-subdomain>.ngrok-free.app/calendar/callback`
5. Add to `backend/.env`:

```env
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
GOOGLE_REDIRECT_URI=https://<your-ngrok-subdomain>.ngrok-free.app/calendar/callback
FRONTEND_URL=campuseats://dashboard
```

> ngrok URL changes each session on the free tier — update `.env` and Google Console each time.

---

### Layout

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

### API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/meals/today` | JWT | Today's nutrient totals |
| POST | `/meals/log` | JWT | Log a meal |
| GET | `/meals/recommendation?venue=` | JWT | Nutrient-aware meal recommendation |
| GET | `/profile/preferences` | JWT | Get user preferences |
| PUT | `/profile/preferences` | JWT | Update preferences |
| GET | `/calendar/status` | JWT | Calendar connection status |
| GET | `/calendar/connect-init` | JWT | Start Google OAuth flow |
| GET | `/calendar/events` | JWT | Get synced events |
| POST | `/calendar/sync` | JWT | Sync calendar |
| GET | `/admin/menu/items` | Admin | List menu items |
| POST | `/admin/menu/items` | Admin | Add menu item |
| PATCH | `/admin/venues/:venue/status` | Admin | Toggle venue open/closed |

Full interactive docs at `/docs` when running locally.

---

### Contributing

1. Fork the repo and create a feature branch: `git checkout -b feature/your-feature`
2. Follow existing code style — FastAPI for backend, functional React components for mobile
3. Keep backend endpoints rate-limited and JWT-protected
4. Run `python3 seed_menu.py` and `python3 backfill_nutrients.py` after any menu changes
5. Open a pull request with a clear description of what changed and why

---

### Bug Reports

Please open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Device / OS / Expo SDK version (for mobile bugs)
- Backend logs if relevant (sanitize any personal data)

---

## Contact

### Socials

> To be added.

### Acknowledgements

- [USDA FoodData Central](https://fdc.nal.usda.gov/) — nutrient database
- [UW Dining](https://hfs.uw.edu/Eat/Dining-Locations) — menu and venue information
- [Google Calendar API](https://developers.google.com/calendar) — schedule integration
- [Expo](https://expo.dev/) — React Native toolchain
- [Render](https://render.com/) — backend hosting
