import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  selectUnreadCount, 
  selectIsTooltipOpen, 
  selectAllNotifications 
} from '../../store/slices/notifications-slice/notificationsSelectors';
import { 
  setTooltipOpen, 
  markAllAsRead, 
  removeNotification 
} from '../../store/slices/notifications-slice/notificationsSlice';
import { useNotificationSync } from './useNotificationSync';
import { useNotificationSound, NotificationPriority } from './NotificationSoundService';
import './NotificationBell.css';
// Красивый тултип в стиле приложения с реальными данными
const NotificationTooltip = () => {
  const dispatch = useDispatch();
  const notifications = useSelector(selectAllNotifications);
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const { playSound, testSound, playBrandSound } = useNotificationSound();
  
  // Используем функции из useNotificationSync для правильной синхронизации с localStorage
  const { removeNotification: removeNotificationSync, markAllAsRead: markAllAsReadSync } = useNotificationSync();

  const handleMarkAllAsRead = () => {
    markAllAsReadSync(); // ✅ Теперь синхронизируется с localStorage
    testSound('urgent'); // Звук уведомления при прочтении всех
  };

  const handleRemoveNotification = (notificationId: string) => {
    removeNotificationSync(notificationId); // ✅ Теперь синхронизируется с localStorage
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return '!';
      case 'high': return '⚠';
      case 'medium': return '●';
      case 'low': return 'i';
      default: return '●';
    }
  };

  const getPriorityClass = (priority: string) => {
    return `notification-item-${priority}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, #2a2a2a 0%, #1e1e1e 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      width: '400px',
      maxHeight: '520px',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      color: '#ffffff'
    }}>
      {/* Заголовок */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(145deg, #4f46e5 0%, #3b82f6 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'white',
              boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onClick={() => testSound('urgent')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(79, 70, 229, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(79, 70, 229, 0.3)';
            }}
            title="🔊 Тест звука SUPBoard"
          >
            🔔
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>
              Уведомления
            </h3>
            {unreadNotifications.length > 0 && (
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                {unreadNotifications.length} непрочитанных
              </p>
            )}
          </div>
        </div>
        {unreadNotifications.length > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            style={{
              background: 'linear-gradient(145deg, #4f46e5 0%, #3b82f6 100%)',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.3)';
            }}
          >
            Прочитать все
          </button>
        )}
      </div>
      
      {/* Контент */}
      <div className="notification-tooltip-content" style={{
        maxHeight: '420px',
        overflowY: 'auto',
        padding: notifications.length > 0 ? '12px 0' : '0'
      }}>
        {notifications.length > 0 ? (
          notifications.map((notification, index) => (
            <div 
              key={notification.id}
              style={{
                margin: '8px 16px',
                padding: '20px',
                borderRadius: '16px',
                background: notification.isRead 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                  : 'linear-gradient(145deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: notification.isRead 
                  ? '1px solid rgba(255, 255, 255, 0.05)'
                  : '1px solid rgba(79, 70, 229, 0.2)',
                position: 'relative',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                boxShadow: notification.isRead 
                  ? '0 4px 8px rgba(0, 0, 0, 0.1)'
                  : '0 8px 16px rgba(79, 70, 229, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = notification.isRead 
                  ? '0 8px 16px rgba(0, 0, 0, 0.2)'
                  : '0 12px 24px rgba(79, 70, 229, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = notification.isRead 
                  ? '0 4px 8px rgba(0, 0, 0, 0.1)'
                  : '0 8px 16px rgba(79, 70, 229, 0.2)';
              }}
            >
              {/* Индикатор непрочитанного */}
              {!notification.isRead && (
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '20px',
                  width: '8px',
                  height: '8px',
                  background: 'linear-gradient(145deg, #4f46e5 0%, #3b82f6 100%)',
                  borderRadius: '50%',
                  boxShadow: '0 0 12px rgba(79, 70, 229, 0.6)'
                }} />
              )}
              
              {/* Иконка приоритета */}
              <div style={{
                position: 'absolute',
                left: '20px',
                top: '20px',
                width: '36px',
                height: '36px',
                background: notification.priority === 'urgent' 
                  ? 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)'
                  : notification.priority === 'high'
                  ? 'linear-gradient(145deg, #f59e0b 0%, #d97706 100%)'
                  : notification.priority === 'medium'
                  ? 'linear-gradient(145deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(145deg, #6b7280 0%, #4b5563 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: notification.priority === 'urgent' 
                  ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                  : notification.priority === 'high'
                  ? '0 4px 12px rgba(245, 158, 11, 0.3)'
                  : notification.priority === 'medium'
                  ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                  : '0 4px 12px rgba(107, 114, 128, 0.3)'
              }}>
                {getPriorityIcon(notification.priority)}
              </div>
              
              {/* Контент уведомления */}
              <div style={{ marginLeft: '72px', marginRight: '48px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#ffffff',
                    lineHeight: '1.3'
                  }}>
                    {notification.title}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    whiteSpace: 'nowrap',
                    marginLeft: '16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>
                    {formatTimeAgo(notification.timestamp)}
                  </div>
                </div>
                
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: '1.5',
                  marginBottom: '12px'
                }}>
                  {notification.body}
                </div>
                
                {notification.clientName && (
                  <div style={{
                    fontSize: '13px',
                    color: '#4f46e5',
                    fontWeight: '600',
                    marginBottom: '16px',
                    background: 'linear-gradient(145deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                    display: 'inline-block'
                  }}>
                    {notification.clientName}
                  </div>
                )}
                
                {/* Кнопки действий */}
                {notification.actions && notification.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    {notification.actions.map((action, index) => (
                      <button 
                        key={index}
                        onClick={() => {
                          // Играем звук в зависимости от типа действия
                          if (action.action === 'confirm' || action.action === 'returned') {
                            playSound('medium');
                          } else if (action.action === 'cancel' || action.action === 'contact_urgent') {
                            playSound('high');
                          } else {
                            playSound('low');
                          }
                        }}
                        style={{
                          background: action.action === 'confirm' || action.action === 'returned' 
                            ? 'linear-gradient(145deg, #10b981 0%, #059669 100%)' 
                            : action.action === 'cancel' || action.action === 'contact_urgent' 
                            ? 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)'
                            : 'linear-gradient(145deg, #4f46e5 0%, #3b82f6 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: action.action === 'confirm' || action.action === 'returned' 
                            ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
                            : action.action === 'cancel' || action.action === 'contact_urgent' 
                            ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                            : '0 4px 12px rgba(79, 70, 229, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = action.action === 'confirm' || action.action === 'returned' 
                            ? '0 6px 16px rgba(16, 185, 129, 0.4)' 
                            : action.action === 'cancel' || action.action === 'contact_urgent' 
                            ? '0 6px 16px rgba(239, 68, 68, 0.4)'
                            : '0 6px 16px rgba(79, 70, 229, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = action.action === 'confirm' || action.action === 'returned' 
                            ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
                            : action.action === 'cancel' || action.action === 'contact_urgent' 
                            ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                            : '0 4px 12px rgba(79, 70, 229, 0.3)';
                        }}
                      >
                        {action.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Кнопка удаления */}
              <button 
                onClick={() => handleRemoveNotification(notification.id)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '16px',
                  cursor: 'pointer',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          /* Пустое состояние */
          <div style={{
            padding: '60px 32px',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(145deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 24px',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              boxShadow: '0 8px 16px rgba(79, 70, 229, 0.1)'
            }}>
              🔔
            </div>
            <h4 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '20px', 
              fontWeight: '700',
              color: '#ffffff'
            }}>
              Пока нет уведомлений
            </h4>
            <p style={{ 
              margin: 0, 
              fontSize: '14px', 
              color: 'rgba(255, 255, 255, 0.5)',
              lineHeight: '1.6'
            }}>
              Здесь будут отображаться важные<br />
              уведомления о бронированиях и клиентах
            </p>
          </div>
        )}
      </div>
      
      {/* Подвал */}
      <div style={{
        padding: '16px 24px',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center'
      }}>
        {notifications.length > 0 ? (
          <small style={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            fontSize: '12px'
          }}>
            Уведомления автоматически удаляются через 24 часа
          </small>
        ) : (
          <small style={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            fontSize: '12px'
          }}>
            Уведомления автоматически удаляются через 24 часа
          </small>
        )}
      </div>
    </div>
  );
};

// Стили компонентов
const BellContainer = ({ children, ref, ...props }: any) => (
  <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} {...props}>
    {children}
  </div>
);

const BellIcon = ({ children, onClick, $color, className, title, ...props }: any) => (
  <div
    onClick={onClick}
    style={{
      fontSize: '18px',
      cursor: 'pointer',
      color: '#ffffff',
      padding: '12px',
      borderRadius: '12px',
      position: 'relative',
      transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      background: 'linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      width: '48px',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}
    className={`bell-icon ${className || ''}`}
    title={title}
    onMouseEnter={(e: any) => {
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
      e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }}
    onMouseLeave={(e: any) => {
      e.target.style.transform = 'translateY(0)';
      e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
      e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }}
    onMouseDown={(e: any) => {
      e.target.style.transform = 'translateY(-1px)';
      e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
    }}
    onMouseUp={(e: any) => {
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
    }}
    {...props}
  >
    {/* Анимированная подсветка */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
      transition: 'left 0.6s ease',
      pointerEvents: 'none'
    }} className="bell-shimmer" />
    {children}
  </div>
);

const Badge = ({ children, $priority, ...props }: any) => (
  <div
    className={$priority === 'urgent' ? 'notification-badge-urgent' : ''}
    style={{
      position: 'absolute',
      top: '-2px',
      right: '-2px',
      background: $priority === 'urgent' 
        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        : 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
      color: 'white',
      borderRadius: '50%',
      minWidth: '18px',
      height: '18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: '600',
      border: '2px solid rgba(255, 255, 255, 0.9)',
      boxShadow: $priority === 'urgent'
        ? '0 4px 12px rgba(239, 68, 68, 0.4)'
        : '0 4px 12px rgba(0, 122, 255, 0.4)',
      backdropFilter: 'blur(8px)',
      zIndex: 2
    }}
    {...props}
  >
    {children}
  </div>
);

const TooltipWrapper = ({ children, ...props }: any) => (
  <div
    className="notification-tooltip"
    style={{
      position: 'fixed', // Фиксированное позиционирование для правильного отображения
      top: '70px', // Позиция под шапкой
      right: '20px', // Отступ справа
      zIndex: 99999, // Максимальный z-index для отображения поверх всех элементов
      pointerEvents: 'auto' // Обеспечиваем взаимодействие с тултипом
    }}
    {...props}
  >
    {/* Стрелочка указывающая на колокольчик */}
    <div style={{
      position: 'absolute',
      top: '-10px',
      right: '40px',
      width: '0',
      height: '0',
      borderLeft: '10px solid transparent',
      borderRight: '10px solid transparent',
      borderBottom: '10px solid #2a2a2a',
      filter: 'drop-shadow(0 -4px 8px rgba(0, 0, 0, 0.4))',
      zIndex: 100000
    }} />
    {children}
  </div>
);

const TooltipWrapperDynamic = ({ children, position, ...props }: any) => (
  <div
    className="notification-tooltip"
    style={{
      position: 'fixed',
      top: `${position.top}px`,
      right: `${position.right}px`,
      zIndex: 99999,
      pointerEvents: 'auto'
    }}
    {...props}
  >
    {/* Стрелочка указывающая на колокольчик */}
    <div style={{
      position: 'absolute',
      top: '-10px',
      right: '20px', // Центрируем стрелочку относительно тултипа
      width: '0',
      height: '0',
      borderLeft: '10px solid transparent',
      borderRight: '10px solid transparent',
      borderBottom: '10px solid #2a2a2a',
      filter: 'drop-shadow(0 -4px 8px rgba(0, 0, 0, 0.4))',
      zIndex: 100000
    }} />
    {children}
  </div>
);

// Компонент только для колокольчика (без тултипа)
export const NotificationBellIcon: React.FC = () => {
  const dispatch = useDispatch();
  const unreadCount = useSelector(selectUnreadCount);
  const isTooltipOpen = useSelector(selectIsTooltipOpen);
  const notifications = useSelector(selectAllNotifications);
  const { playSound } = useNotificationSound();

  const handleBellClick = () => {
    dispatch(setTooltipOpen(!isTooltipOpen));
    // Убираем звуки при клике на колокольчик - звук только при получении уведомлений
  };

  const getPriorityColor = () => {
    if (unreadCount === 0) return '#6B7280'; // Серый
    
    // Проверяем наличие критичных уведомлений
    const hasUrgent = notifications.some(n => !n.isRead && n.priority === 'urgent');
    const hasHigh = notifications.some(n => !n.isRead && n.priority === 'high');
    
    if (hasUrgent) return '#DC2626'; // Красный для urgent
    if (hasHigh) return '#F59E0B'; // Оранжевый для high
    return '#10B981'; // Зеленый для medium/low
  };

  const getAnimationClass = () => {
    if (unreadCount === 0) return '';
    
    const hasUrgent = notifications.some(n => !n.isRead && n.priority === 'urgent');
    if (hasUrgent) return 'notification-bell-urgent';
    
    return 'notification-bell-has-notifications';
  };

  return (
    <div data-notification-bell style={{ position: 'relative', display: 'inline-block' }}>
      <BellIcon 
        onClick={handleBellClick}
        $color={getPriorityColor()}
        className={getAnimationClass()}
        title={`Уведомления (${unreadCount} непрочитанных)`}
      >
        🔔
        {unreadCount > 0 && (
          <Badge $priority={notifications.some(n => !n.isRead && n.priority === 'urgent') ? 'urgent' : 'normal'}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </BellIcon>
    </div>
  );
};

// Компонент только для тултипа (рендерится глобально)
export const NotificationTooltipGlobal: React.FC = () => {
  const dispatch = useDispatch();
  const isTooltipOpen = useSelector(selectIsTooltipOpen);
  const [tooltipPosition, setTooltipPosition] = React.useState({ top: 70, right: 20 });

  // Инициализируем синхронизацию уведомлений
  useNotificationSync();

  // Вычисляем позицию тултипа относительно колокольчика
  useEffect(() => {
    if (isTooltipOpen) {
      const bellElement = document.querySelector('[data-notification-bell]');
      if (bellElement) {
        const bellRect = bellElement.getBoundingClientRect();
        const tooltipTop = bellRect.bottom + 8; // 8px отступ под колокольчиком
        const tooltipRight = window.innerWidth - bellRect.right; // Выравниваем по правому краю колокольчика
        
        setTooltipPosition({
          top: tooltipTop,
          right: tooltipRight
        });
      }
    }
  }, [isTooltipOpen]);

  // Обработчик клика вне тултипа
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Проверяем, что клик не по колокольчику или тултипу
      const target = event.target as HTMLElement;
      const isClickOnBell = target.closest('[data-notification-bell]');
      const isClickOnTooltip = target.closest('.notification-tooltip');
      
      if (!isClickOnBell && !isClickOnTooltip) {
        dispatch(setTooltipOpen(false));
      }
    };

    if (isTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipOpen, dispatch]);

  if (!isTooltipOpen) return null;

  return (
    <TooltipWrapperDynamic position={tooltipPosition}>
      <NotificationTooltip />
    </TooltipWrapperDynamic>
  );
};

// Основной компонент (для обратной совместимости)
export const NotificationBell: React.FC = () => {
  const dispatch = useDispatch();
  const unreadCount = useSelector(selectUnreadCount);
  const isTooltipOpen = useSelector(selectIsTooltipOpen);
  const notifications = useSelector(selectAllNotifications);
  const bellRef = useRef<HTMLDivElement>(null);
  const { playSound } = useNotificationSound();

  // Инициализируем синхронизацию уведомлений
  useNotificationSync();

  // Закрытие тултипа при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        dispatch(setTooltipOpen(false));
      }
    };

    if (isTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isTooltipOpen, dispatch]);

  const handleBellClick = () => {
    dispatch(setTooltipOpen(!isTooltipOpen));
    // Убираем звуки при клике на колокольчик - звук только при получении уведомлений
  };

  const getPriorityColor = () => {
    if (unreadCount === 0) return '#6B7280'; // Серый
    
    // Проверяем наличие критичных уведомлений
    const hasUrgent = notifications.some(n => !n.isRead && n.priority === 'urgent');
    const hasHigh = notifications.some(n => !n.isRead && n.priority === 'high');
    
    if (hasUrgent) return '#DC2626'; // Красный для urgent
    if (hasHigh) return '#F59E0B'; // Оранжевый для high
    return '#10B981'; // Зеленый для medium/low
  };

  const getAnimationClass = () => {
    if (unreadCount === 0) return '';
    
    const hasUrgent = notifications.some(n => !n.isRead && n.priority === 'urgent');
    if (hasUrgent) return 'notification-bell-urgent';
    
    return 'notification-bell-has-notifications';
  };

  return (
    <BellContainer ref={bellRef} data-notification-bell>
      <BellIcon 
        onClick={handleBellClick}
        $color={getPriorityColor()}
        className={getAnimationClass()}
        title={`Уведомления (${unreadCount} непрочитанных)`}
      >
        🔔
        {unreadCount > 0 && (
          <Badge $priority={notifications.some(n => !n.isRead && n.priority === 'urgent') ? 'urgent' : 'normal'}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </BellIcon>
      
      {isTooltipOpen && (
        <TooltipWrapper>
          <NotificationTooltip />
        </TooltipWrapper>
      )}
    </BellContainer>
  );
}; 