import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/shared/services/api';

interface DeviceSession {
  id: string;
  device_fingerprint: string;
  device_info: {
    browser: string;
    os: string;
    device_type: string;
  };
  location: {
    country: string | null;
    city: string | null;
  };
  created_at: string;
  last_used_at: string;
  is_active: boolean;
  is_current?: boolean;
}

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActiveSessionsModal: React.FC<ActiveSessionsModalProps> = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoCleanupDays, setAutoCleanupDays] = useState(30);
  const [showSettings, setShowSettings] = useState(false);

  // Загрузка списка сессий
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await api.get<DeviceSession[]>('/v1/auth/device-sessions');
      setSessions(response.data);
    } catch (error) {
      console.error('Ошибка загрузки сессий:', error);
    } finally {
      setLoading(false);
    }
  };

  // Завершить конкретную сессию
  const terminateSession = async (sessionId: string) => {
    try {
      await api.delete(`/v1/auth/device-sessions/${sessionId}`);
      await fetchSessions(); // Обновляем список
    } catch (error) {
      console.error('Ошибка завершения сессии:', error);
    }
  };

  // Завершить все сессии кроме текущей
  const terminateAllOthers = async () => {
    try {
      await api.post('/v1/auth/device-sessions/close-others');
      await fetchSessions(); // Обновляем список
    } catch (error) {
      console.error('Ошибка завершения сессий:', error);
    }
  };

  // Обновить настройки автоудаления
  const updateAutoCleanup = async (days: number) => {
    try {
      await api.patch('/v1/auth/device-sessions/settings', { days });
      setAutoCleanupDays(days);
    } catch (error) {
      console.error('Ошибка обновления настроек:', error);
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Получение иконки устройства
  const getDeviceIcon = (deviceType: string, browser: string) => {
    if (deviceType === 'mobile') return '📱';
    if (deviceType === 'tablet') return '📱';
    if (browser.toLowerCase().includes('chrome')) return '🌐';
    if (browser.toLowerCase().includes('firefox')) return '🦊';
    if (browser.toLowerCase().includes('safari')) return '🧭';
    if (browser.toLowerCase().includes('edge')) return '🌐';
    return '💻';
  };

  // Загрузка при открытии модала
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <Modal
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3 }}
      >
        <Header>
          <Title>🔐 Активные сеансы</Title>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>

        <Content>
          {loading ? (
            <LoadingState>
              <LoadingSpinner />
              <LoadingText>Загрузка сеансов...</LoadingText>
            </LoadingState>
          ) : (
            <>
              {/* Заголовок с кнопкой завершения всех */}
              <SectionHeader>
                <SectionTitle>Устройства ({sessions.length})</SectionTitle>
                {sessions.length > 1 && (
                  <ActionButton 
                    onClick={terminateAllOthers}
                    variant="danger"
                  >
                    🚫 Завершить все кроме текущего
                  </ActionButton>
                )}
              </SectionHeader>

              {/* Список сессий */}
              <SessionsList>
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    isCurrent={session.is_current}
                  >
                    <SessionInfo>
                      <DeviceIcon>
                        {getDeviceIcon(session.device_info.device_type, session.device_info.browser)}
                      </DeviceIcon>
                      <SessionDetails>
                        <DeviceName>
                          {session.device_info.browser} на {session.device_info.os}
                          {session.is_current && <CurrentBadge>Текущий</CurrentBadge>}
                        </DeviceName>
                        <SessionMeta>
                          <MetaItem>📅 Создан: {formatDate(session.created_at)}</MetaItem>
                          <MetaItem>⏰ Активен: {formatDate(session.last_used_at)}</MetaItem>
                          {session.location.city && (
                            <MetaItem>📍 {session.location.city}, {session.location.country}</MetaItem>
                          )}
                        </SessionMeta>
                      </SessionDetails>
                    </SessionInfo>
                    
                    {!session.is_current && (
                      <SessionActions>
                        <ActionButton
                          onClick={() => terminateSession(session.id)}
                          variant="secondary"
                          size="small"
                        >
                          🗑️ Завершить
                        </ActionButton>
                      </SessionActions>
                    )}
                  </SessionCard>
                ))}
              </SessionsList>

              {/* Настройки автоудаления */}
              <SettingsSection>
                <SettingsToggle
                  onClick={() => setShowSettings(!showSettings)}
                  isOpen={showSettings}
                >
                  <SettingsIcon>⚙️</SettingsIcon>
                  <SettingsTitle>Настройки безопасности</SettingsTitle>
                  <ToggleIcon isOpen={showSettings}>▼</ToggleIcon>
                </SettingsToggle>

                <AnimatePresence>
                  {showSettings && (
                    <SettingsContent
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SettingItem>
                        <SettingLabel>
                          🗑️ Автоматическое удаление неактивных сеансов
                        </SettingLabel>
                        <SettingDescription>
                          Сеансы, которые не использовались указанное время, будут автоматически удалены
                        </SettingDescription>
                        <SettingControl>
                          <DaysInput
                            type="number"
                            min="1"
                            max="365"
                            value={autoCleanupDays}
                            onChange={(e) => setAutoCleanupDays(Number(e.target.value))}
                          />
                          <DaysLabel>дней</DaysLabel>
                          <SaveButton
                            onClick={() => updateAutoCleanup(autoCleanupDays)}
                          >
                            Сохранить
                          </SaveButton>
                        </SettingControl>
                      </SettingItem>
                    </SettingsContent>
                  )}
                </AnimatePresence>
              </SettingsSection>
            </>
          )}
        </Content>
      </Modal>
    </AnimatePresence>
  );
};

