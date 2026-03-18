import uuid
import random
import time
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException

from app.config import settings
from app.db.models import User
from app.db.redis import store_jti, is_jti_active
from app.auth.schemas import RegisterRequest, LoginRequest, AuthToken, DUMMY_HASH, SUPPORTED_UNIVERSITIES

def _hash_password(password: str) -> str:
    rounds = settings.bcrypt_rounds
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=rounds)).decode()


def _issue_token(user: User) -> tuple[AuthToken, str]:
    now = int(datetime.now(tz=timezone.utc).timestamp())
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(user.user_id),
        "username": user.username,
        "university": user.university,
        "iat": now,
        "nbf": now,
        "exp": now + settings.jwt_expire_seconds,
        "jti": jti,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return AuthToken(access_token=token), jti


async def register(req: RegisterRequest, db: AsyncSession) -> AuthToken:
    from asyncpg import UniqueViolationError
    from sqlalchemy.exc import IntegrityError

    password_hash = _hash_password(req.password)
    user = User(
        username=req.username,
        password_hash=password_hash,
        university=req.university,
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username already taken")

    token, jti = _issue_token(user)
    await store_jti(jti, settings.jwt_expire_seconds)
    return token


async def login(req: LoginRequest, db: AsyncSession) -> AuthToken:
    result = await db.execute(select(User).where(User.username == req.username))
    user: User | None = result.scalar_one_or_none()

    hash_to_check = user.password_hash.encode() if user else DUMMY_HASH
    valid = bcrypt.checkpw(req.password.encode(), hash_to_check)

    # Constant-time jitter to prevent timing-based enumeration
    time.sleep(random.uniform(0.08, 0.12))

    if not user or not valid:
        if user:
            # Increment failed attempts and potentially lock
            new_attempts = user.failed_login_attempts + 1
            updates: dict = {"failed_login_attempts": new_attempts}
            if new_attempts >= 5:
                updates["locked_until"] = datetime.now(tz=timezone.utc) + timedelta(minutes=15)
            await db.execute(update(User).where(User.user_id == user.user_id).values(**updates))
            await db.commit()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Check lockout
    if user.locked_until and user.locked_until > datetime.now(tz=timezone.utc):
        raise HTTPException(status_code=401, detail="Account temporarily locked — try again later")

    # Reset failed attempts on success
    await db.execute(
        update(User).where(User.user_id == user.user_id).values(failed_login_attempts=0, locked_until=None)
    )
    await db.commit()

    token, jti = _issue_token(user)
    await store_jti(jti, settings.jwt_expire_seconds)
    return token


async def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    jti = payload.get("jti")
    if not jti or not await is_jti_active(jti):
        raise HTTPException(status_code=401, detail="Token revoked or expired")

    return payload
