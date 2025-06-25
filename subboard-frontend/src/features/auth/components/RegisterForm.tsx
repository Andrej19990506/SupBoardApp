import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, clearError, authenticateWithTelegram, setCredentials } from '../store/authSlice';
import { selectIsLoading, selectAuthError } from '../store/authSelectors';
import { RegisterCredentials } from '../types';
import { AppDispatch } from '../../booking/store';
import { authService } from '../services/authService';
import VKHoverButton from './VKHoverButton';
import TelegramLoginButton, { TelegramUser } from './TelegramLoginButton';
import AnimatedLogo from '../../../shared/components/AnimatedLogo';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onClose: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectAuthError);

  const [formData, setFormData] = useState<RegisterCredentials>({
    phone: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [registrationStep, setRegistrationStep] = useState<'phone' | 'sms' | 'details'>('phone');
  const [smsCode, setSmsCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [smsError, setSmsError] = useState('');

  const formatPhoneNumber = (value: string) => {
    // Убираем все символы кроме цифр
    const digits = value.replace(/\D/g, '');
    
    // Если пустое поле, возвращаем пустую строку
    if (digits.length === 0) return '';
    
    // Если начинается с 8, заменяем на 7
    let normalizedDigits = digits;
    if (digits.startsWith('8')) {
      normalizedDigits = '7' + digits.slice(1);
    }
    
    // Если не начинается с 7, добавляем 7 (только если есть цифры)
    if (!normalizedDigits.startsWith('7') && normalizedDigits.length > 0) {
      normalizedDigits = '7' + normalizedDigits;
    }
    
    // Ограничиваем до 11 цифр (7 + 10 цифр номера)
    normalizedDigits = normalizedDigits.slice(0, 11);
    
    // Форматируем в зависимости от длины
    if (normalizedDigits.length <= 1) return '+7';
    if (normalizedDigits.length <= 4) return `+7 (${normalizedDigits.slice(1)}`;
    if (normalizedDigits.length <= 7) return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4)}`;
    if (normalizedDigits.length <= 9) return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7)}`;
    return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7, 9)}-${normalizedDigits.slice(9, 11)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const formattedPhone = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        [name]: formattedPhone
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Очищаем ошибки валидации при изменении поля
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validatePhoneForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Валидация номера телефона
    const phoneRegex = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
    if (!formData.phone) {
      errors.phone = 'Номер телефона обязателен для заполнения';
    } else if (!phoneRegex.test(formData.phone)) {
      errors.phone = 'Введите полный номер телефона';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDetailsForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Валидация имени
    if (!formData.name.trim()) {
      errors.name = 'Имя обязательно для заполнения';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Имя должно содержать минимум 2 символа';
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен для заполнения';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Введите корректный email';
    }

    // Валидация пароля
    if (!formData.password) {
      errors.password = 'Пароль обязателен для заполнения';
    } else if (formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }

    // Валидация подтверждения пароля
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Подтверждение пароля обязательно';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const startCountdown = () => {
            setCountdown(60); // 1 минута = 60 секунд
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError('');
    
    if (registrationStep === 'phone') {
      if (!validatePhoneForm()) {
        return;
      }

      try {
        // Отправляем SMS код на номер телефона
        const response = await authService.sendRegistrationSMSCode(formData.phone);
        if (response.success) {
          setRegistrationStep('sms');
          startCountdown();
        }
      } catch (error: any) {
        setSmsError(error.response?.data?.detail || 'Ошибка отправки SMS');
      }
    } else if (registrationStep === 'sms') {
      const code = smsCode.join('');
      if (code.length !== 6) {
        setSmsError('Введите 6-значный код');
        return;
      }

      try {
        // Проверяем SMS код регистрации
        await authService.verifyRegistrationSMSCode(formData.phone, code);
        
        // Если код верный, переходим к заполнению данных
        setRegistrationStep('details');
        setSmsError('');
      } catch (error: any) {
        setSmsError(error.response?.data?.detail || 'Неверный код');
      }
    } else if (registrationStep === 'details') {
      if (!validateDetailsForm()) {
        return;
      }

      try {
        // Регистрируем пользователя с полными данными используя новую функцию
        const registrationData = {
          ...formData
        };
        
        // Импортируем функцию регистрации напрямую
        const { registerUser: registerUserFunction } = await import('../services/authService');
        const authData = await registerUserFunction(registrationData);
        
        // Обновляем Redux состояние авторизации
        dispatch(setCredentials({
          user: authData.user,
          token: authData.access_token
        }));
        
        console.log('✅ Redux состояние обновлено после регистрации');
        
        // Небольшая задержка для корректного обновления Redux состояния
        setTimeout(() => {
          onClose();
        }, 100);
      } catch (error: any) {
        console.error('Ошибка регистрации:', error);
      }
    }
  };

  const handleSmsCodeChange = (index: number, value: string) => {
    if (value.length > 1) return; // Только одна цифра
    if (value && !/^\d$/.test(value)) return; // Только цифры

    const newCode = [...smsCode];
    newCode[index] = value;
    setSmsCode(newCode);

    // Автоматический переход к следующему полю
    if (value && index < 5) {
      const nextInput = document.getElementById(`sms-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSmsCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !smsCode[index] && index > 0) {
      const prevInput = document.getElementById(`sms-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleBackToPhone = () => {
    setRegistrationStep('phone');
    setSmsCode(['', '', '', '', '', '']);
    setSmsError('');
    setCountdown(0);
  };

  const handleBackToSms = () => {
    setRegistrationStep('sms');
    setValidationErrors({});
  };

  const isFormValid = formData.name && formData.phone && formData.password && 
                     formData.confirmPassword && Object.keys(validationErrors).length === 0;

  const handleVKAuth = (userData: any) => {
    // При регистрации через VK создаем аккаунт автоматически
    console.log('VK registration:', userData);
    onClose();
  };

  const handleGoogleLogin = () => {
    const googleAuthUrl = authService.getGoogleAuthUrl();
    window.location.href = googleAuthUrl;
  };

  const handleTelegramLogin = async (user: TelegramUser) => {
    try {
      console.log('Telegram user data:', user);
      const result = await dispatch(authenticateWithTelegram(user));
      if (authenticateWithTelegram.fulfilled.match(result)) {
        onClose();
      }
    } catch (error) {
      console.error('Telegram auth error:', error);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Form onSubmit={handleSubmit}>
          {registrationStep === 'phone' && (
            <>
              {/* Логотип */}

              <FormCard
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
              >
                <AnimatedLogo size="medium" /> 
                <PhoneIconContainer
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 150, 
                damping: 12,
                delay: 0.6
              }}
            >
              <AnimatedPhoneIcon>
                <motion.svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.8 }}
                >
                  <motion.path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.2, delay: 0.9 }}
                  />
                </motion.svg>
                
                {/* Анимированные волны сигнала */}
                <SignalWaves>
                  <motion.div
                    className="wave wave-1"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.2, 0], opacity: [0, 0.6, 0] }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      delay: 1.2
                    }}
                  />
                  <motion.div
                    className="wave wave-2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.5, 0], opacity: [0, 0.4, 0] }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      delay: 1.5
                    }}
                  />
                  <motion.div
                    className="wave wave-3"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.8, 0], opacity: [0, 0.2, 0] }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      delay: 1.8
                    }}
                  />
                </SignalWaves>
              </AnimatedPhoneIcon>
            </PhoneIconContainer>
                <FormTitle>Введите номер телефона</FormTitle>
                <FormDescription>
                  По этому номеру будет проходить авторизация в системе
                </FormDescription>

                <InputGroup>
                  <InputLabel>Номер телефона</InputLabel>
                  <PhoneInputContainer>
                    <PhoneInput
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+7 (___) ___-__-__"
                      required
                      disabled={isLoading}
                      $hasError={!!validationErrors.phone}
                    />
                  </PhoneInputContainer>
                  {validationErrors.phone && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ValidationError>{validationErrors.phone}</ValidationError>
                    </motion.div>
                  )}
                </InputGroup>

                <SubmitButton
                  type="submit"
                  disabled={isLoading || !formData.phone}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 1.4 }}
                >
                  {isLoading ? (
                    <>
                      <Spinner />
                      Отправка кода...
                    </>
                  ) : (
                    <>
                      <span>Отправить код</span>
                      <ArrowIcon>→</ArrowIcon>
                    </>
                  )}
                </SubmitButton>

                <FormFooter>
                  <FooterText>
                    Уже есть аккаунт?{' '}
                    <FooterLink onClick={onSwitchToLogin}>
                      Войти
                    </FooterLink>
                  </FooterText>
                </FormFooter>
              </FormCard>
            </>
          )}

          {registrationStep === 'sms' && (
            <>
              <TitleContainer>
                <MainTitle>Подтверждение номера</MainTitle>
                <SubTitle>
                  Введите 6-значный код из SMS,<br/>
                  отправленный на номер {formData.phone}
                </SubTitle>
              </TitleContainer>

              <InputGroup>
                <InputLabel>
                  Код из SMS
                  <BackButton
                    type="button"
                    onClick={handleBackToPhone}
                  >
                    Изменить номер
                  </BackButton>
                </InputLabel>
                <SmsCodeContainer>
                  {smsCode.map((value, index) => (
                    <SmsInput
                      key={index}
                      id={`sms-input-${index}`}
                      type="text"
                      value={value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSmsCodeChange(index, e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleSmsCodeKeyDown(index, e)}
                      placeholder="0"
                      maxLength={1}
                      required
                      disabled={isLoading}
                      autoFocus={index === 0}
                    />
                  ))}
                </SmsCodeContainer>
                {countdown > 0 ? (
                  <CountdownText>
                    Запросить новый код можно через {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </CountdownText>
                ) : (
                  <ResendButton
                    type="button"
                    onClick={async () => {
                      try {
                        setSmsError('');
                        const resendResponse = await authService.sendRegistrationSMSCode(formData.phone);
                        if (resendResponse.success) {
                          setSmsCode(['', '', '', '', '', '']);
                          startCountdown();
                        }
                      } catch (error: any) {
                        setSmsError(error.response?.data?.detail || 'Ошибка отправки SMS');
                      }
                    }}
                  >
                    Отправить новый код
                  </ResendButton>
                )}
                {smsError && (
                  <ValidationError>{smsError}</ValidationError>
                )}
              </InputGroup>

              <SubmitButton
                type="submit"
                disabled={
                  isLoading || 
                  smsCode.join('').length !== 6
                }
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Подтверждение...
                  </>
                ) : (
                  'Подтвердить код'
                )}
              </SubmitButton>
            </>
          )}

          {registrationStep === 'details' && (
            <>
              <TitleContainer>
                <MainTitle>Завершение регистрации</MainTitle>
                <SubTitle>
                  Заполните данные для создания аккаунта.<br/>
                  Email нужен для восстановления пароля.
                </SubTitle>
              </TitleContainer>

              <InputGroup>
                <InputLabel>Имя</InputLabel>
                <StyledInput
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ваше имя"
                  required
                  disabled={isLoading}
                  $hasError={!!validationErrors.name}
                />
                {validationErrors.name && (
                  <ValidationError>{validationErrors.name}</ValidationError>
                )}
              </InputGroup>

              <InputGroup>
                <InputLabel>Email</InputLabel>
                <StyledInput
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="example@example.com"
                  required
                  disabled={isLoading}
                  $hasError={!!validationErrors.email}
                />
                {validationErrors.email && (
                  <ValidationError>{validationErrors.email}</ValidationError>
                )}
              </InputGroup>

              <InputGroup>
                <InputLabel>Пароль</InputLabel>
                <PasswordContainer>
                  <StyledInput
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Минимум 6 символов"
                    required
                    disabled={isLoading}
                    $hasError={!!validationErrors.password}
                  />
                  <PasswordToggle
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? 'Скрыть' : 'Показать'}
                  </PasswordToggle>
                </PasswordContainer>
                {validationErrors.password && (
                  <ValidationError>{validationErrors.password}</ValidationError>
                )}
              </InputGroup>

              <InputGroup>
                <InputLabel>Подтверждение пароля</InputLabel>
                <PasswordContainer>
                  <StyledInput
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Повторите пароль"
                    required
                    disabled={isLoading}
                    $hasError={!!validationErrors.confirmPassword}
                  />
                  <PasswordToggle
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? 'Скрыть' : 'Показать'}
                  </PasswordToggle>
                </PasswordContainer>
                {validationErrors.confirmPassword && (
                  <ValidationError>{validationErrors.confirmPassword}</ValidationError>
                )}
              </InputGroup>

              <BackButton
                type="button"
                onClick={handleBackToSms}
                style={{ marginBottom: '16px' }}
              >
                ← Назад к SMS
              </BackButton>

              <SubmitButton
                type="submit"
                disabled={isLoading || !formData.name || !formData.email || !formData.password || !formData.confirmPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Создание аккаунта...
                  </>
                ) : (
                  'Создать аккаунт'
                )}
              </SubmitButton>
            </>
          )}
        </Form>
      </motion.div>
    </AnimatePresence>
  );
};

