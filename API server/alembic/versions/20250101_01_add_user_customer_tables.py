"""Add user and customer tables

Revision ID: 20250101_01_add_user_customer_tables
Revises: 20250620_02_add_password_hash_to_clients
Create Date: 2025-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250101_01'
down_revision = '20241202_02'
branch_labels = None
depends_on = None


def upgrade():
    # Создаем таблицу users (бизнесмены) если она не существует
    try:
        op.create_table('users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('phone', sa.String(length=32), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=True),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('avatar', sa.String(length=500), nullable=True),
            
            # Бизнес информация
            sa.Column('business_name', sa.String(length=255), nullable=True),
            sa.Column('business_description', sa.Text(), nullable=True),
            sa.Column('business_address', sa.String(length=500), nullable=True),
            sa.Column('business_phone', sa.String(length=32), nullable=True),
            
            # Поля безопасности и авторизации
            sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
            sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_login_ip', sa.String(length=45), nullable=True),
            sa.Column('last_login_user_agent', sa.Text(), nullable=True),
            sa.Column('device_fingerprint', sa.String(length=255), nullable=True),
            sa.Column('failed_login_attempts', sa.Integer(), nullable=False, default=0),
            sa.Column('sms_requests_count', sa.Integer(), nullable=False, default=0),
            
            # Метаданные
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            
            sa.PrimaryKeyConstraint('id')
        )
        
        # Индексы для таблицы users
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
        op.create_index(op.f('ix_users_name'), 'users', ['name'], unique=False)
        op.create_index(op.f('ix_users_phone'), 'users', ['phone'], unique=True)
    except Exception:
        pass  # Таблица уже существует
    
    # Создаем таблицу customers (клиенты бизнесменов) если она не существует
    try:
        op.create_table('customers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('phone', sa.String(length=32), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=True),
            
            # Связь с бизнесменом
            sa.Column('business_owner_id', sa.Integer(), nullable=False),
            
            # Статистика клиента
            sa.Column('total_bookings_count', sa.Integer(), nullable=False, default=0),
            sa.Column('total_spent', sa.Integer(), nullable=False, default=0),
            
            # Дополнительная информация
            sa.Column('notes', sa.Text(), nullable=True),
            
            # Метаданные
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['business_owner_id'], ['users.id'], )
        )
        
        # Индексы для таблицы customers
        op.create_index(op.f('ix_customers_id'), 'customers', ['id'], unique=False)
        op.create_index(op.f('ix_customers_name'), 'customers', ['name'], unique=False)
        op.create_index(op.f('ix_customers_phone'), 'customers', ['phone'], unique=False)
        op.create_index(op.f('ix_customers_business_owner_id'), 'customers', ['business_owner_id'], unique=False)
    except Exception:
        pass  # Таблица уже существует


def downgrade():
    # Удаляем таблицу customers
    op.drop_index(op.f('ix_customers_business_owner_id'), table_name='customers')
    op.drop_index(op.f('ix_customers_phone'), table_name='customers')
    op.drop_index(op.f('ix_customers_name'), table_name='customers')
    op.drop_index(op.f('ix_customers_id'), table_name='customers')
    op.drop_table('customers')
    
    # Удаляем таблицу users
    op.drop_index(op.f('ix_users_phone'), table_name='users')
    op.drop_index(op.f('ix_users_name'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users') 