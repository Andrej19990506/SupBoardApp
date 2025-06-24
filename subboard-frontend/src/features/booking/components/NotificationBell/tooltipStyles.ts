import styled from 'styled-components';

export const TooltipContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  width: 380px;
  max-height: 500px;
  overflow: hidden;
  border: 1px solid #E5E7EB;
`;

export const TooltipHeader = styled.div`
  padding: 16px 20px;
  background: #F9FAFB;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const TooltipTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
`;

export const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

export const ActionButton = styled.button`
  background: none;
  border: none;
  color: #6366F1;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  
  &:hover {
    background: #EEF2FF;
    color: #4F46E5;
  }
`;

export const NotificationsList = styled.div`
  max-height: 350px;
  overflow-y: auto;
  
  /* Стилизация скроллбара */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #F3F4F6;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
  }
`;

export const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #6B7280;
  
  div {
    font-size: 48px;
    margin-bottom: 12px;
  }
  
  p {
    margin: 0;
    font-size: 16px;
  }
`;

export const PrioritySection = styled.div`
  border-bottom: 1px solid #F3F4F6;
  
  &:last-child {
    border-bottom: none;
  }
`;

export const PrioritySectionTitle = styled.div<{ $priority: string }>`
  padding: 12px 20px 8px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => {
    switch (props.$priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#6366F1';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  }};
  background: ${props => {
    switch (props.$priority) {
      case 'urgent': return '#FEF2F2';
      case 'high': return '#FFFBEB';
      case 'medium': return '#EEF2FF';
      case 'low': return '#F9FAFB';
      default: return '#F9FAFB';
    }
  }};
  border-bottom: 1px solid #E5E7EB;
`;

export const Footer = styled.div`
  padding: 12px 20px;
  background: #F9FAFB;
  border-top: 1px solid #E5E7EB;
  text-align: center;
  
  small {
    color: #6B7280;
    font-size: 12px;
  }
`; 