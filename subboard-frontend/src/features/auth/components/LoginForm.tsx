import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, authenticateWithVK, clearError, authenticateWithTelegram, setUser } from '../store/authSlice';
import { selectIsLoading, selectAuthError } from '../store/authSelectors';
import { LoginCredentials } from '../types';
import { authService } from '../services/authService';
import { AppDispatch } from '../../booking/store';
import VKHoverButton from './VKHoverButton';
import TelegramLoginButton, { TelegramUser } from './TelegramLoginButton';
import { saveAccount } from '../utils/savedAccountsUtils';
import AnimatedLogo from '../../../shared/components/AnimatedLogo';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
  onClose: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onForgotPassword, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectAuthError);

  const [formData, setFormData] = useState({
    phone: '', // Номер телефона для SMS
    password: '', // Пароль для входа через пароль
  });

  const [loginMode, setLoginMode] = useState<'sms' | 'password'>('sms'); // Режим входа
  const [showPassword, setShowPassword] = useState(false); // Показать/скрыть пароль
  const [smsStep, setSmsStep] = useState<'phone' | 'code'>('phone');
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [smsError, setSmsError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneCheckResult, setPhoneCheckResult] = useState<{ exists: boolean; userName?: string; userAvatar?: string } | null>(null);

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
    if (normalizedDigits.length <= 4) return `+7 (${normalizedDigits.slice(1)})`;
    if (normalizedDigits.length <= 7) return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4)}`;
    if (normalizedDigits.length <= 9) return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7)}`;
    return `+7 (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7, 9)}-${normalizedDigits.slice(9, 11)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'user-phone-number') {
      const formattedPhone = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        phone: formattedPhone
      }));
      
      // Сбрасываем предыдущий результат проверки при изменении номера
      setPhoneCheckResult(null);
      setSmsError('');
      
      // Проверяем номер если он полный (11 цифр) и режим SMS
      const digits = formattedPhone.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('7') && loginMode === 'sms') {
        checkPhoneDebounced(formattedPhone);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      
      // Очищаем ошибки при изменении пароля
      if (name === 'user-auth-password') {
        setSmsError('');
        setFormData(prev => ({
          ...prev,
          password: value
        }));
      }
    }
  };

  // Функция для проверки номера телефона с задержкой
  const checkPhoneDebounced = React.useCallback(
    React.useMemo(
      () => {
        let timeoutId: NodeJS.Timeout;
        return (phone: string) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            if (!phone || isLoading) return;
            
            setIsCheckingPhone(true);
            try {
              const result = await authService.checkPhoneExists(phone);
              console.log('🔍 checkPhoneExists результат:', result);
              console.log('🔍 checkPhoneExists аватар:', result.user_avatar);
              console.log('🔍 checkPhoneExists тип аватара:', typeof result.user_avatar);
              setPhoneCheckResult({
                exists: result.user_exists,
                userName: result.user_name,
                userAvatar: result.user_avatar
              });
            } catch (error: any) {
              // Если ошибка 404 - значит пользователь не найден
              if (error.response?.status === 404) {
                setPhoneCheckResult({ exists: false });
              } else {
                // Другие ошибки не показываем пока пользователь не попытается отправить SMS
                setPhoneCheckResult(null);
              }
            } finally {
              setIsCheckingPhone(false);
            }
          }, 500); // Задержка 500мс
        };
      },
      [isLoading]
    ),
    [isLoading]
  );

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
    
    if (loginMode === 'password') {
      // Авторизация через пароль
      if (!formData.phone) {
        setSmsError('Введите номер телефона');
        return;
      }
      
      if (!formData.password) {
        setSmsError('Введите пароль');
        return;
      }

      try {
        const result = await authService.loginWithPassword(formData.phone, formData.password);
        if (result.user) {
          // Обновляем Redux состояние - токен уже сохранен в authService
          dispatch(clearError());
          dispatch(setUser(result.user));
          
          // Сохраняем аккаунт если выбран чекбокс
          if (rememberMe) {
            saveAccountToLocalStorage(result.user, formData.phone);
          }
          
          onClose();
        }
      } catch (error: any) {
        setSmsError(error.response?.data?.detail || 'Неверный номер телефона или пароль');
      }
    } else {
      // Авторизация через SMS (существующая логика)
      if (smsStep === 'phone') {
        if (!formData.phone) {
          setSmsError('Введите номер телефона');
          return;
        }

        try {
          // Сначала проверяем существование аккаунта
          const checkResponse = await authService.checkPhoneExists(formData.phone);
          
          if (checkResponse.user_exists) {
            // Аккаунт существует - отправляем SMS код
            const smsResponse = await authService.sendSMSCode(formData.phone);
            if (smsResponse.success) {
              setSmsStep('code');
              startCountdown();
            }
          }
        } catch (error: any) {
          // Если аккаунт не найден или другая ошибка
          setSmsError(error.response?.data?.detail || 'Ошибка проверки номера');
        }
      } else if (smsStep === 'code') {
        if (!smsCode || smsCode.length !== 4) {
          setSmsError('Введите 4-значный код');
          return;
        }

        try {
          const result = await authService.verifySMSCode(formData.phone, smsCode);
          if (result.user) {
            // Обновляем Redux состояние - токен уже сохранен в authService
            dispatch(clearError());
            dispatch(setUser(result.user));
            
            // Сохраняем аккаунт если выбран чекбокс
            if (rememberMe) {
              saveAccountToLocalStorage(result.user, formData.phone);
            }
            
            onClose();
          }
        } catch (error: any) {
          setSmsError(error.response?.data?.detail || 'Неверный код');
        }
      }
    }
  };

  // Функция для сохранения аккаунта
  const saveAccountToLocalStorage = (user: any, phone: string) => {
    try {
      console.log('saveAccountToLocalStorage - user данные:', user);
      console.log('saveAccountToLocalStorage - user.avatar:', user.avatar);
      
      // 🛡️ НЕ СОХРАНЯЕМ ТОКЕНЫ из соображений безопасности XSS
      // Device Trust будет работать через HttpOnly cookies
      const savedAccount = {
        id: user.id || Date.now().toString(),
        name: user.name || 'Пользователь',
        phone: phone,
        avatar: user.avatar || undefined,
        lastLogin: new Date().toISOString()
        // Токены НЕ сохраняются для безопасности
      };

      console.log('saveAccountToLocalStorage - сохраняемый аккаунт (без токенов):', savedAccount);
      saveAccount(savedAccount);
    } catch (error) {
      console.error('Ошибка сохранения аккаунта:', error);
    }
  };

  const handleVKAuth = () => {
    // VK авторизация через перенаправление
    try {
      const vkAuthUrl = authService.getVKAuthUrl();
      window.location.href = vkAuthUrl;
    } catch (error) {
      console.error('VK auth error:', error);
      // Показываем ошибку пользователю
      alert('VK авторизация недоступна. Проверьте настройки.');
    }
  };

  const handleTelegramAuth = () => {
    // Создаем Telegram Login Widget динамически
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', 'SubBoardAuthBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    // Создаем глобальную функцию для callback
    (window as any).onTelegramAuth = async (user: TelegramUser) => {
      console.log('Telegram auth success:', user);
      try {
        const result = await dispatch(authenticateWithTelegram(user));
        if (authenticateWithTelegram.fulfilled.match(result)) {
          onClose();
        }
      } catch (error) {
        console.error('Telegram auth error:', error);
      }
    };

    // Добавляем скрипт на страницу
    document.head.appendChild(script);
    
    // Показываем уведомление пользователю
    console.log('Telegram Login Widget загружается...');
  };

  const handleGoogleLogin = () => {
    const googleAuthUrl = authService.getGoogleAuthUrl();
    window.location.href = googleAuthUrl;
  };

  return (
    <FormContainer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Логотип */}
      <LogoContainer>
        <AnimatedLogo size="medium" />
        
        <LogoText
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5,
            delay: 0.3,
            ease: "easeOut"
          }}
        >
          <MainTitle>SUPBoard</MainTitle>
          <Subtitle>Система управления прокатом досок</Subtitle>
        </LogoText>
      </LogoContainer>

      <FormHeader>
        <FormTitle>Вход в систему</FormTitle>
        <FormSubtitle>Войдите в свой аккаунт для продолжения</FormSubtitle>
      </FormHeader>

      {(error || smsError) && (
        <ErrorMessage
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          ⚠️ {error || smsError}
        </ErrorMessage>
      )}

      <Form onSubmit={handleSubmit}>
        {/* Скрытые поля-ловушки для обмана автозаполнения */}
        <input type="text" name="username" style={{ display: 'none' }} autoComplete="username" tabIndex={-1} />
        <input type="password" name="fake-password" style={{ display: 'none' }} autoComplete="current-password" tabIndex={-1} />
        
        {/* Поле номера телефона (всегда видимо) */}
        <InputGroup>
          <InputLabel>Номер телефона</InputLabel>
                      <StyledInput
              type="tel"
              name="user-phone-number"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+7 (999) 999-99-99"
              required
              disabled={isLoading}
              autoComplete="new-password"
              data-form-type="other"
              readOnly
              onFocus={(e) => {
                e.target.removeAttribute('readonly');
              }}
            />
          {/* Индикатор статуса проверки номера для SMS режима */}
          {loginMode === 'sms' && formData.phone && formData.phone.replace(/\D/g, '').length === 11 && (
            <PhoneStatusContainer>
              {isCheckingPhone ? (
                <PhoneStatusChecking>
                  <Spinner style={{ width: '16px', height: '16px' }} />
                  Проверяем номер...
                </PhoneStatusChecking>
              ) : phoneCheckResult?.exists ? (
                <PhoneStatusSuccess>
                  <UserFoundCard
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 200, 
                      damping: 20,
                      duration: 0.4 
                    }}
                  >
                    <UserAvatar>
                      {phoneCheckResult.userAvatar ? (
                        <AvatarImage 
                          src={`${import.meta.env.VITE_APP_API_URL || 'http://localhost:8000'}${phoneCheckResult.userAvatar}`}
                          alt={phoneCheckResult.userName || 'Пользователь'}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement;
                            if (placeholder) {
                              placeholder.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <AvatarPlaceholder style={{ display: phoneCheckResult.userAvatar ? 'none' : 'flex' }}>
                        {(phoneCheckResult.userName || 'У').charAt(0).toUpperCase()}
                      </AvatarPlaceholder>
                    </UserAvatar>
                    <UserInfo>
                      <UserFoundText>Найден аккаунт</UserFoundText>
                      <UserName>{phoneCheckResult.userName}</UserName>
                    </UserInfo>
                    <CheckIcon>✓</CheckIcon>
                  </UserFoundCard>
                </PhoneStatusSuccess>
              ) : phoneCheckResult?.exists === false ? (
                <PhoneStatusError>
                  ❌ Пользователь не найден. Попробуйте зарегистрироваться
                </PhoneStatusError>
              ) : null}
            </PhoneStatusContainer>
          )}
        </InputGroup>

        {/* Поле пароля (только в режиме пароля) */}
        {loginMode === 'password' && (
          <InputGroup>
            <InputLabel>Пароль</InputLabel>
            <PasswordContainer>
              <StyledInput
                type={showPassword ? 'text' : 'password'}
                name="user-auth-password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Введите пароль"
                required
                disabled={isLoading}
                autoComplete="new-password"
                data-form-type="other"
                readOnly
                onFocus={(e) => {
                  e.target.removeAttribute('readonly');
                }}
              />
              <PasswordToggle
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                                 {showPassword ? 'Скрыть' : 'Показать'}
              </PasswordToggle>
            </PasswordContainer>
          </InputGroup>
        )}

        {/* SMS код (только в SMS режиме и на втором шаге) */}
        {loginMode === 'sms' && smsStep === 'code' && (
          <InputGroup>
            <InputLabel>
              SMS код отправлен на {formData.phone}
              <BackButton 
                type="button" 
                onClick={() => {
                  setSmsStep('phone');
                  setSmsCode('');
                  setCountdown(0);
                  setSmsError('');
                }}
              >
                Изменить номер
              </BackButton>
            </InputLabel>
            <StyledInput
              type="text"
              name="smsCode"
              value={smsCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setSmsCode(value);
              }}
              placeholder="Введите 4-значный код"
              maxLength={4}
              required
              disabled={isLoading}
              autoFocus
            />
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
                    const response = await authService.sendSMSCode(formData.phone);
                    if (response.success) {
                      setSmsCode('');
                      startCountdown();
                    }
                  } catch (error: any) {
                    setSmsError(error.response?.data?.detail || 'Ошибка отправки SMS');
                  }
                }}
              >
                📱 Отправить новый код
              </ResendButton>
            )}
          </InputGroup>
        )}

        {/* Кнопка "Войти через пароль" */}
        {loginMode === 'sms' && smsStep === 'phone' && (
          <PasswordModeButton
            type="button"
            onClick={() => {
              setLoginMode('password');
              setSmsError('');
              setPhoneCheckResult(null);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Войти через пароль
          </PasswordModeButton>
        )}

        {/* Кнопка "Назад к SMS" */}
        {loginMode === 'password' && (
          <BackToSMSButton
            type="button"
            onClick={() => {
              setLoginMode('sms');
              setSmsError('');
              setFormData(prev => ({ ...prev, password: '' }));
            }}
          >
            ← Назад к SMS коду
          </BackToSMSButton>
        )}

        {/* Чекбокс "Сохранить вход" */}
        <RememberMeContainer>
          <RememberMeCheckbox>
            <CheckboxInput
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <CheckboxCustom $checked={rememberMe}>
              {rememberMe && (
                <CheckboxIcon>✓</CheckboxIcon>
              )}
            </CheckboxCustom>
            <CheckboxLabel htmlFor="rememberMe">
              Сохранить вход
            </CheckboxLabel>
          </RememberMeCheckbox>
        </RememberMeContainer>

        <SubmitButton
          type="submit"
          disabled={
            isLoading || 
            isCheckingPhone ||
            (loginMode === 'password' && (!formData.phone || !formData.password)) ||
            (loginMode === 'sms' && smsStep === 'phone' && (!formData.phone || !phoneCheckResult?.exists)) || 
            (loginMode === 'sms' && smsStep === 'code' && smsCode.length !== 4)
          }
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <>
              <Spinner />
              {loginMode === 'password' ? 'Вход...' : (smsStep === 'phone' ? 'Отправка SMS...' : 'Проверка кода...')}
            </>
          ) : isCheckingPhone ? (
            <>
              <Spinner />
              Проверка номера...
            </>
          ) : (
            loginMode === 'password' ? 'Войти' : (smsStep === 'phone' ? 'Отправить SMS код' : 'Подтвердить код')
          )}
        </SubmitButton>
      </Form>

      <SocialSection>
        <SocialDivider>
          <SocialDividerLine />
          <SocialTitle>или войти через</SocialTitle>
          <SocialDividerLine />
        </SocialDivider>
        <SocialButtons>
          <SocialIconButton
            onClick={() => {
              // VK авторизация
              handleVKAuth();
            }}
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 8px 32px rgba(25, 118, 210, 0.4)"
            }}
            whileTap={{ scale: 0.98 }}
            $bgColor="transparent"
          >
            <img src="/icons8-vk-circled.svg" alt="VK" width="40" height="40" />
          </SocialIconButton>

          <SocialIconButton
            onClick={() => {
              // Создаем Telegram Login Widget динамически
              handleTelegramAuth();
            }}
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 8px 32px rgba(41, 182, 246, 0.4)"
            }}
            whileTap={{ scale: 0.98 }}
            $bgColor="transparent"
          >
            <img src="/icons8-telegram-app.svg" alt="Telegram" width="40" height="40" />
          </SocialIconButton>

          <SocialIconButton
            onClick={handleGoogleLogin}
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 8px 32px rgba(66, 133, 244, 0.3)"
            }}
            whileTap={{ scale: 0.98 }}
            $bgColor="transparent"
          >
            <img src="/icons8-google.svg" alt="Google" width="40" height="40" />
          </SocialIconButton>
        </SocialButtons>
      </SocialSection>

      <FormFooter>
        <FooterText>
          Нет аккаунта?{' '}
          <FooterLink onClick={onSwitchToRegister}>
            Зарегистрироваться
          </FooterLink>
        </FooterText>
        <FooterDivider>•</FooterDivider>
        <FooterText>
          <FooterLink onClick={onForgotPassword}>
            Забыл пароль
          </FooterLink>
        </FooterText>
      </FormFooter>
    </FormContainer>
  );
};

// Стили в стиле стекломорфизм
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
    margin: 0;
    max-width: 100vw;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: none;
  }
  
  @media (max-width: 480px) {
    padding: 12px 8px;
    margin: 0;
    max-width: 100vw;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    border: none;
  }
  
  @media (max-width: 360px) {
    padding: 12px 10px;
  }

  /* Добавляем тонкий светящийся эффект по краям */
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
    
    @media (max-width: 768px) {
      border-radius: 0;
    }
    
    @media (max-width: 480px) {
      border-radius: 0;
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
    margin-bottom: 12px;
  }
  
  @media (max-width: 360px) {
    margin-bottom: 12px;
  }
`;

