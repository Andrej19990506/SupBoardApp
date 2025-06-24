"""add seats table

Revision ID: 20240610_06
Revises: 20240610_05
Create Date: 2024-06-10 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240610_06'
down_revision = '20240610_05'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'seats',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('status', sa.String(length=32), nullable=False, index=True, server_default='available'),
        sa.Column('current_booking_id', sa.String(), nullable=True),
        sa.Column('last_service_end', sa.DateTime(timezone=True), nullable=True),
    )

def downgrade():
    op.drop_table('seats') 