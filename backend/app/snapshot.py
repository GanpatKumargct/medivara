"""Demo snapshots (FR-006, BE-2.2): save and restore the database plus the private file store.

    uv run python -m app.snapshot save G1        → snapshots/snapshot-G1/
    uv run python -m app.snapshot restore demo   (stop the backend first)
    uv run python -m app.snapshot list

Works the same on PostgreSQL and SQLite: every table is exported to JSON through SQLAlchemy
(no pg_dump needed), and restore recreates the schema and re-inserts rows in foreign-key
order. That also moves data between the two engines. `save` reads in one transaction, so
it is consistent while the server runs. `restore` refuses unless DEMO_MODE=true.
Target: restore in 2 minutes or less (TC-REL-03). Synthetic data only; never committed.
"""

import json
import shutil
import sys
import time
from datetime import date, datetime
from enum import Enum
from pathlib import Path

from sqlalchemy import Date, DateTime, select
from sqlmodel import SQLModel

from app.config import get_settings
from app.db import get_engine, init_db
from app.models import utcnow

DATA_FILE = "tables.json"
FILES_DIR = "files"


def _root() -> Path:
    return Path(get_settings().snapshot_dir)


def _folder(name: str) -> Path:
    if not name or not all(c.isalnum() or c in "-_" for c in name):
        raise SystemExit("Snapshot names use letters, digits, '-' and '_' only.")
    return _root() / f"snapshot-{name}"


def _tables():
    import app.models  # noqa: F401  registers tables

    return SQLModel.metadata.sorted_tables  # parents before children


def _to_json(value):
    if isinstance(value, Enum):
        return value.name
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _base_type(column):
    """The SQLAlchemy type underneath SQLModel's wrappers (UTCDateTime → DateTime)."""
    return getattr(column.type, "impl", column.type)


def _from_json(column, value):
    if value is None or not isinstance(value, str):
        return value
    base = _base_type(column)
    if isinstance(base, DateTime):
        return datetime.fromisoformat(value)
    if isinstance(base, Date):
        return date.fromisoformat(value)
    return value


def save(name: str) -> Path:
    settings = get_settings()
    target = _folder(name)
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    data: dict[str, list[dict]] = {}
    with get_engine().connect() as conn, conn.begin():
        for table in _tables():
            rows = conn.execute(select(table)).mappings().all()
            data[table.name] = [{k: _to_json(v) for k, v in row.items()} for row in rows]
    (target / DATA_FILE).write_text(json.dumps(data, ensure_ascii=False))
    storage = Path(settings.storage_dir)
    if storage.exists():
        shutil.copytree(storage, target / FILES_DIR)
    else:
        (target / FILES_DIR).mkdir()
    files = sum(1 for p in (target / FILES_DIR).rglob("*") if p.is_file())
    rows = sum(len(v) for v in data.values())
    (target / "snapshot.json").write_text(
        json.dumps({"name": name, "saved_at": utcnow().isoformat(), "rows": rows, "files": files}, indent=2)
    )
    return target


def restore(name: str) -> float:
    settings = get_settings()
    if not settings.demo_mode:
        raise SystemExit("Refusing to restore: DEMO_MODE is not true.")
    source = _folder(name)
    if not (source / DATA_FILE).exists():
        raise SystemExit(f"No snapshot named {name!r} in {_root()}.")
    start = time.perf_counter()
    data = json.loads((source / DATA_FILE).read_text())
    engine = get_engine()
    SQLModel.metadata.drop_all(engine)
    init_db()
    with engine.begin() as conn:
        for table in _tables():
            rows = data.get(table.name, [])
            if rows:
                conn.execute(
                    table.insert(),
                    [{k: _from_json(table.c[k], v) for k, v in row.items() if k in table.c} for row in rows],
                )
    storage = Path(settings.storage_dir)
    if storage.exists():
        shutil.rmtree(storage)
    shutil.copytree(source / FILES_DIR, storage)
    return time.perf_counter() - start


def list_snapshots() -> list[dict]:
    if not _root().exists():
        return []
    return [json.loads(p.read_text()) for p in sorted(_root().glob("snapshot-*/snapshot.json"))]


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["save"] and len(args) == 2:
        print(f"Saved {save(args[1])}")
    elif args[:1] == ["restore"] and len(args) == 2:
        print(f"Restored snapshot {args[1]!r} in {restore(args[1]):.1f} s. Start the backend and check /api/v1/health.")
    elif args == ["list"]:
        for snap in list_snapshots():
            print(f"{snap['name']}: saved {snap['saved_at']}, {snap.get('rows', '?')} rows, {snap['files']} files")
    else:
        sys.exit("Usage: python -m app.snapshot save NAME | restore NAME | list")
