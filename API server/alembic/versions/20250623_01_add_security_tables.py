"""Add security tables and update clients

Revision ID: 20250623_01_add_security_tables
Revises: 20250621_01_add_avatar_to_clients
Create Date: 2025-06-23 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250623_01'
down_revision = '20250621_01'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем новые поля безопасности в таблицу clients
    op.add_column('clients', sa.Column('is_active', sa.Boolean(), nullable=True, default=True))
    op.add_column('clients', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clients', sa.Column('last_login_ip', sa.String(length=45), nullable=True))
    op.add_column('clients', sa.Column('last_login_user_agent', sa.Text(), nullable=True))
    op.add_column('clients', sa.Column('device_fingerprint', sa.String(length=255), nullable=True))
    op.add_column('clients', sa.Column('failed_login_attempts', sa.Integer(), nullable=True, default=0))
    op.add_column('clients', sa.Column('last_failed_login_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clients', sa.Column('sms_requests_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('clients', sa.Column('last_sms_request_at', sa.DateTime(timezone=True), nullable=True))
    
    # Устанавливаем значения по умолчанию для существующих записей
    op.execute("UPDATE clients SET is_active = true WHERE is_active IS NULL")
    op.execute("UPDATE clients SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL")
    op.execute("UPDATE clients SET sms_requests_count = 0 WHERE sms_requests_count IS NULL")
    
    # Делаем поля NOT NULL после установки значений по умолчанию
    op.alter_column('clients', 'is_active', nullable=False)
    op.alter_column('clients', 'failed_login_attempts', nullable=False)
    op.alter_column('clients', 'sms_requests_count', nullable=False, server_default='0')

    # Создаем таблицу device_sessions
    op.create_table('device_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('device_fingerprint', sa.String(length=255), nullable=False),
        sa.Column('refresh_token_hash', sa.String(length=255), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('browser_name', sa.String(length=100), nullable=True),
        sa.Column('os_name', sa.String(length=100), nullable=True),
        sa.Column('device_type', sa.String(length=50), nullable=True),
        sa.Column('country', sa.String(length=2), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_device_sessions_client_active', 'device_sessions', ['client_id', 'is_active'])
    op.create_index('idx_device_sessions_device_active', 'device_sessions', ['device_fingerprint', 'is_active'])
    op.create_index('idx_device_sessions_expires', 'device_sessions', ['expires_at'])
    op.create_index(op.f('ix_device_sessions_client_id'), 'device_sessions', ['client_id'])
    op.create_index(op.f('ix_device_sessions_device_fingerprint'), 'device_sessions', ['device_fingerprint'])
    op.create_index(op.f('ix_device_sessions_id'), 'device_sessions', ['id'])
    op.create_unique_constraint(None, 'device_sessions', ['refresh_token_hash'])

    # Создаем таблицу rate_limit_entries
    op.create_table('rate_limit_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('limit_key', sa.String(length=100), nullable=False),
        sa.Column('limit_type', sa.String(length=20), nullable=False),
        sa.Column('requests_count', sa.Integer(), nullable=True, default=1),
        sa.Column('window_start', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_request_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_rate_limit_key_type', 'rate_limit_entries', ['limit_key', 'limit_type'])
    op.create_index('idx_rate_limit_window', 'rate_limit_entries', ['window_start'])
    op.create_index(op.f('ix_rate_limit_entries_id'), 'rate_limit_entries', ['id'])
    op.create_index(op.f('ix_rate_limit_entries_limit_key'), 'rate_limit_entries', ['limit_key'])

    # Создаем таблицу blocked_ips
    op.create_table('blocked_ips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('violation_count', sa.Integer(), nullable=True, default=1),
        sa.Column('blocked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('country', sa.String(length=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_blocked_ips_active', 'blocked_ips', ['ip_address', 'is_active'])
    op.create_index('idx_blocked_ips_expires', 'blocked_ips', ['expires_at'])
    op.create_index(op.f('ix_blocked_ips_id'), 'blocked_ips', ['id'])
    op.create_index(op.f('ix_blocked_ips_ip_address'), 'blocked_ips', ['ip_address'])
    op.create_unique_constraint(None, 'blocked_ips', ['ip_address'])

    # Создаем таблицу security_logs
    op.create_table('security_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('device_fingerprint', sa.String(length=255), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('additional_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_security_logs_client_time', 'security_logs', ['client_id', 'created_at'])
    op.create_index('idx_security_logs_ip_time', 'security_logs', ['ip_address', 'created_at'])
    op.create_index('idx_security_logs_severity', 'security_logs', ['severity', 'created_at'])
    op.create_index('idx_security_logs_type_time', 'security_logs', ['event_type', 'created_at'])
    op.create_index(op.f('ix_security_logs_client_id'), 'security_logs', ['client_id'])
    op.create_index(op.f('ix_security_logs_created_at'), 'security_logs', ['created_at'])
    op.create_index(op.f('ix_security_logs_event_type'), 'security_logs', ['event_type'])
    op.create_index(op.f('ix_security_logs_id'), 'security_logs', ['id'])
    op.create_index(op.f('ix_security_logs_ip_address'), 'security_logs', ['ip_address'])


def downgrade():
    # Удаляем таблицы безопасности
    op.drop_table('security_logs')
    op.drop_table('blocked_ips')
    op.drop_table('rate_limit_entries')
    op.drop_table('device_sessions')

    # Удаляем добавленные поля из таблицы clients
    op.drop_column('clients', 'last_sms_request_at')
    op.drop_column('clients', 'sms_requests_count')
    op.drop_column('clients', 'last_failed_login_at')
    op.drop_column('clients', 'failed_login_attempts')
    op.drop_column('clients', 'device_fingerprint')
    op.drop_column('clients', 'last_login_user_agent')
    op.drop_column('clients', 'last_login_ip')
    op.drop_column('clients', 'last_login_at')
    op.drop_column('clients', 'is_active') 