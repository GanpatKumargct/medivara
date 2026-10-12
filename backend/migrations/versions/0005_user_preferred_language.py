"""user preferred language

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-11 01:11:43.025651
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Interface language (DEC-29); existing users keep English.
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('preferred_language', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='en'))



def downgrade() -> None:
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('preferred_language')

