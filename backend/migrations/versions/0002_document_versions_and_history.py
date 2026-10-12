"""document versions and history

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-10 23:08:05.519839
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('record_version',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('series_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('document_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('version_no', sa.Integer(), nullable=False),
    sa.Column('action', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('actor_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('session_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('snapshot', sa.JSON(), nullable=False),
    sa.Column('summary', sa.JSON(), nullable=False),
    sa.Column('at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('series_id', 'version_no', name='uq_record_version_no')
    )
    with op.batch_alter_table('record_version', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_record_version_at'), ['at'], unique=False)
        batch_op.create_index(batch_op.f('ix_record_version_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_record_version_series_id'), ['series_id'], unique=False)

    with op.batch_alter_table('medical_document', schema=None) as batch_op:
        # Existing documents: each is its own series, file version 1, current.
        batch_op.add_column(sa.Column('series_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('file_version', sa.Integer(), nullable=False, server_default='1'))
        batch_op.add_column(sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('superseded_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
        batch_op.add_column(sa.Column('deleted_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
        batch_op.add_column(sa.Column('deleted_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.create_index(batch_op.f('ix_medical_document_deleted_at'), ['deleted_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_medical_document_series_id'), ['series_id'], unique=False)

    op.execute("UPDATE medical_document SET series_id = id WHERE series_id = ''")

    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('previous_login_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    # Version 1 ("existing") for documents made before history is written at startup by
    # app.versions.backfill(), which builds snapshots with the app's own code.


def downgrade() -> None:
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('previous_login_at')

    with op.batch_alter_table('medical_document', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_medical_document_series_id'))
        batch_op.drop_index(batch_op.f('ix_medical_document_deleted_at'))
        batch_op.drop_column('deleted_by_user_id')
        batch_op.drop_column('deleted_at')
        batch_op.drop_column('superseded_at')
        batch_op.drop_column('is_current')
        batch_op.drop_column('file_version')
        batch_op.drop_column('series_id')

    with op.batch_alter_table('record_version', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_record_version_series_id'))
        batch_op.drop_index(batch_op.f('ix_record_version_patient_id'))
        batch_op.drop_index(batch_op.f('ix_record_version_at'))

    op.drop_table('record_version')
