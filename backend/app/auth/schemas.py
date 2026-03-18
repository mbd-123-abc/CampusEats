from pydantic import BaseModel, field_validator
import re
from typing import Literal
from zxcvbn import zxcvbn

SUPPORTED_UNIVERSITIES: dict[str, str] = {
    "uw_seattle": "University of Washington",
}

# Precomputed dummy hash — avoids bcrypt cost at import time
# Replace with a freshly generated hash on initial deployment
DUMMY_HASH = b"$2b$12$C6UzMDM.H6dfI/f/IKcEeO5j9GqQ8K/uxkXn9Yx8RJWb1x1oGf4bW"


class RegisterRequest(BaseModel):
    username: str
    password: str
    university: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not (3 <= len(v) <= 30):
            raise ValueError("Username must be 3–30 characters")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username may only contain letters, digits, and underscores")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 10:
            raise ValueError("Password must be at least 10 characters")
        result = zxcvbn(v)
        if result["score"] < 2:
            raise ValueError("Password is too weak — try a longer or more complex password")
        return v

    @field_validator("university")
    @classmethod
    def validate_university(cls, v: str) -> str:
        if v not in SUPPORTED_UNIVERSITIES:
            raise ValueError(f"Unsupported university. Supported: {list(SUPPORTED_UNIVERSITIES.keys())}")
        return v

    # No confirm_password field — validated client-side only


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthToken(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = 86400
    role: str = "user"
