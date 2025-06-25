import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/authService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

type ResetStep = 'phone' | 'sms' | 'newPassword' | 'emailFallback' | 'success';

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ 
  isOpen, 
  onClose, 
  onBackToLogin 
}) => {
  const [currentStep, setCurrentStep] = useState<ResetStep>('phone');
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    smsCode: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryMethod, setRecoveryMethod] = useState<'sms' | 'email' | null>(null);

  // Форматирование номера телефона
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    
    let normalizedDigits = digits;
    if (digits.startsWith('8')) {
      normalizedDigits = '7' + digits.slice(1);
    }
    if (!normalizedDigits.startsWith('7') && normalizedDigits.length > 0) {
      normalizedDigits = '7' + normalizedDigits;
    }
    normalizedDigits = normalizedDigits.slice(0, 11);
    
    if (normalizedDigits.length <= 1) return '+7';
    if (normalizedDigits.length <= 4) return `+7 (${normalizedDigits.slice(1)})`;
    if (normalizedDigits.length <= 7) return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4)}`;
    if (normalizedDigits.length <= 9) return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7)}`;
    return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7, 9)}-${normalizedDigits.slice(9, 11)}`;
  };

  // Обработчик изменения полей
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const formattedPhone = formatPhoneNumber(value);
      setFormData(prev => ({ ...prev, phone: formattedPhone }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  // Таймер для повторной отправки SMS
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Повторная отправка SMS кода
  const handleResendSMS = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await authService.forgotPassword(formData.phone);
      if (result.success) {
        startCountdown();
      } else {
        setError('Не удалось отправить SMS код');
      }
    } catch (error: any) {
      console.error('Ошибка повторной отправки SMS:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Ошибка при отправке SMS');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Проверка силы пароля
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return { level: 'weak', text: 'Слабый', color: '#ff4444' };
    if (strength <= 3) return { level: 'medium', text: 'Средний', color: '#ffaa00' };
    return { level: 'strong', text: 'Сильный', color: '#00aa44' };
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      switch (currentStep) {
        case 'phone':
          // Отправка SMS на телефон
          const forgotResult = await authService.forgotPassword(formData.phone);
          if (forgotResult.success) {
            setRecoveryMethod('sms');
            setCurrentStep('sms');
            startCountdown();
          } else {
            setError('Не удалось отправить SMS код');
          }
          break;
          
        case 'sms':
          // Проверка SMS кода
          const verifyResult = await authService.verifyResetCode(formData.phone, formData.smsCode);
          if (verifyResult.success && verifyResult.reset_token) {
            setResetToken(verifyResult.reset_token);
            setCurrentStep('newPassword');
          } else {
            setError('Неверный код или код истек');
          }
          break;
          
        case 'newPassword':
          // Установка нового пароля
          if (formData.newPassword !== formData.confirmPassword) {
            setError('Пароли не совпадают');
            return;
          }
          
          if (formData.newPassword.length < 6) {
            setError('Пароль должен содержать минимум 6 символов');
            return;
          }
          
          if (!resetToken) {
            setError('Токен сброса не найден. Повторите процедуру.');
            return;
          }
          
          const resetResult = await authService.resetPassword(
            formData.phone, 
            resetToken, 
            formData.newPassword
          );
          
          if (resetResult.success) {
            setCurrentStep('success');
          } else {
            setError('Не удалось изменить пароль');
          }
          break;
          
        case 'emailFallback':
          // Восстановление через email
          const emailResult = await authService.emailFallbackRecovery(formData.email, formData.phone);
          if (emailResult.success) {
            if (emailResult.method === 'email_link') {
              // Email отправлен - показываем успех
              setRecoveryMethod('email');
              setCurrentStep('success');
            } else if (emailResult.method === 'sms_to_registered_phone') {
              // Fallback к SMS (если вдруг такое понадобится)
              setRecoveryMethod('sms');
              setCurrentStep('sms');
              startCountdown();
            } else {
              setRecoveryMethod('email');
              setCurrentStep('success');
            }
          } else {
            setError(emailResult.message || 'Не удалось выполнить восстановление через email');
          }
          break;
      }
    } catch (error: any) {
      console.error('Ошибка восстановления пароля:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Произошла ошибка. Попробуйте еще раз.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Прогресс этапов
  const getStepProgress = () => {
    switch (currentStep) {
      case 'phone': return 25;
      case 'sms': return 50;
      case 'newPassword': return 75;
      case 'success': return 100;
      case 'emailFallback': return 50;
      default: return 0;
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>          
          <HeaderContent>
            <ModalTitle>Сброс пароля</ModalTitle>
            <ModalSubtitle>
              {currentStep === 'phone' && 'Введите номер телефона для восстановления'}
              {currentStep === 'sms' && 'Введите код из SMS'}
              {currentStep === 'newPassword' && 'Создайте новый пароль'}
              {currentStep === 'emailFallback' && 'Альтернативное восстановление'}
              {currentStep === 'success' && (recoveryMethod === 'email' ? 'Проверьте email' : 'Пароль успешно изменен')}
            </ModalSubtitle>
          </HeaderContent>
        </ModalHeader>

        {/* Прогресс-бар */}
        {currentStep !== 'success' && (
          <ProgressContainer>
            <ProgressBar>
              <ProgressFill 
                style={{ width: `${getStepProgress()}%` }}
                animate={{ width: `${getStepProgress()}%` }}
                transition={{ duration: 0.5 }}
              />
            </ProgressBar>
            <StepIndicator>Шаг {currentStep === 'emailFallback' ? '2' : Math.ceil(getStepProgress() / 25)} из 4</StepIndicator>
          </ProgressContainer>
        )}

        <FormContainer>
          {error && (
            <ErrorMessage
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </ErrorMessage>
          )}

          <AnimatePresence mode="wait">
            {/* Этап 1: Ввод номера телефона */}
            {currentStep === 'phone' && (
              <StepContainer
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Form onSubmit={handleSubmit}>
                  <InputGroup>
                    <InputLabel>Номер телефона</InputLabel>
                    <StyledInput
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+7 (999) 999-99-99"
                      required
                      disabled={isLoading}
                    />
                  </InputGroup>

                  <ButtonGroup>
                    <PrimaryButton type="submit" disabled={isLoading || !formData.phone}>
                      {isLoading ? 'Отправка...' : 'Отправить SMS код'}
                    </PrimaryButton>
                    
                    <SecondaryButton 
                      type="button" 
                      onClick={() => setCurrentStep('emailFallback')}
                    >
                      Номер телефона недоступен
                    </SecondaryButton>
                  </ButtonGroup>
                </Form>
              </StepContainer>
            )}

            {/* Этап 2: Ввод SMS кода */}
            {currentStep === 'sms' && (
              <StepContainer
                key="sms"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Form onSubmit={handleSubmit}>
                  <InputGroup>
                    <InputLabel>
                      SMS код отправлен на {formData.phone}
                      <BackButton onClick={() => setCurrentStep('phone')}>
                        Изменить номер
                      </BackButton>
                    </InputLabel>
                    <StyledInput
                      type="text"
                      name="smsCode"
                      value={formData.smsCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setFormData(prev => ({ ...prev, smsCode: value }));
                      }}
                      placeholder="Введите 6-значный код"
                      maxLength={6}
                      required
                      disabled={isLoading}
                      autoFocus
                    />
                    
                    {countdown > 0 ? (
                      <CountdownText>
                        Запросить новый код можно через {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                      </CountdownText>
                    ) : (
                      <ResendButton type="button" onClick={handleResendSMS} disabled={isLoading}>
                        {isLoading ? 'Отправка...' : 'Отправить новый код'}
                      </ResendButton>
                    )}
                  </InputGroup>

                  <ButtonGroup>
                    <PrimaryButton type="submit" disabled={isLoading || formData.smsCode.length !== 6}>
                      {isLoading ? 'Проверка...' : 'Подтвердить код'}
                    </PrimaryButton>
                  </ButtonGroup>
                </Form>
              </StepContainer>
            )}

            {/* Этап 3: Новый пароль */}
            {currentStep === 'newPassword' && (
              <StepContainer
                key="newPassword"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Form onSubmit={handleSubmit}>
                  <InputGroup>
                    <InputLabel>Новый пароль</InputLabel>
                    <PasswordContainer>
                      <StyledInput
                        type={showPassword ? 'text' : 'password'}
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        placeholder="Введите новый пароль"
                        required
                        disabled={isLoading}
                      />
                      <PasswordToggle
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? 'Скрыть' : 'Показать'}
                      </PasswordToggle>
                    </PasswordContainer>
                    
                    {formData.newPassword && (
                      <PasswordStrength strength={getPasswordStrength(formData.newPassword)}>
                        Сила пароля: {getPasswordStrength(formData.newPassword).text}
                      </PasswordStrength>
                    )}
                  </InputGroup>

                  <InputGroup>
                    <InputLabel>Подтвердите пароль</InputLabel>
                    <PasswordContainer>
                      <StyledInput
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Повторите новый пароль"
                        required
                        disabled={isLoading}
                      />
                      <PasswordToggle
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? 'Скрыть' : 'Показать'}
                      </PasswordToggle>
                    </PasswordContainer>
                  </InputGroup>

                  <ButtonGroup>
                    <PrimaryButton 
                      type="submit" 
                      disabled={isLoading || !formData.newPassword || !formData.confirmPassword}
                    >
                      {isLoading ? 'Сохранение...' : 'Сохранить пароль'}
                    </PrimaryButton>
                  </ButtonGroup>
                </Form>
              </StepContainer>
            )}

            {/* Альтернативное восстановление через email */}
            {currentStep === 'emailFallback' && (
              <StepContainer
                key="emailFallback"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <InfoBlock>
                  <InfoIcon>📧</InfoIcon>
                  <InfoText>
                    Если у вас нет доступа к номеру телефона, укажите email и последний используемый номер при регистрации
                  </InfoText>
                </InfoBlock>

                <Form onSubmit={handleSubmit}>
                  <InputGroup>
                    <InputLabel>Email адрес</InputLabel>
                    <StyledInput
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="example@mail.com"
                      required
                      disabled={isLoading}
                    />
                  </InputGroup>

                  <InputGroup>
                    <InputLabel>Последний номер телефона при регистрации</InputLabel>
                    <StyledInput
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+7 (999) 999-99-99"
                      required
                      disabled={isLoading}
                    />
                  </InputGroup>

                  <ButtonGroup>
                    <PrimaryButton 
                      type="submit" 
                      disabled={isLoading || !formData.email || !formData.phone}
                    >
                      {isLoading ? 'Отправка...' : 'Отправить запрос'}
                    </PrimaryButton>
                    
                    <SecondaryButton 
                      type="button" 
                      onClick={() => setCurrentStep('phone')}
                    >
                      ← Назад к SMS
                    </SecondaryButton>
                  </ButtonGroup>
                </Form>
              </StepContainer>
            )}

            {/* Успешное завершение */}
            {currentStep === 'success' && (
              <StepContainer
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <SuccessBlock>
                  <SuccessIconContainer>
                    <SuccessIconSVG>
                      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="32" fill="url(#successGradient)" />
                        <path 
                          d="M20 32L28 40L44 24" 
                          stroke="white" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                        <defs>
                          <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00D4AA" />
                            <stop offset="100%" stopColor="#007AFF" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </SuccessIconSVG>
                  </SuccessIconContainer>
                  
                  <SuccessTitle>
                    {recoveryMethod === 'email' 
                      ? 'Ссылка отправлена на email' 
                      : 'Пароль успешно изменен'
                    }
                  </SuccessTitle>
                  <SuccessText>
                    {recoveryMethod === 'email' 
                      ? 'Проверьте вашу почту и перейдите по ссылке для восстановления пароля. Ссылка действительна в течение 30 минут.'
                      : 'Теперь вы можете войти в систему с новым паролем'
                    }
                  </SuccessText>
                  
                  <ButtonGroup>
                    <PrimaryButton onClick={onBackToLogin}>
                      {recoveryMethod === 'email' ? 'Понятно' : 'Войти в систему'}
                    </PrimaryButton>
                  </ButtonGroup>
                </SuccessBlock>
              </StepContainer>
            )}
          </AnimatePresence>
        </FormContainer>

        {/* Футер с кнопкой "Назад к входу" */}
        {currentStep !== 'success' && (
          <ModalFooter>
            <FooterLink onClick={onBackToLogin}>
              ← Назад к входу
            </FooterLink>
          </ModalFooter>
        )}
      </ModalContent>
    </ModalOverlay>
  );
};

// Стили компонента
const ModalOverlay = styled.div`
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
  padding: 20px;
  
  @media (max-width: 768px) {
    padding: 0;
    backdrop-filter: blur(6px);
  }
  
  @media (max-width: 480px) {
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

const ModalContent = styled(motion.div)`
  background: linear-gradient(135deg, 
    rgba(15, 15, 20, 0.98) 0%, 
    rgba(25, 25, 35, 0.95) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  backdrop-filter: blur(25px);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  
  @media (max-width: 768px) {
    max-width: 100vw;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border: none;
  }
  
  @media (max-width: 480px) {
    border-radius: 0;
    border: none;
  }
`;

const ModalHeader = styled.div`
  padding: 24px 24px 0;
  position: relative;
  
  @media (max-width: 480px) {
    padding: 20px 16px 0;
  }
  
  @media (max-width: 360px) {
    padding: 16px 12px 0;
  }
`;



const HeaderContent = styled.div`
  text-align: center;
  margin-bottom: 24px;
`;

const ModalTitle = styled.h2`
  color: white;
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
  
  @media (max-width: 480px) {
    font-size: 20px;
    margin: 0 0 6px 0;
  }
  
  @media (max-width: 360px) {
    font-size: 18px;
    margin: 0 0 4px 0;
  }
`;

const ModalSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
`;

const ProgressContainer = styled.div`
  padding: 0 24px 24px;
`;

const ProgressBar = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  height: 6px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled(motion.div)`
  background: linear-gradient(90deg, #007AFF 0%, #00D4FF 100%);
  height: 100%;
  border-radius: 8px;
`;

const StepIndicator = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  text-align: center;
`;

const FormContainer = styled.div`
  padding: 0 24px 24px;
  
  @media (max-width: 480px) {
    padding: 0 16px 20px;
  }
  
  @media (max-width: 360px) {
    padding: 0 12px 16px;
  }
`;

const StepContainer = styled(motion.div)`
  width: 100%;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InputLabel = styled.label`
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledInput = styled.input`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 14px 16px;
  color: white;
  font-size: 16px;
  transition: all 0.3s ease;

  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  &:focus {
    outline: none;
    border-color: #007AFF;
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 480px) {
    padding: 12px 14px;
    font-size: 16px; /* Оставляем 16px для предотвращения зума на iOS */
    border-radius: 10px;
  }
  
  @media (max-width: 360px) {
    padding: 10px 12px;
    border-radius: 8px;
  }
`;

const PasswordContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.3s ease;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
  }
`;

const PasswordStrength = styled.div<{ strength: { level: string; text: string; color: string } }>`
  color: ${props => props.strength.color};
  font-size: 12px;
  font-weight: 500;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PrimaryButton = styled.button`
  background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
  border: none;
  border-radius: 12px;
  padding: 14px 20px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(0, 122, 255, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 480px) {
    padding: 12px 18px;
    font-size: 14px;
    border-radius: 10px;
    min-height: 44px;
  }
  
  @media (max-width: 360px) {
    padding: 10px 16px;
    font-size: 13px;
    border-radius: 8px;
    min-height: 40px;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 12px 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #007AFF;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;

  &:hover {
    color: #0056CC;
  }
`;

const CountdownText = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  text-align: center;
`;

const ResendButton = styled.button`
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 8px;
  padding: 8px 16px;
  color: #007AFF;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 122, 255, 0.2);
  }