// Стили (переиспользуем многие из LoginForm, но добавляем специфичные)
const FormContainer = styled(motion.div)`
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
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(255, 255, 255, 0.05);
  padding: 36px;
  width: 100%;
  max-width: 420px;
  position: relative;
  overflow: hidden;
  
  /* Мобильная адаптация */
  @media (max-width: 768px) {
    padding: 24px 20px;
    margin: 16px;
    max-width: calc(100vw - 32px);
    border-radius: 20px;
    min-height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  @media (max-width: 480px) {
    padding: 20px 16px;
    margin: 12px;
    max-width: calc(100vw - 24px);
    border-radius: 16px;
    min-height: calc(100vh - 80px);
  }

  /* Добавляем тонкий светящийся эффект по краям с зеленоватым оттенком для регистрации */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 24px;
    padding: 1px;
    background: linear-gradient(135deg, 
      rgba(33, 150, 243, 0.3) 0%, 
      rgba(255, 255, 255, 0.1) 25%,
      rgba(33, 150, 243, 0.2) 50%,
      rgba(255, 255, 255, 0.05) 75%,
      rgba(33, 150, 243, 0.3) 100%
    );
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: subtract;
    z-index: -1;
    opacity: 0.6;
    animation: borderGlow 4s ease-in-out infinite;
    
    @media (max-width: 768px) {
      border-radius: 20px;
    }
    
    @media (max-width: 480px) {
      border-radius: 16px;
    }
  }

  @keyframes borderGlow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
`;

