"""Redesign extensions (API contract §5b, API-40 to API-61): registration, family profiles,
Medical ID, vitals, chat history, email invitations and voice sessions."""

from datetime import date, datetime, timedelta, timezone

import httpx
import pytest
from sqlmodel import Session, select

from conftest import API, DEMO_PASSWORD, FRESH, KARTHIK, MEERA, RAVI, auth, login, upload
from fake_model import statement

P = f"{API}/patients/pat_meera"
POLICY = "2026-10-demo-1"
ALL_SCOPES = ["view_records", "upload_documents", "manage_reminders"]


def db() -> Session:
    from app.db import get_engine

    return Session(get_engine())


def audit_rows(action: str):
    from app.models import AuditEvent

    with db() as session:
        return session.exec(select(AuditEvent).where(AuditEvent.action == action)).all()


def all_audit_meta() -> str:
    from app.models import AuditEvent

    with db() as session:
        return str([e.meta for e in session.exec(select(AuditEvent)).all()])


def fields(response) -> set[str]:
    assert response.status_code == 422, response.text
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    return {f["field"] for f in error["details"]["fields"]}


def code(response) -> str:
    return response.json()["error"]["code"]


def ago(**delta) -> str:
    return (datetime.now(timezone.utc) - timedelta(**delta)).isoformat()


# --- API-40 registration ------------------------------------------------------------------


def register(client, email="new.user@example.com", password="correct-horse-battery", display_name="Asha Iyer", ip=None):
    headers = {"X-Forwarded-For": ip} if ip else {}
    body = {"email": email, "password": password, "display_name": display_name}
    return client.post(f"{API}/auth/register", json=body, headers=headers)


def test_register_signs_in_and_needs_onboarding(client):
    response = register(client, email="  New.User@Example.com ", display_name="  Asha   Iyer ")
    assert response.status_code == 201, response.text
    body = response.json()
    signed_in = client.post(f"{API}/auth/login", json={"email": MEERA, "password": DEMO_PASSWORD}).json()
    assert set(body) == set(signed_in) and set(body["user"]) == set(signed_in["user"])
    assert body["token"].startswith("mvs_") and body["token_type"] == "bearer" and body["expires_at"].endswith("Z")
    assert body["user"]["email"] == "new.user@example.com"
    assert body["user"]["display_name"] == "Asha Iyer" and body["user"]["is_demo"] is False

    token = auth(body["token"])
    me = client.get(f"{API}/me", headers=token).json()
    assert me["onboarding_required"] is True
    assert all(value is None for value in me["consents"].values())
    patient_id = me["owned_patient_id"]
    assert patient_id.startswith("pat_")
    listing = client.get(f"{API}/patients", headers=token).json()
    assert [p["id"] for p in listing["items"]] == [patient_id]
    own = listing["items"][0]
    assert (own["my_role"], own["display_name"], own["is_synthetic"], own["scopes"]) == ("owner", "Asha Iyer", True, ALL_SCOPES)
    details = client.get(f"{API}/patients/{patient_id}/details", headers=token).json()["details"]
    assert details["relationship"] == "self"
    assert login(client, "new.user@example.com", "correct-horse-battery")

    events = audit_rows("auth.registered")
    assert len(events) == 1 and events[0].patient_id == patient_id and events[0].meta == {}


def test_register_duplicate_email(client):
    assert register(client).status_code == 201
    again = register(client, email="NEW.user@example.com ")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "EMAIL_TAKEN"
    assert again.json()["error"]["message"] == "An account already uses this email. Sign in instead."
    assert code(register(client, email=MEERA)) == "EMAIL_TAKEN"


@pytest.mark.parametrize(
    "change, field",
    [
        ({"password": "too-short"}, "password"),
        ({"password": "x" * 129}, "password"),
        ({"email": "not-an-email"}, "email"),
        ({"email": "a@b@example.com"}, "email"),
        ({"email": "user@localhost"}, "email"),
        ({"email": "user name@example.com"}, "email"),
        ({"email": "u" * 250 + "@x.com"}, "email"),
        ({"display_name": "   "}, "display_name"),
        ({"display_name": "x" * 81}, "display_name"),
    ],
)
def test_register_validation(client, change, field):
    assert fields(register(client, **change)) == {field}


def test_register_lists_every_bad_field_and_creates_nothing(client):
    from app.models import User

    assert fields(register(client, email="nope", password="123", display_name="")) == {"email", "password", "display_name"}
    with db() as session:
        assert len(session.exec(select(User)).all()) == 4  # the seeded demo users only


def test_register_is_rate_limited_per_ip(client):
    for i in range(10):
        assert register(client, email=f"user{i}@example.com", ip="203.0.113.77").status_code == 201
    blocked = register(client, email="user10@example.com", ip="203.0.113.77")
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    assert int(blocked.headers["Retry-After"]) == blocked.json()["error"]["details"]["retry_after_s"] > 0
    assert register(client, email="user10@example.com", ip="203.0.113.78").status_code == 201


# --- API-41 family profiles ---------------------------------------------------------------


def test_family_profile_is_owned_and_listed(client):
    meera = auth(login(client, MEERA))
    response = client.post(
        f"{API}/patients", headers=meera, json={"display_name": "  Lakshmi  Raman ", "age_years": 82, "relationship": "parent"}
    )
    assert response.status_code == 201, response.text
    patient = response.json()["patient"]
    assert patient["id"].startswith("pat_") and patient["display_name"] == "Lakshmi Raman" and patient["age_years"] == 82
    assert (patient["my_role"], patient["scopes"], patient["is_synthetic"]) == ("owner", ALL_SCOPES, True)
    assert patient["owner_display_name"] == "Meera Raman" and patient["stats"]["documents_total"] == 0
    assert patient["created_at"].endswith("Z")
    detail = client.get(f"{API}/patients/{patient['id']}", headers=meera).json()
    assert set(detail) == set(patient)

    listing = client.get(f"{API}/patients", headers=meera).json()
    assert listing["total"] == 2 and {p["id"] for p in listing["items"]} == {"pat_meera", patient["id"]}
    assert client.get(f"{API}/me", headers=meera).json()["owned_patient_id"] == "pat_meera"
    details = client.get(f"{API}/patients/{patient['id']}/details", headers=meera).json()["details"]
    assert details["relationship"] == "parent"

    karthik = auth(login(client, KARTHIK))
    assert patient["id"] not in {p["id"] for p in client.get(f"{API}/patients", headers=karthik).json()["items"]}
    assert code(client.get(f"{API}/patients/{patient['id']}", headers=karthik)) == "ACCESS_DENIED"
    events = audit_rows("patient.created")
    assert len(events) == 1 and events[0].patient_id == patient["id"] and events[0].meta == {}


