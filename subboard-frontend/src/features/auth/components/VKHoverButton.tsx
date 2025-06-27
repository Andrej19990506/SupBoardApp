import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface VKHoverButtonProps {
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

const VKHoverButton: React.FC<VKHoverButtonProps> = ({
  onSuccess,
  onError,
  disabled = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isSDKReady, setIsSDKReady] = useState(false);

  useEffect(() => {
    // Устанавливаем глобальные функции для VK FloatingOneTap
    (window as any).vkidOnSuccess = (data: any) => {
      console.log('VK FloatingOneTap Success:', data);
      onSuccess(data);
    };

    (window as any).vkidOnError = (error: any) => {
      console.log('VK FloatingOneTap Error:', error);
      onError(error);
    };

    // Проверяем готовность SDK
    const checkSDK = () => {
      if ((window as any).VKIDSDK) {
        setIsSDKReady(true);
      } else {
        setTimeout(checkSDK, 100);
      }
    };
    checkSDK();

    return () => {
      delete (window as any).vkidOnSuccess;
      delete (window as any).vkidOnError;
    };
  }, [onSuccess, onError]);

  const handleMouseEnter = () => {
    if (!disabled && isSDKReady) {
      setIsHovered(true);
      
      // Показываем FloatingOneTap при hover
      setTimeout(() => {
        if (isHovered) {
          showFloatingOneTap();
        }
      }, 300);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = () => {
    if (!disabled && isSDKReady) {
      showFloatingOneTap();
    }
  };

  const showFloatingOneTap = () => {
    // Создаем скрипт с официальным кодом FloatingOneTap
    const floatingScript = document.createElement('script');
    floatingScript.textContent = `
      if ('VKIDSDK' in window) {
        const VKID = window.VKIDSDK;

        VKID.Config.init({
          app: 53780062,
          redirectUrl: 'https://supboardapp.ru/auth/vk/callback',
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: 'vkid.personal_info email phone',
        });

        const floatingOneTap = new VKID.FloatingOneTap();

        floatingOneTap.render({
          scheme: 'dark',
          contentId: 6,
          appName: 'SUPBoardsApp',
          showAlternativeLogin: true
        })
        .on(VKID.WidgetEvents.ERROR, window.vkidOnError)
        .on(VKID.FloatingOneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
          const code = payload.code;
          const deviceId = payload.device_id;

          VKID.Auth.exchangeCode(code, deviceId)
            .then(function(data) {
              floatingOneTap.close();
              window.vkidOnSuccess(data);
            })
            .catch(window.vkidOnError);
        });
      }
    `;
    
    document.body.appendChild(floatingScript);
    
    // Удаляем скрипт после выполнения
    setTimeout(() => floatingScript.remove(), 100);
  };

  return (
    <VKButton
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled || !isSDKReady}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      $isHovered={isHovered}
    >
      <VKIcon>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1.01-1.49-.9-1.744-.9-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.441 0 .61.203.78.677.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.271.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .763.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
        </svg>
      </VKIcon>
      
      <ButtonText>
        {!isSDKReady ? 'Загрузка...' : 'Быстрая регистрация с VK'}
      </ButtonText>
    </VKButton>
  );
};

const VKButton = styled(motion.button)<{ $isHovered: boolean }>`
  width: 100%;
  background: ${props => props.$isHovered 
    ? 'linear-gradient(135deg, #0077FF 0%, #0056CC 100%)' 
    : '#0077FF'
  };
  border: 1px solid ${props => props.$isHovered ? '#0056CC' : '#0077FF'};
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #0056CC 0%, #003D99 100%);
    border-color: #0056CC;
    box-shadow: 0 4px 12px rgba(0, 119, 255, 0.4);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    background: #003D99;
    border-color: #003D99;
    box-shadow: 0 2px 8px rgba(0, 119, 255, 0.3);
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Анимированный фон при hover */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover::before {
    left: 100%;
  }
`;

const VKIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;

  ${VKButton}:hover & {
    transform: scale(1.1) rotate(5deg);
  }
`;

const ButtonText = styled.span`
  font-weight: 500;
  transition: all 0.3s ease;
`;

export default VKHoverButton; 