const FormHeader = styled.div`
  text-align: center;
  margin-bottom: 28px;
  
  @media (max-width: 768px) {
    margin-bottom: 24px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 20px;
  }
`;



const FormSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.5;
  margin: 8px 0 0 0;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const ErrorMessage = styled(motion.div)`
  background: linear-gradient(135deg, 
    rgba(255, 59, 48, 0.15) 0%, 
    rgba(255, 59, 48, 0.08) 100%
  );
  border: 1px solid rgba(255, 59, 48, 0.25);
  border-radius: 16px;
  padding: 14px 18px;
  margin-bottom: 24px;
  color: #ff6b6b;
  font-size: 14px;
  text-align: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(255, 59, 48, 0.1);
  
  @media (max-width: 768px) {
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: 13px;
    border-radius: 14px;
  }
  
  @media (max-width: 480px) {
    padding: 10px 14px;
    margin-bottom: 16px;
    font-size: 12px;
    border-radius: 12px;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  @media (max-width: 768px) {
    gap: 18px;
  }
  
  @media (max-width: 480px) {
    gap: 16px;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  @media (max-width: 480px) {
    gap: 6px;
  }
`;

const InputLabel = styled.label`
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.3px;
  
  @media (max-width: 768px) {
    font-size: 14px;
    margin-bottom: 3px;
  }
  
  @media (max-width: 480px) {
    font-size: 13px;
    margin-bottom: 2px;
  }
`;

