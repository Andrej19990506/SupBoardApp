import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileButton from '@features/auth/components/ProfileButton';
import { NotificationBellIcon } from '@features/booking/components/NotificationBell/NotificationBell';
import { WeatherWidget } from './WeatherWidget';
import canoeIcon from '@/assets/canoe.png';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useDeviceSessions, DeviceSession } from '@features/auth/hooks/useDeviceSessions';
import { authService } from '../../../../auth/services/authService';
import { useDispatch } from 'react-redux';
import { setUser } from '../../../../auth/store/authSlice';

interface MobileHeaderProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onInventoryClick: () => void;
  onGalleryClick: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  canGoPrev,
  canGoNext,
  onInventoryClick,
  onGalleryClick,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false); // Левая панель профиля
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Правая панель бургера
  const [profileScreen, setProfileScreen] = useState<'main' | 'settings' | 'sessions'>('main'); // Экраны левой панели
  const [showPhotoTooltip, setShowPhotoTooltip] = useState(false); // Тултип для управления фото
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, logout: authLogout } = useAuth();
  const { sessions, loading: sessionsLoading, terminateSession, terminateAllOthers, refreshSessions } = useDeviceSessions();
  const dispatch = useDispatch();

  // Управление overflow body во время анимации панелей
  useEffect(() => {
    if (isProfileMenuOpen || isMenuOpen) {
      // Блокируем скролл body когда панель открыта
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      // Восстанавливаем скролл когда панель закрыта
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    // Cleanup при размонтировании компонента
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isProfileMenuOpen, isMenuOpen]);

  // Функция для формирования полного URL аватара
  const getFullAvatarUrl = (avatarUrl: string | null): string | null => {
    if (!avatarUrl) return null;
    
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    const apiBaseUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000';
    return `${apiBaseUrl}${avatarUrl}`;
  };

  const handleLogout = async () => {
    try {
      await authLogout();
      setIsProfileMenuOpen(false);
      setProfileScreen('main');
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const openSettings = () => {
    setProfileScreen('settings');
  };

  const openSessions = () => {
    setProfileScreen('sessions');
    refreshSessions(); // Обновляем сеансы при открытии экрана
  };

  const goBackToMain = () => {
    setProfileScreen('main');
  };

  const goBackToSettings = () => {
    setProfileScreen('settings');
  };

  const closeProfileMenu = () => {
    setIsProfileMenuOpen(false);
    setProfileScreen('main');
  };

  const handleTerminateSession = async (sessionId: number) => {
    try {
      await terminateSession(sessionId);
    } catch (error) {
      console.error('Ошибка завершения сеанса:', error);
    }
  };

  const handleTerminateAllOthers = async () => {
    try {
      await terminateAllOthers();
    } catch (error) {
      console.error('Ошибка завершения всех сеансов:', error);
    }
  };

  const getDeviceIcon = (deviceType: string | null, browserName: string | null): string => {
    if (deviceType === 'mobile') return '📱';
    if (deviceType === 'tablet') return '📱';
    if (browserName?.toLowerCase().includes('chrome')) return '💻';
    if (browserName?.toLowerCase().includes('safari')) return '💻';
    if (browserName?.toLowerCase().includes('firefox')) return '💻';
    return '🖥️';
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 5) return 'Сейчас активен';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    return `${diffDays} дн назад`;
  };

  // Функции для управления фото аватара
  const handleAvatarClick = () => {
    console.log('👤 Клик по аватару в мобильной панели, текущее состояние тултипа:', showPhotoTooltip);
    setShowPhotoTooltip(!showPhotoTooltip);
  };

  const handleAddPhoto = () => {
    console.log('🖼️ Клик по "Добавить фото" в мобильной панели');
    const fileInput = document.getElementById('mobile-avatar-input') as HTMLInputElement;
    console.log('fileInput:', fileInput);
    fileInput?.click();
    setShowPhotoTooltip(false);
  };

  const handleRemovePhoto = async () => {
    if (!user?.id) return;
    
    try {
      const response = await authService.deleteAvatar(Number(user.id));
      console.log('Аватар удален:', response);
      
      // Обновляем пользователя в Redux
      const updatedUser = { ...user, avatar: undefined };
      dispatch(setUser(updatedUser));
      authService.setStoredUser(updatedUser);
    } catch (error) {
      console.error('Ошибка удаления аватара:', error);
    }
    
    setShowPhotoTooltip(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 Изменение файла в мобильной панели');
    const file = event.target.files?.[0];
    console.log('Выбранный файл:', file);
    console.log('User ID:', user?.id);
    
    if (!file || !user?.id) {
      console.log('❌ Нет файла или ID пользователя');
      return;
    }
    
    try {
      console.log('📤 Отправляем файл на сервер...');
      const response = await authService.uploadAvatar(Number(user.id), file);
      console.log('✅ Аватар загружен:', response);
      
      // Обновляем пользователя в Redux  
      const apiBaseUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000';
      const fullAvatarUrl = response.avatar_url.startsWith('http') 
        ? response.avatar_url 
        : `${apiBaseUrl}${response.avatar_url}`;
      
      console.log('🖼️ Полный URL аватара:', fullAvatarUrl);
      
      const updatedUser = { ...user, avatar: fullAvatarUrl };
      dispatch(setUser(updatedUser));
      authService.setStoredUser(updatedUser);
    } catch (error) {
      console.error('❌ Ошибка загрузки аватара:', error);
    }
  };

  return (
    <>
      <HeaderContainer>
        {/* Верхняя строка с профилем и меню */}
        <TopRow>
          <ProfileSection>
            <ProfileMenuButton 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              $isOpen={isProfileMenuOpen}
            >
              <Avatar>
                {user?.avatar ? (
                  <AvatarImage src={getFullAvatarUrl(user.avatar) || ''} alt={user.name} />
                ) : (
                  <AvatarPlaceholder>
                    {user?.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarPlaceholder>
                )}
              </Avatar>
              <UserInfo>
                <UserName>{user?.name}</UserName>
                <UserRole>Администратор</UserRole>
              </UserInfo>
            </ProfileMenuButton>
          </ProfileSection>
          
          <ActionSection>
            <NotificationBellIcon />
            <MenuButton 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              $isOpen={isMenuOpen}
            >
              <MenuIcon $isOpen={isMenuOpen}>
                <span></span>
                <span></span>
                <span></span>
              </MenuIcon>
            </MenuButton>
          </ActionSection>
        </TopRow>

        {/* Навигация по месяцам */}
        <NavigationRow>
          <NavButton 
            onClick={onPrevMonth}
            disabled={!canGoPrev}
            whileTap={{ scale: 0.95 }}
          >
            ←
          </NavButton>
          
          <CurrentMonth>
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </CurrentMonth>
          
          <NavButton 
            onClick={onNextMonth}
            disabled={!canGoNext}
            whileTap={{ scale: 0.95 }}
          >
            →
          </NavButton>
        </NavigationRow>
      </HeaderContainer>

      {/* ЛЕВАЯ панель профиля */}
      <AnimatePresence>
        {isProfileMenuOpen && (
          <>
                         <Overlay 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={closeProfileMenu}
             />
            <ProfileMenu
              initial={{ x: '-100vw' }}
              animate={{ x: 0 }}
              exit={{ x: '-100vw' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
                             <ProfileMenuHeader>
                 <ProfileMenuTitle>
                   {profileScreen === 'main' && 'Профиль'}
                   {profileScreen === 'settings' && 'Настройки'}
                   {profileScreen === 'sessions' && 'Активные сеансы'}
                 </ProfileMenuTitle>
                 <HeaderButtons>
                   {profileScreen !== 'main' && (
                     <BackButton 
                       onClick={profileScreen === 'settings' ? goBackToMain : goBackToSettings}
                     >
                       ←
                     </BackButton>
                   )}
                   <CloseButton onClick={closeProfileMenu}>
                     ✕
                   </CloseButton>
                 </HeaderButtons>
               </ProfileMenuHeader>
               
               <ProfileMenuContent>
                 {profileScreen === 'main' && (
                   <>
                     <ProfileInfo>
                       <ProfileAvatar
                         onClick={handleAvatarClick}
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                       >
                         {user?.avatar ? (
                           <AvatarImage src={getFullAvatarUrl(user.avatar) || ''} alt={user.name} />
                         ) : (
                           <AvatarPlaceholder>
                             {user?.name?.charAt(0)?.toUpperCase() || '👤'}
                           </AvatarPlaceholder>
                         )}
                         <AvatarOverlay>
                           <CameraIcon>📷</CameraIcon>
                         </AvatarOverlay>
                         
                         {/* Тултип для управления фото */}
                         <AnimatePresence>
                           {showPhotoTooltip && (
                             <PhotoTooltip
                               initial={{ opacity: 0, scale: 0.8, y: 10 }}
                               animate={{ opacity: 1, scale: 1, y: 0 }}
                               exit={{ opacity: 0, scale: 0.8, y: 10 }}
                               transition={{ duration: 0.2 }}
                             >
                               <TooltipItem onClick={(e) => {
                                 console.log('📁 Клик по "Добавить фото" в мобильном тултипе');
                                 e.stopPropagation();
                                 handleAddPhoto();
                               }}>
                                 <TooltipIcon>📁</TooltipIcon>
                                 <TooltipText>Добавить фото</TooltipText>
                               </TooltipItem>
                               {user?.avatar && (
                                 <TooltipItem onClick={(e) => {
                                   e.stopPropagation();
                                   handleRemovePhoto();
                                 }}>
                                   <TooltipIcon>🗑️</TooltipIcon>
                                   <TooltipText>Удалить фото</TooltipText>
                                 </TooltipItem>
                               )}
                             </PhotoTooltip>
                           )}
                         </AnimatePresence>
                       </ProfileAvatar>
                       <ProfileDetails>
                         <ProfileName>{user?.name}</ProfileName>
                         <ProfileEmail>{user?.email}</ProfileEmail>
                       </ProfileDetails>
                       
                       {/* Скрытый input для загрузки файлов */}
                       <input
                         id="mobile-avatar-input"
                         type="file"
                         accept="image/*"
                         onChange={handleFileChange}
                         ref={fileInputRef}
                         style={{ display: 'none' }}
                       />
                     </ProfileInfo>

                     <ProfileDivider />

                     <ProfileMenuItem onClick={openSettings} whileTap={{ scale: 0.98 }}>
                       <ProfileMenuItemIcon>⚙️</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle>Настройки</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Персональные настройки</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>

                     <ProfileMenuItem whileTap={{ scale: 0.98 }}>
                       <ProfileMenuItemIcon>📊</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle>Статистика</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Персональная аналитика</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>

                     <ProfileDivider />

                     <ProfileMenuItem 
                       onClick={handleLogout}
                       whileTap={{ scale: 0.98 }}
                     >
                       <ProfileMenuItemIcon>🚪</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle style={{ color: '#FF4D4F' }}>Выйти</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Завершить сеанс</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>
                   </>
                 )}

                 {profileScreen === 'settings' && (
                   <>
                     <ProfileMenuItem onClick={openSessions} whileTap={{ scale: 0.98 }}>
                       <ProfileMenuItemIcon>🔐</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle>Активные сеансы</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Управление входами в систему</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>

                     <ProfileMenuItem whileTap={{ scale: 0.98 }}>
                       <ProfileMenuItemIcon>🔔</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle>Уведомления</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Настройки оповещений</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>

                     <ProfileMenuItem whileTap={{ scale: 0.98 }}>
                       <ProfileMenuItemIcon>🎨</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle>Тема</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Внешний вид приложения</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>

                     <ProfileMenuItem whileTap={{ scale: 0.98 }}>
                       <ProfileMenuItemIcon>🌐</ProfileMenuItemIcon>
                       <ProfileMenuItemText>
                         <ProfileMenuItemTitle>Язык</ProfileMenuItemTitle>
                         <ProfileMenuItemSubtitle>Язык интерфейса</ProfileMenuItemSubtitle>
                       </ProfileMenuItemText>
                       <ProfileMenuItemArrow>→</ProfileMenuItemArrow>
                     </ProfileMenuItem>
                   </>
                 )}

                 {profileScreen === 'sessions' && (
                   <>
                     {sessionsLoading ? (
                       <SessionsLoading>
                         <LoadingSpinner />
                         <SessionsText>Загрузка активных сеансов...</SessionsText>
                       </SessionsLoading>
                     ) : sessions.length === 0 ? (
                       <SessionsLoading>
                         <SessionsText>Активных сеансов не найдено</SessionsText>
                       </SessionsLoading>
                     ) : (
                       <>
                         {sessions.map((session: DeviceSession & { is_current?: boolean }) => (
                           <SessionItem key={session.id} whileTap={{ scale: 0.98 }}>
                             <SessionInfo>
                               <SessionDevice>
                                 <DeviceIcon>{getDeviceIcon(session.device_type, session.browser_name)}</DeviceIcon>
                                 {session.browser_name || 'Неизвестный браузер'} на {session.os_name || 'Неизвестная ОС'}
                               </SessionDevice>
                               <SessionDetails>
                                 <SessionLocation>
                                   {session.city && session.country 
                                     ? `${session.city}, ${session.country}` 
                                     : session.ip_address
                                   }
                                 </SessionLocation>
                                 <SessionTime>{formatTimeAgo(session.last_used_at)}</SessionTime>
                               </SessionDetails>
                             </SessionInfo>
                             
                             {session.is_current ? (
                               <SessionBadge $current>Текущий</SessionBadge>
                             ) : (
                               <SessionAction onClick={() => handleTerminateSession(session.id)}>
                                 Завершить
                               </SessionAction>
                             )}
                           </SessionItem>
                         ))}

                         {sessions.length > 1 && (
                           <SessionsActions>
                             <TerminateAllButton 
                               onClick={handleTerminateAllOthers}
                               disabled={sessionsLoading}
                             >
                               ⚠️ Завершить все сеансы кроме текущего ({sessions.length - 1})
                             </TerminateAllButton>
                           </SessionsActions>
                         )}
                       </>
                     )}
                   </>
                 )}
               </ProfileMenuContent>
            </ProfileMenu>
          </>
        )}
      </AnimatePresence>

      {/* ПРАВАЯ панель меню */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <Overlay 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
            />
            <MobileMenu
              initial={{ x: '-100vw' }}
              animate={{ x: 0 }}
              exit={{ x: '-100vw' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <MobileMenuHeader>
                <MobileMenuTitle>Меню</MobileMenuTitle>
                <CloseButton onClick={() => setIsMenuOpen(false)}>
                  ✕
                </CloseButton>
              </MobileMenuHeader>
              
              <MobileMenuContent>
                <MobileMenuItem 
                  onClick={() => {
                    onInventoryClick();
                    setIsMenuOpen(false);
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MobileMenuItemIcon>
                    <img src={canoeIcon} alt="Инвентарь" />
                  </MobileMenuItemIcon>
                  <MobileMenuItemText>
                    <MobileMenuItemTitle>Инвентарь</MobileMenuItemTitle>
                    <MobileMenuItemSubtitle>Управление оборудованием</MobileMenuItemSubtitle>
                  </MobileMenuItemText>
                  <MobileMenuItemArrow>→</MobileMenuItemArrow>
                </MobileMenuItem>

                <MobileMenuItem 
                  onClick={() => {
                    onGalleryClick();
                    setIsMenuOpen(false);
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MobileMenuItemIcon>📸</MobileMenuItemIcon>
                  <MobileMenuItemText>
                    <MobileMenuItemTitle>Галерея</MobileMenuItemTitle>
                    <MobileMenuItemSubtitle>Фото оборудования</MobileMenuItemSubtitle>
                  </MobileMenuItemText>
                  <MobileMenuItemArrow>→</MobileMenuItemArrow>
                </MobileMenuItem>

                <MenuDivider />

                <MobileMenuItem whileTap={{ scale: 0.98 }}>
                  <MobileMenuItemIcon>⚙️</MobileMenuItemIcon>
                  <MobileMenuItemText>
                    <MobileMenuItemTitle>Настройки приложения</MobileMenuItemTitle>
                    <MobileMenuItemSubtitle>Общие параметры</MobileMenuItemSubtitle>
                  </MobileMenuItemText>
                  <MobileMenuItemArrow>→</MobileMenuItemArrow>
                </MobileMenuItem>

                <MobileMenuItem whileTap={{ scale: 0.98 }}>
                  <MobileMenuItemIcon>📊</MobileMenuItemIcon>
                  <MobileMenuItemText>
                    <MobileMenuItemTitle>Аналитика</MobileMenuItemTitle>
                    <MobileMenuItemSubtitle>Отчеты и статистика</MobileMenuItemSubtitle>
                  </MobileMenuItemText>
                  <MobileMenuItemArrow>→</MobileMenuItemArrow>
                </MobileMenuItem>
              </MobileMenuContent>
              
              {/* Секция погоды в нижней части меню */}
              <WeatherSection>
                <WeatherWidget />
              </WeatherSection>
            </MobileMenu>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// Стили
const HeaderContainer = styled.div`
  background: linear-gradient(135deg, #2C2C2E 0%, #3A3A3C 50%, #2C2C2E 100%);
  padding: 8px 16px 12px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      #007AFF 0%,
      #52C41A 25%,
      #FFD600 50%,
      #FF6B35 75%,
      #007AFF 100%
    );
    background-size: 200% 100%;
    animation: gradientShift 4s ease-in-out infinite;
  }
  
  @keyframes gradientShift {
    0%, 100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  margin-top: 8px;
`;

const ProfileSection = styled.div`
  flex: 1;
`;

const ProfileMenuButton = styled(motion.button)<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(16px);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 122, 255, 0.2);
  }
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #007AFF, #34C759);
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
`;

const AvatarPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #007AFF, #0056CC);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: white;
  border-radius: 50%;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
`;

const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1;
`;

const UserRole = styled.span`
  font-size: 12px;
  color: #86868B;
  line-height: 1;
`;

const ActionSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MenuButton = styled(motion.button)<{ $isOpen: boolean }>`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const MenuIcon = styled.div<{ $isOpen: boolean }>`
  width: 24px;
  height: 20px;
  position: relative;
  
  span {
    display: block;
    height: 2px;
    width: 100%;
    background: #fff;
    border-radius: 1px;
    position: absolute;
    left: 0;
    transition: all 0.3s ease;
    
    &:nth-child(1) {
      top: ${props => props.$isOpen ? '50%' : '0'};
      transform: ${props => props.$isOpen ? 'translateY(-50%) rotate(45deg)' : 'none'};
    }
    
    &:nth-child(2) {
      top: 50%;
      transform: translateY(-50%);
      opacity: ${props => props.$isOpen ? '0' : '1'};
    }
    
    &:nth-child(3) {
      top: ${props => props.$isOpen ? '50%' : '100%'};
      transform: ${props => props.$isOpen ? 'translateY(-50%) rotate(-45deg)' : 'translateY(-100%)'};
    }
  }
`;

const NavigationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const NavButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const CurrentMonth = styled.h2`
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  text-align: center;
  flex: 1;
  text-transform: capitalize;
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  backdrop-filter: blur(4px);
  overflow: hidden; /* Предотвращаем скролл */
`;

// ЛЕВАЯ панель профиля
const ProfileMenu = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw; /* Предотвращаем переполнение */
  background: linear-gradient(135deg, 
    rgba(15, 15, 20, 0.98) 0%, 
    rgba(25, 25, 35, 0.95) 30%,
    rgba(20, 20, 30, 0.97) 70%,
    rgba(10, 10, 15, 0.98) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(25px);
  box-shadow: 
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 10px 30px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  /* Добавляем тонкий светящийся эффект по краям */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1px;
    background: linear-gradient(135deg, 
      rgba(0, 122, 255, 0.3) 0%, 
      rgba(255, 255, 255, 0.1) 25%,
      rgba(0, 122, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.05) 75%,
      rgba(0, 122, 255, 0.3) 100%
    );
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: subtract;
    z-index: -1;
    opacity: 0.6;
    animation: borderGlow 4s ease-in-out infinite;
  }

  @keyframes borderGlow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
`;

const ProfileMenuHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, 
    rgba(44, 44, 46, 0.8) 0%, 
    rgba(58, 58, 60, 0.6) 100%
  );
  position: relative;
  
  /* Фирменная полоска градиент */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      #007AFF 0%,
      #52C41A 25%,
      #FFD600 50%,
      #FF6B35 75%,
      #007AFF 100%
    );
    background-size: 200% 100%;
    animation: gradientShift 4s ease-in-out infinite;
  }
  
  @keyframes gradientShift {
    0%, 100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }
`;

const ProfileMenuTitle = styled.h3`
  background: linear-gradient(135deg, 
    #ffffff 0%, 
    #007AFF 25%,
    #00D4FF 50%,
    #007AFF 75%,
    #ffffff 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.5px;
  
  /* Fallback для браузеров без поддержки */
  @supports not (-webkit-background-clip: text) {
    color: #ffffff;
  }
  
  /* Добавляем тень для глубины */
  text-shadow: 0 4px 16px rgba(0, 122, 255, 0.4);
`;

const HeaderButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ProfileMenuContent = styled.div`
  flex: 1;
  padding: 24px 0;
  overflow-y: auto;
  
  /* Красивый скроллбар */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(44, 44, 46, 0.3);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #86868B 0%, #5A5A5E 100%);
    border-radius: 3px;
    transition: background 0.2s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #A0A0A5 0%, #7A7A7E 100%);
  }
`;

const ProfileInfo = styled.div`
  display: flex;
  align-items: center;
  padding: 24px 24px;
  gap: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  backdrop-filter: blur(20px);
  position: relative;
  
  /* Анимированная подсветка */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    50% { left: 100%; }
    100% { left: 100%; }
  }
`;

const ProfileAvatar = styled(motion.div)`
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #007AFF, #34C759);
  border: 3px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 
    0 8px 32px rgba(0, 122, 255, 0.3),
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  
  &:hover {
    border-color: rgba(0, 122, 255, 0.6);
    transform: translateY(-2px);
    box-shadow: 
      0 12px 48px rgba(0, 122, 255, 0.4),
      0 6px 24px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
`;

const AvatarOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 50%;
  
  ${ProfileAvatar}:hover & {
    opacity: 1;
  }
`;

const CameraIcon = styled.span`
  font-size: 18px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
`;

const PhotoTooltip = styled(motion.div)`
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, 
    rgba(28, 28, 30, 0.95) 0%, 
    rgba(44, 44, 46, 0.9) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px;
  backdrop-filter: blur(20px);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  z-index: 1002;
  min-width: 160px;
  overflow: hidden;
  
  /* Анимированная подсветка */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
    animation: shimmer 3s ease-in-out infinite;
  }
`;

const TooltipItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.15) 0%, 
      rgba(255, 255, 255, 0.08) 100%
    );
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const TooltipIcon = styled.span`
  font-size: 16px;
  width: 20px;
  display: flex;
  justify-content: center;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
`;

const TooltipText = styled.span`
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const ProfileDetails = styled.div`
  flex: 1;
`;

const ProfileName = styled.div`
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const ProfileEmail = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const ProfileMenuItem = styled(motion.div)`
  display: flex;
  align-items: center;
  padding: 18px 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.02) 0%, 
    rgba(255, 255, 255, 0.01) 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.12) 0%, 
      rgba(255, 255, 255, 0.06) 100%
    );
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ProfileMenuItemIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.15) 0%, 
    rgba(255, 255, 255, 0.08) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  
  ${ProfileMenuItem}:hover & {
    transform: scale(1.05);
    box-shadow: 
      0 6px 24px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
`;

const ProfileMenuItemText = styled.div`
  flex: 1;
`;

const ProfileMenuItemTitle = styled.div`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const ProfileMenuItemSubtitle = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const ProfileMenuItemArrow = styled.div`
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
  transition: all 0.3s ease;
  
  ${ProfileMenuItem}:hover & {
    color: rgba(255, 255, 255, 0.7);
    transform: translateX(2px);
  }
`;

const ProfileDivider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.2) 50%, 
    transparent 100%
  );
  margin: 16px 24px;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(0, 122, 255, 0.3) 50%, 
      transparent 100%
    );
  }
`;

// ПРАВАЯ панель меню
const MobileMenu = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw; /* Предотвращаем переполнение */
  background: linear-gradient(135deg, 
    rgba(15, 15, 20, 0.98) 0%, 
    rgba(25, 25, 35, 0.95) 30%,
    rgba(20, 20, 30, 0.97) 70%,
    rgba(10, 10, 15, 0.98) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(25px);
  box-shadow: 
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 10px 30px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  /* Добавляем тонкий светящийся эффект по краям с оранжевым оттенком */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1px;
    background: linear-gradient(135deg, 
      rgba(255, 149, 0, 0.3) 0%, 
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 149, 0, 0.2) 50%,
      rgba(255, 255, 255, 0.05) 75%,
      rgba(255, 149, 0, 0.3) 100%
    );
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: subtract;
    z-index: -1;
    opacity: 0.6;
    animation: borderGlow 4s ease-in-out infinite;
  }

  @keyframes borderGlow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
`;

const MobileMenuHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, 
    rgba(44, 44, 46, 0.8) 0%, 
    rgba(58, 58, 60, 0.6) 100%
  );
  position: relative;
  
  /* Фирменная полоска градиент с оранжевым акцентом */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      #FF9500 0%,
      #FF6B35 25%,
      #FFD600 50%,
      #52C41A 75%,
      #FF9500 100%
    );
    background-size: 200% 100%;
    animation: gradientShift 4s ease-in-out infinite;
  }
  
  @keyframes gradientShift {
    0%, 100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }
`;

const MobileMenuTitle = styled.h3`
  background: linear-gradient(135deg, 
    #ffffff 0%, 
    #FF9500 25%,
    #FF6B35 50%,
    #FF9500 75%,
    #ffffff 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.5px;
  
  /* Fallback для браузеров без поддержки */
  @supports not (-webkit-background-clip: text) {
    color: #ffffff;
  }
  
  /* Добавляем тень для глубины */
  text-shadow: 0 4px 16px rgba(255, 149, 0, 0.4);
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 149, 0, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const MobileMenuContent = styled.div`
  flex: 1;
  padding: 24px 0;
  overflow-y: auto;
  
  /* Красивый скроллбар */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(44, 44, 46, 0.3);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #86868B 0%, #5A5A5E 100%);
    border-radius: 3px;
    transition: background 0.2s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #A0A0A5 0%, #7A7A7E 100%);
  }
`;

const WeatherSection = styled.div`
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  backdrop-filter: blur(20px);
  margin-top: auto;
  position: relative;
  
  /* Анимированная подсветка */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    50% { left: 100%; }
    100% { left: 100%; }
  }
`;

const MobileMenuItem = styled(motion.div)`
  display: flex;
  align-items: center;
  padding: 18px 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.02) 0%, 
    rgba(255, 255, 255, 0.01) 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.12) 0%, 
      rgba(255, 255, 255, 0.06) 100%
    );
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const MobileMenuItemIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.15) 0%, 
    rgba(255, 255, 255, 0.08) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  
  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }
  
  ${MobileMenuItem}:hover & {
    transform: scale(1.05);
    box-shadow: 
      0 6px 24px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
`;

const MobileMenuItemText = styled.div`
  flex: 1;
`;

const MobileMenuItemTitle = styled.div`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const MobileMenuItemSubtitle = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const MobileMenuItemArrow = styled.div`
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
  transition: all 0.3s ease;
  
  ${MobileMenuItem}:hover & {
    color: rgba(255, 255, 255, 0.7);
    transform: translateX(2px);
  }
`;

const MenuDivider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.2) 50%, 
    transparent 100%
  );
  margin: 16px 24px;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(255, 149, 0, 0.3) 50%, 
      transparent 100%
    );
  }
`;

// Стили для экрана сеансов
const SessionsLoading = styled.div`
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
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

const SessionsText = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const SessionItem = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.02) 0%, 
    rgba(255, 255, 255, 0.01) 100%
  );
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.08) 0%, 
      rgba(255, 255, 255, 0.04) 100%
    );
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const SessionInfo = styled.div`
  flex: 1;
  margin-right: 16px;
`;

const SessionDevice = styled.div`
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 6px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DeviceIcon = styled.span`
  font-size: 18px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
`;

const SessionDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SessionLocation = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const SessionTime = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const SessionBadge = styled.div<{ $current?: boolean }>`
  background: ${props => props.$current 
    ? 'linear-gradient(135deg, #34C759 0%, #30D158 100%)' 
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
  };
  color: ${props => props.$current ? '#fff' : 'rgba(255, 255, 255, 0.8)'};
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-shadow: ${props => props.$current ? '0 2px 4px rgba(0, 0, 0, 0.3)' : 'none'};
  box-shadow: ${props => props.$current 
    ? '0 4px 16px rgba(52, 199, 89, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
    : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
  };
  backdrop-filter: blur(10px);
  margin-right: 12px;
  transition: all 0.3s ease;
`;

const SessionAction = styled.button`
  background: linear-gradient(135deg, 
    rgba(255, 77, 79, 0.15) 0%, 
    rgba(255, 77, 79, 0.08) 100%
  );
  border: 1px solid rgba(255, 77, 79, 0.3);
  color: #FF4D4F;
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 4px 16px rgba(255, 77, 79, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 77, 79, 0.25) 0%, 
      rgba(255, 77, 79, 0.15) 100%
    );
    border-color: rgba(255, 77, 79, 0.5);
    transform: translateY(-1px);
    box-shadow: 
      0 6px 24px rgba(255, 77, 79, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const SessionsActions = styled.div`
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  backdrop-filter: blur(20px);
`;

const TerminateAllButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, 
    rgba(255, 77, 79, 0.15) 0%, 
    rgba(255, 77, 79, 0.08) 100%
  );
  border: 1px solid rgba(255, 77, 79, 0.3);
  color: #FF4D4F;
  padding: 16px 20px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 8px 32px rgba(255, 77, 79, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 77, 79, 0.25) 0%, 
      rgba(255, 77, 79, 0.15) 100%
    );
    border-color: rgba(255, 77, 79, 0.5);
    transform: translateY(-2px);
    box-shadow: 
      0 12px 48px rgba(255, 77, 79, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  &:active {
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

export default MobileHeader; 