const FormTitle = styled.h2`
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 10px 0;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  letter-spacing: -0.3px;
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: 768px) {
    font-size: 24px;
    margin: 0 0 8px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 18px;
    margin: 0 0 4px 0;
  }
  
  @media (max-width: 360px) {
    font-size: 18px;
    margin: 0 0 4px 0;
  }
`;

const FormSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.75);
  font-size: 15px;
  margin: 0;
  font-weight: 400;
  line-height: 1.4;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    font-size: 13px;
    line-height: 1.3;
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
  gap: 24px;
  
  @media (max-width: 768px) {
    gap: 20px;
  }
  
  @media (max-width: 480px) {
    gap: 12px;
  }
  
  @media (max-width: 360px) {
    gap: 10px;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  
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
    font-size: 12px;
    margin-bottom: 1px;
  }
`;

const PasswordInputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.12) 0%, 
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.08) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.25);
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
    padding: 10px 14px;
    font-size: 16px; /* Оставляем 16px для предотвращения зума на iOS */
    border-radius: 10px;
  }
  
  @media (max-width: 360px) {
    padding: 10px 14px;
    border-radius: 10px;
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.55);
    font-weight: 400;
  }

  &:focus {
    outline: none;
    border-color: rgba(0, 122, 255, 0.7);
    box-shadow: 
      0 0 0 4px rgba(0, 122, 255, 0.2),
      0 12px 40px rgba(0, 122, 255, 0.25),
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
        0 0 0 3px rgba(0, 122, 255, 0.2),
        0 8px 30px rgba(0, 122, 255, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: rgba(255, 255, 255, 0.35);
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

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-50%) scale(1.02);
  }

  &:active:not(:disabled) {
    transform: translateY(-50%) scale(0.98);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled(motion.button)`
  background: linear-gradient(135deg, 
    rgba(0, 122, 255, 1) 0%, 
    rgba(0, 102, 255, 0.9) 30%,
    rgba(0, 122, 255, 0.95) 70%,
    rgba(0, 92, 230, 1) 100%
  );
  border: 1px solid rgba(0, 122, 255, 0.6);
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
    0 8px 32px rgba(0, 122, 255, 0.3),
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
    padding: 10px 16px;
    font-size: 13px;
    border-radius: 10px;
    margin-top: 6px;
    min-height: 40px; /* Минимальная высота для удобного нажатия */
  }
  
  @media (max-width: 360px) {
    padding: 10px 16px;
    font-size: 13px;
    border-radius: 10px;
    margin-top: 6px;
    min-height: 40px;
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
      rgba(0, 122, 255, 1) 0%, 
      rgba(0, 112, 255, 1) 30%,
      rgba(0, 132, 255, 1) 70%,
      rgba(0, 102, 240, 1) 100%
    );
    border-color: rgba(0, 122, 255, 0.8);
    box-shadow: 
      0 12px 48px rgba(0, 122, 255, 0.4),
      0 6px 24px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);

    &::before {
      left: 100%;
    }
    
    @media (max-width: 480px) {
      transform: translateY(-1px);
      box-shadow: 
        0 8px 32px rgba(0, 122, 255, 0.3),
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 
      0 8px 24px rgba(0, 122, 255, 0.35),
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

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const SocialSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 24px 0 20px 0;
  
  @media (max-width: 768px) {
    margin: 20px 0 18px 0;
  }
  
  @media (max-width: 480px) {
    margin: 16px 0 16px 0;
  }
`;

const SocialDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  width: 100%;
  
  @media (max-width: 768px) {
    gap: 14px;
    margin-bottom: 18px;
  }
  
  @media (max-width: 480px) {
    gap: 12px;
    margin-bottom: 16px;
  }
`;

const SocialDividerLine = styled.div`
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.2) 50%, 
    transparent 100%
  );
`;

const SocialTitle = styled.div`
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  
  @media (max-width: 768px) {
    font-size: 12px;
  }
  
  @media (max-width: 480px) {
    font-size: 11px;
  }
`;

const SocialButtons = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  
  @media (max-width: 768px) {
    gap: 18px;
  }
  
  @media (max-width: 480px) {
    gap: 12px;
  }
`;

const SocialIconButton = styled(motion.button)<{ $bgColor: string; $textColor?: string }>`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: ${props => props.$bgColor === 'transparent' 
    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
    : props.$bgColor
  };
  backdrop-filter: blur(20px);
  color: ${props => props.$textColor || '#ffffff'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  
  @media (max-width: 768px) {
    width: 56px;
    height: 56px;
  }
  
  @media (max-width: 480px) {
    width: 46px;
    height: 46px;
  }

  img {
    z-index: 2;
    flex-shrink: 0;
    border-radius: 50%;
    
    @media (max-width: 768px) {
      width: 36px !important;
      height: 36px !important;
    }
    
    @media (max-width: 480px) {
      width: 28px !important;
      height: 28px !important;
    }
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at center, 
      rgba(255, 255, 255, 0.15) 0%, 
      rgba(255, 255, 255, 0.05) 50%,
      transparent 100%
    );
    opacity: 0;
    transition: opacity 0.4s ease;
    z-index: 1;
    border-radius: 50%;
  }

  &:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02);
    border-color: rgba(255, 255, 255, 0.25);
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.15) 0%, 
      rgba(255, 255, 255, 0.08) 100%
    );
    
    &::before {
      opacity: 1;
    }
    
    @media (max-width: 480px) {
      transform: translateY(-2px) scale(1.01);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(-1px) scale(0.99);
    transition: all 0.1s ease;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FormFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  text-align: center;
  margin-top: 24px;
  
  @media (max-width: 768px) {
    margin-top: 20px;
  }
  
  @media (max-width: 480px) {
    margin-top: 12px;
    flex-direction: column;
    gap: 6px;
  }
`;

const FooterText = styled.p`
  color: #86868B;
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
  color: #007AFF;
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
    color: #0056CC;
  }