const StyledInput = styled.input<{ $hasError?: boolean }>`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.12) 0%, 
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.08) 100%
  );
  border: 1px solid ${props => 
    props.$hasError 
      ? 'rgba(255, 59, 48, 0.5)' 
      : 'rgba(255, 255, 255, 0.25)'
  };
  border-radius: 18px;
  padding: 18px 22px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(15px);
  box-shadow: 
    0 6px 25px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  width: 100%;
  box-sizing: border-box;
  
  @media (max-width: 768px) {
    padding: 16px 20px;
    font-size: 16px;
    border-radius: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 14px 18px;
    font-size: 16px; /* Оставляем 16px для предотвращения зума на iOS */
    border-radius: 14px;
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.55);
    font-weight: 400;
  }

  &:focus {
    outline: none;
    border-color: ${props => 
      props.$hasError 
        ? 'rgba(255, 59, 48, 0.7)' 
        : 'rgba(33, 150, 243, 0.7)'
    };
    box-shadow: 
      0 0 0 4px ${props => 
        props.$hasError 
          ? 'rgba(255, 59, 48, 0.15)' 
          : 'rgba(52, 199, 89, 0.2)'
      },
      0 12px 40px ${props => 
        props.$hasError 
          ? 'rgba(255, 59, 48, 0.2)' 
          : 'rgba(52, 199, 89, 0.25)'
      },
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.18) 0%, 
      rgba(255, 255, 255, 0.10) 50%,
      rgba(255, 255, 255, 0.15) 100%
    );
    transform: translateY(-2px);
    
    @media (max-width: 480px) {
      transform: translateY(-1px);
      box-shadow: 
        0 0 0 3px ${props => 
          props.$hasError 
            ? 'rgba(255, 59, 48, 0.15)' 
            : 'rgba(52, 199, 89, 0.2)'
        },
        0 8px 30px ${props => 
          props.$hasError 
            ? 'rgba(255, 59, 48, 0.15)' 
            : 'rgba(52, 199, 89, 0.2)'
        },
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: ${props => 
      props.$hasError 
        ? 'rgba(255, 59, 48, 0.6)' 
        : 'rgba(255, 255, 255, 0.35)'
    };
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.15) 0%, 
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.12) 100%
    );
    transform: translateY(-1px);
    box-shadow: 
      0 8px 30px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
      
    @media (max-width: 480px) {
      transform: none; /* Убираем hover эффекты на мобильных */
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PasswordInput = styled(StyledInput)`
  padding-right: 56px;
  
  @media (max-width: 768px) {
    padding-right: 52px;
  }
  
  @media (max-width: 480px) {
    padding-right: 48px;
  }
