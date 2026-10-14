"""add note column to invoices table

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0011'
down_revision: Union[str, None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'note')