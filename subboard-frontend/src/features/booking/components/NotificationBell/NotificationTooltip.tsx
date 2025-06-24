import React from 'react';
import { useSelector } from 'react-redux';
import { 
  selectAllNotifications, 
  selectUnreadCount,
  selectNotificationsByPriority 
} from '../../store/slices/notifications-slice/notificationsSelectors';
import { useNotificationSync } from './useNotificationSync';
import { NotificationItem } from '@features/booking/components/NotificationBell/NotificationItem';
import { 
  TooltipContainer, 
  TooltipHeader, 
  TooltipTitle, 
  HeaderActions,
  ActionButton,
  NotificationsList, 
  EmptyState,
  PrioritySection,
  PrioritySectionTitle,
  Footer
} from '@/features/booking/components/NotificationBell/tooltipStyles';

export const NotificationTooltip: React.FC = () => {
  const notifications = useSelector(selectAllNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const notificationsByPriority = useSelector(selectNotificationsByPriority);
  
  // Используем функции из useNotificationSync для правильной синхронизации с localStorage
  const { markAsRead, markAllAsRead, removeNotification } = useNotificationSync();

  const handleMarkAllAsRead = () => {
    markAllAsRead(); // ✅ Теперь синхронизируется с localStorage
  };

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId); // ✅ Теперь синхронизируется с localStorage
  };

  const handleRemoveNotification = (notificationId: string) => {
    removeNotification(notificationId); // ✅ Теперь синхронизируется с localStorage
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} дн назад`;
  };

  if (notifications.length === 0) {
    return (
      <TooltipContainer>
        <TooltipHeader>
          <TooltipTitle>Уведомления</TooltipTitle>
        </TooltipHeader>
        <EmptyState>
          <div>📭</div>
          <p>Нет уведомлений</p>
        </EmptyState>
      </TooltipContainer>
    );
  }

  const renderPrioritySection = (priority: 'urgent' | 'high' | 'medium' | 'low', title: string, emoji: string) => {
    const priorityNotifications = notificationsByPriority[priority];
    
    if (priorityNotifications.length === 0) return null;

    return (
      <PrioritySection key={priority}>
        <PrioritySectionTitle $priority={priority}>
          {emoji} {title} ({priorityNotifications.length})
        </PrioritySectionTitle>
        {priorityNotifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification.id)}
            onRemove={() => handleRemoveNotification(notification.id)}
            timeAgo={formatTime(notification.timestamp)}
          />
        ))}
      </PrioritySection>
    );
  };

  return (
    <TooltipContainer>
      <TooltipHeader>
        <TooltipTitle>
          Уведомления {unreadCount > 0 && `(${unreadCount})`}
        </TooltipTitle>
        {unreadCount > 0 && (
          <HeaderActions>
            <ActionButton onClick={handleMarkAllAsRead}>
              Прочитать все
            </ActionButton>
          </HeaderActions>
        )}
      </TooltipHeader>

      <NotificationsList>
        {renderPrioritySection('urgent', 'Критичные', '🚨')}
        {renderPrioritySection('high', 'Важные', '⚠️')}
        {renderPrioritySection('medium', 'Обычные', '🔔')}
        {renderPrioritySection('low', 'Информационные', 'ℹ️')}
      </NotificationsList>

      <Footer>
        <small>Уведомления автоматически удаляются через 24 часа</small>
      </Footer>
    </TooltipContainer>
  );
}; 