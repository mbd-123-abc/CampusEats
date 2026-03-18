from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    bcrypt_rounds: int = 12
    redis_url: str = "redis://localhost:6379"
    jwt_expire_seconds: int = 86400

    # Google Calendar OAuth2 (optional — feature disabled if not set)
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: str = "http://localhost:8000/calendar/callback"
    frontend_url: str = "http://localhost:8081"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    class Config:
        env_file = ".env"


settings = Settings()