`;

const FooterDivider = styled.span`
  color: #86868B;
  font-size: 14px;
  margin: 0 12px;
  
  @media (max-width: 768px) {
    font-size: 13px;
    margin: 0 10px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
    margin: 0 8px;
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #007AFF;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 12px;
  transition: color 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 11px;
    margin-left: 10px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
    margin-left: 8px;
  }

  &:hover {
    color: #0051D0;
  }
`;

const CountdownText = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-top: 8px;
  text-align: center;
  
  @media (max-width: 480px) {
    font-size: 11px;
    margin-top: 6px;
  }
`;

const ResendButton = styled.button`
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.2) 0%, rgba(0, 122, 255, 0.1) 100%);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 8px;
  padding: 8px 16px;
  color: #007AFF;
  font-size: 12px;
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.2s ease;
  width: 100%;
  
  @media (max-width: 768px) {
    padding: 7px 14px;
    font-size: 11px;
    border-radius: 7px;
    margin-top: 7px;
  }
  
  @media (max-width: 480px) {
    padding: 6px 12px;
    font-size: 11px;
    border-radius: 6px;
    margin-top: 6px;
    min-height: 36px;
  }

  &:hover {
    background: linear-gradient(135deg, rgba(0, 122, 255, 0.3) 0%, rgba(0, 122, 255, 0.2) 100%);
    border-color: rgba(0, 122, 255, 0.5);
  }
`;

