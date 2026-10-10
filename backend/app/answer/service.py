"""M4 Answer orchestration: Ask (API-21) and the brief narrative (API-20).

Ask: AG-09 gate → AG-10 context → AG-11 generator → AG-12 validator → AIOutput stored.
AI problems never become HTTP errors; they become `degraded`, `unavailable` or `withheld`.
"""

import logging
import re
import time

from sqlmodel import Session, select

from app.answer import gate, generator, validator
from app.answer.context import Context, EvidenceEntry, build_ask_context, build_narrative_context
from app.config import get_settings
from app.copy import COPY_02, COPY_05, COPY_06, COPY_07, COPY_07B, COPY_09A, COPY_09B, COPY_12B, NO_AI_CONSENT, notice
from app.consents import has_current_consent
from app.models import AIOutput, ConsentType, ConsultationBrief, ExtractedFact, FactStatus, FactType, PatientProfile, iso_z

log = logging.getLogger("medivara.answer")

MAX_KEYWORD_LINES = 6
MAX_ADVICE_LINES = 4
STOPWORDS = set(
    """a an the and or of to in on at for from by with about is are was were be been being am do does did done have has
    had my me i you your it its this that these those what which who whom whose when where why how much many any some
    all most recent latest last before after over time ever still please tell show give list say says said documents
    document records record report reports mention mentions listed there their they them can could should would will""".split()
)


def patient_medicines(session: Session, patient_id: str) -> list[str]:
    """Medicine names as written and as corrected by the user (both may appear in evidence)."""
    rows = session.exec(
        select(ExtractedFact).where(
            ExtractedFact.patient_id == patient_id,
            ExtractedFact.fact_type == FactType.medication,
            ExtractedFact.status != FactStatus.rejected,
        )
    ).all()
    names = []
    for fact in rows:
        for name in (fact.name, (fact.corrected_fields or {}).get("name")):
            clean = re.sub(r"^(?:\d+\.\s*)?(?:tab(?:let)?s?|cap(?:sule)?s?|syp|inj)\.?\s+", "", (name or "").strip(), flags=re.I)
            if clean and clean not in names:
                names.append(clean)
    return names


def ai_consented(session: Session, patient_id: str) -> bool:
    """The profile owner's current AI-processing consent also covers Ask and the narrative (COPY-04)."""
    patient = session.get(PatientProfile, patient_id)
    return bool(patient) and has_current_consent(session, patient.owner_user_id, ConsentType.ai_processing)


def keyword_evidence(ctx: Context, question: str) -> list[dict]:
    """Lines matching the question's own keywords, for evidence-only answers (COPY-10)."""
    words = {w for w in re.findall(r"[a-z0-9]+", question.lower()) if len(w) >= 3 and w not in STOPWORDS}
    scored = []
    for order, (key, entry) in enumerate(ctx.entries.items()):
        if entry.is_user_correction:
            continue
        text = entry.text.lower()
        hits = sum(1 for w in words if re.search(rf"\b{re.escape(w)}\b", text))
        if hits:
            scored.append((-hits, entry.fact_status is None, order, entry))
    best = [e for *_, e in sorted(scored)[:MAX_KEYWORD_LINES]]
    best.sort(key=lambda e: list(ctx.entries).index(e.key))
    return [e.as_evidence(f"E{i}") for i, e in enumerate(best, start=1)]


def _advice_evidence(ctx: Context, medicines: list[str], all_medicines: list[str]) -> list[dict]:
    terms = medicines or all_medicines
    entries: list[EvidenceEntry] = []
    for entry in ctx.entries.values():  # newest document first
        if entry.is_user_correction or entry.fact_status is None:
            continue
        if any(re.search(rf"\b{re.escape(m)}\b", entry.text, re.IGNORECASE) for m in terms):
            entries.append(entry)
        if len(entries) == MAX_ADVICE_LINES:
            break
    return [e.as_evidence(f"E{i}") for i, e in enumerate(entries, start=1)]


def _safety_statement(text: str) -> list[dict]:
    return [{"id": "S1", "kind": "safety_notice", "text": text, "evidence_ids": []}]


def _unverified_notice(evidence: list[dict]) -> list[dict]:
    return [notice("unverified_included", COPY_12B)] if any("unverified" in (e["fact_status"] or "") for e in evidence) else []


