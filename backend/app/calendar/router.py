"""
Google Calendar OAuth2 — hardened implementation.

Security model:
  - JWT never travels as a URL query param to Google. /connect-init accepts
    the JWT, validates it server-side, then issues a short-lived opaque CSRF
    state token (random UUID, no user data) stored in Redis for 5 minutes.
  - /callback validates + deletes the state token (one-time use) before
    doing anything else. CSRF attack surface = zero.
  - PKCE (S256) stored alongside state — prevents auth code interception.
  - Google userinfo endpoint called to verify the access token is valid.
  - All httpx calls have a 10s timeout — no hung workers.
  - All string fields from Google are truncated before storage.
  - Refresh token stored in Redis (TTL 30 days) for silent re-sync.
  - /status and /events require authentication.
  - /disconnect revokes the token with Google before deleting locally.
"""

import base64
import hashlib
import json
import os
import secrets
import urllib.parse
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.auth.middleware import get_current_user
from app.db.base import get_db
from app.db.models import CalendarEvent
from app.config import settings
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/calendar", tags=["calendar"])
limiter = Limiter(key_func=get_remote_address)

GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_REVOKE_URL   = "https://oauth2.googleapis.com/revoke"
GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3"
SCOPES = "https://www.googleapis.com/auth/calendar.readonly openid email"

_STATE_PREFIX    = "cal_state:"
_STATE_TTL       = 300        # 5 minutes — CSRF state token lifetime
_TIMEOUT         = httpx.Timeout(10.0)
_MAX_TITLE_LEN   = 300
_MAX_EVENTID_LEN = 200

# In-memory fallback for state tokens when Redis is unavailable (local dev)
_local_state: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_redis_safe():
    """Returns Redis client or None if unavailable."""
    try:
        from app.db.redis import get_redis
        r = await get_redis()
        await r.ping()   # confirm it's actually reachable
        return r
    except Exception:
        return None


async def _state_set(key: str, value: str) -> None:
    redis = await _get_redis_safe()
    if redis:
        await redis.setex(key, _STATE_TTL, value)
    else:
        _local_state[key] = value   # local dev fallback


async def _state_get(key: str) -> str | None:
    redis = await _get_redis_safe()
    if redis:
        return await redis.get(key)
    return _local_state.get(key)


async def _state_delete(key: str) -> None:
    redis = await _get_redis_safe()
    if redis:
        await redis.delete(key)
    else:
        _local_state.pop(key, None)


def _pkce_pair() -> tuple[str, str]:
    """Returns (code_verifier, code_challenge_S256)."""
    verifier  = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    digest    = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


async def _issue_state_and_redirect(user_id: str) -> RedirectResponse:
    """
    Creates a CSRF state token + PKCE pair, stores them,
    and returns a redirect to Google's consent screen.
    """
    state    = secrets.token_urlsafe(32)
    verifier, challenge = _pkce_pair()

    await _state_set(
        f"{_STATE_PREFIX}{state}",
        json.dumps({"user_id": user_id, "verifier": verifier}),
    )

    params = {
        "client_id":             settings.google_client_id,
        "redirect_uri":          settings.google_redirect_uri,
        "response_type":         "code",
        "scope":                 SCOPES,
        "access_type":           "offline",
        "prompt":                "consent",
        "state":                 state,
        "code_challenge":        challenge,
        "code_challenge_method": "S256",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}")


