import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

DEMO_PASSWORD = "MediVara-Demo-2026"
API = "/api/v1"


@pytest.fixture
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    """A fresh, seeded database per test, isolated from the developer's .env."""
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    # TEST_DATABASE_URL runs the suite on PostgreSQL; every test wipes that database, so
    # only a database whose name ends in "_test" is accepted.
    test_url = os.environ.get("TEST_DATABASE_URL", "")
    if test_url:
        if not test_url.rsplit("/", 1)[-1].split("?")[0].endswith("_test"):
            pytest.exit("TEST_DATABASE_URL must point at a database named *_test", returncode=2)
        monkeypatch.setenv("DATABASE_URL", test_url)
    else:
        monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "files"))
    monkeypatch.setenv("GOLDEN_CACHE_DIR", str(tmp_path / "golden_cache"))
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("AI_MODE", os.environ.get("TEST_AI_MODE", "live"))
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-not-real")
    monkeypatch.setenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")  # independent of the local .env
    monkeypatch.setenv("OPENROUTER_REASONING_EFFORT", "low")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setenv("GEMINI_RETRY_BACKOFF_S", "0")
    # Never send email or reach ElevenLabs from tests, whatever the local .env says.
    for name in ("SMTP_HOST", "SMTP_FROM", "ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_FEMALE_VOICE_ID"):
        monkeypatch.setenv(name, "")

    from app import config, db, ratelimit, seed

    config.get_settings.cache_clear()
    db.reset_engine()
    seed.reset()
    ratelimit.reset()

    from app.main import create_app

    # Connect from loopback, like the Vite proxy, so X-Forwarded-For is honoured as in the dev setup.
    with TestClient(create_app(), raise_server_exceptions=False, client=("127.0.0.1", 50000)) as test_client:
        yield test_client

    db.reset_engine()
    config.get_settings.cache_clear()


@pytest.fixture
def fake_model(client):
    """Route every model call to a FakeModel (never the network)."""
    from app import ai_state, llm
    from fake_model import FakeModel

    model = FakeModel()
    llm.set_transport(model)
    yield model
    llm.set_transport(None)
    ai_state.record_call_outcome(True)


@pytest.fixture(scope="session")
def pdfs() -> dict[str, bytes]:
    """The synthetic demo PDFs, generated in memory from the data pack."""
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "demo-data" / "make_pdfs.py"
    spec = importlib.util.spec_from_file_location("make_pdfs", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.build_all()


def upload(client, token: str, filename: str, data: bytes, patient_id: str = "pat_meera", **form):
    return client.post(
        f"{API}/patients/{patient_id}/documents",
        headers=auth(token),
        files={"file": (filename, data, "application/pdf")},
        data=form,
    )


def login(client: TestClient, email: str, password: str = DEMO_PASSWORD) -> str:
    response = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


MEERA = "meera.demo@medivara.test"
KARTHIK = "karthik.demo@medivara.test"
RAVI = "ravi.demo@medivara.test"
FRESH = "fresh.test@medivara.test"
