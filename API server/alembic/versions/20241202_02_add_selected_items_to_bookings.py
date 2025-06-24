"""add selected_items to bookings

Revision ID: 20241202_02
Revises: 20241202_01
Create Date: 2024-12-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20241202_02'
down_revision = '20241202_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле selected_items как JSON для хранения данных новой системы инвентаря
    op.add_column('bookings', sa.Column('selected_items', sa.JSON(), nullable=True))
    
    # Создаем индекс для быстрого поиска по содержимому JSON (PostgreSQL specific)
    # op.create_index('ix_bookings_selected_items', 'bookings', ['selected_items'], postgresql_using='gin')


def downgrade() -> None:
    # Удаляем индекс
    # op.drop_index('ix_bookings_selected_items', table_name='bookings')
    
    # Удаляем поле selected_items
    op.drop_column('bookings', 'selected_items') 