def test_family_profile_validation_and_limit(client):
    meera = auth(login(client, MEERA))

    def create(**body):
        return client.post(f"{API}/patients", headers=meera, json={"display_name": "Family", "relationship": "child", **body})

    assert fields(create(display_name="  ")) == {"display_name"}
    assert fields(create(display_name="x" * 81)) == {"display_name"}
    assert fields(create(relationship="cousin")) == {"relationship"}
    assert fields(create(age_years=131)) == {"age_years"}
    assert create(age_years=None).status_code == 201
    for i in range(8):  # Meera already owns pat_meera: 10 in total
        assert create(display_name=f"Family {i}").status_code == 201
    over = create()
    assert over.status_code == 409 and code(over) == "PROFILE_LIMIT"


# --- API-42/43 Medical ID -----------------------------------------------------------------

DETAILS = {
    "relationship": "self",
    "date_of_birth": "1968-04-12",
    "sex": "female",
    "blood_group": "B+",
    "height_cm": 158.5,
    "emergency_contacts": [{"name": " Karthik Raman ", "phone": "+91 98765 43210", "relation": "Son"}],
    "allergies_note": "Sulfa drugs (rash)",
    "conditions_note": "Type 2 diabetes, hypertension",
    "medications_note": "Metformin 1000 mg twice daily",
    "organ_donor": True,
}


def test_details_defaults_put_and_permissions(client):
    meera = auth(login(client, MEERA))
    empty = client.get(f"{P}/details", headers=meera)
    assert empty.status_code == 200
    assert empty.json() == {
        "details": {
            "patient_id": "pat_meera",
            "relationship": None,
            "date_of_birth": None,
            "sex": None,
            "blood_group": None,
            "height_cm": None,
            "emergency_contacts": [],
            "allergies_note": None,
            "conditions_note": None,
            "medications_note": None,
            "organ_donor": None,
            "updated_at": None,
        }
    }
    put = client.put(f"{P}/details", headers=meera, json=DETAILS)
    assert put.status_code == 200, put.text
    saved = put.json()["details"]
    assert set(saved) == set(empty.json()["details"])
    assert {k: saved[k] for k in DETAILS if k != "emergency_contacts"} == {k: v for k, v in DETAILS.items() if k != "emergency_contacts"}
    assert saved["emergency_contacts"] == [{"name": "Karthik Raman", "phone": "+91 98765 43210", "relation": "Son"}]
    assert saved["updated_at"].endswith("Z")
    assert client.get(f"{P}/details", headers=meera).json()["details"] == saved

    karthik, ravi = auth(login(client, KARTHIK)), auth(login(client, RAVI))
    assert client.get(f"{P}/details", headers=karthik).json()["details"] == saved
    denied = client.put(f"{P}/details", headers=karthik, json=DETAILS)
    assert denied.status_code == 403 and code(denied) == "OWNER_ONLY"
    assert code(client.get(f"{P}/details", headers=ravi)) == "ACCESS_DENIED"

    # A PUT replaces everything: what's missing becomes null (or []).
    partial = client.put(f"{P}/details", headers=meera, json={"blood_group": "o-", "sex": ""}).json()["details"]
    assert partial["blood_group"] == "O-" and partial["sex"] is None and partial["emergency_contacts"] == []
    assert partial["height_cm"] is None and partial["organ_donor"] is None and partial["relationship"] is None
    events = audit_rows("profile.details_updated")
    assert len(events) == 2 and all(e.meta == {} for e in events)


def test_details_validation(client):
    meera = auth(login(client, MEERA))
    bad = {
        "relationship": "cousin",
        "date_of_birth": (date.today() + timedelta(days=3)).isoformat(),
        "sex": "unknown",
        "blood_group": "C+",
        "height_cm": 20,
        "emergency_contacts": [{"name": "", "phone": "call me", "relation": "x" * 41}],
        "allergies_note": "x" * 501,
        "medications_note": "y" * 501,
    }
    assert fields(client.put(f"{P}/details", headers=meera, json=bad)) == {
        "relationship",
        "date_of_birth",
        "sex",
        "blood_group",
        "height_cm",
        "emergency_contacts.0.name",
        "emergency_contacts.0.phone",
        "emergency_contacts.0.relation",
        "allergies_note",
        "medications_note",
    }
    six = [{"name": f"Contact {i}", "phone": "(044) 2345-6789"} for i in range(6)]
    assert fields(client.put(f"{P}/details", headers=meera, json={"emergency_contacts": six})) == {"emergency_contacts"}
    assert fields(client.put(f"{P}/details", headers=meera, json={"height_cm": 251})) == {"height_cm"}
    assert fields(client.put(f"{P}/details", headers=meera, json={"emergency_contacts": [{"name": "A", "phone": "12"}]})) == {
        "emergency_contacts.0.phone"
    }
    assert client.get(f"{P}/details", headers=meera).json()["details"]["updated_at"] is None  # nothing saved
    five = [{"name": f"Contact {i}", "phone": "(044) 2345-6789"} for i in range(5)]
    ok = client.put(f"{P}/details", headers=meera, json={"emergency_contacts": five, "height_cm": 30})
    assert ok.status_code == 200 and ok.json()["details"]["emergency_contacts"][4]["relation"] == ""


