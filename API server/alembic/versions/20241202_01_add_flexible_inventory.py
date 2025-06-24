"""Add flexible inventory system

Revision ID: 20241202_01
Revises: 20241201_01
Create Date: 2024-12-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20241202_01'
down_revision = '20241201_01'
branch_labels = None
depends_on = None


def upgrade():
    # Создаем таблицу типов инвентаря
    op.create_table(
        'inventory_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon_name', sa.String(length=50), nullable=True),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('affects_availability', sa.Boolean(), nullable=False, default=True),
        sa.Column('board_equivalent', sa.DECIMAL(3,2), nullable=False, default=1.0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('settings', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inventory_types_id'), 'inventory_types', ['id'], unique=False)
    op.create_index(op.f('ix_inventory_types_name'), 'inventory_types', ['name'], unique=True)
    op.create_index(op.f('ix_inventory_types_is_active'), 'inventory_types', ['is_active'], unique=False)

    # Создаем таблицу единиц инвентаря
    op.create_table(
        'inventory_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inventory_type_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, default='available'),
        sa.Column('current_booking_id', sa.String(), nullable=True),
        sa.Column('last_service_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('serial_number', sa.String(length=50), nullable=True),
        sa.Column('purchase_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('condition', sa.String(length=20), nullable=False, default='good'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('item_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['inventory_type_id'], ['inventory_types.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inventory_items_id'), 'inventory_items', ['id'], unique=False)
    op.create_index(op.f('ix_inventory_items_status'), 'inventory_items', ['status'], unique=False)
    op.create_index(op.f('ix_inventory_items_inventory_type_id'), 'inventory_items', ['inventory_type_id'], unique=False)
    op.create_index(op.f('ix_inventory_items_is_active'), 'inventory_items', ['is_active'], unique=False)
    op.create_index(op.f('ix_inventory_items_condition'), 'inventory_items', ['condition'], unique=False)

    # Добавляем базовые типы инвентаря
    op.execute("""
        INSERT INTO inventory_types (name, display_name, description, icon_name, color, is_active, affects_availability, board_equivalent, created_at, updated_at) VALUES
        ('SUP доска', 'SUP доска', 'Доска для SUP серфинга', '🏄‍♂️', '#007AFF', true, true, 1.0, NOW(), NOW()),
        ('Каяк', 'Каяк', 'Одноместный каяк', '🪑', '#52C41A', true, true, 1.0, NOW(), NOW()),
        ('Плот', 'Плот', 'Многоместный плот', '🛟', '#FFB300', true, true, 2.0, NOW(), NOW()),
        ('Спасательный жилет', 'Спасательный жилет', 'Спасательный жилет для водных видов спорта', '🦺', '#FF0000', true, false, 0.0, NOW(), NOW()),
        ('Весло', 'Весло', 'Весло для SUP/каяка', '🪥', '#0000FF', true, false, 0.0, NOW(), NOW()),
        ('Гермосумка', 'Гермосумка', 'Водонепроницаемая сумка', '👕', '#00FF00', true, false, 0.0, NOW(), NOW())
    """)

    # Добавляем инвентарь по умолчанию (12 SUP досок)
    op.execute("""
        INSERT INTO inventory_items (inventory_type_id, name, status, condition, is_active, created_at, updated_at)
        SELECT 
            (SELECT id FROM inventory_types WHERE name = 'SUP доска'),
            'SUP доска #' || generate_series,
            'available',
            'good',
            true,
            NOW(),
            NOW()
        FROM generate_series(1, 12)
    """)


def downgrade():
    # Удаляем таблицы в обратном порядке
    op.drop_index(op.f('ix_inventory_items_inventory_type_id'), table_name='inventory_items')
    op.drop_index(op.f('ix_inventory_items_status'), table_name='inventory_items')
    op.drop_index(op.f('ix_inventory_items_id'), table_name='inventory_items')
    op.drop_index(op.f('ix_inventory_items_is_active'), table_name='inventory_items')
    op.drop_index(op.f('ix_inventory_items_condition'), table_name='inventory_items')
    op.drop_table('inventory_items')
    
    op.drop_index(op.f('ix_inventory_types_is_active'), table_name='inventory_types')
    op.drop_index(op.f('ix_inventory_types_name'), table_name='inventory_types')
    op.drop_index(op.f('ix_inventory_types_id'), table_name='inventory_types')
    op.drop_table('inventory_types') 