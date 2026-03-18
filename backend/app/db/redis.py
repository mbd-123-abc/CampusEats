import logging
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def store_jti(jti: str, ttl: int = 86400) -> None:
    try:
        r = await get_redis()
        await r.setex(f"jti:{jti}", ttl, "active")
    except Exception:
        logger.warning("Redis unavailable — skipping JTI store for %s", jti)


async def revoke_jti(jti: str) -> None:
    try:
        r = await get_redis()
        await r.delete(f"jti:{jti}")
    except Exception:
        logger.warning("Redis unavailable — skipping JTI revoke for %s", jti)


async def is_jti_active(jti: str) -> bool:
    """Returns True if JTI is active in Redis, or if Redis is unavailable (fail-open for local dev)."""
    try:
        r = await get_redis()
        return bool(await r.exists(f"jti:{jti}"))
    except Exception:
        logger.warning("Redis unavailable — allowing token with jti=%s (fail-open)", jti)
        return True
