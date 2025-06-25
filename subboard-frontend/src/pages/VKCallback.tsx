import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../features/booking/store/hooks';
import { authenticateWithVK } from '../features/auth/store/authSlice';
import AnimatedLogo from '../shared/components/AnimatedLogo';
import styled from 'styled-components';

const CallbackContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  text-align: center;
`;

const LoadingText = styled.div`
  margin-top: 20px;
  font-size: 16px;
  color: #666;
`;

const ErrorText = styled.div`
  margin-top: 20px;
  font-size: 16px;
  color: #e74c3c;
  max-width: 400px;
`;

const VKCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleVKCallback = async () => {
      try {
        // Получаем параметры из URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        console.log('🔍 VK Callback parameters:', { code, state, error, errorDescription });

        // Проверяем на ошибки от VK
        if (error) {
          console.error('❌ VK OAuth error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(`Ошибка VK авторизации: ${errorDescription || error}`);
          return;
        }

        // Проверяем наличие кода авторизации
        if (!code) {
          console.error('❌ No authorization code from VK');
          setStatus('error');
          setErrorMessage('Не получен код авторизации от VK');
          return;
        }

        // Проверяем state для защиты от CSRF
        const storedState = localStorage.getItem('vk_auth_state');
        if (!storedState || storedState !== state) {
          console.error('❌ VK OAuth state mismatch');
          setStatus('error');
          setErrorMessage('Ошибка безопасности: неверный state параметр');
          return;
        }

        // Очищаем сохраненный state
        localStorage.removeItem('vk_auth_state');

        console.log('✅ VK OAuth validation passed, authenticating...');

        // Вызываем авторизацию через Redux
        const result = await dispatch(authenticateWithVK({
          code,
          state
        })).unwrap();

        console.log('✅ VK authentication successful:', result);

        // Перенаправляем на главную страницу
        navigate('/', { replace: true });

      } catch (error: any) {
        console.error('❌ VK authentication failed:', error);
        setStatus('error');
        setErrorMessage(
          error?.message || 
          'Не удалось войти через VK. Попробуйте еще раз.'
        );
      }
    };

    handleVKCallback();
  }, [searchParams, navigate, dispatch]);

  if (status === 'error') {
    return (
      <CallbackContainer>
        <AnimatedLogo />
        <ErrorText>
          {errorMessage}
        </ErrorText>
        <button 
          onClick={() => navigate('/')} 
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Вернуться на главную
        </button>
      </CallbackContainer>
    );
  }

  return (
    <CallbackContainer>
      <AnimatedLogo />
      <LoadingText>
        Завершаем вход через VK...
      </LoadingText>
    </CallbackContainer>
  );
};

export default VKCallback; 