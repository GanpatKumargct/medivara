"""API-47 to API-53: saved Ask conversations.

A chat belongs to one profile AND one user: it is private to the user who started it, so a
caregiver never sees the owner's chats and the owner never sees a caregiver's. A chat is
found only by (chat ID, profile in the path, current user); anything else is 404.

Questions run through the same Ask pipeline as API-21 (emergency and advice gate, grounded
context, validator). Question text is stored with the chat but never logged or audited.
"""

from datetime import timedelta

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import and_, delete
from sqlmodel import Session, func, select

from app import audit
from app.access import PatientAccess, load_owned, require_access
from app.answer.service import ask
from app.db import get_session
from app.errors import ApiError
from app.models import ChatMessage, ChatSession, MedicalDocument, iso_z, utcnow
from app.routers import API_PREFIX
from app.routers.ask import AskRequest
from app.validation import validation_error

router = APIRouter(prefix=API_PREFIX, tags=["chats"])

DEFAULT_TITLE = "New chat"
TITLE_FROM_QUESTION = 60
PREVIEW_CHARS = 120


class ChatCreate(BaseModel):
    title: str | None = None


class ChatRename(BaseModel):
    title: str


class AttachmentIn(BaseModel):
    document_id: str


def _title(raw: str) -> str:
    title = " ".join(raw.split())
    if not 1 <= len(title) <= 80:
        raise validation_error([("title", "must be between 1 and 80 characters")])
    return title


