import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface AnimatedLogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ 
  size = 'medium', 
  className 
}) => {
  return (
    <LogoContainer
      className={className}
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 200, 
        damping: 15,
        delay: 0.1 
      }}
      $size={size}
    >
      <LogoIcon>
        <LogoImageWrapper $size={size}>
          <img 
            src="/Logo SUBboards.png" 
            alt="SUBboards Logo" 
            style={{ objectFit: 'contain' }}
          />
          <LogoGlow $size={size} />
        </LogoImageWrapper>
      </LogoIcon>
    </LogoContainer>
  );
};

// Получаем размеры в зависимости от пропа size
const getSizeConfig = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        container: { width: '48px', height: '48px' },
        image: { width: '32px', height: '32px' },
        glow: { 
          top: '-6px', left: '-6px', right: '-6px', bottom: '-6px',
          blur: '8px'
        }
      };
    case 'large':
      return {
        container: { width: '96px', height: '96px' },
        image: { width: '72px', height: '72px' },
        glow: { 
          top: '-12px', left: '-12px', right: '-12px', bottom: '-12px',
          blur: '18px'
        }
      };
    default: // medium
      return {
        container: { width: '80px', height: '80px' },
        image: { width: '64px', height: '64px' },
        glow: { 
          top: '-10px', left: '-10px', right: '-10px', bottom: '-10px',
          blur: '15px'
        }
      };
  }
};

const LogoContainer = styled(motion.div)<{ $size: 'small' | 'medium' | 'large' }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    margin-bottom: 14px;
  }
  
  @media (max-width: 480px) {
    margin-bottom: 12px;
  }
`;

const LogoIcon = styled.div`
  position: relative;
`;

const LogoImageWrapper = styled.div<{ $size: 'small' | 'medium' | 'large' }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, 
    rgba(33, 150, 243, 0.15) 0%, 
    rgba(100, 181, 246, 0.1) 50%,
    rgba(33, 150, 243, 0.05) 100%
  );
  backdrop-filter: blur(20px);
  border: 1px solid rgba(33, 150, 243, 0.3);
  box-shadow: 
    0 8px 32px rgba(33, 150, 243, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
  
  img {
    width: ${props => getSizeConfig(props.$size).image.width};
    height: ${props => getSizeConfig(props.$size).image.height};
    border-radius: 50%;
    z-index: 1;
    position: relative;
  }
  
  /* Автоматическая анимация остекления */
  &::before {
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
  
  /* Дополнительная анимация пульсации */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    border: 2px solid rgba(33, 150, 243, 0.3);
    animation: logoPulse 3s ease-in-out infinite;
    pointer-events: none;
    z-index: 3;
  }
  
  @keyframes logoPulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.3;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.6;
    }
  }
  
  @media (max-width: 768px) {
    width: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.container.width} * 0.9)`;
    }};
    height: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.container.height} * 0.9)`;
    }};
    
    img {
      width: ${props => {
        const config = getSizeConfig(props.$size);
        return `calc(${config.image.width} * 0.9)`;
      }};
      height: ${props => {
        const config = getSizeConfig(props.$size);
        return `calc(${config.image.height} * 0.9)`;
      }};
    }
  }
  
  @media (max-width: 480px) {
    width: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.container.width} * 0.8)`;
    }};
    height: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.container.height} * 0.8)`;
    }};
    
    img {
      width: ${props => {
        const config = getSizeConfig(props.$size);
        return `calc(${config.image.width} * 0.8)`;
      }};
      height: ${props => {
        const config = getSizeConfig(props.$size);
        return `calc(${config.image.height} * 0.8)`;
      }};
    }
  }
`;

const LogoGlow = styled.div<{ $size: 'small' | 'medium' | 'large' }>`
  position: absolute;
  top: ${props => getSizeConfig(props.$size).glow.top};
  left: ${props => getSizeConfig(props.$size).glow.left};
  right: ${props => getSizeConfig(props.$size).glow.right};
  bottom: ${props => getSizeConfig(props.$size).glow.bottom};
  background: linear-gradient(135deg, 
    rgba(33, 150, 243, 0.4), 
    rgba(100, 181, 246, 0.3),
    rgba(33, 150, 243, 0.2)
  );
  border-radius: 50%;
  filter: blur(${props => getSizeConfig(props.$size).glow.blur});
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
  
  @media (max-width: 768px) {
    top: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.top} * 0.8)`;
    }};
    left: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.left} * 0.8)`;
    }};
    right: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.right} * 0.8)`;
    }};
    bottom: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.bottom} * 0.8)`;
    }};
    filter: blur(${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.blur} * 0.8)`;
    }});
  }
  
  @media (max-width: 480px) {
    top: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.top} * 0.6)`;
    }};
    left: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.left} * 0.6)`;
    }};
    right: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.right} * 0.6)`;
    }};
    bottom: ${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.bottom} * 0.6)`;
    }};
    filter: blur(${props => {
      const config = getSizeConfig(props.$size);
      return `calc(${config.glow.blur} * 0.6)`;
    }});
  }
`;

export default AnimatedLogo; 