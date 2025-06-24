"""add client_id to bookings

Revision ID: 20240610_09
Revises: 20240610_08
Create Date: 2024-06-10 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20240610_09'
down_revision = '20240610_08'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем поле client_id в таблицу bookings
    op.add_column('bookings', sa.Column('client_id', sa.Integer(), nullable=True))
    
    # Создаем индекс для client_id
    op.create_index(op.f('ix_bookings_client_id'), 'bookings', ['client_id'], unique=False)
    
    # Создаем внешний ключ
    op.create_foreign_key(
        'fk_bookings_client_id', 
        'bookings', 
        'clients', 
        ['client_id'], 
        ['id']
    )


def downgrade():
    # Удаляем внешний ключ
    op.drop_constraint('fk_bookings_client_id', 'bookings', type_='foreignkey')
    
    # Удаляем индекс
    op.drop_index(op.f('ix_bookings_client_id'), table_name='bookings')
    
    # Удаляем поле
    op.drop_column('bookings', 'client_id') 