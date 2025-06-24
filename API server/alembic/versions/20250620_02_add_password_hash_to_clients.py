"""add password_hash to clients

Revision ID: 20250620_02
Revises: 20250620_01
Create Date: 2025-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250620_02'
down_revision = '20250620_01'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем поле password_hash в таблицу clients
    op.add_column('clients', sa.Column('password_hash', sa.String(255), nullable=True))


def downgrade():
    # Удаляем поле password_hash из таблицы clients
    op.drop_column('clients', 'password_hash') 