def ask(session: Session, patient_id: str, user_id: str, question: str, input_mode: str) -> tuple[AIOutput, dict]:
    settings = get_settings()
    start = time.perf_counter()
    medicines = patient_medicines(session, patient_id)
    route = gate.classify(question, medicines)
    model_id = prompt_version = thinking = None
    questions: list[str] = []
    statements: list[dict] = []
    evidence: list[dict] = []
    notices: list[dict] = []
    report: dict = {}

    if route.route == "emergency":
        status, statements = "emergency", _safety_statement(COPY_05)
    else:
        ctx = build_ask_context(session, patient_id, settings.ask_context_token_cap)
        if route.route == "advice_redirect":
            status, statements = "advice_redirect", _safety_statement(COPY_06)
            evidence = _advice_evidence(ctx, route.medicines, medicines)
            medicine = route.medicines[0] if route.medicines else None
            questions = [
                f"Is my current dose of {medicine} still right for me?"
                if medicine
                else "Are my current medicines and doses still right for me?"
            ]
        elif ctx.empty:
            status, statements = "not_found", [{"id": "S1", "kind": "not_found", "text": COPY_07, "evidence_ids": []}]
        elif not ai_consented(session, patient_id):
            # Consent withdrawn: nothing is sent to Gemini; show the matching lines instead.
            status = "degraded"
            evidence = keyword_evidence(ctx, question)
            notices = [notice("consent_required", NO_AI_CONSENT)]
        else:
            result = generator.generate("answer", ctx.text, question, settings.timeout_ask_s)
            notices = list(ctx.notices)
            if not result.ok:
                status = "degraded"
                evidence = keyword_evidence(ctx, question)
                notices.append(notice("ai_unavailable", COPY_09B))
            else:
                model_id, prompt_version, thinking = result.model_id, generator.ASK_PROMPT_VERSION, settings.gemini_thinking_level
                checked = validator.validate(result.data, ctx, medicines, "answer")
                report = checked.report
                status = checked.status
                if status == "not_found":
                    statements = [{"id": "S1", "kind": "not_found", "text": COPY_07, "evidence_ids": []}]
                elif status == "out_of_scope":
                    statements = [{"id": "S1", "kind": "not_found", "text": COPY_07B, "evidence_ids": []}]
                elif status == "withheld":
                    evidence = keyword_evidence(ctx, question)
                    notices += checked.notices + _unverified_notice(evidence)
                else:
                    statements, evidence, questions = checked.statements, checked.evidence, checked.questions
                    notices += checked.notices

    if route.route == "advice_redirect":
        notices += _unverified_notice(evidence)
    latency = int((time.perf_counter() - start) * 1000)
    output = AIOutput(
        patient_id=patient_id,
        requested_by_user_id=user_id,
        output_type="answer",
        input_mode=input_mode,
        question_text=question,
        status=status,
        statements=statements,
        evidence=evidence,
        questions_for_doctor=questions,
        notices=notices,
        validation_report=report,
        model_id=model_id,
        prompt_version=prompt_version,
        thinking_level=thinking,
        latency_ms=latency,
    )
    session.add(output)
    session.commit()
    session.refresh(output)
    log.info("ask_answered", extra={"outcome": status, "latency_ms": latency})
    return output, answer_response(output)


def answer_response(output: AIOutput) -> dict:
    return {
        "answer_id": output.id,
        "status": output.status,
        "statements": output.statements,
        "evidence": output.evidence,
        "questions_for_doctor": output.questions_for_doctor,
        "notices": output.notices,
        "disclaimer": COPY_02,
        "generated_at": iso_z(output.created_at),
        "latency_ms": output.latency_ms,
    }


def narrative(session: Session, brief: ConsultationBrief, user_id: str) -> AIOutput:
    settings = get_settings()
    start = time.perf_counter()
    ctx = build_narrative_context(brief)
    medicines = patient_medicines(session, brief.patient_id)
    status, statements, evidence, notices, report = "unavailable", [], [], [], {}
    model_id = prompt_version = thinking = None
    if ctx.empty:
        notices = [notice("ai_unavailable", COPY_09A)]
    elif not ai_consented(session, brief.patient_id):
        notices = [notice("consent_required", NO_AI_CONSENT)]
    else:
        result = generator.generate("narrative", ctx.text, None, settings.timeout_narrative_s)
        if not result.ok:
            notices = [notice("ai_unavailable", COPY_09A)]
        else:
            model_id, prompt_version, thinking = result.model_id, generator.NARRATIVE_PROMPT_VERSION, settings.gemini_thinking_level
            checked = validator.validate(result.data, ctx, medicines, "narrative")
            report = checked.report
            if checked.status == "withheld":
                status, notices = "withheld", checked.notices
            else:
                status, statements, evidence, notices = "ready", checked.statements, checked.evidence, checked.notices
    output = AIOutput(
        patient_id=brief.patient_id,
        requested_by_user_id=user_id,
        output_type="brief_narrative",
        status=status,
        statements=statements,
        evidence=evidence,
        notices=notices,
        validation_report=report,
        model_id=model_id,
        prompt_version=prompt_version,
        thinking_level=thinking,
        latency_ms=int((time.perf_counter() - start) * 1000),
    )
    session.add(output)
    session.flush()
    brief.narrative_output_id = output.id
    session.add(brief)
    session.commit()
    session.refresh(output)
    return output


def narrative_object(output: AIOutput, templated_text: str) -> dict:
    return {
        "output_id": output.id,
        "status": output.status,
        "statements": output.statements,
        "evidence": output.evidence,
        "notices": output.notices,
        "templated_text": templated_text,
        "generated_at": iso_z(output.created_at),
    }