`;

const ValidationError = styled.div`
  color: #ff6b6b;
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  
  @media (max-width: 768px) {
    font-size: 11px;
    margin-top: 3px;
    gap: 3px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
    margin-top: 2px;
    gap: 2px;
  }

  &::before {
    content: '⚠️';
    font-size: 10px;
    
    @media (max-width: 480px) {
      font-size: 9px;
    }
  }
`;

const PasswordInputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  white-space: nowrap;
  
  @media (max-width: 768px) {
    right: 14px;
    padding: 3px 6px;
    font-size: 10px;
  }
  
  @media (max-width: 480px) {
    right: 12px;
    padding: 3px 6px;
    font-size: 10px;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-50%) scale(1.02);
    
    @media (max-width: 480px) {
      transform: translateY(-50%);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(-50%) scale(0.98);
    
    @media (max-width: 480px) {
      transform: translateY(-50%);
    }
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled(motion.button)`
  background: linear-gradient(135deg, 
    rgba(52, 199, 89, 1) 0%, 
    rgba(48, 179, 79, 0.9) 30%,
    rgba(52, 199, 89, 0.95) 70%,
    rgba(40, 159, 69, 1) 100%
  );
  border: 1px solid rgba(52, 199, 89, 0.6);
  border-radius: 18px;
  padding: 18px 28px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
  width: 100%;
  box-sizing: border-box;
  backdrop-filter: blur(15px);
  box-shadow: 
    0 8px 32px rgba(52, 199, 89, 0.3),
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  
  @media (max-width: 768px) {
    padding: 16px 24px;
    font-size: 15px;
    border-radius: 16px;
    margin-top: 10px;
  }
  
  @media (max-width: 480px) {
    padding: 14px 20px;
    font-size: 15px;
    border-radius: 14px;
    margin-top: 8px;
    min-height: 48px; /* Минимальная высота для удобного нажатия */
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
      rgba(255, 255, 255, 0.3), 
      transparent
    );
    transition: left 0.6s;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, 
      rgba(52, 199, 89, 1) 0%, 
      rgba(48, 189, 79, 1) 30%,
      rgba(56, 209, 93, 1) 70%,
      rgba(44, 179, 73, 1) 100%
    );
    border-color: rgba(52, 199, 89, 0.8);
    box-shadow: 
      0 12px 48px rgba(52, 199, 89, 0.4),
      0 6px 24px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);

    &::before {
      left: 100%;
    }
    
    @media (max-width: 480px) {
      transform: translateY(-1px);
      box-shadow: 
        0 8px 32px rgba(52, 199, 89, 0.3),
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 
      0 8px 24px rgba(52, 199, 89, 0.35),
      0 4px 12px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
      
    @media (max-width: 480px) {
      transform: none;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.1) 0%, 
      rgba(255, 255, 255, 0.05) 100%
    );
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    box-shadow: none;
  }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @media (max-width: 480px) {
    width: 14px;
    height: 14px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const FormFooter = styled.div`
  text-align: center;
  margin-top: 24px;
  
  @media (max-width: 768px) {
    margin-top: 20px;
  }
  
  @media (max-width: 480px) {
    margin-top: 16px;
  }
`;

const FooterText = styled.p`
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

const FooterLink = styled.button`
  background: none;
  border: none;
  color: #34C759;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }

  &:hover {
    color: #1976D2;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 28px 0 24px 0;
  gap: 16px;
  
  @media (max-width: 768px) {
    margin: 24px 0 20px 0;
    gap: 14px;
  }
  
  @media (max-width: 480px) {
    margin: 20px 0 16px 0;
    gap: 12px;
  }
`;

const DividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.15) 20%,
    rgba(255, 255, 255, 0.25) 50%,
    rgba(255, 255, 255, 0.15) 80%,
    transparent 100%
  );
`;

const DividerText = styled.span`
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  padding: 0 4px;
  
  @media (max-width: 768px) {
    font-size: 12px;
  }
  
  @media (max-width: 480px) {
    font-size: 11px;
    padding: 0 2px;
  }
`;

const SocialButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    gap: 12px;
    margin-bottom: 18px;
  }
  
  @media (max-width: 480px) {
    gap: 10px;
    margin-bottom: 16px;
  }
`;

const GoogleButton = styled(motion.button)`
  width: 100%;
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
  border: 1px solid rgba(218, 220, 224, 0.8);
  border-radius: 16px;
  padding: 14px 18px;
  color: #3c4043;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05);
    
  @media (max-width: 768px) {
    padding: 12px 16px;
    font-size: 14px;
    border-radius: 14px;
    gap: 10px;
  }
  
  @media (max-width: 480px) {
    padding: 12px 14px;
    font-size: 14px;
    border-radius: 12px;
    gap: 8px;
    min-height: 44px;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
    border-color: rgba(198, 198, 198, 1);
    box-shadow: 
      0 6px 24px rgba(0, 0, 0, 0.15),
      0 3px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
    
    @media (max-width: 480px) {
      transform: none;
    }
  }

  &:active:not(:disabled) {
    background: linear-gradient(135deg, #f1f3f4 0%, #e8eaed 100%);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.1),
      0 2px 8px rgba(0, 0, 0, 0.05);
    transform: translateY(0px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;



const PhoneIconContainer = styled(motion.div)`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  position: relative;
`;

const AnimatedPhoneIcon = styled.div`
  position: relative;
  color: #2196F3;
  filter: drop-shadow(0 4px 12px rgba(33, 150, 243, 0.3));
  
  svg {
    display: block;
  }
`;

const SignalWaves = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  
  .wave {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border: 2px solid #2196F3;
    border-radius: 50%;
    
    &.wave-1 {
      width: 50px;
      height: 50px;
    }
    
    &.wave-2 {
      width: 70px;
      height: 70px;
    }
    
    &.wave-3 {
      width: 90px;
      height: 90px;
    }
  }
`;

const TitleContainer = styled.div`
  text-align: center;
  margin-bottom: 28px;
  
  @media (max-width: 768px) {
    margin-bottom: 24px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 20px;
  }
`;

const MainTitle = styled.h1`
  background: linear-gradient(135deg, 
    #ffffff 0%, 
    #2196F3 25%,
    #1976D2 50%,
    #2196F3 75%,
    #ffffff 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 6px 0;
  letter-spacing: -0.8px;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 24px;
    margin: 0 0 5px 0;
    letter-spacing: -0.6px;
  }
  
  @media (max-width: 480px) {
    font-size: 22px;
    margin: 0 0 4px 0;
    letter-spacing: -0.4px;
  }
  
  /* Fallback для браузеров без поддержки */
  @supports not (-webkit-background-clip: text) {
    color: #ffffff;
  }

  /* Добавляем тень для глубины */
  text-shadow: 0 4px 16px rgba(33, 150, 243, 0.4);
`;

const SubTitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.5;
  margin: 8px 0 0 0;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const PasswordContainer = styled.div`
  position: relative;
  width: 100%;
`;

const SmsCodeContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    gap: 6px;
  }
  
  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const SmsInput = styled.input`
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.12) 0%, 
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.08) 100%
  );
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(15px);
  box-sizing: border-box;
  
  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
    font-weight: 400;
  }
  
  &:focus {
    outline: none;
    border-color: rgba(33, 150, 243, 0.2);
    box-shadow: 
              0 0 0 4px rgba(33, 150, 243, 0.2),
              0 12px 40px rgba(33, 150, 243, 0.25);
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.18) 0%, 
      rgba(255, 255, 255, 0.10) 50%,
      rgba(255, 255, 255, 0.15) 100%
    );
    transform: translateY(-2px);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: rgba(255, 255, 255, 0.3);
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.15) 0%, 
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.12) 100%
    );
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #2196F3;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }

  &:hover {
    color: rgba(33, 150, 243, 0.2);
  }
