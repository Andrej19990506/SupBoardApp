import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { getSavedAccounts, removeAccount, SavedAccount } from '../utils/savedAccountsUtils';
import { authService } from '../services/authService';
import AnimatedLogo from '../../../shared/components/AnimatedLogo';
import { useAppDispatch } from '../../booking/store/hooks';
import { setUser } from '../store/authSlice';

interface SavedAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowLoginForm: () => void;
}

interface AccountTrustStatus {
  [accountId: string]: {
    trusted: boolean;
    loading: boolean;
    reason: string;
    message: string;
    device_info?: any;
  };
}

interface LoginButtonProps {
  trusted?: boolean;
  disabled?: boolean;
}

const SavedAccountsModal: React.FC<SavedAccountsModalProps> = ({ 
  isOpen, 
  onClose, 
  onShowLoginForm 
}) => {
  const dispatch = useAppDispatch();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [trustStatus, setTrustStatus] = useState<AccountTrustStatus>({});
  const [loginLoading, setLoginLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSavedAccounts();
    }
  }, [isOpen]);

  const loadSavedAccounts = async () => {
    const accounts = getSavedAccounts();
    setSavedAccounts(accounts);
    
    // 🔍 ПРОВЕРЯЕМ DEVICE TRUST для каждого аккаунта
    console.log('🔍 Проверяем Device Trust для сохраненных аккаунтов...');
    
    for (const account of accounts) {
      // Устанавливаем состояние загрузки
      setTrustStatus(prev => ({
        ...prev,
        [account.id]: {
          trusted: false,
          loading: true,
          reason: 'checking',
          message: 'Проверяем устройство...'
        }
      }));
      
      try {
        const trustResult = await authService.checkDeviceTrust(account.phone);
        
        setTrustStatus(prev => ({
          ...prev,
          [account.id]: {
            trusted: trustResult.trusted,
            loading: false,
            reason: trustResult.reason,
            message: trustResult.message,
            device_info: trustResult.device_info
          }
        }));
        
        console.log(`🔍 Device Trust для ${account.name}: ${trustResult.trusted ? '✅ Доверенное' : '❌ Требует SMS'}`);
      } catch (error) {
        console.error(`❌ Ошибка проверки Device Trust для ${account.name}:`, error);
        
        setTrustStatus(prev => ({
          ...prev,
          [account.id]: {
            trusted: false,
            loading: false,
            reason: 'error',
            message: 'Ошибка проверки'
          }
        }));
      }
    }
  };

  const handleAccountSelect = async (account: SavedAccount) => {
    try {
      console.log('🔐 Выбран сохраненный аккаунт:', account);
      
      const status = trustStatus[account.id];
      
      if (!status) {
        console.error('❌ Статус доверия не найден для аккаунта');
        return;
      }
      
      if (status.trusted) {
        // 🚀 АВТОМАТИЧЕСКИЙ ВХОД для доверенного устройства
        console.log('🚀 Доверенное устройство - автоматический вход');
        setLoginLoading(account.id);
        
        try {
          const authData = await authService.autoLogin(account.phone);
          console.log('✅ Успешный автоматический вход:', authData);
          
          // Обновляем Redux состояние
          dispatch(setUser(authData.user));
          
          // Закрываем модал
          onClose();
          
          // Показываем уведомление об успешном входе
          console.log('🎉 Автоматический вход выполнен успешно!');
          
        } catch (autoLoginError) {
          console.error('❌ Ошибка автоматического входа:', autoLoginError);
          
          // Если автоматический вход не удался, переключаемся на SMS код
          handleSMSLogin(account);
        } finally {
          setLoginLoading(null);
        }
      } else {
        // 📱 ТРЕБУЕТСЯ SMS КОД для нового/недоверенного устройства
        handleSMSLogin(account);
      }
      
    } catch (error) {
      console.error('❌ Ошибка при выборе аккаунта:', error);
      setLoginLoading(null);
    }
  };

  const handleSMSLogin = (account: SavedAccount) => {
    console.log('📱 Требуется SMS код для входа:', account);
    
    // Закрываем модал сохраненных аккаунтов
    onClose();
    
    // Отправляем событие для предзаполнения номера телефона в форме входа
    const event = new CustomEvent('selectSavedAccountPhone', { 
      detail: { 
        phone: account.phone, 
        name: account.name,
        message: 'Подтвердите вход с помощью SMS кода для безопасности' 
      } 
    });
    window.dispatchEvent(event);
    
    onShowLoginForm();
  };

  const handleRemoveAccount = (accountId: string) => {
    removeAccount(accountId);
    setSavedAccounts(savedAccounts.filter(acc => acc.id !== accountId));
    
    // Удаляем статус доверия
    setTrustStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[accountId];
      return newStatus;
    });
    
    console.log('🗑️ Аккаунт удален из сохраненных');
  };

  const formatPhoneDisplay = (phone: string) => {
    // Форматируем телефон для отображения: +7 ••• •• •• 01
    if (phone.length >= 11) {
      return `${phone.slice(0, 2)} ••• •• •• ${phone.slice(-2)}`;
    }
    return phone;
  };

  const getFullAvatarUrl = (avatarUrl: string | null): string | null => {
    if (!avatarUrl) return null;
    
    // Если URL уже полный, возвращаем как есть
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    // Если это относительный путь, добавляем базовый URL API
    const baseUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000';
    return `${baseUrl}${avatarUrl}`;
  };

  const getTrustStatusIcon = (status: any) => {
    if (status.loading) return '⏳';
    if (status.trusted) return '🚀';
    return '🔒';
  };

  const getTrustStatusText = (status: any) => {
    if (status.loading) return 'Проверяем...';
    if (status.trusted) return 'Быстрый вход';
    return 'Требует SMS';
  };

  const getTrustStatusColor = (status: any) => {
    if (status.loading) return '#007AFF';
    if (status.trusted) return '#34C759';
    return '#FF9500';
  };

  if (!isOpen) return null;

  return (
    <AuthContainer onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <Header>
          <LogoContainer>
            <AnimatedLogo size="small" />
          </LogoContainer>
          
          <Title>Вход в SubBoard</Title>
          <Subtitle>Выберите аккаунт для входа</Subtitle>
        </Header>

        <AccountsList>
          <AnimatePresence>
            {savedAccounts.map((account, index) => {
              const status = trustStatus[account.id];
              const isLoading = loginLoading === account.id;
              
              return (
                <AccountCard
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  onClick={() => handleAccountSelect(account)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <AccountAvatar>
                    {account.avatar ? (
                      <AvatarImage 
                        src={getFullAvatarUrl(account.avatar) || account.avatar} 
                        alt={account.name}
                        onError={(e) => {
                          // Если изображение не загрузилось, показываем placeholder
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder) {
                            placeholder.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <AvatarPlaceholder style={{ display: account.avatar ? 'none' : 'flex' }}>
                      {account.name.charAt(0).toUpperCase()}
                    </AvatarPlaceholder>
                  </AccountAvatar>
                  
                  <AccountInfo>
                    <AccountName>{account.name}</AccountName>
                    <AccountPhone>{formatPhoneDisplay(account.phone)}</AccountPhone>
                    {account.lastLogin && (
                      <LastLogin>Последний вход: {new Date(account.lastLogin).toLocaleDateString('ru-RU')}</LastLogin>
                    )}
                  </AccountInfo>
                  
                  <AccountStatus>
                    {status && (
                      <StatusIndicator color={getTrustStatusColor(status)}>
                        <StatusIcon>{getTrustStatusIcon(status)}</StatusIcon>
                      </StatusIndicator>
                    )}
                    
                    <RemoveButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAccount(account.id);
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      ✕
                    </RemoveButton>
                  </AccountStatus>
                </AccountCard>
              );
            })}
          </AnimatePresence>
        </AccountsList>

        <AddAccountButton
          onClick={onShowLoginForm}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <AddIcon>+</AddIcon>
          Войти в другой аккаунт
        </AddAccountButton>
      </ModalContent>
    </AuthContainer>
  );
};

// Стили
const AuthContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.6);
  

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 30%, rgba(0, 122, 255, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(52, 199, 89, 0.06) 0%, transparent 50%), radial-gradient(circle at 40% 80%, rgba(255, 45, 85, 0.04) 0%, transparent 50%), radial-gradient(circle at 70% 20%, rgba(175, 82, 222, 0.05) 0%, transparent 50%);
    animation: backgroundFloat 20s ease-in-out infinite;
    z-index: -1;
}
`;

const ModalContent = styled.div`
  background: linear-gradient(135deg, 
    rgba(15, 15, 20, 0.98) 0%, 
    rgba(25, 25, 35, 0.95) 30%,
    rgba(20, 20, 30, 0.97) 70%,
    rgba(10, 10, 15, 0.98) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  backdrop-filter: blur(25px);
  box-shadow: 
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 10px 30px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  padding: 32px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    max-width: calc(100vw - 32px);
    margin: 16px;
    border-radius: 20px;
    padding: 24px;
    max-height: calc(100vh - 80px);
  }
  
  @media (max-width: 480px) {
    max-width: calc(100vw - 24px);
    margin: 12px;
    border-radius: 16px;
    padding: 20px;
    max-height: calc(100vh - 60px);
  }

`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  @media (max-width: 768px) {
    margin-bottom: 24px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 20px;
  }
`;

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    margin-bottom: 16px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 12px;
  }
`;

const Title = styled.h2`
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  
  @media (max-width: 768px) {
    font-size: 22px;
    margin: 0 0 6px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 20px;
    margin: 0 0 4px 0;
  }
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const AccountsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  
  @media (max-width: 768px) {
    gap: 10px;
    margin-bottom: 20px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    margin-bottom: 16px;
  }
`;

const AccountCard = styled(motion.div)`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.08) 0%, 
    rgba(255, 255, 255, 0.04) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  @media (max-width: 768px) {
    padding: 16px;
    gap: 14px;
    border-radius: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 14px;
    gap: 12px;
    border-radius: 14px;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(255, 255, 255, 0.1), 
      transparent
    );
    transition: left 0.5s ease;
  }

  &:hover {
    background: linear-gradient(135deg, 
      rgba(0, 122, 255, 0.08) 0%, 
      rgba(255, 255, 255, 0.08) 100%
    );
    border-color: rgba(0, 122, 255, 0.3);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(0, 122, 255, 0.2);
    
    &::before {
      left: 100%;
    }
    
    @media (max-width: 480px) {
      transform: translateY(-2px) scale(1.01);
    }
  }

  &:active {
    transform: translateY(-2px) scale(0.98);
  }
