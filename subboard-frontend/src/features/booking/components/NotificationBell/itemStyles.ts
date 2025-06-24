import styled from 'styled-components';

export const ItemContainer = styled.div<{ $isRead: boolean }>`
  position: relative;
  padding: 16px 20px;
  border-bottom: 1px solid #F3F4F6;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$isRead ? 'white' : '#F8FAFC'};
  
  &:hover {
    background: #F9FAFB;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

export const UnreadIndicator = styled.div`
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: #3B82F6;
  border-radius: 50%;
`;

export const PriorityIndicator = styled.div<{ $priority: string }>`
  position: absolute;
  left: 20px;
  top: 16px;
  font-size: 16px;
  filter: ${props => {
    switch (props.$priority) {
      case 'urgent': return 'brightness(1.2)';
      case 'high': return 'brightness(1.1)';
      default: return 'brightness(1)';
    }
  }};
`;

export const ItemContent = styled.div`
  margin-left: 40px;
  margin-right: 30px;
`;

export const ItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
`;

export const ItemTitle = styled.div<{ $isRead: boolean }>`
  font-size: 14px;
  font-weight: ${props => props.$isRead ? '500' : '600'};
  color: ${props => props.$isRead ? '#6B7280' : '#111827'};
  line-height: 1.4;
`;

export const ItemTime = styled.div`
  font-size: 12px;
  color: #9CA3AF;
  white-space: nowrap;
  margin-left: 12px;
`;

export const ItemBody = styled.div<{ $isRead: boolean }>`
  font-size: 13px;
  color: ${props => props.$isRead ? '#9CA3AF' : '#4B5563'};
  line-height: 1.4;
  margin-bottom: 8px;
`;

export const ClientName = styled.div`
  font-size: 12px;
  color: #6366F1;
  font-weight: 500;
  margin-bottom: 8px;
`;

export const ItemFooter = styled.div`
  margin-top: 12px;
`;

export const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

export const ActionButton = styled.button<{ $priority: string }>`
  background: ${props => {
    switch (props.$priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#6366F1';
      case 'low': return '#6B7280';
      default: return '#6366F1';
    }
  }};
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

export const RemoveButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: #D1D5DB;
  font-size: 14px;
  cursor: pointer;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    background: #FEF2F2;
    color: #DC2626;
  }
`; 