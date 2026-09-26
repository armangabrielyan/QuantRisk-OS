"""QuantRisk OS - Database Session Management"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./quantrisk.db")

# SQLite needs check_same_thread=False for FastAPI's async handling
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize all tables. Called on startup."""
    from app.models.orm_models import Base
    Base.metadata.create_all(bind=engine)
