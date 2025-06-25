import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import SavedAccountsModal from './SavedAccountsModal';
import ForgotPasswordModal from './ForgotPasswordModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  initialMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'savedAccounts' | 'forgotPassword'>(initialMode);

  // Проверяем сохраненные аккаунты при открытии модала
  useEffect(() => {
    if (isOpen && initialMode === 'login') {
      try {
        const savedAccounts = localStorage.getItem('subboard_saved_accounts');
        if (savedAccounts && JSON.parse(savedAccounts).length > 0) {
          setMode('savedAccounts');
        } else {
          setMode('login');
        }
      } catch (error) {
        console.error('Ошибка проверки сохраненных аккаунтов:', error);
        setMode('login');
      }
    } else {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  const handleSwitchToRegister = () => setMode('register');
  const handleSwitchToLogin = () => setMode('login');
  const handleShowLoginForm = () => setMode('login');
  const handleForgotPassword = () => setMode('forgotPassword');
  const handleBackToLogin = () => setMode('login');

  if (!isOpen) return null;

  // Если показываем сохраненные аккаунты, используем их собственный модал
  if (mode === 'savedAccounts') {
    return (
      <SavedAccountsModal 
        isOpen={true}
        onClose={onClose || (() => {})}
        onShowLoginForm={handleShowLoginForm}
      />
    );
  }

  // Если показываем форму восстановления пароля
  if (mode === 'forgotPassword') {
    return (
      <ForgotPasswordModal 
        isOpen={true}
        onClose={onClose || (() => {})}
        onBackToLogin={handleBackToLogin}
      />
    );
  }

  return (
    <AuthContainer onClick={onClose || (() => {})}>
      <ModalContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div>
          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <LoginForm 
                  onSwitchToRegister={handleSwitchToRegister}
                  onForgotPassword={handleForgotPassword}
                  onClose={onClose || (() => {})}
                />
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <RegisterForm 
                  onSwitchToLogin={handleSwitchToLogin}
                  onClose={onClose || (() => {})}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
  
  @media (max-width: 768px) {
    align-items: flex-start;
    padding: 0;
    backdrop-filter: blur(6px);
  }
  
  @media (max-width: 480px) {
    align-items: flex-start;
    padding: 0;
    backdrop-filter: blur(4px);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 30%, rgba(0, 122, 255, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(52, 199, 89, 0.06) 0%, transparent 50%),
      radial-gradient(circle at 40% 80%, rgba(255, 45, 85, 0.04) 0%, transparent 50%),
      radial-gradient(circle at 70% 20%, rgba(175, 82, 222, 0.05) 0%, transparent 50%);
    animation: backgroundFloat 20s ease-in-out infinite;
    z-index: -1;
    
    @media (max-width: 768px) {
      background: 
        radial-gradient(circle at 20% 30%, rgba(0, 122, 255, 0.06) 0%, transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(52, 199, 89, 0.04) 0%, transparent 40%);
    }
    
    @media (max-width: 480px) {
      background: 
        radial-gradient(circle at 20% 30%, rgba(0, 122, 255, 0.04) 0%, transparent 30%);
    }
  }

  @keyframes backgroundFloat {
    0%, 100% { 
      opacity: 0.6;
      transform: scale(1) rotate(0deg);
    }
    50% { 
      opacity: 1;
      transform: scale(1.1) rotate(0deg);
    }
  }
`;

const ModalContent = styled.div`
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    max-width: 100%;
    max-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  
  @media (max-width: 480px) {
    max-width: 100%;
    max-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 0;
  }
  
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

export default AuthModal;