// Стили для контейнера логотипа
const LogoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28px;
  padding: 20px 0;
  
  @media (max-width: 768px) {
    margin-bottom: 24px;
    padding: 16px 0;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 20px;
    padding: 12px 0;
  }
`;

const LogoText = styled(motion.div)`
  text-align: center;
`;

const MainTitle = styled.h1`
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
  text-shadow: 0 4px 16px rgba(0, 122, 255, 0.4);
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  margin: 0;
  font-weight: 500;
  text-align: center;
  line-height: 1.4;
  opacity: 0.95;
  
  @media (max-width: 768px) {
    font-size: 12px;
    line-height: 1.3;
  }
  
  @media (max-width: 480px) {
    font-size: 11px;
    line-height: 1.2;
  }
  
  /* Добавляем легкую тень */
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
`;

// Стили для чекбокса "Сохранить вход"
const RememberMeContainer = styled.div`
  margin: 16px 0 8px 0;
  
  @media (max-width: 768px) {
    margin: 14px 0 6px 0;
  }
  
  @media (max-width: 480px) {
    margin: 8px 0 2px 0;
  }
`;

const RememberMeCheckbox = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  
  @media (max-width: 768px) {
    gap: 10px;
  }
  
  @media (max-width: 480px) {
    gap: 6px;
  }
`;

