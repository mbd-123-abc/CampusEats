"""Add menu_items and venue_status tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'menu_items',
        sa.Column('item_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('venue', sa.String(100), nullable=False),
        sa.Column('meal_period', sa.String(20), nullable=False),
        sa.Column('date', sa.String(10), nullable=False),
        sa.Column('diet_tags', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('nutrients_json', JSONB, nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'venue_status',
        sa.Column('venue', sa.String(100), primary_key=True),
        sa.Column('is_open', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('venue_status')
    op.drop_table('menu_items')
