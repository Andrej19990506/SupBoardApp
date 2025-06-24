"""add role column to group_members

Revision ID: 20240610_02
Revises: 20240610_01
Create Date: 2024-06-10 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240610_02'
down_revision = '20240610_01'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('group_members', sa.Column('role', sa.String(), nullable=True))

def downgrade():
    op.drop_column('group_members', 'role') 