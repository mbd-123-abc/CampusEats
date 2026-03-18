from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.base import get_db
from app.auth.schemas import RegisterRequest, LoginRequest, AuthToken
from app.auth import service

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=AuthToken, status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await service.register(req, db)


@router.post("/login", response_model=AuthToken)
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await service.login(req, db)
