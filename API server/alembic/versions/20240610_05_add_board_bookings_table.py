# alembic/versions/20240610_04_add_board_bookings_table.py

from alembic import op
import sqlalchemy as sa

revision = '20240610_05'
down_revision = '20240610_04'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'board_bookings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('board_id', sa.Integer(), sa.ForeignKey('boards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('booking_id', sa.Integer(), sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False),
    )

def downgrade():
    op.drop_table('board_bookings')