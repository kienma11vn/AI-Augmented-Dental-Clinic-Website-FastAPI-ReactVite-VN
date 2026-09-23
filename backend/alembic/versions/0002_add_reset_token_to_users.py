"""add reset token to users

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('reset_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('reset_token_expires_at', sa.DateTime(timezone=True), nullable=True))

def downgrade():
    op.drop_column('users', 'reset_token_expires_at')
    op.drop_column('users', 'reset_token')