import React, { useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useProfileDropdown } from '../contexts/ProfileDropdownContext';

const ProfileButton: React.FC = () => {
  const { user } = useAuth();
  const { openDropdown, isOpen } = useProfileDropdown();
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const handleClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const position = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };
      openDropdown(position);
    }
  };

  if (!user) return null;

  return (
    <ProfileContainer>
      <ProfileButtonStyled
        ref={buttonRef}
        onClick={handleClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Avatar>
          {user.avatar ? (
            <AvatarImage src={getFullAvatarUrl(user.avatar) || ''} alt={user.name} />
          ) : (
            <AvatarPlaceholder>
              {user.name?.charAt(0).toUpperCase() || '?'}
            </AvatarPlaceholder>
          )}
        </Avatar>
        <UserInfo>
          <UserName>{user.name}</UserName>
          <UserRole>Администратор</UserRole>
        </UserInfo>
        <DropdownIcon isOpen={isOpen}>▼</DropdownIcon>
      </ProfileButtonStyled>
    </ProfileContainer>
  );
};

// Стили
const ProfileContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ProfileButtonStyled = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
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

  @media (max-width: 768px) {
    padding: 6px 12px;
    gap: 8px;
  }
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #007AFF, #34C759);

  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
  }
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarPlaceholder = styled.div`
  color: #fff;
  font-weight: 600;
  font-size: 16px;

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;

  @media (max-width: 768px) {
    display: none;
  }
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

const DropdownIcon = styled.span<{ isOpen: boolean }>`
  font-size: 12px;
  color: #86868B;
  transition: transform 0.3s ease;
  transform: ${props => props.isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};

  @media (max-width: 768px) {
    display: none;
  }
`;



export default ProfileButton; 