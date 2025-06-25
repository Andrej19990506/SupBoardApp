import React, { useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './AuthModal';
import Loader from '../../../shared/components/Layout/Loader';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, refreshUser } = useAuth();

  // Проверяем авторизацию при загрузке приложения только если есть токен но нет пользователя
  useEffect(() => {
    const checkAuth = async () => {
      // Проверяем только если есть токен в localStorage
      const token = localStorage.getItem('auth_token');
      if (token && !isAuthenticated) {
        try {
          console.log('🔍 Проверяем токен на сервере...');
          await refreshUser();
        } catch (error) {
          console.log('❌ Токен недействителен, очищаем авторизацию');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_data');
        }
      }
    };

    checkAuth();
  }, [refreshUser, isAuthenticated]);

  // Показываем загрузку во время проверки авторизации
  if (isLoading) {
    return <Loader isVisible={true} />;
  }

  // Если пользователь не авторизован - показываем экран авторизации
  if (!isAuthenticated) {
    return (
      <AuthContainer> 
          <AuthSection>
            <AnimatePresence>
              <AuthModal
                isOpen={true}
                onClose={() => {}} // Нельзя закрыть, пока не авторизуешься
                initialMode="login"
              />
            </AnimatePresence>
          </AuthSection>
      </AuthContainer>
    );
  }

  // Если авторизован - показываем основное приложение
  return <>{children}</>;
};

// Стили для экрана авторизации
const AuthContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  width: 1200px;
  margin: 0 auto;
`;

const AuthSection = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`;

export default AuthGuard; 