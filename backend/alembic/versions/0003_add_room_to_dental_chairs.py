"""add room to dental_chairs

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# Khai báo các biến revision bắt buộc cho Alembic
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('dental_chairs', sa.Column('room', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('dental_chairs', 'room')