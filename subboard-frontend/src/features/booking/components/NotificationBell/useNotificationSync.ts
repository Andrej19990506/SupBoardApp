import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { 
  addNotification, 
  loadNotifications, 
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearOldNotifications,
  NotificationData
} from '../../store/slices/notifications-slice/notificationsSlice';
import { NotificationStorageService } from '../../services/notificationStorageService';
import { notificationSoundService } from './NotificationSoundService';

/**
 * Синхронизирует IndexedDB с localStorage (удаляет из IndexedDB то, что удалено из localStorage)
 */
const syncIndexedDBWithLocalStorage = async () => {
  try {
    if (!navigator.serviceWorker.controller) {
      console.warn('⚠️ [useNotificationSync] Service Worker не активен, пропускаем синхронизацию');
      return;
    }

    // Получаем текущие уведомления из localStorage
    const currentNotifications = NotificationStorageService.loadNotifications();
    
    const channel = new MessageChannel();
    
    return new Promise((resolve) => {
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'SYNC_COMPLETED') {
          console.log('✅ [useNotificationSync] Синхронизация IndexedDB завершена');
          resolve(true);
        }
      };

      navigator.serviceWorker.controller!.postMessage({
        type: 'SYNC_NOTIFICATIONS',
        notifications: currentNotifications
      }, [channel.port2]);
    });
  } catch (error) {
    console.error('❌ [useNotificationSync] Ошибка синхронизации IndexedDB:', error);
  }
};

/**
 * Загружает уведомления из IndexedDB через Service Worker
 */
const loadNotificationsFromIndexedDB = async (dispatch: any) => {
  try {
    if (!navigator.serviceWorker.controller) {
      console.warn('⚠️ [useNotificationSync] Service Worker не активен, пропускаем загрузку из IndexedDB');
      return;
    }

    const channel = new MessageChannel();
    
    return new Promise((resolve) => {
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'NOTIFICATIONS_LOADED') {
          const indexedDBNotifications = event.data.notifications || [];
          console.log(`📦 [useNotificationSync] Получено ${indexedDBNotifications.length} уведомлений из IndexedDB`);
          
          if (indexedDBNotifications.length > 0) {
            // Получаем текущие уведомления из localStorage
            const localStorageNotifications = NotificationStorageService.loadNotifications();
            const localStorageIds = new Set(localStorageNotifications.map(n => n.id));
            
            // Добавляем только НОВЫЕ уведомления из IndexedDB (которых нет в localStorage)
            const newNotifications = indexedDBNotifications.filter(
              (notification: NotificationData) => !localStorageIds.has(notification.id)
            );
            
            console.log(`🔄 [useNotificationSync] Найдено ${newNotifications.length} новых уведомлений из IndexedDB`);
            
            if (newNotifications.length > 0) {
              // Добавляем только новые уведомления в localStorage
              newNotifications.forEach((notification: NotificationData) => {
                NotificationStorageService.addNotification(notification);
              });
              
              // Объединяем все уведомления и загружаем в Redux
              const allNotifications = [...localStorageNotifications, ...newNotifications];
              dispatch(loadNotifications(allNotifications));
              console.log(`🔄 [useNotificationSync] Добавлено ${newNotifications.length} новых уведомлений в Redux`);
            } else {
              console.log('✅ [useNotificationSync] Все уведомления из IndexedDB уже есть в localStorage');
            }
          }
          resolve(indexedDBNotifications);
        }
      };

      navigator.serviceWorker.controller!.postMessage(
        { type: 'LOAD_NOTIFICATIONS' },
        [channel.port2]
      );
    });
  } catch (error) {
    console.error('❌ [useNotificationSync] Ошибка загрузки из IndexedDB:', error);
  }
};

/**
 * Хук для синхронизации уведомлений между Service Worker, localStorage и Redux store
 */
