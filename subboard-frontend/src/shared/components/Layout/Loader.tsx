import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import canoeGif from '@/assets/canoe.gif';

const LoaderWrapper = styled.div<{ $visible: boolean }>`
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: linear-gradient(135deg, 
    rgba(15, 15, 20, 0.98) 0%, 
    rgba(25, 25, 35, 0.95) 30%,
    rgba(20, 20, 30, 0.97) 70%,
    rgba(10, 10, 15, 0.98) 100%
  );
  position: fixed;
  left: 0;
  top: 0;
  z-index: 9999;
  transition: transform 0.7s cubic-bezier(.77,0,.18,1);
  transform: ${({ $visible }) => $visible ? 'translateX(0)' : 'translateX(-100vw)'};
  opacity: 1;
  overflow: hidden;
  

`;

const LoaderContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const LoaderImageWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, 
    rgba(33, 150, 243, 0.15) 0%, 
    rgba(100, 181, 246, 0.1) 50%,
    rgba(33, 150, 243, 0.05) 100%
  );
  backdrop-filter: blur(20px);
  
  /* Красивая анимированная окантовка как в логотипе */
  border: 2px solid transparent;
  background-clip: padding-box;
  
  &::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -3px;
    right: -3px;
    bottom: -3px;
    border-radius: 50%;
    background: linear-gradient(45deg,
      #007AFF 0%,
      #00D4FF 25%,
      #007AFF 50%,
      #0066CC 75%,
      #007AFF 100%
    );
    z-index: -1;
    animation: borderRotate 3s linear infinite;
  }
  
  @keyframes borderRotate {
    0% {
      transform: rotate(0deg);
      filter: hue-rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
      filter: hue-rotate(360deg);
    }
  }
  
  box-shadow: 
    0 8px 32px rgba(33, 150, 243, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
  margin-bottom: 32px;
  
  /* Автоматическая анимация остекления */
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 70%
    );
    animation: logoGlassEffect 4s ease-in-out infinite;
    border-radius: 50%;
    pointer-events: none;
    z-index: 2;
  }
  
  @keyframes logoGlassEffect {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(0deg);
      opacity: 0;
    }
    25% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    75% {
      opacity: 0.6;
    }
    100% {
      transform: translateX(100%) translateY(100%) rotate(180deg);
      opacity: 0;
    }
  }
  

`;

const LoaderImage = styled.img`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  z-index: 1;
  position: relative;
  user-drag: none;
  user-select: none;
`;

const LoaderGlow = styled.div`
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  background: linear-gradient(135deg, 
    rgba(33, 150, 243, 0.4), 
    rgba(100, 181, 246, 0.3),
    rgba(33, 150, 243, 0.2)
  );
  border-radius: 50%;
  filter: blur(18px);
  z-index: -1;
  opacity: 0.8;
  animation: logoGlow 3s ease-in-out infinite alternate;
  
  @keyframes logoGlow {
    0% {
      opacity: 0.6;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1.05);
    }
  }
`;

const LoaderText = styled.div`
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
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-top: 8px;
  
  /* Fallback для браузеров без поддержки */
  @supports not (-webkit-background-clip: text) {
    color: #ffffff;
  }
  
  /* Добавляем тень для глубины */
  text-shadow: 0 4px 16px rgba(0, 122, 255, 0.4);
`;

const LoaderSubtext = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 8px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
`;

const Loader: React.FC<{ isVisible: boolean }> = ({ isVisible }) => (
  <LoaderWrapper $visible={isVisible}>
    <LoaderContainer
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 200, 
        damping: 15,
        delay: 0.2 
      }}
    >
      <LoaderImageWrapper>
        <LoaderImage src={canoeGif} alt="Загрузка..." />
        <LoaderGlow />
      </LoaderImageWrapper>
      
      <LoaderText>SUPBoard</LoaderText>
      <LoaderSubtext>Загрузка приложения...</LoaderSubtext>
    </LoaderContainer>
  </LoaderWrapper>
);

export default Loader; 