// Стили
const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Modal = styled(motion.div)`
  background: rgba(28, 28, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h2`
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #86868B;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }
`;

const Content = styled.div`
  padding: 24px;
  overflow-y: auto;
  flex: 1;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
`;

const LoadingSpinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.div`
  color: #86868B;
  font-size: 14px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin: 0;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger'; size?: 'small' | 'medium' }>`
  background: ${props => 
    props.variant === 'danger' ? 'rgba(255, 77, 79, 0.1)' :
    props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.1)' :
    'rgba(0, 122, 255, 0.1)'
  };
  border: 1px solid ${props => 
    props.variant === 'danger' ? 'rgba(255, 77, 79, 0.3)' :
    props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.2)' :
    'rgba(0, 122, 255, 0.3)'
  };
  color: ${props => 
    props.variant === 'danger' ? '#FF4D4F' :
    props.variant === 'secondary' ? '#fff' :
    '#007AFF'
  };
  padding: ${props => props.size === 'small' ? '6px 12px' : '8px 16px'};
  border-radius: 8px;
  font-size: ${props => props.size === 'small' ? '12px' : '14px'};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => 
      props.variant === 'danger' ? 'rgba(255, 77, 79, 0.2)' :
      props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.2)' :
      'rgba(0, 122, 255, 0.2)'
    };
    transform: translateY(-1px);
  }
`;

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
`;

const SessionCard = styled(motion.div)<{ isCurrent?: boolean }>`
  background: ${props => props.isCurrent ? 'rgba(0, 122, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${props => props.isCurrent ? 'rgba(0, 122, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.isCurrent ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)'};
  }
`;

const SessionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const DeviceIcon = styled.div`
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const SessionDetails = styled.div`
  flex: 1;
`;

const DeviceName = styled.div`
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CurrentBadge = styled.span`
  background: rgba(0, 122, 255, 0.2);
  color: #007AFF;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
`;

const SessionMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MetaItem = styled.div`
  color: #86868B;
  font-size: 12px;
`;

const SessionActions = styled.div`
  display: flex;
  gap: 8px;
`;

const SettingsSection = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 24px;
`;

const SettingsToggle = styled.button<{ isOpen: boolean }>`
  width: 100%;
  background: none;
  border: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const SettingsIcon = styled.span`
  font-size: 18px;
`;

const SettingsTitle = styled.span`
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  flex: 1;
  text-align: left;
`;

const ToggleIcon = styled.span<{ isOpen: boolean }>`
  color: #86868B;
  font-size: 12px;
  transition: transform 0.2s ease;
  transform: ${props => props.isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
`;

const SettingsContent = styled(motion.div)`
  overflow: hidden;
`;

const SettingItem = styled.div`
  padding: 16px 0;
`;

const SettingLabel = styled.div`
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
`;

const SettingDescription = styled.div`
  color: #86868B;
  font-size: 12px;
  margin-bottom: 12px;
  line-height: 1.4;
`;

const SettingControl = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DaysInput = styled.input`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  font-size: 14px;
  width: 80px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: #007AFF;
  }
`;

const DaysLabel = styled.span`
  color: #86868B;
  font-size: 14px;
`;

const SaveButton = styled.button`
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.3);
  color: #007AFF;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 122, 255, 0.2);
  }
`;

export default ActiveSessionsModal; 