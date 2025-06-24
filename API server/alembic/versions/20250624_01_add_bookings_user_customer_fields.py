"""Add business_owner_id and customer_id fields to bookings table

Revision ID: 20250624_01_add_bookings_user_customer_fields
Revises: 20250623_01_add_security_tables
Create Date: 2025-06-24 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250624_01'
down_revision = '20250623_01'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем новые поля в таблицу bookings
    try:
        op.add_column('bookings', sa.Column('business_owner_id', sa.Integer(), nullable=True))
    except Exception:
        pass  # Колонка уже существует
    
    try:
        op.add_column('bookings', sa.Column('customer_id', sa.Integer(), nullable=True))
    except Exception:
        pass  # Колонка уже существует
    
    # Создаем внешние ключи для bookings (только если таблицы users и customers существуют)
    try:
        op.create_foreign_key('fk_bookings_business_owner', 'bookings', 'users', ['business_owner_id'], ['id'])
    except Exception:
        pass  # Таблица users не существует или ключ уже создан
    
    try:
        op.create_foreign_key('fk_bookings_customer', 'bookings', 'customers', ['customer_id'], ['id'])
    except Exception:
        pass  # Таблица customers не существует или ключ уже создан
    
    # Создаем индексы для новых полей в bookings
    try:
        op.create_index(op.f('ix_bookings_business_owner_id'), 'bookings', ['business_owner_id'], unique=False)
    except Exception:
        pass  # Индекс уже существует
    
    try:
        op.create_index(op.f('ix_bookings_customer_id'), 'bookings', ['customer_id'], unique=False)
    except Exception:
        pass  # Индекс уже существует
    
    # Делаем старые поля nullable для обратной совместимости
    try:
        op.alter_column('bookings', 'client_name', nullable=True)
    except Exception:
        pass  # Уже nullable
    
    try:
        op.alter_column('bookings', 'phone', nullable=True)
    except Exception:
        pass  # Уже nullable


def downgrade():
    # Возвращаем старые поля как NOT NULL
    try:
        op.alter_column('bookings', 'client_name', nullable=False)
    except Exception:
        pass
    
    try:
        op.alter_column('bookings', 'phone', nullable=False)
    except Exception:
        pass
    
    # Удаляем индексы из bookings
    try:
        op.drop_index(op.f('ix_bookings_customer_id'), table_name='bookings')
    except Exception:
        pass
    
    try:
        op.drop_index(op.f('ix_bookings_business_owner_id'), table_name='bookings')
    except Exception:
        pass
    
    # Удаляем внешние ключи из bookings
    try:
        op.drop_constraint('fk_bookings_customer', 'bookings', type_='foreignkey')
    except Exception:
        pass
    
    try:
        op.drop_constraint('fk_bookings_business_owner', 'bookings', type_='foreignkey')
    except Exception:
        pass
    
    # Удаляем новые колонки из bookings
    try:
        op.drop_column('bookings', 'customer_id')
    except Exception:
        pass
    
    try:
        op.drop_column('bookings', 'business_owner_id')
    except Exception:
        pass 