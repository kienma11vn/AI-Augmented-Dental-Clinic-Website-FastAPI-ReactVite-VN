"""create chat_histories table

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0010'
down_revision: Union[str, None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chat_histories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=False),
        sa.Column('sender', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_histories_id'), 'chat_histories', ['id'], unique=False)
    op.create_index(op.f('ix_chat_histories_session_id'), 'chat_histories', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_chat_histories_session_id'), table_name='chat_histories')
    op.drop_index(op.f('ix_chat_histories_id'), table_name='chat_histories')
    op.drop_table('chat_histories')