`;

const InfoBlock = styled.div`
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
`;

const InfoIcon = styled.div`
  font-size: 20px;
  flex-shrink: 0;
`;

const InfoText = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  line-height: 1.4;
`;

const SuccessBlock = styled.div`
  text-align: center;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const SuccessIconContainer = styled.div`
  margin-bottom: 8px;
  animation: successPulse 2s ease-in-out infinite;
  
  @keyframes successPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;

const SuccessIconSVG = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 8px 24px rgba(0, 212, 170, 0.3));
`;

const SuccessTitle = styled.h3`
  color: white;
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  text-align: center;
  background: linear-gradient(135deg, #00D4AA 0%, #007AFF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: 480px) {
    font-size: 20px;
  }
`;

const SuccessText = styled.p`
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  line-height: 1.5;
  margin: 0 0 8px 0;
  text-align: center;
  max-width: 320px;
  
  @media (max-width: 480px) {
    font-size: 14px;
    max-width: 280px;
  }
`;

const ModalFooter = styled.div`
  padding: 0 24px 24px;
  text-align: center;
`;

const FooterLink = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.8);
  }
`;

const ErrorMessage = styled(motion.div)`
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 12px;
  padding: 12px 16px;
  color: #ff6b6b;
  font-size: 14px;
  text-align: center;
  margin-bottom: 16px;
`;

export default ForgotPasswordModal; 