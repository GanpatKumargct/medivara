"""Unit tests for AG-02 lines, AG-05 validation and the Gemini wrapper (TC-EXT-02, 05; TC-REL-04)."""

from datetime import date

import pytest

from app.pipeline import lines, validation
from app.pipeline.normalize import parse_date
from fake_model import CANNED, FakeModel, response


def page_lines(pdfs, name):
    return lines.extract_lines(pdfs[name]).pages[0].lines


# TC-EXT-02
def test_lab_table_rows_become_single_lines(pdfs):
    texts = {l["line_id"]: l["text"] for l in page_lines(pdfs, "lab_sunrise_may2026.pdf")}
    assert texts["p1-l6"] == "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H"
    assert texts["p1-l8"] == "LDL cholesterol   112   mg/dL   < 100   H"
    assert texts["p1-l10"] == "Haemoglobin   12.1   g/dL"
    assert len(texts) == 11


def test_line_ids_are_stable_on_reprocessing(pdfs):
    data = pdfs["discharge_greenfield_jul2025.pdf"]
    assert lines.extract_lines(data).pages[0].lines == lines.extract_lines(data).pages[0].lines


def test_scanned_pdf_has_no_text(pdfs):
    assert lines.extract_lines(pdfs["scanned_prescription.pdf"]).has_text is False


def test_unopenable_pdf_raises():
    with pytest.raises(lines.UnreadablePdf):
        lines.extract_lines(b"%PDF-1.7 garbage")


def _validate(pdfs, name, facts, document=None):
    doc_lines = page_lines(pdfs, name)
    canned = next(v for k, v in CANNED.items() if any(k in l["text"] for l in doc_lines))
    return validation.validate(document or canned["document"], facts, doc_lines, [], date(2026, 10, 24))


# TC-EXT-05
def test_untraceable_fact_is_discarded(pdfs):
    fact = {"fact_type": "lab_result", "name": "HbA1c", "value": "8.4", "unit": "%", "reference_range": "4.0 - 5.6",
            "source_line_ids": ["p9-l99"]}
    result = _validate(pdfs, "lab_sunrise_mar2025.pdf", [fact])
    assert result.facts == [] and result.discarded == 1


def test_value_not_in_cited_line_is_low_confidence(pdfs):
    fact = {"fact_type": "lab_result", "name": "HbA1c (Glycated haemoglobin)", "value": "9.4", "unit": "%",
            "reference_range": "4.0 - 5.6", "source_line_ids": ["p1-l6"]}
    [validated] = _validate(pdfs, "lab_sunrise_mar2025.pdf", [fact]).facts
    assert validated.confidence.value == "low"
    assert validated.uncertainty_reasons == ["value_not_in_source"]


def test_medication_checks_strength_and_required_fields(pdfs):
    ok = {"fact_type": "medication", "name": "Metformin", "strength": "1000 mg", "frequency": "twice daily",
          "source_line_ids": ["p1-l8"]}
    no_freq = {**ok, "frequency": None}
    wrong_strength = {**ok, "strength": "500 mg"}
    results = _validate(pdfs, "rx_lakeview_sep2026.pdf", [ok, no_freq, wrong_strength]).facts
    assert [r.confidence.value for r in results] == ["high", "low", "low"]
    assert results[1].uncertainty_reasons == ["missing_required_field"]
    assert results[2].uncertainty_reasons == ["value_not_in_source"]


def test_unknown_unit_and_model_note_are_soft(pdfs):
    fact = {"fact_type": "lab_result", "name": "Serum creatinine", "value": "0.9", "unit": "mg/dl",
            "reference_range": "0.6 - 1.1", "extraction_note": "faint print", "source_line_ids": ["p1-l9"]}
    [v] = _validate(pdfs, "lab_sunrise_mar2025.pdf", [fact]).facts
    assert v.confidence.value == "medium" and v.uncertainty_reasons == ["model_note"]
    weird = {**fact, "unit": "furlongs", "extraction_note": None}
    [w] = _validate(pdfs, "lab_sunrise_mar2025.pdf", [weird]).facts
    assert w.uncertainty_reasons == ["unrecognised_unit"]


