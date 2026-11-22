"""Database session management and connection pooling for Supabase Postgres.

Configured with SQLAlchemy 2.0, psycopg (v3) driver, and tuned for Supabase's
PgBouncer connection pooler (small pool size, pre-ping enabled, prepared statements disabled).
"""

import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.config import get_settings

logger = logging.getLogger(__name__)

_engine = None
_session_factory = None


def get_db_engine():
    """Create or return the cached SQLAlchemy Engine instance.

    Configured specifically for Supabase's transaction pooler:
    - Connection pooling (pool_size=5, max_overflow=5, pool_pre_ping=True, pool_recycle=300)
    - Disables prepared statements (prepare_threshold=None) to ensure compatibility
      with Supabase PgBouncer transaction mode on port 6543.
    """
    global _engine
    if _engine is not None:
        return _engine

    settings = get_settings()
    db_url = settings.get_sqlalchemy_database_url()

    if not db_url:
        logger.warning("DATABASE_URL is not configured. Database engine will not be initialized.")
        return None

    connect_args = {}
    if "psycopg" in db_url:
        # Crucial for Supabase PgBouncer pooler (transaction mode): disable prepared statements
        connect_args["prepare_threshold"] = None
        _engine = create_engine(
            db_url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
            pool_recycle=settings.DB_POOL_RECYCLE,
            connect_args=connect_args,
            echo=False,
        )
    elif "sqlite" in db_url:
        connect_args["check_same_thread"] = False
        _engine = create_engine(
            db_url,
            connect_args=connect_args,
            echo=False,
        )
        from app.db.models import Base
        Base.metadata.create_all(_engine)
        logger.info("Local SQLite database engine initialized and tables created.")
    else:
        _engine = create_engine(
            db_url,
            connect_args=connect_args,
            echo=False,
        )
    return _engine


def get_session_factory():
    """Return the thread-safe sessionmaker factory."""
    global _session_factory
    if _session_factory is not None:
        return _session_factory

    engine = get_db_engine()
    if engine is None:
        raise RuntimeError("Database engine is not initialized. Please verify DATABASE_URL in .env.")

    _session_factory = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False,
    )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency to acquire and clean up a database session per request."""
    factory = get_session_factory()
    db: Session = factory()
    try:
        yield db
    finally:
        db.close()


def check_db_connectivity() -> bool:
    """Perform a live connectivity health check against Supabase Postgres.

    Free-tier Supabase projects automatically pause after a period of inactivity.
    This check detects if the database is paused or unreachable and logs/raises
    an explicit and actionable error message.

    Returns:
        bool: True if connection succeeded.

    Raises:
        RuntimeError: If connection fails, explaining that the project may be paused.
    """
    engine = get_db_engine()
    if engine is None:
        raise RuntimeError(
            "Database connectivity check failed: DATABASE_URL is empty or not configured. "
            "Please check your .env file."
        )

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Successfully connected to Supabase PostgreSQL database.")
        return True
    except (OperationalError, SQLAlchemyError, Exception) as exc:
        error_msg = (
            "Database connectivity check failed! "
            "If you are using Supabase Free Tier, the project may be paused due to inactivity. "
            "Please visit https://supabase.com/dashboard to unpause it, or verify your DATABASE_URL "
            f"and connection-pooler credentials. Underlying error: {exc}"
        )
        logger.error(error_msg)
        raise RuntimeError(error_msg) from exc
