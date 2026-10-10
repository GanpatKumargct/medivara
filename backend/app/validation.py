"""Shared input rules for the redesign extensions (API contract §5b)."""

from typing import Literal

from app.errors import ApiError

RELATIONSHIPS = ("self", "spouse", "parent", "child", "sibling", "grandparent", "other")
Relationship = Literal["self", "spouse", "parent", "child", "sibling", "grandparent", "other"]
SCOPE_ORDER = ("view_records", "upload_documents", "manage_reminders")
SEXES = ("female", "male", "other")
SEX_ISSUE = f"must be one of: {', '.join(SEXES)}"


def validation_error(fields: list[tuple[str, str]]) -> ApiError:
    """422 VALIDATION_ERROR listing every failing field, like the request-validation handler."""
    return ApiError(
        422,
        "VALIDATION_ERROR",
        "Some fields need attention.",
        {"fields": [{"field": field, "issue": issue} for field, issue in fields]},
    )


def normalise_email(raw: str) -> str:
    return raw.strip().lower()


def email_issue(email: str) -> str | None:
    """A simple format check on an already normalised email; None when it passes."""
    if not email:
        return "is required"
    if len(email) > 254:
        return "must be 254 characters or fewer"
    if email.count("@") != 1 or any(c.isspace() for c in email):
        return "must be a valid email address"
    local, domain = email.split("@")
    if not local or "." not in domain or domain.startswith(".") or domain.endswith(".") or ".." in domain:
        return "must be a valid email address"
    return None


def clean_sex(raw: str | None) -> str | None:
    """Trimmed and lowercased; an empty string counts as null. Check the result against SEXES."""
    value = (raw or "").strip().lower()
    return value or None


def clean_name(raw: str) -> str:
    """Trim and collapse whitespace (also removes line breaks, which matter in email headers)."""
    return " ".join(raw.split())


def ordered_scopes(scopes: list[str]) -> list[str]:
    return [s for s in SCOPE_ORDER if s in scopes]
