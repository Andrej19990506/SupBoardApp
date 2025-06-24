import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { format, parseISO, addMinutes, differenceInMinutes, isAfter, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppDispatch } from '@features/booking/store/hooks';
import { updateBookingAsync, fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBoards } from '@features/booking/store/slices/board-slice/boardThunk';
import { fetchBoardBookings } from '@features/booking/store/slices/board-bookings/boardBookingsThunks';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import { bookingUpdateTracker } from '@features/booking/utils/bookingUpdateTracker';

interface BookingStatusManagerProps {
    bookings: Booking[];
    onStatusUpdate?: (bookingId: string, newStatus: string) => void;
}

interface StatusAlert {
    id: string;
    type: 'overdue' | 'upcoming' | 'ready-for-pickup' | 'ready-for-return' | 'pending-confirmation';
    booking: Booking;
    message: string;
    timeLeft: number; // в минутах
    priority: 'high' | 'medium' | 'low';
}

const AlertContainer = styled.div`
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const AlertCard = styled.div<{ $priority: 'high' | 'medium' | 'low' }>`
    background: ${props => 
        props.$priority === 'high' ? 'linear-gradient(135deg, #FF6B6B, #FF8E8E)' :
        props.$priority === 'medium' ? 'linear-gradient(135deg, #FFD93D, #FFE066)' :
        'linear-gradient(135deg, #4ECDC4, #6EE7E0)'
    };
    color: ${props => props.$priority === 'medium' ? '#333' : '#fff'};
    padding: 12px;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    animation: slideIn 0.3s ease-out;
    max-width: 350px;
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;

const AlertHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
`;

const AlertTitle = styled.h3`
    margin: 0;
    font-size: 15px;
    font-weight: 600;
`;

const AlertTime = styled.span`
    font-size: 11px;
    opacity: 0.9;
    font-weight: 500;
`;

const AlertMessage = styled.p`
    margin: 0 0 10px 0;
    font-size: 13px;
    line-height: 1.3;
`;

const AlertActions = styled.div`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $variant: 'primary' | 'secondary' }>`
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    
    ${props => props.$variant === 'primary' ? `
        background: rgba(255, 255, 255, 0.9);
        color: #333;
        
        &:hover {
            background: rgba(255, 255, 255, 1);
            transform: translateY(-1px);
        }
    ` : `
        background: rgba(255, 255, 255, 0.2);
        color: inherit;
        border: 1px solid rgba(255, 255, 255, 0.3);
        
        &:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `}
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s ease;
    
    &:hover {
        opacity: 1;
    }
`;

