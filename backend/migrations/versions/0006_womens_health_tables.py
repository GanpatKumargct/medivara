"""womens health tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-11 01:42:24.721609
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Women's health tables (API-62 to API-67), which arrived without a migration.
    op.create_table('period_log',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('end_date', sa.Date(), nullable=True),
    sa.Column('flow', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('symptoms', sa.JSON(), nullable=False),
    sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('period_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_period_log_patient_id'), ['patient_id'], unique=False)

    op.create_table('womens_health_settings',
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('mode', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('cycle_length_days', sa.Integer(), nullable=True),
    sa.Column('period_length_days', sa.Integer(), nullable=True),
    sa.Column('lmp_date', sa.Date(), nullable=True),
    sa.Column('due_date', sa.Date(), nullable=True),
    sa.Column('delivery_date', sa.Date(), nullable=True),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('updated_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.PrimaryKeyConstraint('patient_id')
    )


def downgrade() -> None:
    op.drop_table('womens_health_settings')
    with op.batch_alter_table('period_log', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_period_log_patient_id'))

    op.drop_table('period_log')
