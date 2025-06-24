import styled, { keyframes, css } from 'styled-components';

// Анимации
const bellShake = keyframes`
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(10deg); }
  20% { transform: rotate(-8deg); }
  30% { transform: rotate(6deg); }
  40% { transform: rotate(-4deg); }
  50% { transform: rotate(2deg); }
  60% { transform: rotate(0deg); }
`;

const urgentPulse = keyframes`
  0%, 100% { 
    transform: scale(1); 
    filter: brightness(1);
  }
  50% { 
    transform: scale(1.1); 
    filter: brightness(1.2);
  }
`;

const badgePulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
`;

export const BellContainer = styled.div`
  position: relative;
  display: inline-block;
`;

export const BellIcon = styled.div<{ $color: string }>`
  font-size: 24px;
  cursor: pointer;
  color: ${props => props.$color};
  transition: all 0.3s ease;
  user-select: none;
  position: relative;
  padding: 8px;
  border-radius: 50%;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    transform: scale(1.05);
  }
  
  &.normal-animation {
    animation: ${bellShake} 2s ease-in-out infinite;
    animation-delay: 1s;
  }
  
  &.urgent-animation {
    animation: ${css`
      ${bellShake} 1s ease-in-out infinite,
      ${urgentPulse} 2s ease-in-out infinite
    `};
  }
`;

export const Badge = styled.div<{ $priority: 'urgent' | 'normal' }>`
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: ${props => props.$priority === 'urgent' ? '#DC2626' : '#EF4444'};
  color: white;
  border-radius: 50%;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  
  ${props => props.$priority === 'urgent' && css`
    animation: ${badgePulse} 1.5s ease-in-out infinite;
  `}
`;

export const TooltipWrapper = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 1000;
  margin-top: 8px;
  
  /* Стрелка тултипа */
  &::before {
    content: '';
    position: absolute;
    top: -8px;
    right: 20px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid white;
    filter: drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.1));
  }
`; 