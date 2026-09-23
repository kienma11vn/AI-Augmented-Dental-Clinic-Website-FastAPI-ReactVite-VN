"""add discount and payment method fields to invoices

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# Khai báo các biến revision cho Alembic
revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('final_amount', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('discount_code', sa.String(length=50), nullable=True))
    op.add_column('invoices', sa.Column('discount_reason', sa.Text(), nullable=True))
    op.add_column('invoices', sa.Column('payment_method', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'payment_method')
    op.drop_column('invoices', 'discount_reason')
    op.drop_column('invoices', 'discount_code')
    op.drop_column('invoices', 'final_amount')
    op.drop_column('invoices', 'discount_rate')
    op.drop_column('invoices', 'discount_amount')