def test_future_date_is_hard(pdfs):
    document = {**CANNED["Sample collected: 18-Mar-2025"]["document"], "document_date_text": "18-Mar-2030"}
    fact = CANNED["Sample collected: 18-Mar-2025"]["facts"][0]
    [v] = _validate(pdfs, "lab_sunrise_mar2025.pdf", [fact], document).facts
    assert "date_in_future" in v.uncertainty_reasons and v.confidence.value == "low"


def test_missing_document_date_sets_flag(pdfs):
    document = {**CANNED["Sample collected: 18-Mar-2025"]["document"], "document_date_text": None}
    header = _validate(pdfs, "lab_sunrise_mar2025.pdf", [], document).header
    assert header.flags == ["date_missing"] and header.title.endswith("· Undated")


@pytest.mark.parametrize(
    ("text", "expected", "ambiguous"),
    [("04/05/2026", date(2026, 5, 4), True), ("13/05/2026", date(2026, 5, 13), False),
     ("18-Mar-2025", date(2025, 3, 18), False), ("31/02/2026", None, None)],
)
def test_day_first_dates(text, expected, ambiguous):
    parsed = parse_date(text)
    assert (parsed.value if parsed else None) == expected
    if parsed:
        assert parsed.ambiguous is ambiguous


# --- Gemini wrapper (BE-5.3) ------------------------------------------------------------


def _call(**kwargs):
    from app import llm

    return llm.generate_json(stage="test", system_instruction="s", input_text="i", schema={}, timeout_s=1, **kwargs)


def test_wrapper_request_is_stateless(client):
    from app import llm

    model = FakeModel(script=[response({"ok": True})])
    llm.set_transport(model)
    try:
        result = _call()
    finally:
        llm.set_transport(None)
    assert result.ok and result.data == {"ok": True}
    request = model.requests[0]
    assert request["no_retention"] is True and request["provider"] == "openrouter"
    assert request["model"] == "google/gemini-2.5-flash" and request["thinking_level"] == "low"
    assert "history" not in request and "previous_interaction_id" not in request
    assert result.tokens == {"input_tokens": 500, "output_tokens": 200}


@pytest.mark.parametrize(
    ("script", "outcome", "calls"),
    [
        ([response("")], "blocked", 1),  # empty output with HTTP 200
        ([response('{"a":1}', status="failed")], "blocked", 1),
        ([response("[1, 2]"), response("[1, 2]")], "invalid", 2),
        ([response("{}", status="incomplete"), response({"ok": 1})], "ok", 2),
    ],
)
def test_wrapper_maps_recorded_failures(client, script, outcome, calls):
    from app import llm

    model = FakeModel(script=script)
    llm.set_transport(model)
    try:
        result = _call()
    finally:
        llm.set_transport(None)
    assert result.outcome == outcome and len(model.requests) == calls


def test_wrapper_classifies_http_errors(client):
    from app import llm

    class HttpError(Exception):
        def __init__(self, status_code):
            self.status_code = status_code

    for status, outcome, calls in ((429, "quota", 2), (503, "server", 2), (400, "unavailable", 1)):
        model = FakeModel(script=[HttpError(status), HttpError(status)])
        llm.set_transport(model)
        try:
            result = _call()
        finally:
            llm.set_transport(None)
        assert (result.outcome, len(model.requests)) == (outcome, calls)


def test_wrapper_makes_no_call_when_ai_disabled(client, monkeypatch):
    from app import config, llm

    model = FakeModel(script=[response({"ok": 1})])
    llm.set_transport(model)
    try:
        for mode in ("off", "cache_only"):
            monkeypatch.setenv("AI_MODE", mode)
            config.get_settings.cache_clear()
            assert _call().outcome == "disabled"
    finally:
        llm.set_transport(None)
    assert model.requests == []


