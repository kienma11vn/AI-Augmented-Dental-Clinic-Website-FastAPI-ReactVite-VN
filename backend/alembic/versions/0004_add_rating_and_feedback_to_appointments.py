"""add rating and feedback to appointments

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# Khai báo các biến revision cho Alembic
revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('appointments', sa.Column('rating', sa.Integer(), nullable=True))
    op.add_column('appointments', sa.Column('feedback', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('appointments', 'feedback')
    op.drop_column('appointments', 'rating')