`;

const CountdownText = styled.span`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin-top: 4px;
  display: block;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const ResendButton = styled.button`
  background: none;
  border: none;
  color: rgba(33, 150, 243, 0.7);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }

  &:hover {
    color: rgba(33, 150, 243, 0.2);
  }
`;

// Новые styled components для улучшенного дизайна
const WelcomeCard = styled(motion.div)`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 32px 24px;
  margin-bottom: 24px;
  text-align: center;
  
  @media (max-width: 768px) {
    padding: 28px 20px;
    margin-bottom: 20px;
    border-radius: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 24px 16px;
    margin-bottom: 16px;
    border-radius: 12px;
  }
`;

const WelcomeTitle = styled(motion.h2)`
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  margin: 20px 0 12px 0;
  background: linear-gradient(135deg, #ffffff, #2196F3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: 768px) {
    font-size: 24px;
    margin: 16px 0 10px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 20px;
    margin: 12px 0 8px 0;
  }
`;

const WelcomeSubtitle = styled(motion.p)`
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  line-height: 1.5;
  margin: 0 0 24px 0;
  
  @media (max-width: 768px) {
    font-size: 15px;
    margin: 0 0 20px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    margin: 0 0 16px 0;
  }
`;

const FeaturesList = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
  
  @media (max-width: 768px) {
    gap: 10px;
    margin-top: 16px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    margin-top: 12px;
  }
