from datetime import timedelta

from sqlmodel import Session, select

from conftest import API, FRESH, KARTHIK, MEERA, RAVI, auth, login


def audit_actions(action: str):
    from app.db import get_engine
    from app.models import AuditEvent

    with Session(get_engine()) as session:
        return session.exec(select(AuditEvent).where(AuditEvent.action == action)).all()


# TC-AUTH-01
def test_sign_in_returns_token_and_me(client):
    token = login(client, "  Meera.Demo@MediVara.test ")
    assert token.startswith("mvs_") and len(token) == 52
    me = client.get(f"{API}/me", headers=auth(token)).json()
    assert me["user"]["id"] == "usr_meera"
    assert me["owned_patient_id"] == "pat_meera"
    assert me["onboarding_required"] is False
    assert me["consents"]["ai_processing"]["granted"] is True
    assert me["consents"]["voice_input"] is None
    assert len(audit_actions("auth.login")) == 1


def test_only_token_hash_is_stored(client):
    from app.db import get_engine
    from app.models import AuthSession

    token = login(client, MEERA)
    with Session(get_engine()) as session:
        rows = session.exec(select(AuthSession)).all()
    assert all(token not in row.token_hash for row in rows)


# TC-AUTH-02
def test_unknown_email_and_wrong_password_look_identical(client):
    wrong_pw = client.post(f"{API}/auth/login", json={"email": MEERA, "password": "nope"})
    unknown = client.post(f"{API}/auth/login", json={"email": "nobody@medivara.test", "password": "nope"})
    assert wrong_pw.status_code == unknown.status_code == 401
    strip = lambda r: {**r.json()["error"], "request_id": None}  # noqa: E731
    assert strip(wrong_pw) == strip(unknown)
    assert strip(wrong_pw)["code"] == "INVALID_CREDENTIALS"
    assert len(audit_actions("auth.login_failed")) == 2


# TC-AUTH-03
def test_every_non_public_route_needs_a_token(client):
    public = {f"{API}/health", f"{API}/auth/login"}
    paths = client.get(f"{API}/openapi.json").json()["paths"]
    checked = 0
    for path, operations in paths.items():
        if path in public:
            continue
        for method in operations:
            url = path.replace("{patient_id}", "pat_meera")
            response = client.request(method.upper(), url)
            assert response.status_code == 401, (method, url)
            assert response.json()["error"]["code"] == "UNAUTHENTICATED"
            checked += 1
    assert checked >= 5  # logout, me, consents, patients, patient detail


# TC-AUTH-04
def test_sign_out_revokes_token(client):
    token = login(client, MEERA)
    assert client.post(f"{API}/auth/logout", headers=auth(token)).status_code == 204
    again = client.get(f"{API}/me", headers=auth(token))
    assert again.status_code == 401
    assert again.json()["error"]["code"] == "SESSION_EXPIRED"
    assert client.post(f"{API}/auth/logout", headers=auth(token)).json()["error"]["code"] == "SESSION_EXPIRED"


def test_expired_session_is_rejected(client):
    from app.db import get_engine
    from app.models import AuthSession, utcnow

    token = login(client, MEERA)
    with Session(get_engine()) as session:
        row = session.exec(select(AuthSession)).one()
        row.expires_at = utcnow() - timedelta(minutes=1)
        session.add(row)
        session.commit()
    assert client.get(f"{API}/me", headers=auth(token)).json()["error"]["code"] == "SESSION_EXPIRED"


def test_karthik_sees_two_profiles_with_roles_and_scopes(client):
    body = client.get(f"{API}/patients", headers=auth(login(client, KARTHIK))).json()
    assert body["total"] == 2 and body["limit"] == 50 and body["offset"] == 0
    by_id = {p["id"]: p for p in body["items"]}
    assert by_id["pat_karthik"]["my_role"] == "owner"
    assert by_id["pat_karthik"]["scopes"] == ["view_records", "upload_documents", "manage_reminders"]
    assert by_id["pat_meera"]["my_role"] == "caregiver"
    assert by_id["pat_meera"]["scopes"] == ["view_records", "manage_reminders"]
    assert by_id["pat_meera"]["owner_display_name"] == "Meera Raman"
    assert body["items"][0]["id"] == "pat_karthik"


def test_ravi_sees_one_profile(client):
    body = client.get(f"{API}/patients", headers=auth(login(client, RAVI))).json()
    assert [p["id"] for p in body["items"]] == ["pat_ravi"]


def test_caregiver_can_read_shared_profile(client):
    response = client.get(f"{API}/patients/pat_meera", headers=auth(login(client, KARTHIK)))
    assert response.status_code == 200
    assert response.json()["my_role"] == "caregiver"


