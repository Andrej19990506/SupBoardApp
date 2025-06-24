import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  bookingId?: number;
  clientName?: string;
  timestamp: number;
  isRead: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  additionalData?: Record<string, any>;
}

interface NotificationsState {
  notifications: NotificationData[];
  unreadCount: number;
  isTooltipOpen: boolean;
  weatherTooltip: {
    isOpen: boolean;
    position: { top: number; left: number };
    data: {
      temperature: number;
      windSpeed: number;
      condition: string;
      location: string;
      icon: string;
      precipitation?: number;
      rain?: number;
      snowfall?: number;
      humidity?: number;
      recommendations: Array<{
        title: string;
        description: string;
        icon: string;
        type: 'temperature' | 'wind' | 'condition';
      }>;
    } | null;
  };
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isTooltipOpen: false,
  weatherTooltip: {
    isOpen: false,
    position: { top: 0, left: 0 },
    data: null
  }
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<NotificationData>) => {
      // Проверяем, нет ли уже такого уведомления
      const existingIndex = state.notifications.findIndex(
        n => n.id === action.payload.id
      );
      
      if (existingIndex >= 0) {
        // Обновляем существующее уведомление
        state.notifications[existingIndex] = action.payload;
      } else {
        // Добавляем новое уведомление в начало списка
        state.notifications.unshift(action.payload);
      }
      
      // Обновляем счетчик непрочитанных
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
    },

    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.isRead = true;
      });
      state.unreadCount = 0;
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index >= 0) {
        const wasUnread = !state.notifications[index].isRead;
        state.notifications.splice(index, 1);
        if (wasUnread) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }
    },

    clearOldNotifications: (state) => {
      // Удаляем уведомления старше 24 часов
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const oldCount = state.notifications.length;
      
      state.notifications = state.notifications.filter(n => n.timestamp > dayAgo);
      
      // Пересчитываем непрочитанные
      state.unreadCount = state.notifications.filter(n => !n.isRead).length;
      
      console.log(`🗑️ Удалено ${oldCount - state.notifications.length} старых уведомлений`);
    },

    setTooltipOpen: (state, action: PayloadAction<boolean>) => {
      state.isTooltipOpen = action.payload;
    },

    // Для загрузки уведомлений из localStorage при старте приложения
    loadNotifications: (state, action: PayloadAction<NotificationData[]>) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.isRead).length;
    },

    openWeatherTooltip: (state, action: PayloadAction<{ data: any }>) => {
      state.weatherTooltip.isOpen = true;
      state.weatherTooltip.data = action.payload.data;
    },
    closeWeatherTooltip: (state) => {
      state.weatherTooltip.isOpen = false;
    },
    updateWeatherData: (state, action: PayloadAction<any>) => {
      state.weatherTooltip.data = action.payload;
    }
  },
});

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearOldNotifications,
  setTooltipOpen,
  loadNotifications,
  openWeatherTooltip,
  closeWeatherTooltip,
  updateWeatherData
} = notificationsSlice.actions;

export default notificationsSlice.reducer; 