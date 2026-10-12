"""Alembic environment. Runs against the app's own engine (DATABASE_URL or the SQLite file).

Migrations run automatically at startup through app.db.init_db(); the CLI also works:
    uv run alembic -c migrations/alembic.ini upgrade head
"""

from alembic import context
from sqlmodel import SQLModel

import app.models  # noqa: F401  registers tables
from app.db import get_engine

target_metadata = SQLModel.metadata


def run_migrations_online() -> None:
    connection = context.config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    with get_engine().connect() as conn:
        _run(conn)
        conn.commit()


def _run(connection) -> None:
    # Batch mode lets ALTER TABLE work on SQLite as well as PostgreSQL.
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True,
                      compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


run_migrations_online()
