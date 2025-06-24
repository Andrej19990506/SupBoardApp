import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  onAuth: (user: TelegramUser) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  botUsername: string; // Обязательный параметр - имя бота без @
}

const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  onAuth,
  onError,
  disabled = false,
  botUsername
}) => {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botUsername) {
      onError?.('Не указано имя бота для Telegram авторизации');
      return;
    }

    // Создаем уникальное имя функции для этого экземпляра
    const callbackName = `telegramLoginCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Добавляем глобальную функцию для callback
    (window as any)[callbackName] = (user: TelegramUser) => {
      console.log('Telegram auth success:', user);
      onAuth(user);
      
      // Очищаем глобальную функцию после использования
      delete (window as any)[callbackName];
    };

    // Создаем скрипт для Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    script.setAttribute('data-request-access', 'write');

    script.onload = () => {
      console.log('Telegram Widget SDK загружен');
      console.log('Bot username:', botUsername);
      console.log('Current domain:', window.location.hostname);
      setIsSDKLoaded(true);
      
      // Проверяем через некоторое время, создался ли iframe
      setTimeout(() => {
        const iframe = widgetContainerRef.current?.querySelector('iframe');
        console.log('Telegram iframe найден:', !!iframe);
        if (iframe) {
          console.log('Iframe src:', iframe.src);
        } else {
          console.error('Telegram Widget iframe НЕ создался - проверьте настройки домена в BotFather');
        }
      }, 1000);
    };

    script.onerror = () => {
      console.error('Ошибка загрузки Telegram Widget SDK');
      onError?.('Не удалось загрузить Telegram Widget');
      delete (window as any)[callbackName];
    };

    // Добавляем скрипт в скрытый контейнер
    if (widgetContainerRef.current) {
      widgetContainerRef.current.appendChild(script);
    }

    return () => {
      // Очищаем при размонтировании
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName];
      }
      if (widgetContainerRef.current && widgetContainerRef.current.contains(script)) {
        widgetContainerRef.current.removeChild(script);
      }
    };
  }, [botUsername, onAuth, onError]);

  // Убираем handleClick - теперь используем встроенную кнопку Telegram

  return (
    <>
      {/* Контейнер для настоящей Telegram кнопки */}
      <TelegramWidgetContainer 
        ref={widgetContainerRef}
        style={{ 
          width: '100%',
          minHeight: '54px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      />
      
      {/* Показываем загрузку пока SDK не готов */}
      {!isSDKLoaded && (
        <TelegramButton
          type="button"
          disabled={true}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.568 8.16c-.18 1.896-.96 6.504-1.356 8.628-.168.9-.504 1.2-.816 1.236-.696.06-1.224-.456-1.896-.9-1.056-.696-1.656-1.128-2.676-1.8-1.188-.78-.42-1.212.264-1.908.18-.18 3.252-2.976 3.312-3.228a.24.24 0 0 0-.06-.216c-.072-.06-.168-.036-.24-.024-.096.024-1.62 1.032-4.572 3.036-.432.3-.816.444-1.164.432-.384-.012-1.128-.216-1.68-.396-.672-.216-1.204-.336-1.152-.708.024-.192.156-.384.396-.576 4.176-1.8 6.96-2.988 8.34-3.576C16.776 5.016 17.376 4.8 17.76 4.8c.072 0 .24.024.348.144.084.096.108.228.120.324-.012.072-.024.288-.06.456z"/>
          </svg>
          Загрузка Telegram...
        </TelegramButton>
      )}
    </>
  );
};

const TelegramWidgetContainer = styled.div`
  position: relative;
  width: 100%;
  
  /* Стилизация встроенной Telegram кнопки */
  iframe {
    width: 100% !important;
    height: 54px !important;
    border: none !important;
    border-radius: 16px !important;
    overflow: hidden !important;
  }
`;

const TelegramButton = styled(motion.button)`
  width: 100%;
  background: linear-gradient(135deg, rgba(0, 136, 204, 0.8) 0%, rgba(0, 102, 153, 0.9) 100%);
  border: 1px solid rgba(0, 136, 204, 0.3);
  border-radius: 16px;
  padding: 16px 20px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  backdrop-filter: blur(10px);
  box-shadow: 
    0 8px 32px rgba(0, 136, 204, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.6s;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(0, 136, 204, 0.9) 0%, rgba(0, 102, 153, 1) 100%);
    border-color: rgba(0, 136, 204, 0.5);
    box-shadow: 
      0 12px 40px rgba(0, 136, 204, 0.25),
      0 6px 20px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);

    &::before {
      left: 100%;
    }
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 
      0 8px 24px rgba(0, 136, 204, 0.2),
      0 4px 12px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    transition: transform 0.3s ease;
  }

  &:hover:not(:disabled) svg {
    transform: scale(1.1) rotate(5deg);
  }
`;

export default TelegramLoginButton;
export type { TelegramUser }; 