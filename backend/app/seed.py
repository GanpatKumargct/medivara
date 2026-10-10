"""BE-2.2 demo reset and seed. Run: uv run python -m app.seed reset

Wipes the database and private file store, then seeds the fixed demo IDs from the
synthetic demo data pack §2. Refuses to run unless DEMO_MODE=true.
"""

import shutil
import sys
from pathlib import Path

from sqlmodel import Session, SQLModel

from app.auth import hash_password
from app.config import get_settings
from app.db import get_engine, init_db
from app.models import (
    ALL_SCOPES,
    ConsentRecord,
    ConsentType,
    PatientAccessGrant,
    PatientProfile,
    Role,
    User,
)

DEMO_PASSWORD = "MediVara-Demo-2026"

# (user id, email, display name, patient id, age, consented)
DEMO_USERS = [
    ("usr_meera", "meera.demo@medivara.test", "Meera Raman", "pat_meera", 58, True),
    ("usr_karthik", "karthik.demo@medivara.test", "Karthik Raman", "pat_karthik", 32, True),
    ("usr_ravi", "ravi.demo@medivara.test", "Ravi Menon", "pat_ravi", 41, True),
    ("usr_fresh", "fresh.test@medivara.test", "Test User", "pat_fresh", None, False),
]


def seed(session: Session) -> None:
    policy = get_settings().policy_version
    # Flush parents first: without ORM relationships, inserts aren't ordered by foreign key.
    for user_id, email, name, _patient_id, _age, _consented in DEMO_USERS:
        session.add(User(id=user_id, email=email, password_hash=hash_password(DEMO_PASSWORD), display_name=name, is_demo=True))
    session.flush()
    for user_id, _email, name, patient_id, age, _consented in DEMO_USERS:
        session.add(PatientProfile(id=patient_id, owner_user_id=user_id, display_name=name, age_years=age))
    session.flush()
    for user_id, _email, _name, patient_id, _age, consented in DEMO_USERS:
        session.add(
            PatientAccessGrant(
                id=f"grt_{user_id.removeprefix('usr_')}_owner",
                patient_id=patient_id,
                grantee_user_id=user_id,
                role=Role.owner,
                scopes=list(ALL_SCOPES),
                granted_by_user_id=user_id,
            )
        )
        if consented:
            for consent_type in (ConsentType.terms_and_disclaimer, ConsentType.ai_processing):
                session.add(ConsentRecord(user_id=user_id, consent_type=consent_type, granted=True, policy_version=policy))
    session.flush()

    sharing = ConsentRecord(
        user_id="usr_meera",
        patient_id="pat_meera",
        consent_type=ConsentType.sharing,
        granted=True,
        policy_version=policy,
        context={"grant_id": "grt_karthik_meera"},
    )
    session.add(sharing)
    session.flush()
    session.add(
        PatientAccessGrant(
            id="grt_karthik_meera",
            patient_id="pat_meera",
            grantee_user_id="usr_karthik",
            role=Role.caregiver,
            scopes=["view_records", "manage_reminders"],
            granted_by_user_id="usr_meera",
            consent_record_id=sharing.id,
        )
    )
    session.commit()


def reset() -> None:
    settings = get_settings()
    if not settings.demo_mode:
        sys.exit("Refusing to reset: DEMO_MODE is not true.")
    storage = Path(settings.storage_dir)
    if storage.exists():
        shutil.rmtree(storage)
    storage.mkdir(parents=True, exist_ok=True)

    import app.models  # noqa: F401

    engine = get_engine()
    SQLModel.metadata.drop_all(engine)
    init_db()
    with Session(engine) as session:
        seed(session)
    target = engine.url.render_as_string(hide_password=True)
    print(f"Reset complete: {len(DEMO_USERS)} users seeded into {target}")


if __name__ == "__main__":
    if sys.argv[1:] != ["reset"]:
        sys.exit("Usage: python -m app.seed reset")
    reset()
