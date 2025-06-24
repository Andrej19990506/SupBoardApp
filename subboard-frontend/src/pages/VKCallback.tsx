import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { authenticateWithVK } from '../features/auth/store/authSlice';
import { AppDispatch } from '../features/booking/store';

const VKCallback: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const handleVKCallback = async () => {
      try {
        // Получаем код авторизации из URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code) {
          // Отправляем код на сервер для получения токена
          await dispatch(authenticateWithVK({ 
            code, 
            state: state || undefined 
          }));
          
          // Перенаправляем на главную страницу
          window.location.href = '/';
        } else {
          // Ошибка авторизации
          console.error('VK authorization failed: no code received');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('VK callback error:', error);
        window.location.href = '/';
      }
    };

    handleVKCallback();
  }, [dispatch]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)',
      color: '#fff'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #007AFF',
          borderTop: '3px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p>Завершение авторизации через VK...</p>
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default VKCallback; 