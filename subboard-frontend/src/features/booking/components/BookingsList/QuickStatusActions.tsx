import React from 'react';
import styled from 'styled-components';
import { differenceInMinutes, parseISO, addMinutes } from 'date-fns';
import { useAppDispatch } from '@features/booking/store/hooks';
import { updateBookingAsync } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBoards } from '@features/booking/store/slices/board-slice/boardThunk';
import { fetchBoardBookings } from '@features/booking/store/slices/board-bookings/boardBookingsThunks';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import { bookingUpdateTracker } from '@features/booking/utils/bookingUpdateTracker';

interface QuickStatusActionsProps {
    booking: Booking;
    onUpdate?: () => void;
}

const ActionsContainer = styled.div`
    display: flex;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
`;

const QuickActionButton = styled.button<{ 
    $variant: 'primary' | 'secondary' | 'warning' | 'success' | 'danger';
    $size?: 'small' | 'medium';
}>`
    padding: ${props => props.$size === 'small' ? '4px 8px' : '6px 12px'};
    border: none;
    border-radius: 6px;
    font-size: ${props => props.$size === 'small' ? '11px' : '12px'};
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    
    ${props => {
        switch (props.$variant) {
            case 'primary':
                return `
                    background: linear-gradient(135deg, #007AFF, #5AC8FA);
                    color: white;
                    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3); }
                `;
            case 'success':
                return `
                    background: linear-gradient(135deg, #34C759, #52D869);
                    color: white;
                    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(52, 199, 89, 0.3); }
                `;
            case 'warning':
                return `
                    background: linear-gradient(135deg, #FF9500, #FFB340);
                    color: white;
                    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3); }
                `;
            case 'danger':
                return `
                    background: linear-gradient(135deg, #FF3B30, #FF6B60);
                    color: white;
                    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255, 59, 48, 0.3); }
                `;
            case 'secondary':
                return `
                    background: rgba(255, 255, 255, 0.1);
                    color: #8E8E93;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    &:hover { background: rgba(255, 255, 255, 0.15); }
                `;
        }
    }}
`;

const StatusIndicator = styled.div<{ $status: string }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 4px;
    
    ${props => {
        switch (props.$status) {
            case BookingStatus.BOOKED:
                return 'background: rgba(0, 122, 255, 0.2); color: #007AFF;';
            case BookingStatus.PENDING_CONFIRMATION:
                return 'background: rgba(255, 149, 0, 0.2); color: #FF9500;';
            case BookingStatus.CONFIRMED:
                return 'background: rgba(52, 199, 89, 0.2); color: #34C759;';
            case BookingStatus.IN_USE:
                return 'background: rgba(52, 199, 89, 0.2); color: #34C759;';
            case BookingStatus.COMPLETED:
                return 'background: rgba(142, 142, 147, 0.2); color: #8E8E93;';
            case BookingStatus.CANCELLED:
                return 'background: rgba(255, 59, 48, 0.2); color: #FF3B30;';
            case BookingStatus.NO_SHOW:
                return 'background: rgba(255, 149, 0, 0.2); color: #FF9500;';
            case BookingStatus.RESCHEDULED:
                return 'background: rgba(175, 82, 222, 0.2); color: #AF52DE;';
            default:
                return 'background: rgba(142, 142, 147, 0.2); color: #8E8E93;';
        }
    }}
`;

const TimeInfo = styled.div`
    font-size: 10px;
    color: #8E8E93;
    margin-bottom: 4px;
