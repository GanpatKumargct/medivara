"""Interface language preference (DEC-29, API-69)."""

from conftest import API, KARTHIK, MEERA, auth, login


def test_language_defaults_to_english_and_is_saved_per_user(client):
    meera, karthik = login(client, MEERA), login(client, KARTHIK)
    assert client.get(f"{API}/me", headers=auth(meera)).json()["preferred_language"] == "en"
    response = client.patch(f"{API}/me/preferences", headers=auth(meera), json={"preferred_language": "ta"})
    assert response.status_code == 200 and response.json() == {"preferred_language": "ta"}
    assert client.get(f"{API}/me", headers=auth(meera)).json()["preferred_language"] == "ta"
    assert client.get(f"{API}/me", headers=auth(karthik)).json()["preferred_language"] == "en"  # per user
    # A new sign-in keeps it.
    assert client.get(f"{API}/me", headers=auth(login(client, MEERA))).json()["preferred_language"] == "ta"


def test_unknown_language_is_rejected(client):
    meera = login(client, MEERA)
    response = client.patch(f"{API}/me/preferences", headers=auth(meera), json={"preferred_language": "xx"})
    assert response.status_code == 422
    assert client.patch(f"{API}/me/preferences", json={"preferred_language": "hi"}).status_code == 401
