"""camera_input consent type (DEC-28, sign-assisted questions)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-11
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL stores consent types as a native enum; SQLite stores plain text.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE consenttype ADD VALUE IF NOT EXISTS 'camera_input'")


def downgrade() -> None:
    # PostgreSQL can't drop an enum value; existing camera_input records would need removing first.
    pass