# --- API-44 to 46 vitals ------------------------------------------------------------------


def record(client, headers, patient="pat_meera", **body):
    body.setdefault("measured_at", ago(hours=1))
    return client.post(f"{API}/patients/{patient}/vitals", headers=headers, json=body)


def test_vitals_record_list_and_delete(client):
    meera = auth(login(client, MEERA))
    ist = timezone(timedelta(hours=5, minutes=30))
    local = (datetime.now(ist) - timedelta(hours=2)).replace(microsecond=0)
    bp = record(client, meera, kind="blood_pressure", value=128, value2=82, unit="mmHg", measured_at=local.isoformat(), notes=" after a walk ")
    assert bp.status_code == 201, bp.text
    vital = bp.json()["vital"]
    assert set(vital) == {"id", "kind", "value", "value2", "unit", "context", "notes", "measured_at", "created_by", "created_at"}
    assert vital["id"].startswith("vit_") and (vital["value"], vital["value2"], vital["unit"]) == (128, 82, "mmHg")
    assert vital["notes"] == "after a walk" and vital["context"] is None
    assert vital["measured_at"] == local.astimezone(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    assert vital["created_by"] == {"user_id": "usr_meera", "display_name": "Meera Raman"}

    assert record(client, meera, kind="blood_sugar", value=110, unit="mg/dL", context="fasting", measured_at=ago(hours=1)).status_code == 201
    assert record(client, meera, kind="weight", value=64.5, unit="kg", measured_at=ago(days=1)).status_code == 201
    assert record(client, meera, kind="temperature", value=99.1, unit="°F", measured_at=ago(minutes=10)).status_code == 201
    assert record(client, meera, kind="spo2", value=97, unit="%", measured_at=ago(days=2)).status_code == 201
    assert record(client, meera, kind="heart_rate", value=72, unit="bpm", measured_at=ago(days=3)).status_code == 201

    listing = client.get(f"{P}/vitals", headers=meera).json()
    assert set(listing) == {"items", "total"} and listing["total"] == 6
    kinds = [v["kind"] for v in listing["items"]]
    assert kinds == ["temperature", "blood_sugar", "blood_pressure", "weight", "spo2", "heart_rate"]
    only = client.get(f"{P}/vitals", headers=meera, params={"kind": "weight"}).json()
    assert only["total"] == 1 and only["items"][0]["value"] == 64.5 and only["items"][0]["value2"] is None
    limited = client.get(f"{P}/vitals", headers=meera, params={"limit": 2}).json()
    assert len(limited["items"]) == 2 and limited["total"] == 6
    assert client.get(f"{P}/vitals", headers=meera, params={"limit": 0}).status_code == 422
    assert client.get(f"{P}/vitals", headers=meera, params={"limit": 501}).status_code == 422
    assert client.get(f"{P}/vitals", headers=meera, params={"kind": "steps"}).status_code == 422

    karthik = auth(login(client, KARTHIK))
    assert client.get(f"{P}/vitals", headers=karthik).json()["total"] == 6
    denied = record(client, karthik, kind="weight", value=60, unit="kg")
    assert denied.status_code == 403 and code(denied) == "SCOPE_REQUIRED"
    assert code(client.delete(f"{P}/vitals/{vital['id']}", headers=karthik)) == "SCOPE_REQUIRED"
    assert code(client.get(f"{P}/vitals", headers=auth(login(client, RAVI)))) == "ACCESS_DENIED"

    assert client.delete(f"{P}/vitals/{vital['id']}", headers=meera).status_code == 204
    gone = client.delete(f"{P}/vitals/{vital['id']}", headers=meera)
    assert gone.status_code == 404 and code(gone) == "NOT_FOUND"
    assert client.get(f"{P}/vitals", headers=meera).json()["total"] == 5

    recorded = audit_rows("vital.recorded")
    assert len(recorded) == 6 and all(set(e.meta) == {"kind"} for e in recorded)
    assert [e.meta for e in audit_rows("vital.deleted")] == [{"kind": "blood_pressure"}]


def test_vital_ids_are_bound_to_their_profile(client):
    ravi, meera = auth(login(client, RAVI)), auth(login(client, MEERA))
    ravi_vital = record(client, ravi, patient="pat_ravi", kind="weight", value=70, unit="kg").json()["vital"]["id"]
    assert code(client.delete(f"{P}/vitals/{ravi_vital}", headers=meera)) == "NOT_FOUND"
    assert client.get(f"{API}/patients/pat_ravi/vitals", headers=ravi).json()["total"] == 1


FUTURE = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()


@pytest.mark.parametrize(
    "body, bad",
    [
        ({"kind": "blood_pressure", "value": 300, "value2": 80, "unit": "mmHg"}, {"value"}),
        ({"kind": "blood_pressure", "value": 120, "unit": "mmHg"}, {"value2"}),
        ({"kind": "blood_pressure", "value": 120, "value2": 200, "unit": "mmHg"}, {"value2"}),
        ({"kind": "blood_pressure", "value": 120, "value2": 80, "unit": "kPa"}, {"unit"}),
        ({"kind": "blood_sugar", "value": 110, "unit": "mmol/L"}, {"unit"}),
        ({"kind": "blood_sugar", "value": 700, "unit": "mg/dL"}, {"value"}),
        ({"kind": "blood_sugar", "value": 110, "unit": "mg/dL", "context": "bedtime"}, {"context"}),
        ({"kind": "weight", "value": 0.5, "unit": "kg"}, {"value"}),
        ({"kind": "weight", "value": 60, "unit": "kg", "value2": 3}, {"value2"}),
        ({"kind": "weight", "value": 60, "unit": "kg", "context": "fasting"}, {"context"}),
        ({"kind": "heart_rate", "value": 300, "unit": "bpm"}, {"value"}),
        ({"kind": "spo2", "value": 101, "unit": "%"}, {"value"}),
        ({"kind": "temperature", "value": 37, "unit": "K"}, {"unit"}),
        ({"kind": "temperature", "value": 37, "unit": "°F"}, {"value"}),
        ({"kind": "temperature", "value": 100, "unit": "°C"}, {"value"}),
        ({"kind": "weight", "value": 60, "unit": "kg", "notes": "x" * 201}, {"notes"}),
        ({"kind": "weight", "value": 60, "unit": "kg", "measured_at": "2026-10-01T10:00:00"}, {"measured_at"}),
        ({"kind": "weight", "value": 60, "unit": "kg", "measured_at": FUTURE}, {"measured_at"}),
        ({"kind": "steps", "value": 6000, "unit": "steps"}, {"kind"}),
        ({"kind": "blood_pressure", "value": 300, "value2": 10, "unit": "mmHg", "notes": "x" * 201}, {"value", "value2", "notes"}),
    ],
)
def test_vital_plausibility_checks(client, body, bad):
    meera = auth(login(client, MEERA))
    assert fields(record(client, meera, **body)) == bad
    assert client.get(f"{P}/vitals", headers=meera).json()["total"] == 0


def test_vital_range_edges_are_accepted(client):
    meera = auth(login(client, MEERA))
    for body in (
        {"kind": "blood_pressure", "value": 50, "value2": 160, "unit": "mmHg"},
        {"kind": "blood_sugar", "value": 600, "unit": "mg/dL", "context": "post_meal"},
        {"kind": "spo2", "value": 100, "unit": "%"},
        {"kind": "temperature", "value": 30, "unit": "°C"},
        {"kind": "temperature", "value": 113, "unit": "°F"},
        {"kind": "weight", "value": 60, "unit": "kg", "measured_at": (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()},
    ):
        assert record(client, meera, **body).status_code == 201, body


# --- API-47 to 53 chats -------------------------------------------------------------------


def new_chat(client, headers, patient="pat_meera", **body):
    response = client.post(f"{API}/patients/{patient}/chats", headers=headers, json=body or None)
    assert response.status_code == 201, response.text
    return response.json()["chat"]


def send(client, headers, chat_id, question, patient="pat_meera", **extra):
    return client.post(f"{API}/patients/{patient}/chats/{chat_id}/messages", headers=headers, json={"question": question, **extra})


CHAT_KEYS = {"id", "title", "created_at", "updated_at", "message_count", "last_message_preview"}
MESSAGE_KEYS = {"id", "chat_id", "role", "kind", "text", "input_mode", "answer", "document", "created_at"}


def test_chat_create_list_rename_delete(client):
    meera = auth(login(client, MEERA))
    first = new_chat(client, meera)
    assert set(first) == CHAT_KEYS and first["id"].startswith("cht_")
    assert (first["title"], first["message_count"], first["last_message_preview"]) == ("New chat", 0, None)
    second = new_chat(client, meera, title="  BP   questions ")
    assert second["title"] == "BP questions"
    assert fields(client.post(f"{P}/chats", headers=meera, json={"title": "   "})) == {"title"}
    assert fields(client.post(f"{P}/chats", headers=meera, json={"title": "x" * 81})) == {"title"}
    assert new_chat(client, meera, title=None)["title"] == "New chat"

    listing = client.get(f"{P}/chats", headers=meera).json()
    assert (listing["total"], listing["limit"], listing["offset"]) == (3, 50, 0)
    assert [c["id"] for c in listing["items"]][1:] == [second["id"], first["id"]]  # newest activity first
    assert len(client.get(f"{P}/chats", headers=meera, params={"limit": 1, "offset": 1}).json()["items"]) == 1

    renamed = client.patch(f"{P}/chats/{first['id']}", headers=meera, json={"title": " Sugar log "})
    assert renamed.status_code == 200 and renamed.json()["chat"]["title"] == "Sugar log"
    assert client.get(f"{P}/chats", headers=meera).json()["items"][0]["id"] == first["id"]
    assert fields(client.patch(f"{P}/chats/{first['id']}", headers=meera, json={"title": ""})) == {"title"}

    assert client.delete(f"{P}/chats/{second['id']}", headers=meera).status_code == 204
    assert code(client.get(f"{P}/chats/{second['id']}", headers=meera)) == "NOT_FOUND"
    assert code(client.delete(f"{P}/chats/{second['id']}", headers=meera)) == "NOT_FOUND"
    assert client.get(f"{P}/chats", headers=meera).json()["total"] == 2
    assert [e.resource_id for e in audit_rows("chat.deleted")] == [second["id"]]


def test_chat_messages_run_through_ask(client, fake_model, pdfs):
    from app.models import ChatMessage

    token = login(client, MEERA)
    meera = auth(token)
    upload(client, token, "lab_sunrise_may2026.pdf", pdfs["lab_sunrise_may2026.pdf"])
    fake_model.ask = lambda inp: {
        "status": "answered",
        "statements": [statement("record_fact", "Your most recent HbA1c was 7.6 % on 04 May 2026.", inp, "HbA1c (Glycated haemoglobin)   7.6")],
        "questions_for_doctor": [],
    }
    chat_id = new_chat(client, meera)["id"]
    response = send(client, meera, chat_id, "  What was my most recent HbA1c?  ")
    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == {"user_message", "assistant_message", "chat"}
    question, answer = body["user_message"], body["assistant_message"]
    assert set(question) == MESSAGE_KEYS == set(answer)
    assert (question["role"], question["kind"], question["text"], question["input_mode"]) == (
        "user", "question", "What was my most recent HbA1c?", "text")
    assert question["answer"] is None and question["document"] is None and question["chat_id"] == chat_id
    assert (answer["role"], answer["kind"], answer["text"], answer["document"]) == ("assistant", "answer", None, None)
    assert answer["answer"]["status"] == "answered"
    assert answer["answer"]["statements"][0]["text"] == "Your most recent HbA1c was 7.6 % on 04 May 2026."
    direct = client.post(f"{P}/ask", headers=meera, json={"question": "What was my most recent HbA1c?"}).json()
    assert set(answer["answer"]) == set(direct)  # the API-21 response, stored as is

    chat = body["chat"]
    assert chat["title"] == "What was my most recent HbA1c?" and chat["message_count"] == 2
    assert chat["last_message_preview"] == "What was my most recent HbA1c?"

    fake_model.ask = lambda inp: {"status": "not_found", "statements": [], "questions_for_doctor": []}
    second = send(client, meera, chat_id, "Do I have any allergies?", input_mode="voice").json()
    assert second["user_message"]["input_mode"] == "voice"
    assert second["assistant_message"]["answer"]["status"] == "not_found"
    assert second["chat"]["title"] == "What was my most recent HbA1c?"  # set once, from the first question
    assert (second["chat"]["message_count"], second["chat"]["last_message_preview"]) == (4, "Do I have any allergies?")

    history = client.get(f"{P}/chats/{chat_id}", headers=meera).json()
    assert set(history) == {"chat", "messages"} and history["chat"]["message_count"] == 4
    assert [(m["role"], m["kind"]) for m in history["messages"]] == [
        ("user", "question"), ("assistant", "answer"), ("user", "question"), ("assistant", "answer")]
    assert history["messages"][1]["answer"] == answer["answer"]

    assert fields(send(client, meera, chat_id, "   ")) == {"question"}
    assert fields(send(client, meera, chat_id, "x" * 501)) == {"question"}
    assert fields(send(client, meera, chat_id, "hi", input_mode="telepathy")) == {"input_mode"}
    with db() as session:
        assert len(session.exec(select(ChatMessage).where(ChatMessage.chat_id == chat_id)).all()) == 4

    events = [e for e in audit_rows("ask.answered") if (e.meta or {}).get("chat_id")]
    assert [e.meta for e in events] == [
        {"status": "answered", "input_mode": "text", "chat_id": chat_id},
        {"status": "not_found", "input_mode": "voice", "chat_id": chat_id},
    ]
    assert events[0].resource_id == answer["answer"]["answer_id"]
    assert "HbA1c" not in all_audit_meta() and "allergies" not in all_audit_meta()


def test_chat_emergency_question_never_reaches_the_model(client, fake_model):
    meera = auth(login(client, MEERA))
    chat_id = new_chat(client, meera)["id"]
    before = len(fake_model.requests)
    body = send(client, meera, chat_id, "I have chest pain and can't breathe").json()
    assert body["assistant_message"]["answer"]["status"] == "emergency"
    assert body["assistant_message"]["answer"]["statements"][0]["kind"] == "safety_notice"
    assert len(fake_model.requests) == before


def test_chat_title_from_a_long_question(client, fake_model):
    from app.routers.chats import shorten

    meera = auth(login(client, MEERA))
    chat_id = new_chat(client, meera)["id"]
    question = "Can you list every medicine that my doctors prescribed during the hospital stay in July last year?"
    title = send(client, meera, chat_id, question).json()["chat"]["title"]
    assert title == "Can you list every medicine that my doctors prescribed…"
    assert shorten("word " * 3, 60) == "word word word"
    assert shorten("x" * 70, 60) == "x" * 60 + "…"


def test_chat_preview_is_capped(client, fake_model):
    meera = auth(login(client, MEERA))
    chat_id = new_chat(client, meera)["id"]
    question = "Please tell me " + "about my reports " * 30
    preview = send(client, meera, chat_id, question.strip()[:500]).json()["chat"]["last_message_preview"]
    assert len(preview) <= 120 and preview.endswith("…")


def test_chats_are_private_to_their_creator(client, fake_model):
    meera, karthik, ravi = (auth(login(client, e)) for e in (MEERA, KARTHIK, RAVI))
    chat_id = new_chat(client, meera)["id"]
    send(client, meera, chat_id, "What is my blood group?")

    for method, path, body in (
        ("GET", f"{P}/chats/{chat_id}", None),
        ("PATCH", f"{P}/chats/{chat_id}", {"title": "Mine now"}),
        ("DELETE", f"{P}/chats/{chat_id}", None),
        ("POST", f"{P}/chats/{chat_id}/messages", {"question": "What is my blood group?"}),
        ("POST", f"{P}/chats/{chat_id}/attachments", {"document_id": "doc_x"}),
    ):
        response = client.request(method, path, headers=karthik, json=body)
        assert response.status_code == 404 and code(response) == "NOT_FOUND", (method, path)
    assert client.get(f"{P}/chats", headers=karthik).json() == {"items": [], "total": 0, "limit": 50, "offset": 0}

    karthik_chat = new_chat(client, karthik)["id"]  # a caregiver keeps their own chats on the shared profile
    assert code(client.get(f"{P}/chats/{karthik_chat}", headers=meera)) == "NOT_FOUND"
    assert [c["id"] for c in client.get(f"{P}/chats", headers=meera).json()["items"]] == [chat_id]

    own_profile_chat = new_chat(client, karthik, patient="pat_karthik")["id"]
    assert code(client.get(f"{P}/chats/{own_profile_chat}", headers=karthik)) == "NOT_FOUND"  # wrong profile path
    assert code(client.get(f"{P}/chats", headers=ravi)) == "ACCESS_DENIED"
    assert code(client.post(f"{P}/chats", headers=ravi)) == "ACCESS_DENIED"


def test_chat_attachments(client, fake_model, pdfs):
    from app.models import ChatMessage

    meera_token, ravi_token = login(client, MEERA), login(client, RAVI)
    meera = auth(meera_token)
    document_id = upload(client, meera_token, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    ravi_doc = upload(client, ravi_token, "lab_citycare_jun2026.pdf", pdfs["lab_citycare_jun2026.pdf"], patient_id="pat_ravi")
    chat_id = new_chat(client, meera)["id"]

    foreign = client.post(f"{P}/chats/{chat_id}/attachments", headers=meera, json={"document_id": ravi_doc.json()["document"]["id"]})
    assert foreign.status_code == 404 and code(foreign) == "NOT_FOUND"
    assert code(client.post(f"{P}/chats/{chat_id}/attachments", headers=meera, json={"document_id": "doc_nope"})) == "NOT_FOUND"

    response = client.post(f"{P}/chats/{chat_id}/attachments", headers=meera, json={"document_id": document_id})
    assert response.status_code == 201, response.text
    message = response.json()["message"]
    assert set(message) == MESSAGE_KEYS
    assert (message["role"], message["kind"], message["text"], message["answer"]) == ("user", "attachment", None, None)
    doc = client.get(f"{P}/documents/{document_id}", headers=meera).json()["document"]
    assert message["document"] == {
        "id": document_id,
        "title": doc["title"],
        "status": doc["status"],
        "document_type": "lab_report",
        "document_date": "2025-03-18",
    }
    chat = response.json()["chat"]
    expected = doc["title"] if len(doc["title"]) <= 60 else doc["title"][:60].rstrip() + "…"
    assert chat["title"] == f"Document: {expected}"
    assert (chat["message_count"], chat["last_message_preview"]) == (1, None)

    with db() as session:  # a document that no longer exists is shown as null
        session.add(ChatMessage(chat_id=chat_id, role="user", kind="attachment", document_id="doc_gone"))
        session.commit()
    messages = client.get(f"{P}/chats/{chat_id}", headers=meera).json()["messages"]
    assert [m["document"]["id"] if m["document"] else None for m in messages] == [document_id, None]


# --- API-54 to 59 invitations -------------------------------------------------------------


def invite(client, headers, email, patient="pat_meera", **extra):
    body = {"email": email, "scopes": ["view_records"], "relationship": "sibling", "consent_confirmed": True,
            "policy_version": POLICY, **extra}
    return client.post(f"{API}/patients/{patient}/invitations", headers=headers, json=body)


def test_invitation_accept_flow(client):
    from app.models import ConsentRecord, ConsentType, PatientAccessGrant

    meera, ravi, karthik = (auth(login(client, e)) for e in (MEERA, RAVI, KARTHIK))
    created = invite(client, meera, "  Ravi.Demo@MediVara.test ", scopes=["upload_documents", "view_records"])
    assert created.status_code == 201, created.text
    body = created.json()
    invitation = body["invitation"]
    assert set(body) == {"invitation", "invite_url", "email_sent"} and body["email_sent"] is False
    assert body["invite_url"] == invitation["invite_url"] == f"/invite/{invitation['id']}"
    assert set(invitation) == {"id", "email", "relationship", "scopes", "status", "created_at", "expires_at", "responded_at", "invite_url"}
    assert invitation["id"].startswith("inv_") and len(invitation["id"]) == 40
    assert (invitation["email"], invitation["relationship"], invitation["status"]) == (RAVI, "sibling", "pending")
    assert invitation["scopes"] == ["view_records", "upload_documents"] and invitation["responded_at"] is None
    created_at = datetime.fromisoformat(invitation["created_at"].replace("Z", "+00:00"))
    expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
    assert timedelta(days=13, hours=23) < expires_at - created_at <= timedelta(days=14)

    assert code(client.get(P, headers=ravi)) == "ACCESS_DENIED"
    mine = client.get(f"{API}/me/invitations", headers=ravi).json()
    assert mine == {"invitations": [{
        "id": invitation["id"],
        "patient": {"id": "pat_meera", "display_name": "Meera Raman"},
        "invited_by": {"display_name": "Meera Raman"},
        "relationship": "sibling",
        "scopes": ["view_records", "upload_documents"],
        "created_at": invitation["created_at"],
        "expires_at": invitation["expires_at"],
    }]}
    assert client.get(f"{API}/me/invitations", headers=karthik).json() == {"invitations": []}
    wrong = client.post(f"{API}/me/invitations/{invitation['id']}/accept", headers=karthik)
    assert wrong.status_code == 404 and code(wrong) == "NOT_FOUND"

    accepted = client.post(f"{API}/me/invitations/{invitation['id']}/accept", headers=ravi)
    assert accepted.status_code == 200 and accepted.json() == {"patient_id": "pat_meera"}
    profile = client.get(P, headers=ravi)
    assert profile.status_code == 200
    assert (profile.json()["my_role"], profile.json()["scopes"]) == ("caregiver", ["view_records", "upload_documents"])
    assert code(client.post(f"{API}/me/invitations/{invitation['id']}/accept", headers=ravi)) == "NOT_FOUND"
    assert client.get(f"{API}/me/invitations", headers=ravi).json() == {"invitations": []}
    owner_view = client.get(f"{P}/invitations", headers=meera).json()["invitations"]
    assert owner_view[0]["status"] == "accepted" and owner_view[0]["responded_at"].endswith("Z")

    with db() as session:
        grant = session.exec(
            select(PatientAccessGrant).where(PatientAccessGrant.patient_id == "pat_meera", PatientAccessGrant.grantee_user_id == "usr_ravi")
        ).one()
        consent = session.get(ConsentRecord, grant.consent_record_id)
        assert grant.granted_by_user_id == "usr_meera" and consent.consent_type == ConsentType.sharing
        assert consent.user_id == "usr_meera" and consent.patient_id == "pat_meera"
        assert consent.context == {"invitation_id": invitation["id"], "grant_id": grant.id}

    assert [e.meta for e in audit_rows("invitation.created")] == [
        {"invitation_id": invitation["id"], "scopes": ["view_records", "upload_documents"]}]
    assert [e.actor_user_id for e in audit_rows("invitation.accepted")] == ["usr_ravi"]
    granted = [e for e in audit_rows("access.granted") if e.actor_user_id == "usr_ravi"]
    assert len(granted) == 1 and granted[0].patient_id == "pat_meera"
    assert "medivara.test" not in all_audit_meta()
    log = client.get(f"{P}/audit-events", headers=meera).json()["items"]
    assert "Accepted an invitation" in [e["action_label"] for e in log]


def test_invitation_decline_and_cancel(client):
    meera, fresh, karthik, ravi = (auth(login(client, e)) for e in (MEERA, FRESH, KARTHIK, RAVI))
    first = invite(client, meera, FRESH).json()["invitation"]
    assert client.post(f"{API}/me/invitations/{first['id']}/decline", headers=fresh).status_code == 204
    assert client.get(f"{P}/invitations", headers=meera).json()["invitations"][0]["status"] == "declined"
    assert code(client.post(f"{API}/me/invitations/{first['id']}/accept", headers=fresh)) == "NOT_FOUND"
    assert code(client.post(f"{API}/me/invitations/{first['id']}/decline", headers=fresh)) == "NOT_FOUND"
    assert [e.actor_user_id for e in audit_rows("invitation.declined")] == ["usr_fresh"]

    second = invite(client, meera, FRESH).json()["invitation"]  # a declined invitation can be re-sent
    assert client.delete(f"{P}/invitations/{second['id']}", headers=meera).status_code == 204
    again = client.delete(f"{P}/invitations/{second['id']}", headers=meera)
    assert again.status_code == 409 and code(again) == "INVALID_STATE"
    assert code(client.post(f"{API}/me/invitations/{second['id']}/accept", headers=fresh)) == "NOT_FOUND"
    assert client.get(f"{API}/me/invitations", headers=fresh).json() == {"invitations": []}
    statuses = [i["status"] for i in client.get(f"{P}/invitations", headers=meera).json()["invitations"]]
    assert statuses == ["cancelled", "declined"]  # newest first
    assert len(audit_rows("invitation.cancelled")) == 1

    for method, path, body in (
        ("POST", f"{P}/invitations", {"email": "x@example.com", "scopes": ["view_records"], "relationship": "other",
                                      "consent_confirmed": True, "policy_version": POLICY}),
        ("GET", f"{P}/invitations", None),
        ("DELETE", f"{P}/invitations/{second['id']}", None),
    ):
        assert code(client.request(method, path, headers=karthik, json=body)) == "OWNER_ONLY", (method, path)

    ravis = invite(client, ravi, "someone@example.com", patient="pat_ravi").json()["invitation"]["id"]
    assert code(client.delete(f"{P}/invitations/{ravis}", headers=meera)) == "NOT_FOUND"


def test_invitation_rules(client):
    meera = auth(login(client, MEERA))
    unknown = invite(client, meera, "someone@example.com")
    known = invite(client, meera, RAVI)
    # Same answer whether or not the email has an account.
    assert unknown.status_code == known.status_code == 201
    assert set(unknown.json()) == set(known.json()) and unknown.json()["email_sent"] == known.json()["email_sent"]

    duplicate = invite(client, meera, "SOMEONE@example.com ")
    assert duplicate.status_code == 409 and code(duplicate) == "INVITATION_EXISTS"
    existing = invite(client, meera, KARTHIK)
    assert existing.status_code == 409 and code(existing) == "GRANT_EXISTS"
    assert fields(invite(client, meera, MEERA)) == {"email"}
    assert fields(invite(client, meera, "not-an-email")) == {"email"}
    assert fields(invite(client, meera, "a@example.com", scopes=["upload_documents"])) == {"scopes"}
    assert fields(invite(client, meera, "a@example.com", consent_confirmed=False)) == {"consent_confirmed"}
    assert fields(invite(client, meera, "a@example.com", policy_version="2025-old")) == {"policy_version"}
    assert fields(invite(client, meera, "a@example.com", relationship="cousin")) == {"relationship"}
    assert fields(invite(client, meera, "a@example.com", scopes=["view_records", "admin"])) == {"scopes.1"}


def test_expired_invitation(client):
    from app.models import Invitation, utcnow

    meera, ravi = auth(login(client, MEERA)), auth(login(client, RAVI))
    invitation_id = invite(client, meera, RAVI).json()["invitation"]["id"]
    with db() as session:
        row = session.get(Invitation, invitation_id)
        row.expires_at = utcnow() - timedelta(minutes=1)
        session.add(row)
        session.commit()
    assert client.get(f"{API}/me/invitations", headers=ravi).json() == {"invitations": []}
    assert code(client.post(f"{API}/me/invitations/{invitation_id}/accept", headers=ravi)) == "NOT_FOUND"
    assert code(client.post(f"{API}/me/invitations/{invitation_id}/decline", headers=ravi)) == "NOT_FOUND"
    assert client.get(f"{P}/invitations", headers=meera).json()["invitations"][0]["status"] == "expired"
    assert code(client.delete(f"{P}/invitations/{invitation_id}", headers=meera)) == "INVALID_STATE"
    assert invite(client, meera, RAVI).status_code == 201  # a new one may be sent


def test_invitation_email_is_sent_in_the_background(client, monkeypatch):
    from app import config, mailer

    monkeypatch.setenv("SMTP_HOST", "smtp.example.test")
    monkeypatch.setenv("SMTP_FROM", "MediVara <no-reply@example.test>")
    monkeypatch.setenv("SMTP_USERNAME", "mailer")
    monkeypatch.setenv("SMTP_PASSWORD", "mail-secret")
    monkeypatch.setenv("APP_BASE_URL", "https://medivara.example/")
    config.get_settings.cache_clear()
    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            sent.append({"host": host, "port": port})

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self, context=None):
            sent[-1]["starttls"] = True

        def login(self, user, password):
            sent[-1]["login"] = (user, password)

        def send_message(self, message):
            sent[-1]["message"] = message

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    meera = auth(login(client, MEERA))
    response = invite(client, meera, RAVI)
    assert response.status_code == 201 and response.json()["email_sent"] is True
    invitation_id = response.json()["invitation"]["id"]
    assert len(sent) == 1
    mail = sent[0]
    assert (mail["host"], mail["port"], mail["starttls"], mail["login"]) == ("smtp.example.test", 587, True, ("mailer", "mail-secret"))
    message = mail["message"]
    assert message["To"] == RAVI and message["Subject"] == "Meera Raman invited you to MediVara"
    text = message.get_content()
    assert f"https://medivara.example/invite/{invitation_id}" in text
    assert "Meera Raman's health records" in text and "synthetic" in text

    class Broken:
        def __init__(self, *args, **kwargs):
            raise OSError("connection refused")

    monkeypatch.setattr(mailer.smtplib, "SMTP", Broken)
    failed = invite(client, meera, FRESH)
    assert failed.status_code == 201 and failed.json()["email_sent"] is True


# --- API-60/61 voice ----------------------------------------------------------------------


def voice_consent(client, headers, granted=True):
    response = client.post(f"{API}/me/consents", headers=headers,
                           json={"consent_type": "voice_input", "granted": granted, "policy_version": POLICY})
    assert response.status_code == 201


def configure_voice(monkeypatch, key="", agent=""):
    from app import config

    monkeypatch.setenv("ELEVENLABS_API_KEY", key)
    monkeypatch.setenv("ELEVENLABS_AGENT_ID", agent)
    config.get_settings.cache_clear()


def test_voice_is_off_by_default(client):
    meera = auth(login(client, MEERA))
    assert client.get(f"{API}/voice/config", headers=meera).json() == {"available": False, "mode": "off"}
    no_consent = client.post(f"{P}/voice/session", headers=meera)
    assert no_consent.status_code == 403 and code(no_consent) == "CONSENT_REQUIRED"
    assert no_consent.json()["error"]["details"] == {"consent_type": "voice_input"}
    voice_consent(client, meera)
    off = client.post(f"{P}/voice/session", headers=meera)
    assert off.status_code == 503 and code(off) == "VOICE_UNAVAILABLE"
    assert off.json()["error"]["message"] == "Voice conversation isn't set up on this server."
    assert code(client.post(f"{P}/voice/session", headers=auth(login(client, RAVI)))) == "ACCESS_DENIED"


def test_voice_needs_the_speakers_current_consent(client, monkeypatch):
    configure_voice(monkeypatch, agent="agent_public_1")
    meera, karthik = auth(login(client, MEERA)), auth(login(client, KARTHIK))
    voice_consent(client, meera)
    # The owner's consent doesn't cover a caregiver speaking.
    assert code(client.post(f"{P}/voice/session", headers=karthik)) == "CONSENT_REQUIRED"
    voice_consent(client, meera, granted=False)
    assert code(client.post(f"{P}/voice/session", headers=meera)) == "CONSENT_REQUIRED"


def test_voice_public_agent_mode(client, monkeypatch):
    configure_voice(monkeypatch, agent="agent_public_1")
    karthik = auth(login(client, KARTHIK))
    assert client.get(f"{API}/voice/config", headers=karthik).json() == {"available": True, "mode": "public_agent"}
    voice_consent(client, karthik)
    response = client.post(f"{P}/voice/session", headers=karthik)
    assert response.status_code == 200, response.text
    assert response.json() == {
        "signed_url": None,
        "agent_id": "agent_public_1",
        "dynamic_variables": {"patient_first_name": "Meera", "user_first_name": "Karthik"},
    }
    events = audit_rows("voice.session_started")
    assert len(events) == 1 and events[0].meta == {"mode": "public_agent"} and events[0].actor_user_id == "usr_karthik"


def test_voice_signed_url_mode_never_reveals_the_key(client, monkeypatch, caplog):
    import logging

    from app.middleware import JsonAllowListFormatter
    from app.routers import voice

    key = "sk_test_key_must_never_leave_the_server"
    configure_voice(monkeypatch, key=key, agent="agent_private_1")
    calls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append({"url": url, "params": params, "headers": headers, "timeout": timeout})
        return httpx.Response(200, json={"signed_url": "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_private_1&conversation_signature=sig"})

    monkeypatch.setattr(voice.httpx, "get", fake_get)
    meera = auth(login(client, MEERA))
    assert client.get(f"{API}/voice/config", headers=meera).json() == {"available": True, "mode": "signed_url"}
    voice_consent(client, meera)

    caplog.set_level(logging.INFO, logger="medivara")
    logging.getLogger("medivara").propagate = True
    try:
        response = client.post(f"{P}/voice/session", headers=meera)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["signed_url"].startswith("wss://") and body["agent_id"] is None
        assert body["dynamic_variables"] == {"patient_first_name": "Meera", "user_first_name": "Meera"}
        assert calls == [{
            "url": "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
            "params": {"agent_id": "agent_private_1"},
            "headers": {"xi-api-key": key},
            "timeout": 10,
        }]

        def down(*args, **kwargs):
            raise httpx.ConnectError(f"cannot reach host with {key}")

        def refused(*args, **kwargs):
            return httpx.Response(401, json={"detail": {"status": "invalid_api_key"}})

        def no_url(*args, **kwargs):
            return httpx.Response(200, json={})

        failures = []
        for fake in (down, refused, no_url):
            monkeypatch.setattr(voice.httpx, "get", fake)
            failed = client.post(f"{P}/voice/session", headers=meera)
            assert failed.status_code == 502 and code(failed) == "VOICE_UNAVAILABLE"
            assert failed.json()["error"]["message"] == "The voice service didn't respond. Try again, or type your question."
            failures.append(failed.text)
    finally:
        logging.getLogger("medivara").propagate = False
    log_text = "\n".join(JsonAllowListFormatter().format(r) for r in caplog.records)
    assert "voice_signed_url_failed" in log_text
    for text in [response.text, *failures, log_text, all_audit_meta()]:
        assert key not in text
