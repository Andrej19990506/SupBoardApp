"""add bookings table

Revision ID: 20240610_04
Revises: 20240610_03
Create Date: 2024-06-10 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20240610_04'
down_revision = '20240610_03'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'bookings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('client_name', sa.String(length=128), nullable=False),
        sa.Column('phone', sa.String(length=32), nullable=False),
        sa.Column('planned_start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('service_type', sa.String(length=32), nullable=False),
        sa.Column('board_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('board_with_seat_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('raft_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duration_in_hours', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='booked'),
        sa.Column('actual_start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('time_returned_by_client', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_index('ix_bookings_id', table_name='bookings')
    op.drop_table('bookings')