`;

const FeatureItem = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  
  @media (max-width: 768px) {
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
  }
`;

const FeatureIcon = styled.span`
  font-size: 20px;
  
  @media (max-width: 768px) {
    font-size: 18px;
  }
  
  @media (max-width: 480px) {
    font-size: 16px;
  }
`;

const FeatureText = styled.span`
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const FormCard = styled(motion.div)`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 32px 28px;
  
  @media (max-width: 768px) {
    padding: 28px 24px;
    border-radius: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 24px 20px;
    border-radius: 12px;
  }
`;

const FormTitle = styled.h3`
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 18px;
  }
  
  @media (max-width: 480px) {
    font-size: 16px;
  }
`;

const FormDescription = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 24px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 13px;
    margin: 0 0 20px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
    margin: 0 0 16px 0;
  }
`;

const PhoneInputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.12) 0%, 
    rgba(255, 255, 255, 0.06) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  
  &:focus-within {
    border-color: rgba(33, 150, 243, 0.7);
    box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.2);
  }
  
  @media (max-width: 768px) {
    border-radius: 10px;
  }
  
  @media (max-width: 480px) {
    border-radius: 8px;
  }
`;

const PhoneInputIcon = styled.div`
  padding: 0 16px;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.6);
  
  @media (max-width: 768px) {
    padding: 0 14px;
    font-size: 18px;
  }
  
  @media (max-width: 480px) {
    padding: 0 12px;
    font-size: 16px;
  }
`;

const PhoneInput = styled.input<{ $hasError?: boolean }>`
  flex: 1;
  background: transparent;
  border: none;
  padding: 18px 22px 18px 0;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  
  @media (max-width: 768px) {
    padding: 16px 20px 16px 0;
    font-size: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 14px 18px 14px 0;
    font-size: 16px; /* Оставляем 16px для предотвращения зума на iOS */
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.55);
    font-weight: 400;
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ArrowIcon = styled.span`
  margin-left: 8px;
  font-size: 18px;
  transition: transform 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 16px;
    margin-left: 6px;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    margin-left: 4px;
  }
`;

export default RegisterForm;