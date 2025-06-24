import { NotificationData } from '../store/slices/notifications-slice/notificationsSlice';

const STORAGE_KEY = 'subboard_notifications';
const MAX_NOTIFICATIONS = 100; // Максимальное количество уведомлений в хранилище

export class NotificationStorageService {
  /**
   * Загружает уведомления из localStorage
   */
  static loadNotifications(): NotificationData[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const notifications: NotificationData[] = JSON.parse(stored);
      
      // Фильтруем устаревшие уведомления (старше 24 часов)
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const validNotifications = notifications.filter(n => n.timestamp > dayAgo);
      
      // Если количество изменилось, сохраняем обратно
      if (validNotifications.length !== notifications.length) {
        this.saveNotifications(validNotifications);
      }
      
      return validNotifications;
    } catch (error) {
      console.error('Ошибка загрузки уведомлений из localStorage:', error);
      return [];
    }
  }

  /**
   * Сохраняет уведомления в localStorage
   */
  static saveNotifications(notifications: NotificationData[]): void {
    try {
      // Ограничиваем количество уведомлений
      const limitedNotifications = notifications.slice(0, MAX_NOTIFICATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedNotifications));
    } catch (error) {
      console.error('Ошибка сохранения уведомлений в localStorage:', error);
    }
  }

  /**
   * Добавляет новое уведомление
   */
  static addNotification(notification: NotificationData): void {
    const notifications = this.loadNotifications();
    
    // Проверяем, нет ли уже такого уведомления
    const existingIndex = notifications.findIndex(n => n.id === notification.id);
    
    if (existingIndex >= 0) {
      // Обновляем существующее
      notifications[existingIndex] = notification;
    } else {
      // Добавляем новое в начало
      notifications.unshift(notification);
    }
    
    this.saveNotifications(notifications);
  }

  /**
   * Отмечает уведомление как прочитанное
   */
  static markAsRead(notificationId: string): void {
    const notifications = this.loadNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification && !notification.isRead) {
      notification.isRead = true;
      this.saveNotifications(notifications);
    }
  }

  /**
   * Удаляет уведомление
   */
  static removeNotification(notificationId: string): void {
    const notifications = this.loadNotifications();
    const filteredNotifications = notifications.filter(n => n.id !== notificationId);
    
    if (filteredNotifications.length !== notifications.length) {
      this.saveNotifications(filteredNotifications);
    }
  }

  /**
   * Отмечает все уведомления как прочитанные
   */
  static markAllAsRead(): void {
    const notifications = this.loadNotifications();
    let hasChanges = false;
    
    notifications.forEach(notification => {
      if (!notification.isRead) {
        notification.isRead = true;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.saveNotifications(notifications);
    }
  }

  /**
   * Очищает старые уведомления (старше 24 часов)
   */
  static clearOldNotifications(): void {
    const notifications = this.loadNotifications();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const validNotifications = notifications.filter(n => n.timestamp > dayAgo);
    
    if (validNotifications.length !== notifications.length) {
      this.saveNotifications(validNotifications);
    }
  }

  /**
   * Получает количество непрочитанных уведомлений
   */
  static getUnreadCount(): number {
    const notifications = this.loadNotifications();
    return notifications.filter(n => !n.isRead).length;
  }

  /**
   * Создает уведомление из push-данных
   */
  static createNotificationFromPush(pushData: any): NotificationData {
    const timestamp = Date.now();
    
    return {
      id: `push_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      title: pushData.title || 'Уведомление',
      body: pushData.body || '',
      type: pushData.data?.type || 'unknown',
      priority: pushData.data?.priority || 'medium',
      bookingId: pushData.data?.booking_id,
      clientName: pushData.data?.client_name,
      timestamp,
      isRead: false,
      actions: pushData.actions || [],
      additionalData: pushData.data || {},
    };
  }

  /**
   * Подписывается на изменения в localStorage (для синхронизации между вкладками)
   */
  static subscribeToChanges(callback: (notifications: NotificationData[]) => void): () => void {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const notifications = this.loadNotifications();
        callback(notifications);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Возвращаем функцию для отписки
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }
}