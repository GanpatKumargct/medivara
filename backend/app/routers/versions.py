"""Document history and versions (DEC-27): API-34 to API-39 and API-68.

API-34 history · API-35 one version · API-36 restore · API-37 upload a new file version ·
API-38 Recently deleted (list, undelete; permanent delete is API-22 `permanent=true`) ·
API-39 changes since a time (default: the caller's previous sign-in) · API-68 records as they
were at a time, and the caller's sign-ins.
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Request, UploadFile
from sqlmodel import Session, func, select

from app import audit, versions
from app.access import PatientAccess, load_owned, require_access
from app.auth import CurrentUser, current_user
from app.consents import require_ai_consent
from app.db import get_session
from app.errors import ApiError
from app.models import (
    AuthSession,
    DocumentStatus,
    DocumentType,
    MedicalDocument,
    RecordVersion,
    User,
    as_utc,
    iso_z,
    utcnow,
)
from app.pipeline.orchestrator import process_document
from app.routers import API_PREFIX
from app.routers.documents import (
    HINT_TYPES,
    _fact_counts,
    _refuse_duplicate,
    document_summary,
    read_upload,
    require_editable,
    sanitize_filename,
)

router = APIRouter(prefix=API_PREFIX, tags=["versions"])
P = "/patients/{patient_id}"


def _names(session: Session, user_ids: set[str | None]) -> dict[str, str]:
    ids = [u for u in user_ids if u]
    if not ids:
        return {}
    return dict(session.exec(select(User.id, User.display_name).where(User.id.in_(ids))).all())


def _version_out(v: RecordVersion, names: dict[str, str], me: str, current: AuthSession | None = None) -> dict:
    # Made during the caller's current sign-in: tagged with it, or an automatic follow-up of
    # the caller's own action (no session tag) after the sign-in started.
    this_session = current is not None and (
        v.session_id == current.id
        or (v.session_id is None and v.actor_user_id == me and as_utc(v.at) >= as_utc(current.created_at))
    )
    return {
        "version_no": v.version_no,
        "action": v.action,
        "actor": {"id": v.actor_user_id, "display_name": names.get(v.actor_user_id, "")} if v.actor_user_id else None,
        "by_me": v.actor_user_id == me,
        "this_session": this_session,  # screens highlight only earlier changes
        "at": iso_z(v.at),
        "file_version": v.snapshot.get("file_version", 1),
        "summary": v.summary,
    }


def _state_out(state: dict) -> dict:
    """A snapshot as the screens need it (no internal line references)."""
    return {
        "document_id": state["document_id"],
        "file_version": state["file_version"],
        "status": state["status"],
        "deleted": state["deleted"],
        "header": state["header"],
        "facts": [
            {"id": f["id"], "fact_type": f["fact_type"], "status": f["status"], "confidence": f["confidence"],
             "text": f["text"]}
            for f in state["facts"]
        ],
    }


def _series_versions(session: Session, series_id: str) -> list[RecordVersion]:
    return list(
        session.exec(
            select(RecordVersion).where(RecordVersion.series_id == series_id).order_by(RecordVersion.version_no.desc())
        ).all()
    )


# --- API-38 Recently deleted (declared before /documents/{document_id} routes) ---------


@router.get(P + "/documents/deleted")
def list_deleted(
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    versions.purge_expired(session)
    docs = session.exec(
        select(MedicalDocument)
        .where(MedicalDocument.patient_id == access.patient.id, MedicalDocument.is_current.is_(True),
               MedicalDocument.deleted_at.is_not(None))
        .order_by(MedicalDocument.deleted_at.desc())
    ).all()
    counts = _fact_counts(session, [d.id for d in docs])
    names = _names(session, {d.deleted_by_user_id for d in docs})
    items = []
    for d in docs:
        item = document_summary(d, counts[d.id])
        item["deleted_by"] = {"id": d.deleted_by_user_id, "display_name": names.get(d.deleted_by_user_id, "")}
        item["purge_after"] = iso_z(versions.purge_after(as_utc(d.deleted_at)))
        items.append(item)
    return {"items": items, "retention_days": versions.RETENTION_DAYS}


@router.post(P + "/documents/{document_id}/undelete")
def undelete_document(
    document_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    if doc.deleted_at is None:
        raise ApiError(409, "INVALID_STATE", "This document isn't in Recently deleted.")
    current = versions.current_row(session, doc.series_id) or doc
    now = utcnow()
    for row in versions.series_rows(session, doc.series_id):
        row.deleted_at = None
        row.deleted_by_user_id = None
        row.updated_at = now
        session.add(row)
    versions.record_change(session, current, "undeleted", user_id=access.current.user.id,
                           session_id=access.current.auth_session.id)
    session.commit()
    session.refresh(current)
    audit.write(request, "document.undeleted", actor_user_id=access.current.user.id, patient_id=access.patient.id,
                resource_type="document", resource_id=current.id)
    return {"document": document_summary(current, _fact_counts(session, [current.id])[current.id])}


# --- API-34 / 35 / 36 history -------------------------------------------------------------


@router.get(P + "/documents/{document_id}/history")
def document_history(
    document_id: str,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    rows = versions.series_rows(session, doc.series_id)
    current = next((d for d in rows if d.is_current), doc)
    items = _series_versions(session, doc.series_id)
    names = _names(session, {v.actor_user_id for v in items})
    me = access.current.user.id
    return {
        "document": document_summary(current, _fact_counts(session, [current.id])[current.id]),
        "files": [
            {"document_id": d.id, "file_version": d.file_version, "original_filename": d.original_filename,
             "is_current": d.is_current, "status": d.status.value, "uploaded_at": iso_z(d.created_at)}
            for d in rows
        ],
        "versions": [_version_out(v, names, me) for v in items],
        "latest_version": items[0].version_no if items else 0,
    }


@router.get(P + "/documents/{document_id}/history/{version_no}")
def document_version(
    document_id: str,
    version_no: int,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    v = session.exec(
        select(RecordVersion).where(RecordVersion.series_id == doc.series_id, RecordVersion.version_no == version_no)
    ).first()
    if v is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    names = _names(session, {v.actor_user_id})
    return {"version": _version_out(v, names, access.current.user.id), "state": _state_out(v.snapshot)}


@router.post(P + "/documents/{document_id}/history/{version_no}/restore")
def restore_version(
    document_id: str,
    version_no: int,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    try:
        restored = versions.restore(session, doc.series_id, version_no, access.current.user.id,
                                    access.current.auth_session.id)
    except versions.VersionError as exc:
        raise ApiError(409, "INVALID_STATE", exc.message) from None
    session.commit()
    session.refresh(restored)
    audit.write(request, "document.version_restored", actor_user_id=access.current.user.id,
                patient_id=access.patient.id, resource_type="document", resource_id=restored.id,
                meta={"version_no": version_no})
    return {"document": document_summary(restored, _fact_counts(session, [restored.id])[restored.id])}


# --- API-37 new file version -------------------------------------------------------------


@router.post(P + "/documents/{document_id}/versions", status_code=202)
def upload_new_version(
    document_id: str,
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    """Upload an updated copy of a document (for example a corrected lab report). The new file
    is read like any upload; it replaces the current file only if it is read successfully, and
    review decisions carry over for items that are identical."""
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    require_editable(doc)
    require_ai_consent(session, access.patient)
    if doc.status in (DocumentStatus.queued, DocumentStatus.processing):
        raise ApiError(409, "INVALID_STATE", "This document is still being read. Try again when it has finished.")
    if versions.pending_new_file(session, doc.series_id):
        raise ApiError(409, "INVALID_STATE", "A new file for this document is already being read.")
    data, mime, pages = read_upload(file)
    import hashlib

    digest = hashlib.sha256(data).hexdigest()
    rows = versions.series_rows(session, doc.series_id)
    if any(r.sha256 == digest for r in rows):
        raise ApiError(409, "DUPLICATE_DOCUMENT", "This file is already a version of this document.",
                       {"existing_document_id": doc.id})
    _refuse_duplicate(session, access, digest)

    from app import storage

    filename = sanitize_filename(file.filename)
    hint = doc.document_type.value if doc.document_type != DocumentType.unknown else None
    new = MedicalDocument(
        patient_id=access.patient.id,
        uploaded_by_user_id=access.current.user.id,
        original_filename=filename,
        mime_type=mime,
        size_bytes=len(data),
        sha256=digest,
        storage_key=storage.save(data),
        page_count=pages,
        title=f"Uploaded document · {filename}",
        document_type_hint=hint if hint in HINT_TYPES else None,
        series_id=doc.series_id,
        file_version=max(r.file_version for r in rows) + 1,
        is_current=False,
    )
    session.add(new)
    session.commit()
    session.refresh(new)
    audit.write(request, "document.version_uploaded", actor_user_id=access.current.user.id,
                patient_id=access.patient.id, resource_type="document", resource_id=new.id,
                meta={"file_version": new.file_version, "page_count": pages})
    background.add_task(process_document, new.id)
    return {"document": document_summary(new, {"total": 0, "unverified": 0, "low_confidence": 0})}


# --- API-39 changes since -----------------------------------------------------------------


@router.get(P + "/changes")
def changes_since(
    since: str = Query("last_login", description="`last_login` or an ISO 8601 time"),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    me = access.current.user
    if since == "last_login":
        start = me.previous_login_at
    else:
        try:
            start = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise ApiError(422, "VALIDATION_ERROR", "Some fields need attention.",
                           {"fields": [{"field": "since", "issue": "must be last_login or an ISO 8601 time"}]}) from None
    if start is None:  # first sign-in: nothing to compare with
        return {"since": None, "items": [], "counts": {"documents": 0, "changes": 0}}
    start = as_utc(start)
    rows = session.exec(
        select(RecordVersion)
        .where(RecordVersion.patient_id == access.patient.id, RecordVersion.at > start)
        .order_by(RecordVersion.at.desc())
    ).all()
    by_series: dict[str, list[RecordVersion]] = {}
    for v in rows:
        by_series.setdefault(v.series_id, []).append(v)
    first_at = dict(
        session.exec(
            select(RecordVersion.series_id, func.min(RecordVersion.at))
            .where(RecordVersion.series_id.in_(list(by_series)))
            .group_by(RecordVersion.series_id)
        ).all()
    )
    names = _names(session, {v.actor_user_id for v in rows})
    items = []
    for series_id, changes in by_series.items():
        current = versions.current_row(session, series_id)
        if current is None:
            continue  # permanently deleted since
        items.append({
            "document": {"id": current.id, "series_id": series_id, "title": current.title,
                         "deleted": current.deleted_at is not None,
                         "is_new": as_utc(first_at[series_id]) > start},
            "changes": [_version_out(v, names, me.id, access.current.auth_session) for v in changes],
        })
    return {"since": iso_z(start), "items": items,
            "counts": {"documents": len(items), "changes": sum(len(i["changes"]) for i in items)}}


# --- API-68 sign-ins and records as of a time --------------------------------------------


@router.get("/me/logins")
def my_logins(
    limit: int = Query(20, ge=1, le=50),
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    rows = session.exec(
        select(AuthSession).where(AuthSession.user_id == current.user.id)
        .order_by(AuthSession.created_at.desc()).limit(limit)
    ).all()
    return {"items": [{"session_id": r.id, "at": iso_z(r.created_at), "current": r.id == current.auth_session.id}
                      for r in rows]}


@router.get(P + "/records-as-of")
def records_as_of(
    at: datetime = Query(..., description="ISO 8601 time"),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    """Each document as it was at `at`: its latest version saved at or before that time."""
    when = as_utc(at)
    rows = session.exec(
        select(RecordVersion)
        .where(RecordVersion.patient_id == access.patient.id, RecordVersion.at <= when)
        .order_by(RecordVersion.version_no)
    ).all()
    latest: dict[str, RecordVersion] = {}
    for v in rows:
        latest[v.series_id] = v
    docs = []
    for series_id, v in latest.items():
        state = v.snapshot
        if state["deleted"]:
            continue
        docs.append({"series_id": series_id, "version_no": v.version_no, **_state_out(state)})
    docs.sort(key=lambda d: (d["header"]["document_date"] or "", d["version_no"]), reverse=True)
    return {"at": iso_z(when), "documents": docs}