`;

const AccountAvatar = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    width: 44px;
    height: 44px;
  }
  
  @media (max-width: 480px) {
    width: 40px;
    height: 40px;
  }
`;

const AvatarImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
`;

const AvatarPlaceholder = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #007AFF 0%, #00D4FF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  border-radius: 50%;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

const AccountInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const AccountName = styled.div`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 768px) {
    font-size: 15px;
    margin-bottom: 3px;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    margin-bottom: 2px;
  }
`;

const AccountPhone = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  
  @media (max-width: 768px) {
    font-size: 12px;
  }
  
  @media (max-width: 480px) {
    font-size: 11px;
  }
`;

const AccountStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  @media (max-width: 480px) {
    gap: 8px;
  }
`;

const StatusIndicator = styled.div<{ color: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.color}20;
  border: 2px solid ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  
  @media (max-width: 768px) {
    width: 28px;
    height: 28px;
  }
  
  @media (max-width: 480px) {
    width: 24px;
    height: 24px;
  }
  
  &::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    background: ${props => props.color};
    border-radius: 50%;
    top: 2px;
    right: 2px;
    
    @media (max-width: 480px) {
      width: 6px;
      height: 6px;
      top: 1px;
      right: 1px;
    }
  }
`;

const StatusIcon = styled.div`
  font-size: 16px;
  color: #fff;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const RemoveButton = styled(motion.button)`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 59, 48, 0.15);
  border: 1px solid rgba(255, 59, 48, 0.2);
  color: rgba(255, 59, 48, 0.8);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  @media (max-width: 768px) {
    width: 26px;
    height: 26px;
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
  
  &:hover {
    opacity: 1;
    background: rgba(255, 59, 48, 0.25);
    border-color: rgba(255, 59, 48, 0.4);
    color: #ff3b30;
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(255, 59, 48, 0.3);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const AddAccountButton = styled(motion.button)`
  width: 100%;
  background: linear-gradient(135deg, 
    rgba(0, 122, 255, 0.15) 0%, 
    rgba(0, 122, 255, 0.08) 100%
  );
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 16px;
  padding: 16px;
  color: #007AFF;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  @media (max-width: 768px) {
    padding: 14px;
    font-size: 14px;
    gap: 10px;
    border-radius: 14px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    font-size: 14px;
    gap: 8px;
    border-radius: 12px;
    min-height: 44px;
  }

  &:hover {
    background: linear-gradient(135deg, 
      rgba(0, 122, 255, 0.25) 0%, 
      rgba(0, 122, 255, 0.15) 100%
    );
    border-color: rgba(0, 122, 255, 0.5);
    transform: translateY(-1px);
    
    @media (max-width: 480px) {
      transform: none;
    }
  }
`;

const AddIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  
  @media (max-width: 768px) {
    width: 22px;
    height: 22px;
    font-size: 15px;
  }
  
  @media (max-width: 480px) {
    width: 20px;
    height: 20px;
    font-size: 14px;
  }
`;

const LastLogin = styled.div`
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  margin-top: 4px;
  
  @media (max-width: 768px) {
    font-size: 10px;
    margin-top: 3px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
    margin-top: 2px;
  }
`;

export default SavedAccountsModal;