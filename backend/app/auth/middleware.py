from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.service import decode_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    return await decode_token(credentials.credentials)


def require_user_match(user_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    """Ensures the JWT subject matches the requested user_id resource."""
    if str(current_user["sub"]) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user
