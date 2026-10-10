"""Database engine and the per-request session dependency.

PostgreSQL when DATABASE_URL is set (for example
postgresql+psycopg://medivara:…@127.0.0.1:5433/medivara, see docker-compose.yml);
otherwise a local SQLite file at DATABASE_PATH in WAL mode (used by the test suite).
"""

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

_engine: Engine | None = None


def database_url() -> str:
    settings = get_settings()
    if settings.database_url:
        return settings.database_url
    path = Path(settings.database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path}"


def is_sqlite() -> bool:
    return database_url().startswith("sqlite")


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        url = database_url()
        if url.startswith("sqlite"):
            _engine = create_engine(url, connect_args={"check_same_thread": False})

            @event.listens_for(_engine, "connect")
            def _pragmas(dbapi_conn, _record):
                cur = dbapi_conn.cursor()
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute("PRAGMA foreign_keys=ON")
                cur.close()

        else:
            # Background processing runs in worker threads, so keep a small pool and
            # check connections before use (the database may restart under PM2/Docker).
            _engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
    return _engine


def reset_engine() -> None:
    """Drop the cached engine (used by tests and the reset command)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = None


def init_db() -> None:
    import app.models  # noqa: F401  registers tables

    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