const CheckboxInput = styled.input`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 0;
  height: 0;
`;

const CheckboxCustom = styled.div<{ $checked: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid ${props => props.$checked ? '#007AFF' : 'rgba(255, 255, 255, 0.3)'};
  background: ${props => props.$checked 
    ? 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)' 
    : 'rgba(255, 255, 255, 0.05)'
  };
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  backdrop-filter: blur(10px);
  box-shadow: ${props => props.$checked 
    ? '0 4px 16px rgba(0, 122, 255, 0.3)' 
    : '0 2px 8px rgba(0, 0, 0, 0.1)'
  };
  
  @media (max-width: 768px) {
    width: 18px;
    height: 18px;
    border-radius: 5px;
  }
  
  @media (max-width: 480px) {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }

  &:hover {
    border-color: ${props => props.$checked ? '#0056CC' : 'rgba(255, 255, 255, 0.5)'};
    background: ${props => props.$checked 
      ? 'linear-gradient(135deg, #0056CC 0%, #003D99 100%)' 
      : 'rgba(255, 255, 255, 0.08)'
    };
    transform: scale(1.05);
    
    @media (max-width: 480px) {
      transform: none;
    }
  }
`;

const CheckboxIcon = styled.div`
  color: white;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  
  @media (max-width: 768px) {
    font-size: 11px;
  }
  
  @media (max-width: 480px) {
    font-size: 9px;
  }