def test_wrapper_validate_hook_rejects_wrong_shape(client):
    from app import llm

    def must_have_facts(data):
        if "facts" not in data:
            raise llm.InvalidOutput

    model = FakeModel(script=[response({"x": 1}), response({"facts": []})])
    llm.set_transport(model)
    try:
        result = _call(validate=must_have_facts)
    finally:
        llm.set_transport(None)
    assert result.ok and result.attempts == 2


# --- OpenRouter mapping (app/llm.py) -------------------------------------------------------


def _request():
    return {"model": "google/gemini-2.5-flash", "system_instruction": "rules", "input": "DOCUMENT_START\n…",
            "schema": {"type": "object"}, "schema_name": "medivara_extract", "thinking_level": "low", "no_retention": True}


def test_openrouter_payload_is_stateless_private_and_schema_bound(client):
    from app import llm

    body = llm.openrouter_payload(_request())
    assert body["model"] == "google/gemini-2.5-flash"
    assert [m["role"] for m in body["messages"]] == ["system", "user"]  # no conversation history
    assert body["provider"] == {"data_collection": "deny", "require_parameters": True}
    assert body["response_format"]["type"] == "json_schema"
    assert body["response_format"]["json_schema"]["schema"] == {"type": "object"}
    assert body["reasoning"] == {"effort": "low"} and body["stream"] is False


@pytest.mark.parametrize(
    ("status", "body", "expect"),
    [
        (200, {"choices": [{"finish_reason": "stop", "message": {"content": '{"a": 1}'}}],
               "usage": {"prompt_tokens": 10, "completion_tokens": 5}}, ("completed", '{"a": 1}', {"input_tokens": 10, "output_tokens": 5})),
        (200, {"choices": [{"finish_reason": "content_filter", "message": {"content": None}}]}, ("failed", None, {})),
        (200, {"choices": [{"finish_reason": "length", "message": {"content": '{"a"'}}]}, ("incomplete", '{"a"', {})),
        (200, {"choices": []}, ("failed", None, {})),
        (200, {"error": {"code": 403, "message": "flagged"}}, ("failed", None, {})),
    ],
)
def test_parse_openrouter_replies(status, body, expect):
    from app.llm import parse_openrouter

    reply = parse_openrouter(status, body)
    assert (reply.status, reply.text, reply.tokens) == expect


@pytest.mark.parametrize(("status", "body", "outcome"), [(429, None, "quota"), (502, None, "server"),
                                                        (401, None, "unavailable"), (200, {"error": {"code": 503}}, "server")])
def test_openrouter_http_errors_map_to_outcomes(status, body, outcome):
    from app.llm import ProviderError, _classify_exception, parse_openrouter

    with pytest.raises(ProviderError) as exc:
        parse_openrouter(status, body)
    assert _classify_exception(exc.value) == outcome


def test_openrouter_end_to_end_through_the_wrapper(client, monkeypatch):
    """The real transport function, with httpx.post replaced: blocked replies and retries."""
    import httpx

    from app import llm

    calls = []

    class Resp:
        def __init__(self, code, body):
            self.status_code, self._body = code, body

        def json(self):
            return self._body

    replies = [Resp(429, {"error": {"code": 429}}), Resp(200, {"choices": [{"finish_reason": "stop", "message": {"content": '```json\n{"ok": true}\n```'}}]})]

    def fake_post(url, headers, json, timeout):
        calls.append({"url": url, "auth": headers["Authorization"], "body": json})
        return replies.pop(0)

    monkeypatch.setattr(httpx, "post", fake_post)
    result = llm.generate_json(stage="test", system_instruction="s", input_text="i", schema={}, timeout_s=1)
    assert result.ok and result.data == {"ok": True} and result.attempts == 2
    assert calls[0]["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert calls[0]["auth"] == "Bearer test-key-not-real"
    assert calls[0]["body"]["provider"]["data_collection"] == "deny"
