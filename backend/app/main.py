from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.auth.router import router as auth_router
from app.meals.router import router as meals_router
from app.profile.router import router as profile_router
from app.admin.router import router as admin_router
from app.calendar.router import router as calendar_router
from app.db.base import engine, Base

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Campus Eats API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "exp://localhost:8081",
        "https://campus-eats-api.onrender.com",
        # Expo Go on device uses exp:// — allow all origins in dev
        # In production, replace * with your actual app domain
    ],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(meals_router)
app.include_router(profile_router)
app.include_router(admin_router)
app.include_router(calendar_router)


@app.on_event("startup")
async def create_tables():
    """Auto-create tables on startup — works for SQLite local dev."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.middleware("http")
async def enforce_https(request: Request, call_next):
    # Only redirect on Render (production) — never redirect local dev or OPTIONS preflights
    proto = request.headers.get("x-forwarded-proto")
    if proto == "http" and request.method != "OPTIONS" and "localhost" not in request.headers.get("host", ""):
        url = request.url.replace(scheme="https")
        return RedirectResponse(url=str(url), status_code=301)
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok"}
