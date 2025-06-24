"""add avatar to clients

Revision ID: 20250621_01_add_avatar_to_clients
Revises: 20250620_02_add_password_hash_to_clients
Create Date: 2025-06-21 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250621_01'
down_revision = '20250620_02'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем поле avatar в таблицу clients
    op.add_column('clients', sa.Column('avatar', sa.String(length=500), nullable=True))


def downgrade():
    # Удаляем поле avatar из таблицы clients
    op.drop_column('clients', 'avatar') 