"""Sign-assisted questions (DEC-28, FR-064): camera consent and `input_mode: sign`.

Recognition runs in the browser; the backend only sees the confirmed question text, so the
same gate, grounding and validator apply as for typed questions.
"""

import pytest
from sqlmodel import Session, select

from conftest import API, MEERA, auth, login, upload

P = f"{API}/patients/pat_meera"


def test_camera_consent_is_recorded_and_reported(client):
    token = login(client, MEERA)
    assert client.get(f"{API}/me", headers=auth(token)).json()["consents"]["camera_input"] is None
    me = client.get(f"{API}/me", headers=auth(token)).json()
    response = client.post(f"{API}/me/consents", headers=auth(token), json={
        "consent_type": "camera_input", "granted": True, "policy_version": me["current_policy_version"]})
    assert response.status_code == 201
    state = client.get(f"{API}/me", headers=auth(token)).json()["consents"]["camera_input"]
    assert state["granted"] is True
    withdrawn = client.post(f"{API}/me/consents", headers=auth(token), json={
        "consent_type": "camera_input", "granted": False, "policy_version": me["current_policy_version"]})
    assert withdrawn.status_code == 201
    assert client.get(f"{API}/me", headers=auth(token)).json()["consents"]["camera_input"]["granted"] is False


def test_sign_questions_are_answered_and_tagged(client, fake_model, pdfs):
    from app.db import get_engine
    from app.models import AIOutput, AuditEvent

    token = login(client, MEERA)
    upload(client, token, "rx_lakeview_sep2026.pdf", pdfs["rx_lakeview_sep2026.pdf"])
    response = client.post(f"{P}/ask", headers=auth(token),
                           json={"question": "Which medicines are listed in my most recent document?", "input_mode": "sign"})
    assert response.status_code == 200
    with Session(get_engine()) as session:
        output = session.exec(select(AIOutput).order_by(AIOutput.created_at.desc())).first()
        event = session.exec(select(AuditEvent).where(AuditEvent.action == "ask.answered")).first() or \
            session.exec(select(AuditEvent).where(AuditEvent.action.like("ask%"))).first()
    assert output.input_mode == "sign"
    assert event is not None and event.meta.get("input_mode") == "sign"


def test_an_emergency_sign_gets_the_fixed_card_without_a_model_call(client, fake_model):
    token = login(client, MEERA)
    before = len(fake_model.requests)
    body = client.post(f"{P}/ask", headers=auth(token), json={"question": "I have chest pain", "input_mode": "sign"}).json()
    assert body["status"] == "emergency"
    assert len(fake_model.requests) == before


def test_unknown_input_mode_is_rejected(client):
    token = login(client, MEERA)
    response = client.post(f"{P}/ask", headers=auth(token), json={"question": "hello", "input_mode": "video"})
    assert response.status_code == 422


@pytest.mark.parametrize(("question", "route"), [
    ("This is an emergency. I need emergency help now.", "emergency"),  # the "emergency" sign
    ("I need help now", "emergency"),
    ("I need urgent medical help now", "emergency"),
    ("When was my emergency room visit?", "continue"),
    ("Which emergency visits are in my records?", "continue"),
    ("I need help reading my report", "continue"),
])
def test_explicit_help_requests_are_emergencies_but_record_questions_are_not(question, route):
    from app.answer.gate import classify

    assert classify(question, []).route == route


def test_chat_messages_accept_sign_input(client, fake_model, pdfs):
    token = login(client, MEERA)
    upload(client, token, "rx_lakeview_sep2026.pdf", pdfs["rx_lakeview_sep2026.pdf"])
    created = client.post(f"{P}/chats", headers=auth(token))
    chat_id = (created.json().get("chat") or created.json())["id"]
    response = client.post(f"{P}/chats/{chat_id}/messages", headers=auth(token),
                           json={"question": "Which medicines are listed in my most recent document?", "input_mode": "sign"})
    assert response.status_code in (200, 201), response.text
    assert response.json()["user_message"]["input_mode"] == "sign"
