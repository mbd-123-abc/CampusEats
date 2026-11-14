# Campus Eats

**Version:** 1.0 (MVP)

**Contributors:** Mahika Bagri

---

## Table of Contents
<ul>
  <li><a href="#prerequisites">Prerequisites</a>
  <li><a href="#set-up">Set Up</a>
  <li><a href="#configuring-integrations">Configuring Integrations</a>
  <li><a href="#contributing">Contributing</a>
</ul>

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn
- (Optional) Redis — for rate limiting in production
- (Optional) ngrok — for Google Calendar OAuth on a physical device

---

## Set Up 

### Backend

#### Python Installation

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

#### Environment

```env
DATABASE_URL=sqlite+aiosqlite:///./campus_eats.db
JWT_SECRET=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
BCRYPT_ROUNDS=12
REDIS_URL=redis://localhost:6379
```

#### Database

```bash
alembic upgrade head
python3 seed_admin.py
python3 seed_menu.py
python3 seed_venue_hours.py
python3 backfill_nutrients.py   # fetches USDA nutrient data — requires internet
```
Run `python3 seed_menu.py` and `python3 backfill_nutrients.py` after any menu changes

#### Starting the Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

#### Expo Installation

```bash
cd mobile
npm install
```

#### Environment

```env
EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000
EXPO_PUBLIC_USDA_API_KEY=<free key from https://fdc.nal.usda.gov/api-key-signup>
```

#### Starting the Server

```bash
npx expo start
```

---

## Configuring Integrations

#### Google Calendar OAuth 

1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Calendar API**
3. Create OAuth 2.0 credentials → Web application
4. Add your redirect URI to authorized redirect URIs:
   - Local: `http://localhost:8000/calendar/callback`
   - With ngrok: `https://<your-ngrok-subdomain>.ngrok-free.app/calendar/callback`
5. Edit `backend/.env`:

```env
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
GOOGLE_REDIRECT_URI=https://<your-ngrok-subdomain>.ngrok-free.app/calendar/callback
FRONTEND_URL=campuseats://dashboard
```

---

## Contributing

1. Fork the repo and create a feature branch: `git checkout -b feature/your-feature` or a personal branch: `git checkout -b name/your-name`
2. Follow existing code style  
3. Keep backend endpoints rate-limited and JWT-protected
4. Open a pull request with a clear description of what changed and why

---
