import React, { useEffect, useCallback } from 'react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { useAppDispatch } from '@features/booking/store/hooks';
import { updateBookingAsync } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';

interface AutoStatusTransitionProps {
    bookings: Booking[];
    enabled?: boolean;
    onStatusChanged?: (bookingId: string, oldStatus: string, newStatus: string) => void;
}

interface TransitionRule {
    fromStatus: BookingStatus;
    toStatus: BookingStatus;
    condition: (booking: Booking, currentTime: Date) => boolean;
    description: string;
}

const AutoStatusTransition: React.FC<AutoStatusTransitionProps> = ({ 
    bookings, 
    enabled = false, // ОТКЛЮЧЕНО: логика перенесена на backend (scheduler)
    onStatusChanged 
}) => {
    const dispatch = useAppDispatch();

    // Правила автоматических переходов статусов
    const transitionRules: TransitionRule[] = [
        {
            fromStatus: BookingStatus.BOOKED,
            toStatus: BookingStatus.NO_SHOW,
            condition: (booking, now) => {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesLate = differenceInMinutes(now, plannedTime);
                // Автоматически помечаем как "не явился" через 90 минут опоздания
                return minutesLate >= 90;
            },
            description: 'Автопереход в "Не явился" через 90 мин опоздания'
        },
        {
            fromStatus: BookingStatus.PENDING_CONFIRMATION,
            toStatus: BookingStatus.NO_SHOW,
            condition: (booking, now) => {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesLate = differenceInMinutes(now, plannedTime);
                // Для неподтвержденных бронирований даем больше времени - 120 минут
                return minutesLate >= 120;
            },
            description: 'Автопереход неподтвержденного бронирования в "Не явился" через 120 мин опоздания'
        },
        {
            fromStatus: BookingStatus.CONFIRMED,
            toStatus: BookingStatus.NO_SHOW,
            condition: (booking, now) => {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesLate = differenceInMinutes(now, plannedTime);
                // Для подтвержденных бронирований тоже даем 90 минут, как для обычных
                return minutesLate >= 90;
            },
            description: 'Автопереход подтвержденного бронирования в "Не явился" через 90 мин опоздания'
        }
    ];

    // Функция для проверки и выполнения автоматических переходов
    const checkAutoTransitions = useCallback(async () => {
        if (!enabled) return;

        const now = new Date();
        const transitionsToExecute: Array<{
            booking: Booking;
            rule: TransitionRule;
        }> = [];

        // Проверяем каждое бронирование на соответствие правилам
        bookings.forEach(booking => {
            transitionRules.forEach(rule => {
                if (booking.status === rule.fromStatus && rule.condition(booking, now)) {
                    transitionsToExecute.push({ booking, rule });
                }
            });
        });

        // Выполняем найденные переходы
        for (const { booking, rule } of transitionsToExecute) {
            try {
                console.log(`🤖 Автопереход: ${booking.clientName} (${booking.id}) ${rule.fromStatus} → ${rule.toStatus}`);
                
                await dispatch(updateBookingAsync({
                    id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
                    booking: {
                        status: rule.toStatus
                    }
                }));

                // Уведомляем о смене статуса
                onStatusChanged?.(booking.id, rule.fromStatus, rule.toStatus);

            } catch (error) {
                console.error(`Ошибка автоперехода для бронирования ${booking.id}:`, error);
            }
        }

        // Redux уже обновил состояние через updateBookingAsync.fulfilled
        // Нет необходимости в дополнительном fetchBookings() если были изменения

    }, [bookings, enabled, dispatch, onStatusChanged]);

    // Проверяем автопереходы каждые 5 минут
    useEffect(() => {
        if (!enabled) return;

        // Первая проверка сразу
        checkAutoTransitions();

        // Затем каждые 5 минут
        const interval = setInterval(checkAutoTransitions, 5 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, [checkAutoTransitions, enabled]);

    // Функция для получения статистики потенциальных переходов
    const getTransitionStats = useCallback(() => {
        const now = new Date();
        const stats = {
            pendingNoShow: 0,
            totalChecked: bookings.length
        };

        bookings.forEach(booking => {
            if (booking.status === BookingStatus.BOOKED) {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesLate = differenceInMinutes(now, plannedTime);
                
                if (minutesLate >= 60 && minutesLate < 90) {
                    stats.pendingNoShow++;
                }
            } else if (booking.status === BookingStatus.PENDING_CONFIRMATION) {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesLate = differenceInMinutes(now, plannedTime);
                
                if (minutesLate >= 90 && minutesLate < 120) {
                    stats.pendingNoShow++;
                }
            } else if (booking.status === BookingStatus.CONFIRMED) {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesLate = differenceInMinutes(now, plannedTime);
                
                if (minutesLate >= 60 && minutesLate < 90) {
                    stats.pendingNoShow++;
                }
            }
        });

        return stats;
    }, [bookings]);

    // Логируем статистику для отладки
    useEffect(() => {
        if (enabled) {
            const stats = getTransitionStats();
            if (stats.pendingNoShow > 0) {
                console.log(`📊 Автостатусы: ${stats.pendingNoShow} бронирований скоро перейдут в "Не явился"`);
            }
        }
    }, [getTransitionStats, enabled]);

    // Компонент не рендерит ничего, работает в фоне
    return null;
};

export default AutoStatusTransition; 