"""redesign extension tables (profile details, vitals, chats, invitations)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-11 00:06:26.394549
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables from the redesign extensions (contract §5b), which arrived without a migration.
    op.create_table('chat_session',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('chat_session', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_chat_session_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_chat_session_user_id'), ['user_id'], unique=False)

    op.create_table('invitation',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('relationship', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('scopes', sa.JSON(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('invited_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('consent_record_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('expires_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('responded_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('accepted_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['invited_by_user_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('invitation', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_invitation_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_invitation_patient_id'), ['patient_id'], unique=False)

    op.create_table('profile_details',
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('relationship', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('date_of_birth', sa.Date(), nullable=True),
    sa.Column('sex', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('blood_group', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('height_cm', sa.Float(), nullable=True),
    sa.Column('emergency_contacts', sa.JSON(), nullable=False),
    sa.Column('allergies_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('conditions_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('medications_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('organ_donor', sa.Boolean(), nullable=True),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('updated_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.PrimaryKeyConstraint('patient_id')
    )
    op.create_table('vital_reading',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('patient_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('value', sa.Float(), nullable=False),
    sa.Column('value2', sa.Float(), nullable=True),
    sa.Column('unit', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('context', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('measured_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('created_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['patient_id'], ['patient_profile.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('vital_reading', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_vital_reading_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index('ix_vital_reading_patient_kind_time', ['patient_id', 'kind', 'measured_at'], unique=False)

    op.create_table('chat_message',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('chat_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('text', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('input_mode', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('document_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('ai_output_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['chat_id'], ['chat_session.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('chat_message', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_chat_message_chat_id'), ['chat_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('chat_message', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_chat_message_chat_id'))

    op.drop_table('chat_message')
    with op.batch_alter_table('vital_reading', schema=None) as batch_op:
        batch_op.drop_index('ix_vital_reading_patient_kind_time')
        batch_op.drop_index(batch_op.f('ix_vital_reading_patient_id'))

    op.drop_table('vital_reading')
    op.drop_table('profile_details')
    with op.batch_alter_table('invitation', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_invitation_patient_id'))
        batch_op.drop_index(batch_op.f('ix_invitation_email'))

    op.drop_table('invitation')
    with op.batch_alter_table('chat_session', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_chat_session_user_id'))
        batch_op.drop_index(batch_op.f('ix_chat_session_patient_id'))

    op.drop_table('chat_session')
