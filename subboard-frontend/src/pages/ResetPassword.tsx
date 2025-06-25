import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import AnimatedLogo from '../shared/components/AnimatedLogo';

interface TokenValidationResponse {
  valid: boolean;
  message?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    newPassword: false,
    confirmPassword: false
  });

  // Проверка токена при загрузке
  useEffect(() => {
    const verifyToken = async (tokenToVerify: string) => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/auth/verify-email-token/${tokenToVerify}`);
        const data: TokenValidationResponse = await response.json();
        
        if (response.ok && data.valid) {
          setIsValidToken(true);
        } else {
          setError('Ссылка недействительна или истекла');
        }
      } catch (err) {
        setError('Ошибка проверки ссылки восстановления');
      } finally {
        setIsValidating(false);
      }
    };

    if (token) {
      verifyToken(token);
    } else {
      setError('Токен восстановления не найден');
      setIsValidating(false);
    }
  }, [token]);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Пароль должен содержать минимум 8 символов';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Пароль должен содержать строчные буквы';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Пароль должен содержать заглавные буквы';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Пароль должен содержать цифры';
    }
    return '';
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/(?=.*[a-z])/.test(password)) strength++;
    if (/(?=.*[A-Z])/.test(password)) strength++;
    if (/(?=.*\d)/.test(password)) strength++;
    if (/(?=.*[!@#$%^&*])/.test(password)) strength++;
    
    if (strength <= 2) return { level: 'weak', text: 'Слабый', color: '#ff4757' };
    if (strength <= 3) return { level: 'medium', text: 'Средний', color: '#ffa502' };
    return { level: 'strong', text: 'Сильный', color: '#2ed573' };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const togglePasswordVisibility = (field: 'newPassword' | 'confirmPassword') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwords.newPassword || !passwords.confirmPassword) {
      setError('Заполните все поля');
      return;
    }
    
    const passwordError = validatePassword(passwords.newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/reset-password-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          new_password: passwords.newPassword
        })
      });

      const data: ResetPasswordResponse = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setError(data.message || 'Ошибка при сбросе пароля');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  if (isValidating) {
    return (
      <PageContainer>
        <ContentWrapper>
          <FormContainer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatedLogo size="large" />
            <Title>Проверка ссылки...</Title>
            <LoadingSpinner />
          </FormContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  if (!isValidToken) {
    return (
      <PageContainer>
        <ContentWrapper>
          <FormContainer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatedLogo size="large" />
            <ErrorIcon>✕</ErrorIcon>
            <Title>Ссылка недействительна</Title>
            <ErrorMessage>{error}</ErrorMessage>
            <BackButton onClick={handleBackToMain}>
              Вернуться на главную
            </BackButton>
          </FormContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  if (success) {
    return (
      <PageContainer>
        <ContentWrapper>
          <FormContainer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatedLogo size="large" />
            <SuccessIcon>✓</SuccessIcon>
            <Title>Пароль успешно изменен!</Title>
            <SuccessMessage>
              Ваш пароль был успешно обновлен. <br />
              Через несколько секунд вы будете перенаправлены на главную страницу.
            </SuccessMessage>
            <BackButton onClick={handleBackToMain}>
              Перейти на главную
            </BackButton>
          </FormContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ContentWrapper>
        <FormContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatedLogo size="large" />
          <Title>Создание нового пароля</Title>
          <Subtitle>Привет, Вася!</Subtitle>
          
          <Form onSubmit={handleSubmit}>
            <InputGroup>
              <Label>Новый пароль</Label>
              <PasswordInputWrapper>
                <PasswordInput
                  type={showPasswords.newPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={passwords.newPassword}
                  onChange={handleInputChange}
                  placeholder="Введите новый пароль"
                  disabled={isLoading}
                />
                <PasswordToggle
                  type="button"
                  onClick={() => togglePasswordVisibility('newPassword')}
                  disabled={isLoading}
                >
                  {showPasswords.newPassword ? 'Скрыть' : 'Показать'}
                </PasswordToggle>
              </PasswordInputWrapper>
              {passwords.newPassword && (
                <PasswordStrength>
                  <StrengthBar strength={getPasswordStrength(passwords.newPassword).level}>
                    <StrengthFill strength={getPasswordStrength(passwords.newPassword).level} />
                  </StrengthBar>
                  <StrengthText color={getPasswordStrength(passwords.newPassword).color}>
                    {getPasswordStrength(passwords.newPassword).text}
                  </StrengthText>
                </PasswordStrength>
              )}
            </InputGroup>

            <InputGroup>
              <Label>Подтвердите пароль</Label>
              <PasswordInputWrapper>
                <PasswordInput
                  type={showPasswords.confirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={passwords.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Повторите новый пароль"
                  disabled={isLoading}
                />
                <PasswordToggle
                  type="button"
                  onClick={() => togglePasswordVisibility('confirmPassword')}
                  disabled={isLoading}
                >
                  {showPasswords.confirmPassword ? 'Скрыть' : 'Показать'}
                </PasswordToggle>
              </PasswordInputWrapper>
            </InputGroup>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <SubmitButton
              type="submit"
              disabled={isLoading || !passwords.newPassword || !passwords.confirmPassword}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? <LoadingSpinner /> : 'Изменить пароль'}
            </SubmitButton>
          </Form>

          <SecurityNote>
            Помните: используйте надежный пароль для защиты вашего аккаунта
          </SecurityNote>
        </FormContainer>
      </ContentWrapper>
    </PageContainer>
  );
};

// Стили в стиле SUBboards
const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  
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
    z-index: 0;
    
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

  @media (max-width: 768px) {
    padding: 20px;
    align-items: flex-start;
    padding-top: 40px;
  }
`;

const ContentWrapper = styled.div`
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
`;

const FormContainer = styled(motion.div)`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 1px 0 rgba(255, 255, 255, 0.6) inset,
    0 -1px 0 rgba(255, 255, 255, 0.3) inset;
  border: 1px solid rgba(255, 255, 255, 0.2);
  
  @media (max-width: 768px) {
    padding: 32px 24px;
    border-radius: 20px;
  }
  
  @media (max-width: 480px) {
    padding: 24px 20px;
    border-radius: 16px;
  }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  text-align: center;
  margin: 0 0 8px 0;
  
  @media (max-width: 768px) {
    font-size: 24px;
  }
  
  @media (max-width: 480px) {
    font-size: 22px;
  }
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #7f8c8d;
  text-align: center;
  margin: 0 0 32px 0;
  
  @media (max-width: 768px) {
    font-size: 15px;
    margin-bottom: 28px;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    margin-bottom: 24px;
  }
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

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
`;

const PasswordInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const PasswordInput = styled.input`
  width: 100%;
  padding: 16px 50px 16px 16px;
  border: 2px solid #e0e6ed;
  border-radius: 12px;
  font-size: 16px;
  background: rgba(255, 255, 255, 1);
  color: #2c3e50;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: rgba(255, 255, 255, 1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: #a0a0a0;
  }
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(102, 126, 234, 0.1);
    color: #5a67d8;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const PasswordStrength = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
`;

const StrengthBar = styled.div<{ strength: string }>`
  flex: 1;
  height: 4px;
  background: #e0e6ed;
  border-radius: 2px;
  overflow: hidden;
`;

const StrengthFill = styled.div<{ strength: string }>`
  height: 100%;
  border-radius: 2px;
  transition: all 0.3s ease;
  background: ${props => {
    switch (props.strength) {
      case 'weak': return '#ff4757';
      case 'medium': return '#ffa502';
      case 'strong': return '#2ed573';
      default: return '#e0e6ed';
    }
  }};
  width: ${props => {
    switch (props.strength) {
      case 'weak': return '33%';
      case 'medium': return '66%';
      case 'strong': return '100%';
      default: return '0%';
    }
  }};
`;

const StrengthText = styled.span<{ color: string }>`
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.color};
  min-width: 60px;
`;

const SubmitButton = styled(motion.button)`
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }
`;

const BackButton = styled.button`
  width: 100%;
  padding: 16px;
  background: transparent;
  color: #667eea;
  border: 2px solid #667eea;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #667eea;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  font-size: 14px;
  text-align: center;
  padding: 12px;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.2);
  border-radius: 8px;
`;

const SuccessMessage = styled.div`
  color: #27ae60;
  font-size: 16px;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 24px;
`;

const SecurityNote = styled.div`
  color: #7f8c8d;
  font-size: 12px;
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorIcon = styled.div`
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
  color: #e74c3c;
  font-weight: bold;
`;

const SuccessIcon = styled.div`
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
  color: #27ae60;
  font-weight: bold;
`;

export default ResetPassword; 