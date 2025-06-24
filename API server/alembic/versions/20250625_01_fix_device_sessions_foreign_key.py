"""fix device_sessions foreign key

Revision ID: 20250625_01
Revises: 20250624_01
Create Date: 2025-06-25 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250625_01'
down_revision = '20250624_01'
branch_labels = None
depends_on = None


def upgrade():
    # Переименовываем колонку client_id в user_id
    op.alter_column('device_sessions', 'client_id', new_column_name='user_id')
    
    # Создаем новый foreign key constraint на users.id
    op.create_foreign_key('device_sessions_user_id_fkey', 'device_sessions', 'users', ['user_id'], ['id'])
    
    # Обновляем индексы
    op.drop_index('ix_device_sessions_client_id', 'device_sessions')
    op.create_index('ix_device_sessions_user_id', 'device_sessions', ['user_id'])
    
    # Обновляем составные индексы
    op.drop_index('idx_device_sessions_client_active', 'device_sessions')
    op.create_index('idx_device_sessions_user_active', 'device_sessions', ['user_id', 'is_active'])


def downgrade():
    # Откатываем изменения в обратном порядке
    op.drop_index('idx_device_sessions_user_active', 'device_sessions')
    op.create_index('idx_device_sessions_client_active', 'device_sessions', ['client_id', 'is_active'])
    
    op.drop_index('ix_device_sessions_user_id', 'device_sessions')
    op.create_index('ix_device_sessions_client_id', 'device_sessions', ['client_id'])
    
    op.drop_constraint('device_sessions_user_id_fkey', 'device_sessions', type_='foreignkey')
    
    op.alter_column('device_sessions', 'user_id', new_column_name='client_id') 