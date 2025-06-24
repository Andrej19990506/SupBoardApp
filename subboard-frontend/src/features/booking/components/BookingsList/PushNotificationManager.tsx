import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { differenceInMinutes, parseISO } from 'date-fns';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import pushNotificationService from '@features/booking/services/pushNotificationService';

interface PushNotificationManagerProps {
  bookings: Booking[];
  enabled?: boolean;
}

interface NotificationStatus {
  isSupported: boolean;
  isPermissionGranted: boolean;
  hasSubscription: boolean;
  hasServiceWorker: boolean;
  isInitialized: boolean;
}

const StatusContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 12px;
  z-index: 1000;
  max-width: 300px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const StatusRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0;
`;

const StatusIndicator = styled.span<{ $status: 'success' | 'warning' | 'error' }>`
  color: ${props => 
    props.$status === 'success' ? '#4CAF50' :
    props.$status === 'warning' ? '#FF9800' :
    '#F44336'
  };
  font-weight: 600;
`;

const EnableButton = styled.button`
  background: #007AFF;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  margin-top: 8px;
  
  &:hover {
    background: #0056CC;
  }
  
  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`;

const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ 
  bookings, 
  enabled = true 
}) => {
  console.log('🔔 [PushNotificationManager] Компонент рендерится:', { enabled, bookingsCount: bookings.length });

  const [status, setStatus] = useState<NotificationStatus>({
    isSupported: false,
    isPermissionGranted: false,
    hasSubscription: false,
    hasServiceWorker: false,
    isInitialized: false
  });
  
  const [showStatus, setShowStatus] = useState(true); // Показываем статус для дебага
  const [sentNotifications, setSentNotifications] = useState<Set<string>>(new Set());

  // Инициализация push-уведомлений
  useEffect(() => {
    console.log('🔔 [PushNotificationManager] useEffect инициализации запущен:', { enabled });
    
    const initializePushNotifications = async () => {
      if (!enabled) {
        console.log('🔔 [PushNotificationManager] Push-уведомления отключены');
        return;
      }

      try {
        console.log('🔔 [PushNotificationManager] Начинаем инициализацию push-уведомлений...');
        const initialized = await pushNotificationService.initialize();
        const currentStatus = pushNotificationService.getStatus();
        
        console.log('🔔 [PushNotificationManager] Результат инициализации:', { initialized, currentStatus });
        
        setStatus({
          ...currentStatus,
          isInitialized: initialized
        });

        console.log('🔔 Push-уведомления инициализированы:', initialized);
      } catch (error) {
        console.error('❌ Ошибка инициализации push-уведомлений:', error);
        console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Unknown error');
      }
    };

    initializePushNotifications();
  }, [enabled]);

  // Обработка событий бронирований для отправки push-уведомлений
  const checkBookingEvents = useCallback(() => {
    if (!status.isInitialized || !enabled) return;

    const now = new Date();
    
    bookings.forEach(booking => {
      const plannedTime = parseISO(booking.plannedStartTime);
      const minutesUntilStart = differenceInMinutes(plannedTime, now);

      // Создаем уникальные ключи для уведомлений
      const pendingConfirmationKey = `pending-${booking.id}`;
      const arrivingSoonKey = `arriving-${booking.id}`;
      const overdueKey = `overdue-${booking.id}`;
      const returnTimeKey = `return-${booking.id}`;
      const returnOverdueKey = `return-overdue-${booking.id}`;

      switch (booking.status) {
        case BookingStatus.PENDING_CONFIRMATION:
          if (!sentNotifications.has(pendingConfirmationKey)) {
            const notification = pushNotificationService.createBookingNotification(
              booking, 
              'pending_confirmation'
            );
            
            if (notification) {
              pushNotificationService.sendNotification(notification);
              setSentNotifications(prev => new Set(Array.from(prev).concat([pendingConfirmationKey])));
              console.log('📩 Отправлено push-уведомление: требуется подтверждение');
            }
          }
          break;

        case BookingStatus.BOOKED:
        case BookingStatus.CONFIRMED:
          // Клиент скоро придет (за 15 минут)
          if (minutesUntilStart === 15 && !sentNotifications.has(arrivingSoonKey)) {
            const notification = pushNotificationService.createBookingNotification(
              booking,
              'client_arriving_soon'
            );
            
            if (notification) {
              pushNotificationService.sendNotification(notification);
              setSentNotifications(prev => new Set(Array.from(prev).concat([arrivingSoonKey])));
              console.log('📩 Отправлено push-уведомление: клиент скоро придет');
            }
          }
          
          // Клиент опаздывает (каждые 15 минут после опоздания)
          if (minutesUntilStart < 0 && minutesUntilStart % 15 === 0) {
            const overdueKeyWithTime = `${overdueKey}-${Math.abs(minutesUntilStart)}`;
            
            if (!sentNotifications.has(overdueKeyWithTime)) {
              const notification = pushNotificationService.createBookingNotification(
                booking,
                'client_overdue'
              );
              
              if (notification) {
                // Обновляем текст с точным временем опоздания
                notification.body = `${booking.clientName} опаздывает на ${Math.abs(minutesUntilStart)} мин`;
                pushNotificationService.sendNotification(notification);
                setSentNotifications(prev => new Set(Array.from(prev).concat([overdueKeyWithTime])));
                console.log('📩 Отправлено push-уведомление: клиент опаздывает');
              }
            }
          }
          break;

        case BookingStatus.IN_USE:
          if (booking.actualStartTime) {
            const startTime = parseISO(booking.actualStartTime);
            const endTime = new Date(startTime.getTime() + booking.durationInHours * 60 * 60 * 1000);
            const minutesUntilReturn = differenceInMinutes(endTime, now);

            // Время возврата подошло
            if (minutesUntilReturn === 0 && !sentNotifications.has(returnTimeKey)) {
              const notification = pushNotificationService.createBookingNotification(
                booking,
                'return_time'
              );
              
              if (notification) {
                pushNotificationService.sendNotification(notification);
                setSentNotifications(prev => new Set(Array.from(prev).concat([returnTimeKey])));
                console.log('📩 Отправлено push-уведомление: время возврата');
              }
            }
            
            // Просрочка возврата (каждые 15 минут)
            if (minutesUntilReturn < 0 && minutesUntilReturn % 15 === 0) {
              const returnOverdueKeyWithTime = `${returnOverdueKey}-${Math.abs(minutesUntilReturn)}`;
              
              if (!sentNotifications.has(returnOverdueKeyWithTime)) {
                const notification = pushNotificationService.createBookingNotification(
                  booking,
                  'return_overdue'
                );
                
                if (notification) {
                  // Обновляем текст с точным временем просрочки
                  notification.body = `${booking.clientName} просрочил возврат на ${Math.abs(minutesUntilReturn)} мин`;
                  pushNotificationService.sendNotification(notification);
                  setSentNotifications(prev => new Set(Array.from(prev).concat([returnOverdueKeyWithTime])));
                  console.log('📩 Отправлено push-уведомление: просрочка возврата');
                }
              }
            }
          }
          break;
      }
    });
  }, [bookings, status.isInitialized, enabled, sentNotifications]);

  // Проверяем события каждую минуту
  useEffect(() => {
    if (!enabled) return;

    checkBookingEvents();
    
    const interval = setInterval(checkBookingEvents, 60000); // Каждую минуту
    
    return () => clearInterval(interval);
  }, [checkBookingEvents, enabled]);

  // Очищаем старые уведомления (чтобы не накапливались в памяти)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setSentNotifications(prev => {
        // Оставляем только уведомления за последние 24 часа
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
        const filtered = new Set<string>();
        
        prev.forEach(key => {
          // Простая эвристика: если ключ содержит timestamp, проверяем его
          const timestampMatch = key.match(/-(\d+)$/);
          if (!timestampMatch || Date.now() - parseInt(timestampMatch[1]) < cutoffTime) {
            filtered.add(key);
          }
        });
        
        return filtered;
      });
    }, 60 * 60 * 1000); // Каждый час

    return () => clearInterval(cleanupInterval);
  }, []);

  const handleEnablePushNotifications = async () => {
    try {
      const initialized = await pushNotificationService.initialize();
      const currentStatus = pushNotificationService.getStatus();
      
      setStatus({
        ...currentStatus,
        isInitialized: initialized
      });

      if (initialized) {
        console.log('✅ Push-уведомления успешно включены');
      }
    } catch (error) {
      console.error('❌ Ошибка включения push-уведомлений:', error);
    }
  };

  const handleDisablePushNotifications = async () => {
    try {
      await pushNotificationService.unsubscribe();
      setStatus(prev => ({
        ...prev,
        hasSubscription: false,
        isInitialized: false
      }));
      console.log('✅ Push-уведомления отключены');
    } catch (error) {
      console.error('❌ Ошибка отключения push-уведомлений:', error);
    }
  };

  // Показываем статус только в development режиме или при ошибках
  if (!showStatus && status.isInitialized) {
    return null;
  }

  return (
    <StatusContainer>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        🔔 Push-уведомления
      </div>
      
      <StatusRow>
        <span>Поддержка браузера:</span>
        <StatusIndicator $status={status.isSupported ? 'success' : 'error'}>
          {status.isSupported ? '✅' : '❌'}
        </StatusIndicator>
      </StatusRow>
      
      <StatusRow>
        <span>Разрешение:</span>
        <StatusIndicator $status={status.isPermissionGranted ? 'success' : 'warning'}>
          {status.isPermissionGranted ? '✅' : '⚠️'}
        </StatusIndicator>
      </StatusRow>
      
      <StatusRow>
        <span>Service Worker:</span>
        <StatusIndicator $status={status.hasServiceWorker ? 'success' : 'warning'}>
          {status.hasServiceWorker ? '✅' : '⚠️'}
        </StatusIndicator>
      </StatusRow>
      
      <StatusRow>
        <span>Push-подписка:</span>
        <StatusIndicator $status={status.hasSubscription ? 'success' : 'warning'}>
          {status.hasSubscription ? '✅' : '⚠️'}
        </StatusIndicator>
      </StatusRow>
      
      <StatusRow>
        <span>Статус:</span>
        <StatusIndicator $status={status.isInitialized ? 'success' : 'error'}>
          {status.isInitialized ? 'Активно' : 'Неактивно'}
        </StatusIndicator>
      </StatusRow>

      {!status.isInitialized && status.isSupported && (
        <EnableButton onClick={handleEnablePushNotifications}>
          Включить уведомления
        </EnableButton>
      )}

      {status.isInitialized && (
        <EnableButton onClick={handleDisablePushNotifications}>
          Отключить уведомления
        </EnableButton>
      )}

      <div style={{ marginTop: 8, fontSize: 10, opacity: 0.7 }}>
        Уведомлений отправлено: {sentNotifications.size}
      </div>

      {/* Кнопка для показа/скрытия статуса */}
      <button
        onClick={() => setShowStatus(!showStatus)}
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '50%',
          width: 20,
          height: 20,
          color: 'white',
          fontSize: 12,
          cursor: 'pointer'
        }}
      >
        ×
      </button>
    </StatusContainer>
  );
};

export default PushNotificationManager; 