export const useNotificationSync = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('🚀 [useNotificationSync] Хук инициализируется...');
    
    // Загружаем существующие уведомления при инициализации
    const existingNotifications = NotificationStorageService.loadNotifications();
    console.log(`📋 [useNotificationSync] Загружено ${existingNotifications.length} существующих уведомлений из localStorage`);
    if (existingNotifications.length > 0) {
      dispatch(loadNotifications(existingNotifications));
    }

    // Очищаем старые уведомления
    dispatch(clearOldNotifications());

    // Подписываемся на сообщения от Service Worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      console.log('📨 [useNotificationSync] Получено сообщение от Service Worker:', event.data);
      
      if (event.data?.type === 'NEW_NOTIFICATION') {
        console.log('📱 [useNotificationSync] Получено новое уведомление от Service Worker:', event.data.notification);
        const notification = event.data.notification;
        
        // Сохраняем уведомление в localStorage
        console.log('💾 [useNotificationSync] Сохраняем уведомление в localStorage');
        NotificationStorageService.addNotification(notification);
        
        // Добавляем уведомление в store
        console.log('🔄 [useNotificationSync] Добавляем уведомление в Redux store');
        dispatch(addNotification(notification));
        
        // Воспроизводим звук уведомления (всегда urgent)
        console.log('🔊 [useNotificationSync] Воспроизводим звук уведомления');
        
        try {
          notificationSoundService.playNotificationSound('urgent');
        } catch (error) {
          console.warn('⚠️ [useNotificationSync] Не удалось воспроизвести звук уведомления:', error);
        }
      }
    };

    // Подписываемся на изменения в localStorage (синхронизация между вкладками)
    const unsubscribeFromStorage = NotificationStorageService.subscribeToChanges((notifications) => {
      console.log('🔄 Синхронизация уведомлений между вкладками');
      dispatch(loadNotifications(notifications));
    });

    // Регистрируем Service Worker если он еще не зарегистрирован
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('✅ [useNotificationSync] Service Worker зарегистрирован:', registration);
          
          // Подписываемся на сообщения от Service Worker (два способа для надежности)
          console.log('🔗 [useNotificationSync] Подписываемся на сообщения от Service Worker');
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
          
          // Дополнительно подписываемся через onmessage для надежности
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLIENT_READY' });
          }
          
          // Загружаем уведомления из IndexedDB (могут быть уведомления, полученные при закрытом приложении)
          console.log('📦 [useNotificationSync] Загружаем уведомления из IndexedDB...');
          loadNotificationsFromIndexedDB(dispatch);
          
          // Синхронизируем IndexedDB с localStorage (удаляем из IndexedDB то, что удалено из localStorage)
          console.log('🔄 [useNotificationSync] Синхронизируем IndexedDB с localStorage...');
          syncIndexedDBWithLocalStorage();
          
          // Дополнительно проверяем, есть ли активный Service Worker
          if (navigator.serviceWorker.controller) {
            console.log('✅ [useNotificationSync] Service Worker активен и готов к работе');
            // Отправляем сообщение, что клиент готов
            navigator.serviceWorker.controller.postMessage({ type: 'CLIENT_READY' });
          } else {
            console.log('⚠️ [useNotificationSync] Service Worker не активен, ожидаем активации...');
            
            // Ждем активации Service Worker
            navigator.serviceWorker.ready.then((registration) => {
              console.log('✅ [useNotificationSync] Service Worker готов к работе');
              
              // Принудительно обновляем страницу, чтобы Service Worker взял контроль
              if (!navigator.serviceWorker.controller) {
                console.log('🔄 [useNotificationSync] Принудительно перезагружаем страницу для активации Service Worker');
                window.location.reload();
                return;
              }
              
              // Отправляем сообщение, что клиент готов
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CLIENT_READY' });
              }
            });
          }
          
        } catch (error) {
          console.error('❌ [useNotificationSync] Ошибка регистрации Service Worker:', error);
        }
      } else {
        console.warn('⚠️ [useNotificationSync] Service Worker не поддерживается в этом браузере');
      }
    };

    registerServiceWorker();

    // Cleanup
    return () => {
      unsubscribeFromStorage();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [dispatch]);

  // Возвращаем функции для управления уведомлениями с синхронизацией с localStorage
  return {
    markAsRead: (notificationId: string) => {
      NotificationStorageService.markAsRead(notificationId);
      dispatch(markAsRead(notificationId));
    },
    
    markAllAsRead: () => {
      NotificationStorageService.markAllAsRead();
      dispatch(markAllAsRead());
    },
    
    removeNotification: (notificationId: string) => {
      NotificationStorageService.removeNotification(notificationId);
      dispatch(removeNotification(notificationId));
      // Синхронизируем с IndexedDB
      syncIndexedDBWithLocalStorage().catch(error => 
        console.error('❌ Ошибка синхронизации при удалении уведомления:', error)
      );
    },
    
    clearOldNotifications: () => {
      NotificationStorageService.clearOldNotifications();
      dispatch(clearOldNotifications());
      // Синхронизируем с IndexedDB
      syncIndexedDBWithLocalStorage().catch(error => 
        console.error('❌ Ошибка синхронизации при очистке старых уведомлений:', error)
      );
    }
  };
}; 