`;

const QuickStatusActions: React.FC<QuickStatusActionsProps> = ({ 
    booking, 
    onUpdate 
}) => {
    const dispatch = useAppDispatch();

    const handleStatusUpdate = async (newStatus: string, additionalData: Partial<Booking> = {}) => {
        console.log('[QuickStatusActions] Обновление статуса:', { 
            bookingId: booking.id, 
            currentStatus: booking.status, 
            newStatus, 
            additionalData 
        });
        
        try {
            const updateData: Partial<Booking> = {
                status: newStatus as BookingStatus,
                ...additionalData
            };

            console.log('[QuickStatusActions] Отправка обновления:', { bookingId: booking.id, updateData });

            const result = await dispatch(updateBookingAsync({
                id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
                booking: updateData
            }));

            console.log('[QuickStatusActions] Результат обновления:', { 
                requestStatus: result.meta.requestStatus, 
                payload: result.payload 
            });

            // Если операция прошла успешно
            if (result.meta.requestStatus === 'fulfilled') {
                console.log('[QuickStatusActions] Обновление успешно');
                
                // Помечаем бронирование как недавно обновленное
                const bookingId = typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id;
                bookingUpdateTracker.markAsUpdated(bookingId);
                
                // Redux уже обновил состояние через updateBookingAsync.fulfilled
                // Нет необходимости в дополнительном fetchBookings()
                onUpdate?.();
            } else {
                console.error('[QuickStatusActions] Обновление не удалось:', result);
            }
        } catch (error) {
            console.error('[QuickStatusActions] Ошибка обновления статуса:', error);
        }
    };

    const getTimeInfo = () => {
        const now = new Date();
        const plannedTime = parseISO(booking.plannedStartTime);
        const minutesUntilStart = differenceInMinutes(plannedTime, now);

        switch (booking.status) {
            case BookingStatus.BOOKED:
                if (minutesUntilStart < 0) {
                    return `Опаздывает на ${Math.abs(minutesUntilStart)} мин`;
                } else if (minutesUntilStart <= 15) {
                    return `Приходит через ${minutesUntilStart} мин`;
                } else if (minutesUntilStart > 60) {
                    return `Неподтвержденное, через ${Math.floor(minutesUntilStart / 60)}ч ${minutesUntilStart % 60}мин`;
                } else {
                    return `Запланировано через ${Math.floor(minutesUntilStart / 60)}ч ${minutesUntilStart % 60}мин`;
                }

            case BookingStatus.PENDING_CONFIRMATION:
                if (minutesUntilStart < 0) {
                    return `Не подтверждено, опаздывает на ${Math.abs(minutesUntilStart)} мин`;
                } else {
                    return `Нужно подтвердить у клиента (через ${minutesUntilStart} мин)`;
                }

            case BookingStatus.CONFIRMED:
                if (minutesUntilStart < 0) {
                    return `Подтверждено, опаздывает на ${Math.abs(minutesUntilStart)} мин`;
                } else if (minutesUntilStart <= 15) {
                    return `Подтверждено, приходит через ${minutesUntilStart} мин`;
                } else {
                    return `Подтверждено, через ${Math.floor(minutesUntilStart / 60)}ч ${minutesUntilStart % 60}мин`;
                }

            case BookingStatus.IN_USE:
                if (booking.actualStartTime) {
                    const startTime = parseISO(booking.actualStartTime);
                    const endTime = addMinutes(startTime, booking.durationInHours * 60);
                    const minutesUntilReturn = differenceInMinutes(endTime, now);
                    
                    if (minutesUntilReturn < 0) {
                        return `Просрочка ${Math.abs(minutesUntilReturn)} мин`;
                    } else {
                        return `Осталось ${Math.floor(minutesUntilReturn / 60)}ч ${minutesUntilReturn % 60}мин`;
                    }
                }
                return 'В использовании';

            case BookingStatus.COMPLETED:
                return 'Завершено';

            case BookingStatus.CANCELLED:
                return 'Отменено';

            case BookingStatus.NO_SHOW:
                return 'Не явился';

            case BookingStatus.RESCHEDULED:
                return 'Перенесено';

            default:
                return '';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case BookingStatus.BOOKED: return '📅';
            case BookingStatus.PENDING_CONFIRMATION: return '⏳';
            case BookingStatus.CONFIRMED: return '✅';
            case BookingStatus.IN_USE: return '🏄‍♂️';
            case BookingStatus.COMPLETED: return '✅';
            case BookingStatus.CANCELLED: return '❌';
            case BookingStatus.NO_SHOW: return '👻';
            case BookingStatus.RESCHEDULED: return '🔄';
            default: return '📋';
        }
    };

    const renderActionButtons = () => {
        const now = new Date();
        const plannedTime = parseISO(booking.plannedStartTime);
        const minutesUntilStart = differenceInMinutes(plannedTime, now);

        switch (booking.status) {
            case BookingStatus.BOOKED:
                // Если до начала больше часа - показываем информацию о ожидании подтверждения
                if (minutesUntilStart > 60) {
                    return (
                        <>
                            <div style={{
                                fontSize: '10px',
                                color: '#FF9500',
                                marginBottom: '4px',
                                fontWeight: '600'
                            }}>
                                ⏳ Ждем подтверждения за час до начала
                            </div>
                            <QuickActionButton
                                $variant="danger"
                                $size="small"
                                onClick={() => handleStatusUpdate(BookingStatus.CANCELLED)}
                                title="Отменить бронирование"
                            >
                                ❌ Отменить
                            </QuickActionButton>
                        </>
                    );
                }
                
                // Если час или меньше - обычные действия
                return (
                    <>
                        <QuickActionButton
                            $variant="success"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.IN_USE, {
                                actualStartTime: new Date().toISOString()
                            })}
                            title="Клиент пришел, выдать инвентарь"
                        >
                            🏄‍♂️ Выдать
                        </QuickActionButton>
                        
                        {minutesUntilStart < -30 && (
                            <QuickActionButton
                                $variant="warning"
                                $size="small"
                                onClick={() => handleStatusUpdate(BookingStatus.NO_SHOW)}
                                title="Клиент не явился"
                            >
                                👻 Не явился
                            </QuickActionButton>
                        )}
                        
                        <QuickActionButton
                            $variant="danger"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.CANCELLED)}
                            title="Отменить бронирование"
                        >
                            ❌ Отменить
                        </QuickActionButton>
                    </>
                );

            case BookingStatus.PENDING_CONFIRMATION:
                return (
                    <>
                        <QuickActionButton
                            $variant="success"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.CONFIRMED)}
                            title="Подтвердить бронирование"
                        >
                            ✅ Подтвердить
                        </QuickActionButton>
                        
                        <QuickActionButton
                            $variant="success"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.IN_USE, {
                                actualStartTime: new Date().toISOString()
                            })}
                            title="Подтвердить и выдать инвентарь"
                        >
                            🏄‍♂️ Выдать сразу
                        </QuickActionButton>
                        
                        <QuickActionButton
                            $variant="danger"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.CANCELLED)}
                            title="Отменить из-за неподтверждения"
                        >
                            ❌ Отменить
                        </QuickActionButton>
                        
                        <QuickActionButton
                            $variant="warning"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.RESCHEDULED)}
                            title="Перенести на другое время"
                        >
                            🔄 Перенести
                        </QuickActionButton>
                    </>
                );

            case BookingStatus.CONFIRMED:
                return (
                    <>
                        <QuickActionButton
                            $variant="primary"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.IN_USE, {
                                actualStartTime: new Date().toISOString()
                            })}
                            title="Клиент пришел, выдать инвентарь"
                        >
                            🏄‍♂️ Выдать
                        </QuickActionButton>
                        
                        {minutesUntilStart < -30 && (
                            <QuickActionButton
                                $variant="warning"
                                $size="small"
                                onClick={() => handleStatusUpdate(BookingStatus.NO_SHOW)}
                                title="Клиент не явился"
                            >
                                👻 Не явился
                            </QuickActionButton>
                        )}
                        
                        <QuickActionButton
                            $variant="danger"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.CANCELLED)}
                            title="Отменить бронирование"
                        >
                            ❌ Отменить
                        </QuickActionButton>
                    </>
                );

            case BookingStatus.IN_USE:
                return (
                    <>
                        <QuickActionButton
                            $variant="primary"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.COMPLETED, {
                                timeReturnedByClient: new Date().toISOString()
                            })}
                            title="Клиент вернул инвентарь"
                        >
                            ✅ Завершить
                        </QuickActionButton>
                        
                        <QuickActionButton
                            $variant="warning"
                            $size="small"
                            onClick={() => handleStatusUpdate(booking.status, {
                                durationInHours: booking.durationInHours + 1
                            })}
                            title="Продлить на 1 час"
                        >
                            ⏰ +1ч
                        </QuickActionButton>
                    </>
                );

            case BookingStatus.CANCELLED:
                return (
                    <QuickActionButton
                        $variant="secondary"
                        $size="small"
                        onClick={() => handleStatusUpdate(BookingStatus.BOOKED)}
                        title="Восстановить бронирование"
                    >
                        ↩️ Восстановить
                    </QuickActionButton>
                );

            case BookingStatus.COMPLETED:
                // Для завершенных бронирований действий не предусмотрено
                // Новое бронирование создается через обычную форму
                return null;

            case BookingStatus.NO_SHOW:
                return (
                    <>
                        <QuickActionButton
                            $variant="success"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.IN_USE, {
                                actualStartTime: new Date().toISOString()
                            })}
                            title="Клиент все-таки пришел"
                        >
                            🏄‍♂️ Пришел
                        </QuickActionButton>
                        
                        <QuickActionButton
                            $variant="secondary"
                            $size="small"
                            onClick={() => handleStatusUpdate(BookingStatus.BOOKED)}
                            title="Восстановить бронирование"
                        >
                            ↩️ Восстановить
                        </QuickActionButton>
                    </>
                );

            case BookingStatus.RESCHEDULED:
                return (
                    <QuickActionButton
                        $variant="secondary"
                        $size="small"
                        onClick={() => handleStatusUpdate(BookingStatus.BOOKED)}
                        title="Активировать перенесенное бронирование"
                    >
                        ✅ Активировать
                    </QuickActionButton>
                );

            default:
                return null;
        }
    };

    return (
        <div>
            <StatusIndicator $status={booking.status}>
                {getStatusIcon(booking.status)} {booking.status.toUpperCase()}
            </StatusIndicator>
            
            <TimeInfo>{getTimeInfo()}</TimeInfo>
            
            <ActionsContainer>
                {renderActionButtons()}
            </ActionsContainer>
        </div>
    );
};

export default QuickStatusActions; 