# TC-ACC-01
def test_foreign_profile_is_denied_and_audited(client):
    response = client.get(f"{API}/patients/pat_meera", headers=auth(login(client, RAVI)))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACCESS_DENIED"
    denied = audit_actions("access.denied")
    assert len(denied) == 1
    assert denied[0].actor_user_id == "usr_ravi" and denied[0].patient_id == "pat_meera"
    assert denied[0].meta == {"code": "ACCESS_DENIED"}


def test_unknown_profile_is_reported_like_a_foreign_one(client):
    response = client.get(f"{API}/patients/pat_does_not_exist", headers=auth(login(client, RAVI)))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACCESS_DENIED"


def test_revoked_grant_takes_effect_on_next_request(client):
    from app.db import get_engine
    from app.models import GrantStatus, PatientAccessGrant

    token = login(client, KARTHIK)
    assert client.get(f"{API}/patients/pat_meera", headers=auth(token)).status_code == 200
    with Session(get_engine()) as session:
        grant = session.get(PatientAccessGrant, "grt_karthik_meera")
        grant.status = GrantStatus.revoked
        session.add(grant)
        session.commit()
    assert client.get(f"{API}/patients/pat_meera", headers=auth(token)).status_code == 403


def test_scope_and_owner_only_guards(client):
    from fastapi import Depends

    from app.access import PatientAccess, require_access

    @client.app.post(f"{API}/patients/{{patient_id}}/_upload_probe")
    def upload_probe(access: PatientAccess = Depends(require_access("upload_documents"))):
        return {"ok": True}

    @client.app.post(f"{API}/patients/{{patient_id}}/_owner_probe")
    def owner_probe(access: PatientAccess = Depends(require_access(None, owner_only=True))):
        return {"ok": True}

    karthik = auth(login(client, KARTHIK))
    scope = client.post(f"{API}/patients/pat_meera/_upload_probe", headers=karthik)
    assert scope.status_code == 403
    assert scope.json()["error"]["code"] == "SCOPE_REQUIRED"
    assert scope.json()["error"]["details"] == {"required_scope": "upload_documents"}
    owner = client.post(f"{API}/patients/pat_meera/_owner_probe", headers=karthik)
    assert owner.json()["error"]["code"] == "OWNER_ONLY"

    meera = auth(login(client, MEERA))
    assert client.post(f"{API}/patients/pat_meera/_upload_probe", headers=meera).status_code == 200
    assert client.post(f"{API}/patients/pat_meera/_owner_probe", headers=meera).status_code == 200


# FR-003 / BE-3.4
def test_fresh_user_onboarding_and_consents(client):
    token = login(client, FRESH)
    assert client.get(f"{API}/me", headers=auth(token)).json()["onboarding_required"] is True
    for consent_type in ("terms_and_disclaimer", "ai_processing"):
        response = client.post(
            f"{API}/me/consents",
            headers=auth(token),
            json={"consent_type": consent_type, "granted": True, "policy_version": "2026-10-demo-1"},
        )
        assert response.status_code == 201
        assert response.json()["consent"]["consent_type"] == consent_type
        assert response.json()["consent"]["id"].startswith("cns_")
    assert client.get(f"{API}/me", headers=auth(token)).json()["onboarding_required"] is False


def test_consent_rejects_sharing_and_wrong_policy(client):
    token = login(client, FRESH)
    sharing = client.post(
        f"{API}/me/consents",
        headers=auth(token),
        json={"consent_type": "sharing", "granted": True, "policy_version": "2026-10-demo-1"},
    )
    assert sharing.status_code == 422
    stale = client.post(
        f"{API}/me/consents",
        headers=auth(token),
        json={"consent_type": "ai_processing", "granted": True, "policy_version": "2025-old"},
    )
    assert stale.status_code == 422
    assert stale.json()["error"]["details"]["fields"][0]["field"] == "policy_version"


def test_withdrawn_ai_consent_blocks_upload_check(client):
    from app.consents import require_ai_consent
    from app.db import get_engine
    from app.errors import ApiError
    from app.models import PatientProfile

    token = login(client, MEERA)
    client.post(
        f"{API}/me/consents",
        headers=auth(token),
        json={"consent_type": "ai_processing", "granted": False, "policy_version": "2026-10-demo-1"},
    )
    with Session(get_engine()) as session:
        patient = session.get(PatientProfile, "pat_meera")
        try:
            require_ai_consent(session, patient)
            raise AssertionError("expected CONSENT_REQUIRED")
        except ApiError as exc:
            assert exc.status == 403 and exc.code == "CONSENT_REQUIRED"
