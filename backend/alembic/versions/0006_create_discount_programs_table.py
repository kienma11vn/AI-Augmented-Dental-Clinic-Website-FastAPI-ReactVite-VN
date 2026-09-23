"""create discount_programs table

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# Khai báo các biến revision cho Alembic
revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'discount_programs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), server_default='0', nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discount_programs_id'), 'discount_programs', ['id'], unique=False)
    op.create_index(op.f('ix_discount_programs_code'), 'discount_programs', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_discount_programs_code'), table_name='discount_programs')
    op.drop_index(op.f('ix_discount_programs_id'), table_name='discount_programs')
    op.drop_table('discount_programs')