const BookingStatusManager: React.FC<BookingStatusManagerProps> = ({ 
    bookings, 
    onStatusUpdate 
}) => {
    const dispatch = useAppDispatch();
    const [alerts, setAlerts] = useState<StatusAlert[]>([]);
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

    // Функция для анализа статусов и создания уведомлений
    const analyzeBookingStatuses = useCallback(() => {
        const now = new Date();
        const newAlerts: StatusAlert[] = [];

        bookings.forEach(booking => {
            const alertId = `${booking.id}-${booking.status}`;
            
            // Пропускаем уже отклоненные уведомления
            if (dismissedAlerts.has(alertId)) return;

            const plannedTime = parseISO(booking.plannedStartTime);
            const minutesUntilStart = differenceInMinutes(plannedTime, now);

            switch (booking.status) {
                case BookingStatus.BOOKED:
                    // Просроченные бронирования
                    if (minutesUntilStart < 0) {
                        newAlerts.push({
                            id: alertId,
                            type: 'overdue',
                            booking,
                            message: `Клиент ${booking.clientName} опаздывает на ${Math.abs(minutesUntilStart)} мин. Связаться с клиентом?`,
                            timeLeft: minutesUntilStart,
                            priority: 'high'
                        });
                    }
                    // Предстоящие бронирования (за 5-15 минут)
                    else if (minutesUntilStart >= 0 && minutesUntilStart <= 15) {
                        newAlerts.push({
                            id: alertId,
                            type: 'upcoming',
                            booking,
                            message: `Клиент ${booking.clientName} должен прийти через ${minutesUntilStart} мин. Подготовить инвентарь?`,
                            timeLeft: minutesUntilStart,
                            priority: minutesUntilStart <= 5 ? 'high' : 'medium'
                        });
                    }
                    break;

                case BookingStatus.PENDING_CONFIRMATION:
                    // Уведомление о необходимости подтверждения
                    newAlerts.push({
                        id: alertId,
                        type: 'pending-confirmation',
                        booking,
                        message: `Подтвердить бронирование у ${booking.clientName} (до начала ${minutesUntilStart} мин). Связаться с клиентом!`,
                        timeLeft: minutesUntilStart,
                        priority: 'high'
                    });
                    break;

                case BookingStatus.CONFIRMED:
                    // Предстоящие подтвержденные бронирования (за 5-15 минут)
                    if (minutesUntilStart >= 0 && minutesUntilStart <= 15) {
                        newAlerts.push({
                            id: alertId,
                            type: 'upcoming',
                            booking,
                            message: `Подтвержденное бронирование: ${booking.clientName} должен прийти через ${minutesUntilStart} мин. Подготовить инвентарь?`,
                            timeLeft: minutesUntilStart,
                            priority: minutesUntilStart <= 5 ? 'high' : 'medium'
                        });
                    }
                    // Просроченные подтвержденные бронирования
                    else if (minutesUntilStart < 0) {
                        newAlerts.push({
                            id: alertId,
                            type: 'overdue',
                            booking,
                            message: `Подтвержденный клиент ${booking.clientName} опаздывает на ${Math.abs(minutesUntilStart)} мин. Связаться с клиентом?`,
                            timeLeft: minutesUntilStart,
                            priority: 'high'
                        });
                    }
                    break;

                case BookingStatus.IN_USE:
                    if (booking.actualStartTime) {
                        const startTime = parseISO(booking.actualStartTime);
                        const endTime = addMinutes(startTime, booking.durationInHours * 60);
                        const minutesUntilReturn = differenceInMinutes(endTime, now);

                        // Время возврата подходит (за 10 минут до окончания)
                        if (minutesUntilReturn >= 0 && minutesUntilReturn <= 10) {
                            newAlerts.push({
                                id: alertId,
                                type: 'ready-for-return',
                                booking,
                                message: `${booking.clientName} должен вернуть инвентарь через ${minutesUntilReturn} мин.`,
                                timeLeft: minutesUntilReturn,
                                priority: 'medium'
                            });
                        }
                        // Просрочка возврата
                        else if (minutesUntilReturn < 0) {
                            newAlerts.push({
                                id: alertId,
                                type: 'overdue',
                                booking,
                                message: `${booking.clientName} просрочил возврат на ${Math.abs(minutesUntilReturn)} мин. Связаться?`,
                                timeLeft: minutesUntilReturn,
                                priority: 'high'
                            });
                        }
                    }
                    break;
            }
        });

        setAlerts(newAlerts);
    }, [bookings, dismissedAlerts]);

    // Обновление статусов каждую минуту
    useEffect(() => {
        analyzeBookingStatuses();
        const interval = setInterval(analyzeBookingStatuses, 60000); // каждую минуту
        return () => clearInterval(interval);
    }, [analyzeBookingStatuses]);

    // Быстрые действия
    const handleQuickAction = async (alert: StatusAlert, action: string) => {
        const { booking } = alert;
        
        console.log('[BookingStatusManager] Обработка действия:', { action, bookingId: booking.id, currentStatus: booking.status });
        
        try {
            let updateData: Partial<Booking> = {};
            
            switch (action) {
                case 'mark-in-use':
                    updateData = {
                        status: BookingStatus.IN_USE,
                        actualStartTime: new Date().toISOString()
                    };
                    break;
                    
                case 'mark-completed':
                    updateData = {
                        status: BookingStatus.COMPLETED,
                        timeReturnedByClient: new Date().toISOString()
                    };
                    break;
                    
                case 'cancel':
                    updateData = {
                        status: BookingStatus.CANCELLED
                    };
                    break;
                    
                case 'extend-time':
                    // Продлеваем на 1 час
                    updateData = {
                        durationInHours: booking.durationInHours + 1
                    };
                    break;
                    
                case 'confirm-booking':
                    updateData = {
                        status: BookingStatus.CONFIRMED
                    };
                    console.log('[BookingStatusManager] Подтверждение бронирования:', { bookingId: booking.id, newStatus: BookingStatus.CONFIRMED });
                    break;
                    
                case 'confirm-and-issue':
                    updateData = {
                        status: BookingStatus.IN_USE,
                        actualStartTime: new Date().toISOString()
                    };
                    break;
                    
                case 'reschedule':
                    updateData = {
                        status: BookingStatus.RESCHEDULED
                    };
                    break;
            }
            
            console.log('[BookingStatusManager] Отправка обновления:', { bookingId: booking.id, updateData });
            
            const result = await dispatch(updateBookingAsync({
                id: Number(booking.id),
                booking: updateData
            }));
            
            console.log('[BookingStatusManager] Результат обновления:', { 
                requestStatus: result.meta.requestStatus, 
                payload: result.payload 
            });
            
            // Убираем уведомление только если обновление прошло успешно
            if (result.meta.requestStatus === 'fulfilled') {
                console.log('[BookingStatusManager] Обновление успешно, убираем уведомление');
                
                // Помечаем бронирование как недавно обновленное
                bookingUpdateTracker.markAsUpdated(Number(booking.id));
                
                dismissAlert(alert.id);
                
                // Уведомляем родительский компонент
                if (onStatusUpdate && updateData.status) {
                    onStatusUpdate(booking.id, updateData.status);
                }
                
                // Redux уже обновил состояние через updateBookingAsync.fulfilled
                // Нет необходимости в дополнительном fetchBookings()
            } else {
                console.error('[BookingStatusManager] Обновление не удалось:', result);
            }
            
        } catch (error) {
            console.error('[BookingStatusManager] Ошибка обновления статуса:', error);
        }
    };

    const dismissAlert = (alertId: string) => {
        setDismissedAlerts(prev => new Set([...Array.from(prev), alertId]));
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    };

    const getAlertIcon = (type: StatusAlert['type']) => {
        switch (type) {
            case 'overdue': return '⏰';
            case 'upcoming': return '🔔';
            case 'ready-for-pickup': return '📦';
            case 'ready-for-return': return '🔄';
            case 'pending-confirmation': return '📞';
            default: return '📋';
        }
    };

    const formatTimeLeft = (minutes: number) => {
        if (minutes < 0) {
            return `просрочено на ${Math.abs(minutes)} мин`;
        } else if (minutes === 0) {
            return 'сейчас';
        } else if (minutes < 60) {
            return `через ${minutes} мин`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `через ${hours}ч ${mins}мин`;
        }
    };

    const getActionButtons = (alert: StatusAlert) => {
        const { type, booking } = alert;
        
        switch (type) {
            case 'upcoming':
                if (booking.status === BookingStatus.BOOKED) {
                    return (
                        <>
                            <ActionButton 
                                $variant="primary"
                                onClick={() => handleQuickAction(alert, 'mark-in-use')}
                            >
                                ✅ Выдать инвентарь
                            </ActionButton>
                            <ActionButton 
                                $variant="secondary"
                                onClick={() => handleQuickAction(alert, 'cancel')}
                            >
                                ❌ Отменить
                            </ActionButton>
                        </>
                    );
                } else if (booking.status === BookingStatus.CONFIRMED) {
                    return (
                        <>
                            <ActionButton 
                                $variant="primary"
                                onClick={() => handleQuickAction(alert, 'mark-in-use')}
                            >
                                ✅ Выдать инвентарь
                            </ActionButton>
                            <ActionButton 
                                $variant="secondary"
                                onClick={() => handleQuickAction(alert, 'cancel')}
                            >
                                ❌ Отменить
                            </ActionButton>
                        </>
                    );
                }
                break;
                
            case 'ready-for-return':
                return (
                    <>
                        <ActionButton 
                            $variant="primary"
                            onClick={() => handleQuickAction(alert, 'mark-completed')}
                        >
                            ✅ Завершить
                        </ActionButton>
                        <ActionButton 
                            $variant="secondary"
                            onClick={() => handleQuickAction(alert, 'extend-time')}
                        >
                            ⏰ +1 час
                        </ActionButton>
                    </>
                );
                
            case 'overdue':
                if (booking.status === BookingStatus.BOOKED) {
                    return (
                        <>
                            <ActionButton 
                                $variant="primary"
                                onClick={() => handleQuickAction(alert, 'mark-in-use')}
                            >
                                ✅ Клиент пришел
                            </ActionButton>
                            <ActionButton 
                                $variant="secondary"
                                onClick={() => handleQuickAction(alert, 'cancel')}
                            >
                                ❌ Отменить
                            </ActionButton>
                        </>
                    );
                } else if (booking.status === BookingStatus.CONFIRMED) {
                    return (
                        <>
                            <ActionButton 
                                $variant="primary"
                                onClick={() => handleQuickAction(alert, 'mark-in-use')}
                            >
                                ✅ Клиент пришел
                            </ActionButton>
                            <ActionButton 
                                $variant="secondary"
                                onClick={() => handleQuickAction(alert, 'cancel')}
                            >
                                ❌ Отменить
                            </ActionButton>
                        </>
                    );
                } else if (booking.status === BookingStatus.IN_USE) {
                    return (
                        <>
                            <ActionButton 
                                $variant="primary"
                                onClick={() => handleQuickAction(alert, 'mark-completed')}
                            >
                                ✅ Инвентарь вернули
                            </ActionButton>
                            <ActionButton 
                                $variant="secondary"
                                onClick={() => handleQuickAction(alert, 'extend-time')}
                            >
                                ⏰ Продлить
                            </ActionButton>
                        </>
                    );
                }
                break;
                
            case 'pending-confirmation':
                return (
                    <>
                        <ActionButton 
                            $variant="primary"
                            onClick={() => handleQuickAction(alert, 'confirm-booking')}
                        >
                            ✅ Подтвердить
                        </ActionButton>
                        <ActionButton 
                            $variant="primary"
                            onClick={() => handleQuickAction(alert, 'confirm-and-issue')}
                        >
                            🏄‍♂️ Подтвердить и выдать
                        </ActionButton>
                        <ActionButton 
                            $variant="secondary"
                            onClick={() => handleQuickAction(alert, 'reschedule')}
                        >
                            🔄 Перенести
                        </ActionButton>
                        <ActionButton 
                            $variant="secondary"
                            onClick={() => handleQuickAction(alert, 'cancel')}
                        >
                            ❌ Отменить
                        </ActionButton>
                    </>
                );
        }
        
        return null;
    };

    if (alerts.length === 0) return null;

    return (
        <AlertContainer>
            {alerts.map(alert => (
                <AlertCard key={alert.id} $priority={alert.priority}>
                    <AlertHeader>
                        <AlertTitle>
                            {getAlertIcon(alert.type)} {alert.booking.clientName}
                        </AlertTitle>
                        <div>
                            <AlertTime>{formatTimeLeft(alert.timeLeft)}</AlertTime>
                            <CloseButton onClick={() => dismissAlert(alert.id)}>
                                ×
                            </CloseButton>
                        </div>
                    </AlertHeader>
                    
                    <AlertMessage>{alert.message}</AlertMessage>
                    
                    <AlertActions>
                        {getActionButtons(alert)}
                    </AlertActions>
                </AlertCard>
            ))}
        </AlertContainer>
    );
};

export default BookingStatusManager; 