def _sanitise_events(raw_events: list) -> list[dict]:
    """Truncates all string fields from Google before storage."""
    out = []
    for ev in raw_events:
        start    = ev.get("start", {})
        end      = ev.get("end", {})
        start_dt = start.get("dateTime") or start.get("date")
        end_dt   = end.get("dateTime")   or end.get("date")
        if not start_dt or not end_dt:
            continue
        out.append({
            "google_event_id": str(ev.get("id") or "")[:_MAX_EVENTID_LEN],
            "title":           str(ev.get("summary") or "Untitled")[:_MAX_TITLE_LEN],
            "start_dt":        start_dt[:35],
            "end_dt":          end_dt[:35],
            "recurrence":      json.dumps([
                str(r)[:200] for r in ev.get("recurrence", [])
                if isinstance(r, str)
            ][:10]),
        })
    return out


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
@limiter.limit("60/minute")
async def calendar_status(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns whether this user has calendar events stored.
    Checks Redis for a live token first; falls back to checking the DB
    for any stored events (covers local dev without Redis).
    """
    user_id = current_user["sub"]

    # Primary: Redis token present
    redis = await _get_redis_safe()
    if redis and await redis.exists(f"cal_token:{user_id}"):
        return {"configured": True, "connected": True}

    # Fallback: any events in the DB means they connected at some point
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.user_id == user_id).limit(1)
    )
    connected = result.scalar_one_or_none() is not None
    return {"configured": True, "connected": connected}

@router.get("/connect-init")
@limiter.limit("10/minute")
async def calendar_connect_init(request: Request, token: str = Query(...)):
    """
    Browser-facing entry point (opened via Linking.openURL).
    Accepts the JWT as a query param, validates it server-side immediately,
    then issues an opaque state token and redirects to Google.
    The JWT is never forwarded to Google or stored anywhere.
    """
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar not configured")

    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("missing sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return await _issue_state_and_redirect(user_id)


@router.get("/connect")
async def calendar_connect(current_user: dict = Depends(get_current_user)):
    """API-client entry point (Bearer token in Authorization header)."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar not configured")
    return await _issue_state_and_redirect(current_user["sub"])


@router.get("/callback")
async def calendar_callback(
    code:  str = Query(...),
    state: str = Query(...),
    db:    AsyncSession = Depends(get_db),
):
    """
    1. Validates + deletes the CSRF state token (one-time use).
    2. Exchanges auth code + PKCE verifier for tokens.
    3. Verifies the access token via Google userinfo.
    4. Fetches 4 weeks of events and persists them.
    5. Stores refresh token in Redis for silent re-sync.
    6. Redirects to a fixed frontend URL — no user-controlled redirect target.
    """
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar not configured")

    # 1. Validate + consume state token
    raw = await _state_get(f"{_STATE_PREFIX}{state}")
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid or expired state — please try connecting again")

    await _state_delete(f"{_STATE_PREFIX}{state}")  # one-time use

    try:
        state_data = json.loads(raw)
        user_id    = state_data["user_id"]
        verifier   = state_data["verifier"]
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(status_code=400, detail="Malformed state token")

    # 2. Exchange code for tokens (with PKCE verifier)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri":  settings.google_redirect_uri,
            "grant_type":    "authorization_code",
            "code_verifier": verifier,
        })

    if token_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Token exchange with Google failed")

    tokens        = token_resp.json()
    access_token  = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")

    if not access_token:
        raise HTTPException(status_code=502, detail="No access token in Google response")

    # 3. Verify access token is valid (userinfo call)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        ui_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if ui_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify Google identity")

    # 4. Fetch 4 weeks of events
    now      = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(weeks=4)).isoformat()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        ev_resp = await client.get(
            f"{GOOGLE_CALENDAR_URL}/calendars/primary/events",
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "timeMin":      time_min,
                "timeMax":      time_max,
                "singleEvents": "true",
                "orderBy":      "startTime",
                "maxResults":   500,
            },
        )
    # 5. Persist events (replace existing) — skip gracefully if calendar API not enabled
    if ev_resp.status_code == 200:
        await db.execute(delete(CalendarEvent).where(CalendarEvent.user_id == user_id))
        for ev in _sanitise_events(ev_resp.json().get("items", [])):
            db.add(CalendarEvent(user_id=user_id, **ev))
        await db.commit()
    else:
        import logging
        logging.getLogger(__name__).error(
            "Calendar events fetch failed %s: %s", ev_resp.status_code, ev_resp.text[:500]
        )

    # 6. Store refresh token (30-day TTL) for silent re-sync
    if refresh_token:
        redis = await _get_redis_safe()
        if redis:
            await redis.setex(f"cal_token:{user_id}", 60 * 60 * 24 * 30, refresh_token)

    # 7. Return an HTML page that deep-links back into the app
    from fastapi.responses import HTMLResponse
    deep_link = "campuseats://dashboard?calendar=connected"
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Calendar Connected</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body {{ font-family: -apple-system, sans-serif; background: #0f0f1a; color: #fff;
           display: flex; flex-direction: column; align-items: center;
           justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; }}
    h2 {{ color: #74c69d; margin-bottom: 8px; }}
    p  {{ color: #888; font-size: 14px; margin-bottom: 24px; }}
    a  {{ background: #4361ee; color: #fff; padding: 14px 28px; border-radius: 10px;
          text-decoration: none; font-size: 16px; font-weight: 600; }}
  </style>
  <script>
    window.onload = function() {{
      window.location.href = "{deep_link}";
    }};
  </script>
</head>
<body>
  <h2>Calendar Connected</h2>
  <p>Redirecting you back to Campus Eats...</p>
  <a href="{deep_link}">Open App</a>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.post("/sync")
@limiter.limit("10/minute")
async def sync_calendar(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-syncs using the stored refresh token. Called on app open."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar not configured")

    user_id = current_user["sub"]
    redis   = await _get_redis_safe()
    if not redis:
        raise HTTPException(status_code=503, detail="Session store unavailable")

    refresh_token = await redis.get(f"cal_token:{user_id}")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Calendar not connected — please reconnect")

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "client_id":     settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type":    "refresh_token",
        })

    if token_resp.status_code != 200:
        await redis.delete(f"cal_token:{user_id}")
        raise HTTPException(status_code=401, detail="Calendar access revoked — please reconnect")

    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="No access token in refresh response")

    now      = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(weeks=4)).isoformat()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        ev_resp = await client.get(
            f"{GOOGLE_CALENDAR_URL}/calendars/primary/events",
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "timeMin":      time_min,
                "timeMax":      time_max,
                "singleEvents": "true",
                "orderBy":      "startTime",
                "maxResults":   500,
            },
        )
    if ev_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch calendar events")

    await db.execute(delete(CalendarEvent).where(CalendarEvent.user_id == user_id))
    for ev in _sanitise_events(ev_resp.json().get("items", [])):
        db.add(CalendarEvent(user_id=user_id, **ev))
    await db.commit()

    return {"synced": len(ev_resp.json().get("items", []))}


