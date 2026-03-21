"""Add schedule column to venue_status

Revision ID: 003
Revises: 002
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add always_available and date columns that were missing from 002
    with op.batch_alter_table('menu_items') as batch_op:
        batch_op.add_column(sa.Column('always_available', sa.Boolean, nullable=False, server_default='false'))
        batch_op.alter_column('date', nullable=True)

    # Add schedule JSON column to venue_status
    # schedule shape: { "mon": {"open": "07:30", "close": "20:00"} | null, ... }
    # null means closed that day
    with op.batch_alter_table('venue_status') as batch_op:
        batch_op.add_column(sa.Column('schedule', JSONB, nullable=True))
        batch_op.add_column(sa.Column('override_open', sa.Boolean, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('venue_status') as batch_op:
        batch_op.drop_column('override_open')
        batch_op.drop_column('schedule')

    with op.batch_alter_table('menu_items') as batch_op:
        batch_op.drop_column('always_available')
