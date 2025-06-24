import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useProfileDropdown } from '../contexts/ProfileDropdownContext';
import { authService } from '../services/authService';
import { useDispatch } from 'react-redux';
import { setUser } from '../store/authSlice';
import ActiveSessionsModal from './ActiveSessionsModal';

const ProfileDropdownGlobal: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOpen, position, closeDropdown } = useProfileDropdown();
  const [showPhotoTooltip, setShowPhotoTooltip] = useState(false);
  const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();

  // Функция для формирования полного URL аватара
  const getFullAvatarUrl = (avatarUrl: string | null): string | null => {
    if (!avatarUrl) return null;
    
    // Если URL уже полный, возвращаем как есть
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    // Если это относительный путь, добавляем базовый URL API
    const apiBaseUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000';
    return `${apiBaseUrl}${avatarUrl}`;
  };

  const handleLogout = async () => {
    try {
      await logout();
      closeDropdown();
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const handlePhotoClick = () => {
    console.log('👤 Клик по аватару, текущее состояние тултипа:', showPhotoTooltip);
    setShowPhotoTooltip(!showPhotoTooltip);
  };

  const handleAddPhoto = () => {
    console.log('🖼️ Клик по "Добавить фото"');
    console.log('fileInputRef.current:', fileInputRef.current);
    fileInputRef.current?.click();
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
    console.log('📁 Изменение файла в input');
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
      // Формируем полный URL для аватара через API сервер
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

  if (!user || !position) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay для закрытия при клике вне */}
          <Overlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              closeDropdown();
              setShowPhotoTooltip(false);
            }}
          />
          
          {/* Dropdown меню */}
          <DropdownMenu
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              top: position.top,
              right: position.right,
            }}
          >
            <DropdownHeader>
              <UserAvatar
                onClick={handlePhotoClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {user.avatar ? (
                  <AvatarImage src={getFullAvatarUrl(user.avatar) || ''} alt={user.name} />
                ) : (
                  <AvatarPlaceholder>
                    {user.name?.charAt(0)?.toUpperCase() || '👤'}
                  </AvatarPlaceholder>
                )}
                <AvatarOverlay>
                  <CameraIcon>📷</CameraIcon>
                </AvatarOverlay>
                
                {/* Тултип для управления фото */}
                <AnimatePresence>
                  {showPhotoTooltip && (console.log('🔍 Рендерим тултип, showPhotoTooltip:', showPhotoTooltip), (
                    <PhotoTooltip
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      transition={{ duration: 0.2 }}
                      onAnimationComplete={() => console.log('📸 Тултип появился')}
                    >
                      <TooltipItem onClick={(e) => {
                        console.log('📁 Клик по "Добавить фото" в тултипе');
                        e.stopPropagation();
                        handleAddPhoto();
                      }}>
                        <TooltipIcon>📁</TooltipIcon>
                        <TooltipText>Добавить фото</TooltipText>
                      </TooltipItem>
                      {user.avatar && (
                        <TooltipItem onClick={handleRemovePhoto}>
                          <TooltipIcon>🗑️</TooltipIcon>
                          <TooltipText>Удалить фото</TooltipText>
                        </TooltipItem>
                      )}
                    </PhotoTooltip>
                  ))}
                </AnimatePresence>
              </UserAvatar>
              
              <UserDetails>
                <UserDetailName>{user.name}</UserDetailName>
                <UserDetailEmail>{user.email}</UserDetailEmail>
              </UserDetails>
              
              {/* Скрытый input для загрузки файлов */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </DropdownHeader>

            <DropdownDivider />

            <DropdownItem
              onClick={() => {
                setShowActiveSessionsModal(true);
                closeDropdown();
              }}
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.98 }}
            >
              <ItemIcon>🔐</ItemIcon>
              <ItemText>Активные сеансы</ItemText>
            </DropdownItem>

            <DropdownItem
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.98 }}
            >
              <ItemIcon>⚙️</ItemIcon>
              <ItemText>Настройки</ItemText>
            </DropdownItem>

            <DropdownItem
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.98 }}
            >
              <ItemIcon>📊</ItemIcon>
              <ItemText>Статистика</ItemText>
            </DropdownItem>

            <DropdownDivider />

            <DropdownItem
              onClick={handleLogout}
              whileHover={{ backgroundColor: 'rgba(255, 77, 79, 0.1)' }}
              whileTap={{ scale: 0.98 }}
            >
              <ItemIcon>🚪</ItemIcon>
              <ItemText style={{ color: '#FF4D4F' }}>Выйти</ItemText>
            </DropdownItem>
          </DropdownMenu>
        </>
      )}
      
      {/* Модальное окно активных сеансов */}
      <ActiveSessionsModal
        isOpen={showActiveSessionsModal}
        onClose={() => setShowActiveSessionsModal(false)}
      />
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
  z-index: 9998;
  background: transparent;
`;

const DropdownMenu = styled(motion.div)`
  position: fixed;
  min-width: 280px;
  background: rgba(28, 28, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  overflow: hidden;

  @media (max-width: 768px) {
    min-width: 260px;
  }
`;

const DropdownHeader = styled.div`
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
`;

const UserAvatar = styled(motion.div)`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  /* overflow: hidden; // Убираем чтобы тултип был виден */
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: border-color 0.2s ease;
  
  &:hover {
    border-color: rgba(0, 122, 255, 0.6);
  }
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  overflow: hidden;
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
  overflow: hidden;
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
  
  ${UserAvatar}:hover & {
    opacity: 1;
  }
`;

const CameraIcon = styled.span`
  font-size: 16px;
`;

const PhotoTooltip = styled(motion.div)`
  position: absolute;
  top: 100%;
  left: 0;
  background: rgba(40, 40, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  overflow: hidden;
  margin-top: 8px;
  min-width: 140px;
`;

const TooltipItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const TooltipIcon = styled.span`
  font-size: 14px;
  width: 16px;
  display: flex;
  justify-content: center;
`;

const TooltipText = styled.span`
  font-size: 13px;
  color: #fff;
  font-weight: 500;
`;

const UserDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const UserDetailName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #fff;
`;

const UserDetailEmail = styled.div`
  font-size: 14px;
  color: #86868B;
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
`;

const DropdownItem = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease;
`;

const ItemIcon = styled.span`
  font-size: 16px;
  width: 20px;
  display: flex;
  justify-content: center;
`;

const ItemText = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: #fff;
`;

export default ProfileDropdownGlobal; 