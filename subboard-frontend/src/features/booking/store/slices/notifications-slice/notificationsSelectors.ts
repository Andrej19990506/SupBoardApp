import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../types';
import { NotificationData } from './notificationsSlice';

// Базовые селекторы
export const selectNotificationsState = (state: RootState) => state.notifications;

export const selectAllNotifications = createSelector(
  [selectNotificationsState],
  (notificationsState) => notificationsState.notifications
);

export const selectUnreadCount = createSelector(
  [selectNotificationsState],
  (notificationsState) => notificationsState.unreadCount
);

export const selectIsTooltipOpen = createSelector(
  [selectNotificationsState],
  (notificationsState) => notificationsState.isTooltipOpen
);

// Селекторы с фильтрацией
export const selectUnreadNotifications = createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => notifications.filter(n => !n.isRead)
);

export const selectReadNotifications = createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => notifications.filter(n => n.isRead)
);

export const selectNotificationsByPriority = createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => {
    const grouped = {
      urgent: notifications.filter(n => n.priority === 'urgent'),
      high: notifications.filter(n => n.priority === 'high'),
      medium: notifications.filter(n => n.priority === 'medium'),
      low: notifications.filter(n => n.priority === 'low'),
    };
    return grouped;
  }
);

export const selectRecentNotifications = createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => {
    // Уведомления за последние 2 часа
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return notifications.filter(n => n.timestamp > twoHoursAgo);
  }
);

export const selectNotificationById = (id: string) => createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => notifications.find(n => n.id === id)
);

export const selectNotificationsByBooking = (bookingId: number) => createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => notifications.filter(n => n.bookingId === bookingId)
);

// Селектор для подсчета уведомлений по типам
export const selectNotificationStats = createSelector(
  [selectAllNotifications],
  (notifications: NotificationData[]) => {
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.isRead).length,
      byType: {} as Record<string, number>,
      byPriority: {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    notifications.forEach(notification => {
      // Статистика по типам
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      
      // Статистика по приоритетам
      stats.byPriority[notification.priority]++;
    });

    return stats;
  }
); 