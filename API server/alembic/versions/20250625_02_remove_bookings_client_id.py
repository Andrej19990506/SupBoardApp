"""remove bookings client_id

Revision ID: 20250625_02
Revises: 20250625_01
Create Date: 2025-06-25 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '20250625_02'
down_revision = '20250625_01'
branch_labels = None
depends_on = None


def upgrade():
    # Получаем соединение для выполнения SQL запросов
    conn = op.get_bind()
    
    # Проверяем существование constraint перед удалением
    constraint_exists = conn.execute(
        text("""
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bookings_client_id_fkey' 
        AND table_name = 'bookings'
        """)
    ).fetchone()
    
    if constraint_exists:
        op.drop_constraint('bookings_client_id_fkey', 'bookings', type_='foreignkey')
    
    # Проверяем существование индекса перед удалением
    index_exists = conn.execute(
        text("""
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'ix_bookings_client_id' 
        AND tablename = 'bookings'
        """)
    ).fetchone()
    
    if index_exists:
        op.drop_index('ix_bookings_client_id', 'bookings')
    
    # Проверяем существование колонки перед удалением
    column_exists = conn.execute(
        text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'client_id'
        """)
    ).fetchone()
    
    if column_exists:
        op.drop_column('bookings', 'client_id')


def downgrade():
    # Восстанавливаем колонку client_id
    op.add_column('bookings', sa.Column('client_id', sa.Integer(), nullable=True))
    
    # Восстанавливаем индекс
    op.create_index('ix_bookings_client_id', 'bookings', ['client_id'])
    
    # Восстанавливаем foreign key constraint (если таблица clients существует)
    # op.create_foreign_key('bookings_client_id_fkey', 'bookings', 'clients', ['client_id'], ['id']) 