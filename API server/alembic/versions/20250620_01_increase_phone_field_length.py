"""increase phone field length

Revision ID: 20250620_01
Revises: 20241202_02
Create Date: 2025-06-20 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250620_01'
down_revision = '20250101_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Увеличиваем размер поля phone с 20 до 32 символов
    op.alter_column('clients', 'phone',
                    existing_type=sa.VARCHAR(length=20),
                    type_=sa.VARCHAR(length=32),
                    existing_nullable=False)


def downgrade() -> None:
    # Возвращаем размер поля phone обратно к 20 символам
    op.alter_column('clients', 'phone',
                    existing_type=sa.VARCHAR(length=32),
                    type_=sa.VARCHAR(length=20),
                    existing_nullable=False)