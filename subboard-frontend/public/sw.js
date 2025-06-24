// Service Worker для push-уведомлений
const CACHE_NAME = 'subboard-v1';
const DB_NAME = 'subboard-notifications';
const DB_VERSION = 1;
const STORE_NAME = 'notifications';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/canoe.png'
];

// Функции для работы с IndexedDB
async function openNotificationsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('📦 [SW] IndexedDB store created');
      }
    };
  });
}

async function saveNotificationToIndexedDB(notification) {
  try {
    const db = await openNotificationsDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.add(notification);
    console.log('💾 [SW] Notification saved to IndexedDB:', notification.id);
    
    // Ограничиваем количество уведомлений (максимум 100)
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > 100) {
        // Удаляем старые уведомления
        const index = store.index('timestamp');
        const cursorRequest = index.openCursor();
        let deleteCount = countRequest.result - 100;
        
        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && deleteCount > 0) {
            store.delete(cursor.primaryKey);
            deleteCount--;
            cursor.continue();
          }
        };
      }
    };
    
  } catch (error) {
    console.error('❌ [SW] Error saving to IndexedDB:', error);
    throw error;
  }
}

async function loadNotificationsFromIndexedDB() {
  try {
    const db = await openNotificationsDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const notifications = request.result;
        // Сортируем по времени (новые первыми)
        notifications.sort((a, b) => b.timestamp - a.timestamp);
        console.log(`📦 [SW] Loaded ${notifications.length} notifications from IndexedDB`);
        resolve(notifications);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ [SW] Error loading from IndexedDB:', error);
    return [];
  }
}

async function removeNotificationFromIndexedDB(notificationId) {
  try {
    const db = await openNotificationsDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.delete(notificationId);
    console.log(`🗑️ [SW] Notification removed from IndexedDB: ${notificationId}`);
  } catch (error) {
    console.error('❌ [SW] Error removing from IndexedDB:', error);
    throw error;
  }
}

async function syncNotificationsWithIndexedDB(localStorageNotifications) {
  try {
    const db = await openNotificationsDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Получаем все уведомления из IndexedDB
    const indexedDBNotifications = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Создаем Set ID-шников из localStorage
    const localStorageIds = new Set(localStorageNotifications.map(n => n.id));
    
    // Удаляем из IndexedDB те уведомления, которых нет в localStorage
    let removedCount = 0;
    for (const notification of indexedDBNotifications) {
      if (!localStorageIds.has(notification.id)) {
        await store.delete(notification.id);
        removedCount++;
      }
    }
    
    console.log(`🔄 [SW] Синхронизация завершена: удалено ${removedCount} уведомлений из IndexedDB`);
  } catch (error) {
    console.error('❌ [SW] Error syncing with IndexedDB:', error);
  }
}

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('🚀 [SW] Service Worker устанавливается');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('🔧 [SW] Кэш открыт');
        console.log('📦 [SW] Попытка кэширования файлов:', urlsToCache);
        return cache.addAll(urlsToCache).catch(error => {
          console.warn('⚠️ [SW] Некоторые файлы не удалось кэшировать:', error);
          // Пытаемся кэшировать файлы по одному
          return Promise.allSettled(
            urlsToCache.map(url => 
              cache.add(url).catch(err => {
                console.warn(`⚠️ [SW] Не удалось кэшировать ${url}:`, err);
                return null;
              })
            )
          );
        });
      }).then(() => {
        // Принудительно активируем новый Service Worker
        console.log('⚡ [SW] Принудительная активация Service Worker');
        return self.skipWaiting();
      }).catch(error => {
        console.error('❌ [SW] Ошибка установки Service Worker:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('🔄 [SW] Service Worker активируется');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ [SW] Удаляем старый кэш', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ [SW] Service Worker активирован и готов к работе');
      // Берем контроль над всеми клиентами
      return self.clients.claim();
    })
  );
});

// Обработка сообщений от клиентов
self.addEventListener('message', event => {
  console.log('📨 [SW] Получено сообщение от клиента:', event.data);
  
  if (event.data?.type === 'CLIENT_READY') {
    console.log('✅ [SW] Клиент готов к получению уведомлений');
    event.ports[0]?.postMessage({ type: 'SW_READY' });
  }
  
  if (event.data?.type === 'LOAD_NOTIFICATIONS') {
    console.log('📦 [SW] Запрос на загрузку уведомлений из IndexedDB');
    loadNotificationsFromIndexedDB().then(notifications => {
      event.ports[0]?.postMessage({ 
        type: 'NOTIFICATIONS_LOADED', 
        notifications 
      });
    });
  }
  
  if (event.data?.type === 'SYNC_NOTIFICATIONS') {
    console.log('🔄 [SW] Запрос на синхронизацию уведомлений с IndexedDB');
    const localStorageNotifications = event.data.notifications || [];
    syncNotificationsWithIndexedDB(localStorageNotifications).then(() => {
      event.ports[0]?.postMessage({ 
        type: 'SYNC_COMPLETED'
      });
    });
  }
});

