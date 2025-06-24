"""add client statistics counters

Revision ID: 20240610_10
Revises: 20240610_09
Create Date: 2024-06-10 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240610_10'
down_revision = '20240610_09'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем поля-счетчики для резервного хранения статистики клиента
    op.add_column('clients', sa.Column('total_bookings_count', sa.Integer(), nullable=False, server_default='0', comment='Общее количество бронирований (резервный счетчик)'))
    op.add_column('clients', sa.Column('completed_bookings_count', sa.Integer(), nullable=False, server_default='0', comment='Количество завершенных бронирований (резервный счетчик)'))
    op.add_column('clients', sa.Column('cancelled_bookings_count', sa.Integer(), nullable=False, server_default='0', comment='Количество отмененных бронирований (резервный счетчик)'))
    op.add_column('clients', sa.Column('total_revenue', sa.Numeric(10, 2), nullable=False, server_default='0.00', comment='Общая сумма доходов от клиента (резервный счетчик)'))
    op.add_column('clients', sa.Column('last_booking_date', sa.DateTime(timezone=True), nullable=True, comment='Дата последнего бронирования (резервный счетчик)'))
    op.add_column('clients', sa.Column('first_booking_date', sa.DateTime(timezone=True), nullable=True, comment='Дата первого бронирования (резервный счетчик)'))
    
    # Создаем индексы для быстрого поиска
    op.create_index('ix_clients_total_bookings_count', 'clients', ['total_bookings_count'])
    op.create_index('ix_clients_completed_bookings_count', 'clients', ['completed_bookings_count'])
    op.create_index('ix_clients_last_booking_date', 'clients', ['last_booking_date'])


def downgrade():
    # Удаляем индексы
    op.drop_index('ix_clients_last_booking_date', table_name='clients')
    op.drop_index('ix_clients_completed_bookings_count', table_name='clients')
    op.drop_index('ix_clients_total_bookings_count', table_name='clients')
    
    # Удаляем поля
    op.drop_column('clients', 'first_booking_date')
    op.drop_column('clients', 'last_booking_date')
    op.drop_column('clients', 'total_revenue')
    op.drop_column('clients', 'cancelled_bookings_count')
    op.drop_column('clients', 'completed_bookings_count')
    op.drop_column('clients', 'total_bookings_count') 