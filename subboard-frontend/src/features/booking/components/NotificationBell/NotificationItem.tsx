import React from 'react';
import { NotificationData } from '../../store/slices/notifications-slice/notificationsSlice';
import { 
  ItemContainer, 
  ItemContent, 
  ItemHeader, 
  ItemTitle, 
  ItemTime,
  ItemBody,
  ItemFooter,
  ClientName,
  ActionButtons,
  ActionButton,
  RemoveButton,
  UnreadIndicator,
  PriorityIndicator
} from './itemStyles';

interface NotificationItemProps {
  notification: NotificationData;
  onClick: () => void;
  onRemove: () => void;
  timeAgo: string;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  onRemove,
  timeAgo
}) => {
  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🔔';
      case 'low': return 'ℹ️';
      default: return '🔔';
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'pending_confirmation': return 'Требуется подтверждение';
      case 'client_arriving_soon': return 'Клиент скоро придет';
      case 'client_arriving': return 'Клиент приближается';
      case 'client_overdue': return 'Клиент опаздывает';
      case 'return_time': return 'Время возврата';
      case 'return_overdue': return 'Просрочка возврата';
      default: return 'Уведомление';
    }
  };

  const handleItemClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
    
    // Если есть bookingId, можно перейти к бронированию
    if (notification.bookingId) {
      // Здесь можно добавить навигацию к конкретному бронированию
      console.log('Переход к бронированию:', notification.bookingId);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const handleActionClick = (action: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    console.log('Действие:', action, 'для бронирования:', notification.bookingId);
    
    // Здесь можно добавить обработку конкретных действий
    switch (action) {
      case 'confirm':
        // Подтвердить бронирование
        break;
      case 'cancel':
        // Отменить бронирование
        break;
      case 'contact':
      case 'contact_urgent':
        // Связаться с клиентом
        break;
      case 'arrived':
        // Отметить что клиент пришел
        break;
      case 'returned':
        // Отметить что инвентарь возвращен
        break;
      default:
        break;
    }
    
    // Отмечаем уведомление как прочитанное после действия
    onClick();
  };

  return (
    <ItemContainer $isRead={notification.isRead} onClick={handleItemClick}>
      {!notification.isRead && <UnreadIndicator />}
      
      <PriorityIndicator $priority={notification.priority}>
        {getPriorityEmoji(notification.priority)}
      </PriorityIndicator>
      
      <ItemContent>
        <ItemHeader>
          <ItemTitle $isRead={notification.isRead}>
            {getTypeDescription(notification.type)}
          </ItemTitle>
          <ItemTime>{timeAgo}</ItemTime>
        </ItemHeader>
        
        <ItemBody $isRead={notification.isRead}>
          {notification.body}
        </ItemBody>
        
        {notification.clientName && (
          <ClientName>
            👤 {notification.clientName}
          </ClientName>
        )}
        
        {notification.actions && notification.actions.length > 0 && (
          <ItemFooter>
            <ActionButtons>
              {notification.actions.slice(0, 2).map((action, index) => (
                <ActionButton
                  key={index}
                  onClick={(e) => handleActionClick(action.action, e)}
                  $priority={notification.priority}
                >
                  {action.title}
                </ActionButton>
              ))}
            </ActionButtons>
          </ItemFooter>
        )}
      </ItemContent>
      
      <RemoveButton onClick={handleRemoveClick} title="Удалить уведомление">
        ✕
      </RemoveButton>
    </ItemContainer>
  );
}; 