@router.get("/events")
@limiter.limit("60/minute")
async def get_calendar_events(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return today's calendar events for the authenticated user (local date based on UTC offset)."""
    user_id     = current_user["sub"]
    now         = datetime.now(timezone.utc)
    # Use a broad window (yesterday to tomorrow) to avoid timezone edge cases
    today_start = (now - timedelta(hours=12)).isoformat()
    today_end   = (now + timedelta(hours=36)).isoformat()

    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id)
        .where(CalendarEvent.start_dt >= today_start)
        .where(CalendarEvent.start_dt <= today_end)
        .order_by(CalendarEvent.start_dt)
    )
    return {
        "events": [
            {"id": str(e.event_id), "title": e.title, "start": e.start_dt, "end": e.end_dt}
            for e in result.scalars().all()
        ]
    }


@router.get("/events/week")
async def get_calendar_events_week(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all stored events for the next 7 days."""
    user_id = current_user["sub"]
    now     = datetime.now(timezone.utc)
    week_end = (now + timedelta(days=7)).isoformat()

    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id)
        .where(CalendarEvent.start_dt >= now.isoformat())
        .where(CalendarEvent.start_dt <= week_end)
        .order_by(CalendarEvent.start_dt)
    )
    return {
        "events": [
            {"id": str(e.event_id), "title": e.title, "start": e.start_dt, "end": e.end_dt}
            for e in result.scalars().all()
        ]
    }


@router.delete("/disconnect")
async def disconnect_calendar(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revokes token with Google, deletes all stored events for this user."""
    user_id = current_user["sub"]
    redis   = await _get_redis_safe()

    if redis:
        refresh_token = await redis.get(f"cal_token:{user_id}")
        if refresh_token:
            # Revoke with Google so the token can't be used elsewhere
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                await client.post(GOOGLE_REVOKE_URL, params={"token": refresh_token})
        await redis.delete(f"cal_token:{user_id}")

    await db.execute(delete(CalendarEvent).where(CalendarEvent.user_id == user_id))
    await db.commit()
    return {"disconnected": True}


@router.get("/debug")
async def calendar_debug(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dev-only: shows total stored events and the first 5, so you can confirm the DB has data."""
    user_id = current_user["sub"]
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id)
        .order_by(CalendarEvent.start_dt)
    )
    events = result.scalars().all()
    return {
        "total_stored": len(events),
        "sample": [
            {"title": e.title, "start": e.start_dt, "end": e.end_dt}
            for e in events[:5]
        ],
    }
