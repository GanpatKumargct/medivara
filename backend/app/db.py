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


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
BASELINE_REVISION = "0001"


def _alembic_config(connection):
    from alembic.config import Config

    config = Config(str(MIGRATIONS_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.attributes["connection"] = connection
    return config


def init_db() -> None:
    """Bring the schema up to date (Alembic, migrations/versions/).

    Empty database: create every table from the models and mark it as the latest revision.
    Tables but no migration history (databases made before Alembic): mark them as the
    baseline, then apply the newer migrations. Otherwise apply any pending migrations.
    """
    from alembic import command
    from sqlalchemy import inspect

    import app.models  # noqa: F401  registers tables

    engine = get_engine()
    with engine.begin() as connection:
        tables = set(inspect(connection).get_table_names())
        config = _alembic_config(connection)
        if "user" not in tables:
            SQLModel.metadata.create_all(connection)
            command.stamp(config, "head")
        else:
            if "alembic_version" not in tables:
                command.stamp(config, BASELINE_REVISION)
            command.upgrade(config, "head")

    from app import versions

    with Session(engine) as session:
        versions.backfill(session)  # version 1 for documents that predate history
        versions.purge_expired(session)  # Recently deleted older than 30 days


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