// Обработка push-уведомлений
self.addEventListener('push', event => {
  console.log('📩 Service Worker: Получено push-уведомление', event);
  
  if (event.data) {
    const data = event.data.json();
    console.log('📩 Push данные:', data);
    
    // Подготавливаем данные уведомления для отправки в основной поток
    const notificationData = {
      id: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title || 'Уведомление',
      body: data.body || '',
      type: data.data?.type || 'unknown',
      priority: data.data?.priority || 'medium',
      bookingId: data.data?.booking_id,
      clientName: data.data?.client_name,
      timestamp: Date.now(),
      isRead: false,
      actions: data.actions || [],
      additionalData: data.data || {},
    };
    
    console.log('📤 [SW] Отправляем уведомление в основной поток для сохранения в localStorage');
    
    // Сохраняем уведомление в IndexedDB (работает даже при закрытом приложении)
    saveNotificationToIndexedDB(notificationData).then(() => {
      console.log('💾 [SW] Уведомление сохранено в IndexedDB');
    }).catch(error => {
      console.error('❌ [SW] Ошибка сохранения в IndexedDB:', error);
    });
    
    // Отправляем уведомление всем открытым вкладкам для сохранения в localStorage
    // Service Worker не может напрямую записывать в localStorage основного потока
    self.clients.matchAll().then(clients => {
      console.log(`🔍 [SW] Найдено ${clients.length} открытых клиентов:`, clients.map(c => c.url));
      
      clients.forEach((client, index) => {
        console.log(`📤 [SW] Отправляем уведомление клиенту ${index + 1}:`, client.url);
        client.postMessage({
          type: 'NEW_NOTIFICATION',
          notification: notificationData
        });
      });
      
      console.log(`📱 [SW] Уведомление отправлено в ${clients.length} открытых вкладок`);
      
      if (clients.length === 0) {
        console.log('📦 [SW] Нет открытых вкладок, но уведомление сохранено в IndexedDB для последующей загрузки');
      }
    }).catch(error => {
      console.error('❌ [SW] Ошибка при отправке уведомления клиентам:', error);
    });
    
    // Определяем, требует ли уведомление взаимодействия
    const isHighPriority = data.data?.priority === 'high' || data.data?.priority === 'urgent';
    const requiresInteraction = data.requireInteraction || isHighPriority;
    
    const options = {
      body: data.body,
      icon: data.icon || '/canoe.png',
      badge: data.badge || '/canoe.png',
      tag: data.tag || 'booking-notification',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: requiresInteraction,
      silent: data.data?.priority === 'low',
      vibrate: getVibrationPattern(data.data?.priority),
      timestamp: Date.now(),
      renotify: true, // Показывать уведомление даже если есть с тем же tag
      dir: 'auto',
      lang: 'ru',
      // Дополнительные настройки для критичных уведомлений
      ...(isHighPriority && {
        sticky: true, // Попытка сделать уведомление "липким"
        persistent: true // Дополнительная настройка постоянности
      })
    };
    
    console.log('🔔 Настройки уведомления:', {
      title: data.title,
      priority: data.data?.priority,
      requireInteraction: requiresInteraction,
      isHighPriority
    });

    // Показываем уведомление
    const showNotificationPromise = self.registration.showNotification(data.title, options);
    
    // Для критичных уведомлений добавляем дополнительную логику
    if (isHighPriority) {
      console.log('🚨 Критичное уведомление - применяем дополнительные меры');
      
      // Через 5 секунд показываем повторное уведомление, если первое было закрыто
      const repeatNotification = new Promise(resolve => {
        setTimeout(async () => {
          try {
            const notifications = await self.registration.getNotifications({
              tag: options.tag
            });
            
            // Если уведомление исчезло, показываем повторно
            if (notifications.length === 0) {
              console.log('🔄 Повторно показываем критичное уведомление');
              await self.registration.showNotification(`🔄 ${data.title}`, {
                ...options,
                body: `ПОВТОР: ${data.body}`,
                tag: `${options.tag}_repeat`
              });
            }
          } catch (error) {
            console.error('❌ Ошибка повторного показа уведомления:', error);
          }
          resolve();
        }, 5000);
      });
      
      event.waitUntil(Promise.all([showNotificationPromise, repeatNotification]));
    } else {
      event.waitUntil(showNotificationPromise);
    }
  }
});

