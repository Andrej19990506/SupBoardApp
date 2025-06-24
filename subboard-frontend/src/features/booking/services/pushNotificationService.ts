import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import api from '@shared/services/api';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  priority: 'high' | 'medium' | 'low';
  data: {
    bookingId: string;
    bookingStatus: string;
    clientName: string;
    phone?: string;
    action?: string;
    trackClose?: boolean;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class PushNotificationService {
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private isSupported: boolean = false;
  private isPermissionGranted: boolean = false;

  constructor() {
    this.checkSupport();
  }

  /**
   * Проверяем поддержку push-уведомлений
   */
  private checkSupport(): void {
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    console.log('🔍 Проверка поддержки push-уведомлений:');
    console.log('  - Service Worker:', hasServiceWorker);
    console.log('  - PushManager:', hasPushManager);
    console.log('  - Notification:', hasNotification);
    console.log('  - Secure Context (HTTPS):', isSecureContext);
    console.log('  - Localhost:', isLocalhost);
    console.log('  - URL:', window.location.href);
    
    this.isSupported = hasServiceWorker && hasPushManager && hasNotification;
    
    if (!this.isSupported) {
      console.warn('⚠️ Push-уведомления не поддерживаются:');
      if (!hasServiceWorker) console.warn('  - Отсутствует Service Worker API');
      if (!hasPushManager) console.warn('  - Отсутствует PushManager API');
      if (!hasNotification) console.warn('  - Отсутствует Notification API');
      if (!isSecureContext && !isLocalhost) {
        console.warn('  - Требуется HTTPS (или localhost для разработки)');
      }
    }
      
    console.log('🔍 Push-уведомления поддерживаются:', this.isSupported);
  }

  /**
   * Инициализация Service Worker и подписка на уведомления
   */
  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('⚠️ Push-уведомления не поддерживаются в этом браузере');
      return false;
    }

    try {
      // Регистрируем Service Worker
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('✅ Service Worker зарегистрирован:', this.serviceWorkerRegistration);

      // Ждем активации Service Worker
      await this.waitForServiceWorkerActivation();

      // Запрашиваем разрешение на уведомления
      const permission = await this.requestNotificationPermission();
      
      if (permission) {
        // Создаем подписку на push-уведомления
        await this.createPushSubscription();
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Ошибка инициализации push-уведомлений:', error);
      return false;
    }
  }

  /**
   * Ждем активации Service Worker
   */
  private async waitForServiceWorkerActivation(): Promise<void> {
    if (!this.serviceWorkerRegistration) return;

    if (this.serviceWorkerRegistration.active) {
      return;
    }

    return new Promise((resolve) => {
      const worker = this.serviceWorkerRegistration!.installing || this.serviceWorkerRegistration!.waiting;
      
      if (worker) {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Запрашиваем разрешение на уведомления
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('⚠️ Браузер не поддерживает уведомления');
      return false;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    this.isPermissionGranted = permission === 'granted';
    
    console.log('🔔 Разрешение на уведомления:', permission);
    
    return this.isPermissionGranted;
  }

  /**
   * Создаем подписку на push-уведомления
   */
  private async createPushSubscription(): Promise<void> {
    if (!this.serviceWorkerRegistration || !this.isPermissionGranted) {
      return;
    }

    try {
      // Проверяем существующую подписку
      this.subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();

      if (!this.subscription) {
        // Создаем новую подписку
        // Получаем VAPID публичный ключ с сервера
        const vapidPublicKey = await this.getVapidPublicKey();
        
                 this.subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
           userVisibleOnly: true,
           applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
         });

        console.log('✅ Push-подписка создана:', this.subscription);

        // Отправляем подписку на сервер
        await this.sendSubscriptionToServer(this.subscription);
      } else {
        console.log('✅ Push-подписка уже существует:', this.subscription);
      }
    } catch (error) {
      console.error('❌ Ошибка создания push-подписки:', error);
    }
  }

  /**
   * Получаем VAPID публичный ключ с сервера
   */
  private async getVapidPublicKey(): Promise<string> {
    try {
      // Пробуем получить ключ из конфигурации (предпочтительный способ)
      if (window.APP_CONFIG?.APPLICATION_SERVER_KEY) {
        const vapidKey = window.APP_CONFIG.APPLICATION_SERVER_KEY;
        console.log('🔑 VAPID ключ получен из конфигурации:', vapidKey.substring(0, 20) + '...');
        return vapidKey;
      }

      // Fallback: получаем с сервера, если не найден в конфигурации
      console.log('⚠️ VAPID ключ не найден в конфигурации, пытаемся получить с сервера');
      const response = await api.get('/v1/push-notifications/vapid-public-key');
      const vapidKey = response.data.public_key;
      
      if (!vapidKey) {
        throw new Error('VAPID ключ не получен с сервера');
      }
      
      console.log('🔑 VAPID ключ получен с сервера:', vapidKey.substring(0, 20) + '...');
      return vapidKey;
    } catch (error) {
      console.error('❌ Ошибка получения VAPID ключа:', error);
      throw new Error('Не удалось получить VAPID ключ');
    }
  }

  /**
   * Отправляем подписку на сервер
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
             const p256dhKey = subscription.getKey('p256dh');
       const authKey = subscription.getKey('auth');
       
       const subscriptionData: PushSubscriptionData = {
         endpoint: subscription.endpoint,
         keys: {
           p256dh: p256dhKey ? this.arrayBufferToBase64(p256dhKey) : '',
           auth: authKey ? this.arrayBufferToBase64(authKey) : ''
         }
       };

      const response = await api.post('/v1/push-notifications/subscriptions', {
        endpoint: subscriptionData.endpoint,
        keys: subscriptionData.keys,
        user_agent: navigator.userAgent,
        notification_types: [
          'pending_confirmation',
          'client_arriving_soon', 
          'client_overdue',
          'return_time',
          'return_overdue'
        ]
      });

      console.log('✅ Push-подписка отправлена на сервер');
    } catch (error) {
      console.error('❌ Ошибка отправки подписки на сервер:', error);
    }
  }

  /**
   * Конвертируем VAPID ключ в правильный формат
   */
  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
  }

  /**
   * Конвертируем ArrayBuffer в base64 строку
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Создаем уведомления для различных событий бронирований
   */
  createBookingNotification(booking: Booking, eventType: string): NotificationPayload | null {
    const baseData = {
      bookingId: booking.id,
      bookingStatus: booking.status,
      clientName: booking.clientName,
      phone: booking.phone,
      trackClose: true
    };

    switch (eventType) {
      case 'pending_confirmation':
        return {
          title: '🔔 Требуется подтверждение',
          body: `${booking.clientName} - подтвердить бронирование за час до начала`,
          tag: `confirmation-${booking.id}`,
          priority: 'high',
          data: { ...baseData, action: 'confirm' },
          actions: [
            { action: 'confirm', title: '✅ Подтвердить' },
            { action: 'call', title: '📞 Позвонить' },
            { action: 'cancel', title: '❌ Отменить' }
          ]
        };

      case 'client_arriving_soon':
        return {
          title: '⏰ Клиент скоро придет',
          body: `${booking.clientName} должен прийти через 15 минут. Подготовить инвентарь?`,
          tag: `arriving-${booking.id}`,
          priority: 'medium',
          data: { ...baseData, action: 'prepare' },
          actions: [
            { action: 'prepare', title: '🏄‍♂️ Подготовить' },
            { action: 'call', title: '📞 Позвонить' }
          ]
        };

      case 'client_overdue':
        return {
          title: '⚠️ Клиент опаздывает',
                     body: `${booking.clientName} опаздывает`,
          tag: `overdue-${booking.id}`,
          priority: 'high',
          data: { ...baseData, action: 'contact' },
          actions: [
            { action: 'call', title: '📞 Позвонить' },
            { action: 'no_show', title: '👻 Не явился' },
            { action: 'cancel', title: '❌ Отменить' }
          ]
        };

      case 'return_time':
        return {
          title: '🔄 Время возврата',
          body: `${booking.clientName} должен вернуть инвентарь`,
          tag: `return-${booking.id}`,
          priority: 'medium',
          data: { ...baseData, action: 'return' },
          actions: [
            { action: 'complete', title: '✅ Завершить' },
            { action: 'extend', title: '⏰ Продлить' }
          ]
        };

      case 'return_overdue':
        return {
          title: '🚨 Просрочка возврата',
          body: `${booking.clientName} просрочил возврат инвентаря`,
          tag: `return-overdue-${booking.id}`,
          priority: 'high',
          data: { ...baseData, action: 'contact_overdue' },
          actions: [
            { action: 'call', title: '📞 Позвонить срочно' },
            { action: 'complete', title: '✅ Завершить' }
          ]
        };

      case 'status_changed':
        return {
          title: '📝 Статус изменен',
          body: `${booking.clientName} - статус: ${this.getStatusText(booking.status)}`,
          tag: `status-${booking.id}`,
          priority: 'low',
          data: baseData
        };

      default:
        return null;
    }
  }

  /**
   * Получаем текст статуса на русском
   */
  private getStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      [BookingStatus.BOOKED]: 'Забронировано',
      [BookingStatus.PENDING_CONFIRMATION]: 'Ожидает подтверждения',
      [BookingStatus.CONFIRMED]: 'Подтверждено',
      [BookingStatus.IN_USE]: 'В использовании',
      [BookingStatus.COMPLETED]: 'Завершено',
      [BookingStatus.CANCELLED]: 'Отменено',
      [BookingStatus.NO_SHOW]: 'Не явился',
      [BookingStatus.RESCHEDULED]: 'Перенесено'
    };

    return statusTexts[status] || status;
  }

  /**
   * Отправляем уведомление через API (сервер отправит push)
   */
  async sendNotification(notification: NotificationPayload): Promise<boolean> {
    if (!this.isSupported || !this.isPermissionGranted) {
      console.warn('⚠️ Push-уведомления недоступны');
      return false;
    }

    try {
      // Формируем правильную структуру запроса для API
      const requestPayload = {
        payload: notification,
        notification_type: null, // Отправляем всем активным подпискам
        max_concurrent: 10
      };
      
      const response = await api.post('/v1/push-notifications/send', requestPayload);
      console.log('✅ Push-уведомление отправлено:', notification.title);
      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки push-уведомления:', error);
      return false;
    }
  }

  /**
   * Показываем локальное уведомление (fallback)
   */
  showLocalNotification(notification: NotificationPayload): void {
    if (!this.isPermissionGranted) {
      console.warn('⚠️ Нет разрешения на показ уведомлений');
      return;
    }

    new Notification(notification.title, {
      body: notification.body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: notification.tag,
      data: notification.data,
      requireInteraction: notification.priority === 'high',
      silent: notification.priority === 'low'
    });
  }

  /**
   * Проверяем статус разрешений и подписки
   */
  getStatus(): {
    isSupported: boolean;
    isPermissionGranted: boolean;
    hasSubscription: boolean;
    hasServiceWorker: boolean;
  } {
    return {
      isSupported: this.isSupported,
      isPermissionGranted: this.isPermissionGranted,
      hasSubscription: !!this.subscription,
      hasServiceWorker: !!this.serviceWorkerRegistration
    };
  }

  /**
   * Отписываемся от push-уведомлений
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        this.subscription = null;
        console.log('✅ Отписка от push-уведомлений выполнена');
        
        // Уведомляем сервер об отписке
        await api.post('/v1/push-notifications/unsubscribe');
      }

      return success;
    } catch (error) {
      console.error('❌ Ошибка отписки от push-уведомлений:', error);
      return false;
    }
  }
}

// Экспортируем единственный экземпляр сервиса
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService; 