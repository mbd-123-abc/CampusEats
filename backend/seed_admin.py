"""
Run once to create the admin user in the database:
  cd backend && python seed_admin.py
"""
import asyncio
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import settings
from app.db.models import User


async def seed():
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        existing = result.scalar_one_or_none()

        password = input("Set admin password: ")
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()

        if existing:
            existing.password_hash = password_hash
            await session.commit()
            print("Admin password updated.")
        else:
            admin = User(username="admin", password_hash=password_hash, university="uw_seattle")
            session.add(admin)
            await session.commit()
            print("Admin user created.")

    await engine.dispose()


asyncio.run(seed())
