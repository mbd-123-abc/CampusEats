"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('user_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('username', sa.String(30), unique=True, nullable=False),
        sa.Column('password_hash', sa.Text, nullable=False),
        sa.Column('university', sa.String(100), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('failed_login_attempts', sa.Integer, nullable=False, server_default='0'),
        sa.Column('locked_until', sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_table(
        'user_preferences',
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('hard_filters', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('preference_filters', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('nutrient_focus', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('likes', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('dislikes', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('pantry_items', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('academic_intensity', sa.String(10), nullable=False, server_default='chill'),
        sa.Column('walking_speed', sa.String(10), nullable=False, server_default='average'),
        sa.Column('meal_plan_type', sa.String(20), nullable=False, server_default='unlimited'),
        sa.Column('dislike_strictness', sa.String(10), nullable=False, server_default='low'),
        sa.Column('show_calories', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'meal_logs',
        sa.Column('log_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('logged_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('items', sa.ARRAY(sa.Text), nullable=False),
        sa.Column('item_portions', JSONB, nullable=False, server_default='[]'),
        sa.Column('portion_size', sa.Numeric(3, 1), nullable=True),
        sa.Column('portion_count', sa.Integer, nullable=True),
        sa.Column('nutrients_json', JSONB, nullable=False, server_default='[]'),
        sa.Column('inhibitors_detected', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('enhancers_detected', sa.ARRAY(sa.Text), nullable=False, server_default='{}'),
        sa.Column('meal_mood', sa.String(10), nullable=True),
        sa.Column('source', sa.String(20), nullable=False, server_default='manual_search'),
        sa.Column('accuracy_score', sa.Numeric(3, 2), nullable=False, server_default='0.60'),
    )

    # Note: dedup index omitted — timestamp-based expressions are not immutable in Postgres


def downgrade() -> None:
    op.drop_table('meal_logs')
    op.drop_table('user_preferences')
    op.drop_table('users')
