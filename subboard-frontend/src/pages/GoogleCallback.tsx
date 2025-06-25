import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { authenticateWithGoogle } from '../features/auth/store/authSlice';
import { AppDispatch } from '../features/booking/store';

const GoogleCallback: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        // Получаем код авторизации из URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const scope = urlParams.get('scope');

        console.log('🔄 Google callback - получены параметры:', { 
          code: code?.substring(0, 20) + '...', 
          state, 
          scope 
        });

        if (code) {
          console.log('📡 Отправляем код на сервер...');
          
          // Отправляем код на сервер для получения токена
          const result = await dispatch(authenticateWithGoogle({ 
            code, 
            state: state || undefined,
            scope: scope || 'openid email profile'
          }));
          
          console.log('✅ Результат авторизации:', result);
          
          // Перенаправляем на главную страницу
          window.location.href = '/';
        } else {
          // Ошибка авторизации
          console.error('❌ Google authorization failed: no code received');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('❌ Google callback error:', error);
        window.location.href = '/';
      }
    };

    handleGoogleCallback();
  }, [dispatch]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          fontSize: '48px', 
          marginBottom: '20px',
          animation: 'spin 2s linear infinite'
        }}>
          🔄
        </div>
        <h2>Завершаем авторизацию через Google...</h2>
        <p>Пожалуйста, подождите</p>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default GoogleCallback; 