def shorten(text: str, limit: int) -> str:
    """The first `limit` characters, cut back to a word boundary, plus "…" when cut."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if text[limit] != " " and cut.rfind(" ") > 0:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip() + "…"


def _preview(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= PREVIEW_CHARS else text[: PREVIEW_CHARS - 1].rstrip() + "…"


def _stats(session: Session, chat_ids: list[str]) -> dict[str, tuple[int, str | None]]:
    """(message_count, last_message_preview) per chat, in two queries."""
    if not chat_ids:
        return {}
    counts = dict(
        session.exec(
            select(ChatMessage.chat_id, func.count()).where(ChatMessage.chat_id.in_(chat_ids)).group_by(ChatMessage.chat_id)
        ).all()
    )
    latest = (
        select(ChatMessage.chat_id.label("chat_id"), func.max(ChatMessage.created_at).label("at"))
        .where(ChatMessage.chat_id.in_(chat_ids), ChatMessage.kind == "question")
        .group_by(ChatMessage.chat_id)
        .subquery()
    )
    previews = dict(
        session.exec(
            select(ChatMessage.chat_id, ChatMessage.text)
            .join(latest, and_(ChatMessage.chat_id == latest.c.chat_id, ChatMessage.created_at == latest.c.at))
            .where(ChatMessage.kind == "question")
        ).all()
    )
    return {
        cid: (counts.get(cid, 0), _preview(previews[cid]) if previews.get(cid) else None) for cid in chat_ids
    }


def chat_out(chat: ChatSession, stats: tuple[int, str | None]) -> dict:
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": iso_z(chat.created_at),
        "updated_at": iso_z(chat.updated_at),
        "message_count": stats[0],
        "last_message_preview": stats[1],
    }


def _chat_out(session: Session, chat: ChatSession) -> dict:
    return chat_out(chat, _stats(session, [chat.id])[chat.id])


def _documents(session: Session, patient_id: str, messages: list[ChatMessage]) -> dict[str, dict]:
    """Attached documents looked up live (a deleted document comes back as null)."""
    ids = list({m.document_id for m in messages if m.kind == "attachment" and m.document_id})
    if not ids:
        return {}
    docs = session.exec(
        select(MedicalDocument).where(MedicalDocument.id.in_(ids), MedicalDocument.patient_id == patient_id)
    ).all()
    return {
        d.id: {
            "id": d.id,
            "title": d.title,
            "status": d.status.value,
            "document_type": d.document_type.value,
            "document_date": d.document_date.isoformat() if d.document_date else None,
        }
        for d in docs
    }


def message_out(m: ChatMessage, documents: dict[str, dict]) -> dict:
    return {
        "id": m.id,
        "chat_id": m.chat_id,
        "role": m.role,
        "kind": m.kind,
        "text": m.text,
        "input_mode": m.input_mode,
        "answer": dict(m.payload) if m.kind == "answer" else None,
        "document": documents.get(m.document_id) if m.kind == "attachment" and m.document_id else None,
        "created_at": iso_z(m.created_at),
    }


def load_chat(session: Session, access: PatientAccess, chat_id: str) -> ChatSession:
    chat = session.exec(
        select(ChatSession).where(
            ChatSession.id == chat_id,
            ChatSession.patient_id == access.patient.id,
            ChatSession.user_id == access.current.user.id,
        )
    ).first()
    if chat is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    return chat


@router.get("/patients/{patient_id}/chats")
def list_chats(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    where = (ChatSession.patient_id == access.patient.id, ChatSession.user_id == access.current.user.id)
    total = session.exec(select(func.count()).select_from(ChatSession).where(*where)).one()
    chats = session.exec(
        select(ChatSession)
        .where(*where)
        .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    stats = _stats(session, [c.id for c in chats])
    return {"items": [chat_out(c, stats[c.id]) for c in chats], "total": total, "limit": limit, "offset": offset}


@router.post("/patients/{patient_id}/chats", status_code=201)
def create_chat(
    body: ChatCreate | None = Body(None),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    title = DEFAULT_TITLE if body is None or body.title is None else _title(body.title)
    chat = ChatSession(patient_id=access.patient.id, user_id=access.current.user.id, title=title)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return {"chat": chat_out(chat, (0, None))}


@router.get("/patients/{patient_id}/chats/{chat_id}")
def get_chat(
    chat_id: str,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    chat = load_chat(session, access, chat_id)
    messages = session.exec(
        select(ChatMessage).where(ChatMessage.chat_id == chat.id).order_by(ChatMessage.created_at, ChatMessage.id)
    ).all()
    documents = _documents(session, access.patient.id, messages)
    return {"chat": _chat_out(session, chat), "messages": [message_out(m, documents) for m in messages]}


@router.patch("/patients/{patient_id}/chats/{chat_id}")
def rename_chat(
    chat_id: str,
    body: ChatRename,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    chat = load_chat(session, access, chat_id)
    chat.title = _title(body.title)
    chat.updated_at = utcnow()
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return {"chat": _chat_out(session, chat)}


@router.delete("/patients/{patient_id}/chats/{chat_id}", status_code=204)
def delete_chat(
    chat_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> Response:
    chat = load_chat(session, access, chat_id)
    count = _stats(session, [chat.id])[chat.id][0]
    session.exec(delete(ChatMessage).where(ChatMessage.chat_id == chat.id))
    session.delete(chat)
    session.commit()
    audit.write(
        request,
        "chat.deleted",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="chat",
        resource_id=chat_id,
        meta={"message_count": count},
    )
    return Response(status_code=204)


@router.post("/patients/{patient_id}/chats/{chat_id}/messages", status_code=201)
def send_message(
    chat_id: str,
    body: AskRequest,
    request: Request,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    chat = load_chat(session, access, chat_id)
    user_id = access.current.user.id
    asked_at = utcnow()
    output, response = ask(session, access.patient.id, user_id, body.question, body.input_mode)
    answered_at = max(utcnow(), asked_at + timedelta(microseconds=1))  # strictly after the question
    question = ChatMessage(
        chat_id=chat.id, role="user", kind="question", text=body.question, input_mode=body.input_mode, created_at=asked_at
    )
    answer = ChatMessage(
        chat_id=chat.id, role="assistant", kind="answer", payload=response, ai_output_id=output.id, created_at=answered_at
    )
    session.add(question)
    session.add(answer)
    if chat.title == DEFAULT_TITLE:
        chat.title = shorten(body.question, TITLE_FROM_QUESTION)
    chat.updated_at = answered_at
    session.add(chat)
    session.commit()
    for row in (question, answer, chat):
        session.refresh(row)
    # Status and IDs only; the question text is never logged or audited (as API-21).
    audit.write(
        request,
        "ask.answered",
        actor_user_id=user_id,
        patient_id=access.patient.id,
        resource_type="ai_output",
        resource_id=output.id,
        meta={"status": output.status, "input_mode": body.input_mode, "chat_id": chat.id},
    )
    return {
        "user_message": message_out(question, {}),
        "assistant_message": message_out(answer, {}),
        "chat": _chat_out(session, chat),
    }


@router.post("/patients/{patient_id}/chats/{chat_id}/attachments", status_code=201)
def attach_document(
    chat_id: str,
    body: AttachmentIn,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    chat = load_chat(session, access, chat_id)
    document = load_owned(session, MedicalDocument, body.document_id, access.patient.id)
    now = utcnow()
    message = ChatMessage(chat_id=chat.id, role="user", kind="attachment", document_id=document.id, created_at=now)
    session.add(message)
    if chat.title == DEFAULT_TITLE:
        title = document.title if len(document.title) <= 60 else document.title[:60].rstrip() + "…"
        chat.title = f"Document: {title}"
    chat.updated_at = now
    session.add(chat)
    session.commit()
    session.refresh(message)
    session.refresh(chat)
    documents = _documents(session, access.patient.id, [message])
    return {"message": message_out(message, documents), "chat": _chat_out(session, chat)}
