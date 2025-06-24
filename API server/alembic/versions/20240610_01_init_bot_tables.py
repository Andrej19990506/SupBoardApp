"""init bot tables

Revision ID: 20240610_01
Revises: 
Create Date: 2024-06-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20240610_01'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Таблица members
    op.create_table(
        'members',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, unique=True),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('first_name', sa.String(length=255), nullable=True),
        sa.Column('last_name', sa.String(length=255), nullable=True),
        sa.Column('is_bot', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('photo_url', sa.String(), nullable=True),
        sa.Column('metadata', postgresql.JSON(), nullable=True),
        sa.UniqueConstraint('user_id', name='uq_member_user_id')
    )
    op.create_index('ix_members_user_id', 'members', ['user_id'], unique=True)
    op.create_index('ix_members_id', 'members', ['id'], unique=False)

    # Таблица groups
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('group_id', sa.BigInteger(), nullable=False, unique=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('group_type', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('members_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('metadata', postgresql.JSON(), nullable=True),
        sa.UniqueConstraint('group_id', name='uq_group_group_id')
    )
    op.create_index('ix_group_type', 'groups', ['group_type'])

    # Таблица group_members
    op.create_table(
        'group_members',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('member_id', sa.Integer(), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint('group_id', 'member_id', name='uq_group_member')
    )
    op.create_index('ix_group_members_group_id', 'group_members', ['group_id'])
    op.create_index('ix_group_members_member_id', 'group_members', ['member_id'])
    op.create_index('ix_group_members_id', 'group_members', ['id'])

    # Таблица scheduler_tasks (примерная структура)
    op.create_table(
        'scheduler_tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('task_name', sa.String(length=255), nullable=False),
        sa.Column('payload', postgresql.JSON(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        'group_activation_passwords',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('password', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )

def downgrade():
    op.drop_table('scheduler_tasks')
    op.drop_index('ix_group_members_id', table_name='group_members')
    op.drop_index('ix_group_members_member_id', table_name='group_members')
    op.drop_index('ix_group_members_group_id', table_name='group_members')
    op.drop_table('group_members')
    op.drop_index('ix_group_type', table_name='groups')
    op.drop_table('groups')
    op.drop_index('ix_members_id', table_name='members')
    op.drop_index('ix_members_user_id', table_name='members')
    op.drop_table('members')
    op.drop_table('group_activation_passwords')