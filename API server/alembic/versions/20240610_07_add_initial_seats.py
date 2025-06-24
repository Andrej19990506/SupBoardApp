"""add initial seats

Revision ID: 20240610_07
Revises: 20240610_06
Create Date: 2024-06-10 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = '20240610_07'
down_revision = '20240610_06'
branch_labels = None
depends_on = None

def upgrade():
    # Создаем объект таблицы для вставки данных
    seats_table = table(
        'seats',
        column('id', sa.Integer),
        column('status', sa.String),
        column('current_booking_id', sa.String),
        column('last_service_end', sa.DateTime),
    )
    
    # Добавляем 10 кресел со статусом 'available'
    seat_data = [
        {'id': i, 'status': 'available', 'current_booking_id': None, 'last_service_end': None}
        for i in range(1, 11)
    ]
    
    op.bulk_insert(seats_table, seat_data)

def downgrade():
    # Удаляем все кресла с id от 1 до 10
    op.execute("DELETE FROM seats WHERE id BETWEEN 1 AND 10") 