`;

const CheckboxLabel = styled.label`
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 11px;
  }

  &:hover {
    color: rgba(255, 255, 255, 1);
  }
`;

// Стили для индикатора статуса проверки номера
const PhoneStatusContainer = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  
  @media (max-width: 768px) {
    margin-top: 6px;
    padding: 6px 10px;
    font-size: 12px;
  }
  
  @media (max-width: 480px) {
    margin-top: 4px;
    padding: 4px 8px;
    font-size: 11px;
  }
`;

const PhoneStatusChecking = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: inherit;
  border-radius: inherit;
  
  @media (max-width: 768px) {
    gap: 6px;
  }
  
  @media (max-width: 480px) {
    gap: 4px;
  }
`;

const PhoneStatusSuccess = styled.div`
  background: linear-gradient(135deg, 
    rgba(0, 122, 255, 0.15) 0%, 
    rgba(0, 122, 255, 0.08) 100%
  );
  border: 1px solid rgba(0, 122, 255, 0.3);
  padding: 0;
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow: 
    0 8px 32px rgba(0, 122, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  
  @media (max-width: 768px) {
    border-radius: 14px;
  }
  
  @media (max-width: 480px) {
    border-radius: 12px;
  }
`;

const UserFoundCard = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  
  @media (max-width: 768px) {
    gap: 10px;
    padding: 10px 14px;
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    padding: 8px 12px;
  }
`;

const UserAvatar = styled.div`
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
  }
  
  @media (max-width: 480px) {
    width: 32px;
    height: 32px;
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
  background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
  border-radius: 50%;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserFoundText = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 2px;
  
  @media (max-width: 768px) {
    font-size: 11px;
  }
  
  @media (max-width: 480px) {
    font-size: 10px;
  }
`;

const UserName = styled.div`
  color: #007AFF;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 768px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const CheckIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
  
  @media (max-width: 768px) {
    width: 22px;
    height: 22px;
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    width: 20px;
    height: 20px;
    font-size: 12px;
  }
`;

const PhoneStatusError = styled.div`
  color: #f44336;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  padding: inherit;
  border-radius: inherit;
  
  /* Добавляем легкое свечение */
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.2);
`;

const PasswordContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const PasswordModeButton = styled(motion.button)`
  width: 100%;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-0.5px);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    padding: 7px 14px;
    font-size: 12px;
    margin-bottom: 10px;
  }
  
  @media (max-width: 480px) {
    padding: 6px 12px;
    font-size: 11px;
    margin-bottom: 8px;
  }
`;

const BackToSMSButton = styled.button`
  width: 100%;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  padding: 10px 16px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 0.8);
    transform: translateY(-0.5px);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    font-size: 12px;
    padding: 8px 14px;
    margin-bottom: 14px;
    gap: 4px;
  }
  
  @media (max-width: 480px) {
    font-size: 11px;
    padding: 6px 12px;
    margin-bottom: 12px;
    gap: 3px;
  }
`;

export default LoginForm; 