// Функция для определения паттерна вибрации
function getVibrationPattern(priority) {
  switch (priority) {
    case 'urgent':
      return [200, 100, 200, 100, 200]; // Интенсивная вибрация
    case 'high':
      return [200, 100, 200]; // Средняя вибрация
    case 'medium':
      return [150]; // Короткая вибрация
    case 'low':
    default:
      return [100]; // Минимальная вибрация
  }
}

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  console.log('🖱️ Service Worker: Клик по уведомлению', event);
  
  event.notification.close();
  
  const data = event.notification.data;
  const bookingId = data.booking_id || data.bookingId;
  
  // Определяем URL для открытия
  let urlToOpen = '/';
  if (bookingId) {
    urlToOpen = `/?booking=${bookingId}`;
  }
  
  // Обработка действий в уведомлении
  if (event.action) {
    console.log('🎯 Действие в уведомлении:', event.action, 'для бронирования:', bookingId);
    
    // Отправляем действие на сервер для обработки
    const actionPromise = handleNotificationAction(event.action, data);
    
    switch (event.action) {
      case 'confirm':
        urlToOpen = `/?action=confirm&booking=${bookingId}`;
        break;
      case 'cancel':
        urlToOpen = `/?action=cancel&booking=${bookingId}`;
        break;
      case 'contact':
      case 'contact_urgent':
        if (data.phone) {
          urlToOpen = `tel:${data.phone}`;
        } else {
          urlToOpen = `/?action=contact&booking=${bookingId}`;
        }
        break;
      case 'arrived':
        urlToOpen = `/?action=arrived&booking=${bookingId}`;
        break;
      case 'prepare':
        urlToOpen = `/?action=prepare&booking=${bookingId}`;
        break;
      case 'view':
        urlToOpen = `/?action=view&booking=${bookingId}`;
        break;
      case 'remind':
        urlToOpen = `/?action=remind&booking=${bookingId}`;
        break;
      case 'returned':
        urlToOpen = `/?action=returned&booking=${bookingId}`;
        break;
      case 'lost':
        urlToOpen = `/?action=lost&booking=${bookingId}`;
        break;
      default:
        urlToOpen = `/?action=${event.action}&booking=${bookingId}`;
    }
    
    event.waitUntil(actionPromise);
  }
  
  // Открываем или фокусируем приложение
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Ищем уже открытую вкладку
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        
        // Открываем новую вкладку
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Обработка действий уведомлений на сервере
async function handleNotificationAction(action, data) {
  const bookingId = data.booking_id || data.bookingId;
  
  if (!bookingId) {
    console.log('❌ Нет ID бронирования для действия:', action);
    return;
  }
  
  try {
    let apiEndpoint = '';
    let requestBody = {};
    
    switch (action) {
      case 'confirm':
        apiEndpoint = `/api/v1/bookings/${bookingId}`;
        requestBody = { status: 'confirmed' };
        break;
      case 'cancel':
        apiEndpoint = `/api/v1/bookings/${bookingId}`;
        requestBody = { status: 'cancelled' };
        break;
      case 'arrived':
        apiEndpoint = `/api/v1/bookings/${bookingId}`;
        requestBody = { status: 'in_use', actual_start_time: new Date().toISOString() };
        break;
      case 'returned':
        apiEndpoint = `/api/v1/bookings/${bookingId}`;
        requestBody = { status: 'completed', time_returned_by_client: new Date().toISOString() };
        break;
      default:
        console.log('🔄 Действие не требует API вызова:', action);
        return;
    }
    
    if (apiEndpoint) {
      const response = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        console.log('✅ Действие выполнено:', action, 'для бронирования:', bookingId);
        
        // Показываем уведомление об успехе
        self.registration.showNotification('✅ SUPBoard - Действие выполнено', {
          body: getActionSuccessMessage(action, data.client_name),
          icon: '/canoe.png',
          tag: `action-success-${bookingId}`,
          requireInteraction: false,
          actions: []
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка выполнения действия:', action, error);
    
    // Показываем уведомление об ошибке
    self.registration.showNotification('❌ SUPBoard - Ошибка', {
      body: `Не удалось выполнить действие. Попробуйте в приложении.`,
      icon: '/canoe.png',
      tag: `action-error-${bookingId}`,
      requireInteraction: false,
      actions: []
    });
  }
}

// Сообщения об успешных действиях
function getActionSuccessMessage(action, clientName) {
  const name = clientName || 'Клиент';
  
  switch (action) {
    case 'confirm':
      return `Бронирование ${name} подтверждено`;
    case 'cancel':
      return `Бронирование ${name} отменено`;
    case 'arrived':
      return `${name} отмечен как пришедший`;
    case 'returned':
      return `Возврат от ${name} оформлен`;
    default:
      return 'Действие выполнено успешно';
  }
}

// Обработка закрытия уведомлений
self.addEventListener('notificationclose', event => {
  console.log('❌ Service Worker: Уведомление закрыто', event);
  
  // Можно отправить аналитику о закрытии уведомления
  const data = event.notification.data;
  if (data.trackClose) {
    // Отправляем событие закрытия на сервер
    fetch('/api/analytics/notification-closed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: data.id,
        bookingId: data.bookingId,
        closedAt: new Date().toISOString()
      })
    }).catch(err => console.log('Ошибка отправки аналитики:', err));
  }
});

// Обработка фоновой синхронизации (для будущего использования)
self.addEventListener('sync', event => {
  console.log('🔄 Service Worker: Фоновая синхронизация', event);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Здесь можно синхронизировать данные при восстановлении соединения
      fetch('/api/bookings/sync')
        .then(response => response.json())
        .then(data => {
          console.log('✅ Фоновая синхронизация завершена:', data);
        })
        .catch(err => {
          console.log('❌ Ошибка фоновой синхронизации:', err);
        })
    );
  }
});

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
  console.log('💬 Service Worker: Получено сообщение', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('🚀 Service Worker загружен'); 