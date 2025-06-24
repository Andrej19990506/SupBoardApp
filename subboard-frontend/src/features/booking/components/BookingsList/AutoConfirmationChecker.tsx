import React, { useEffect, useCallback, useRef } from 'react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { useAppDispatch } from '@features/booking/store/hooks';
import { updateBookingAsync, fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import { bookingUpdateTracker } from '@features/booking/utils/bookingUpdateTracker';

interface AutoConfirmationCheckerProps {
    bookings: Booking[];
    enabled?: boolean;
    checkIntervalMinutes?: number; // Интервал проверки в минутах (по умолчанию 5)
    confirmationTimeMinutes?: number; // За сколько минут до начала требовать подтверждение (по умолчанию 60)
}

const AutoConfirmationChecker: React.FC<AutoConfirmationCheckerProps> = ({ 
    bookings, 
    enabled = false, // ОТКЛЮЧЕНО: логика перенесена на backend (scheduler)
    checkIntervalMinutes = 5,
    confirmationTimeMinutes = 60
}) => {
    const dispatch = useAppDispatch();
    
    // Храним ID бронирований, которые уже были обработаны, чтобы избежать повторной обработки
    const processedBookingsRef = useRef<Set<number>>(new Set());
    
    // Очищаем данные при изменении списка бронирований
    useEffect(() => {
        const currentIds = bookings.map(b => typeof b.id === 'string' ? parseInt(b.id, 10) : b.id);
        
        // Очищаем обработанные ID для несуществующих бронирований
        const processedIds = processedBookingsRef.current;
        processedIds.forEach(id => {
            if (!currentIds.includes(id)) {
                processedIds.delete(id);
            }
        });
        
        // Очищаем глобальный трекер
        bookingUpdateTracker.cleanup(currentIds);
    }, [bookings]);

    // Функция для проверки и обновления статусов
    const checkAndUpdateConfirmationStatus = useCallback(async (forced = false) => {
        if (!enabled || !bookings || bookings.length === 0) {
            return;
        }

        const now = new Date();
        const bookingsToUpdate: Booking[] = [];

        // Очищаем кэш обработанных бронирований для повторной проверки (только при принудительной проверке)
        if (forced) {
            processedBookingsRef.current.clear();
        }

        // Проверяем каждое бронирование
        bookings.forEach(booking => {
            // Обрабатываем только бронирования со статусом BOOKED
            if (booking.status !== BookingStatus.BOOKED) {
                return;
            }

            const bookingId = typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id;
            
            // Пропускаем уже обработанные бронирования (только если не принудительная проверка)
            if (!forced && processedBookingsRef.current.has(bookingId)) {
                return;
            }
            
            // Проверяем, не было ли это бронирование недавно обновлено через глобальный трекер (только если не принудительная проверка)
            if (!forced && bookingUpdateTracker.wasRecentlyUpdated(bookingId)) {
                const minutesSince = bookingUpdateTracker.getMinutesSinceUpdate(bookingId);
                console.log(`⏳ Пропускаем недавно обновленное бронирование: ${booking.clientName} (ID: ${booking.id}), обновлено ${minutesSince} мин назад`);
                return;
            }

            try {
                const plannedTime = parseISO(booking.plannedStartTime);
                const minutesUntilStart = differenceInMinutes(plannedTime, now);

                // Логируем только если найдено бронирование для обновления
                if (minutesUntilStart <= confirmationTimeMinutes && minutesUntilStart > 0) {
                    console.log(`[AutoConfirmationChecker] ${booking.clientName}: до начала ${minutesUntilStart} мин - требуется подтверждение`);
                }

                // Если до начала осталось час или меньше (но больше 0), 
                // переводим в статус ожидания подтверждения
                if (minutesUntilStart <= confirmationTimeMinutes && minutesUntilStart > 0) {
                    bookingsToUpdate.push(booking);
                    // Помечаем как обработанное, чтобы не обрабатывать повторно
                    processedBookingsRef.current.add(bookingId);
                    console.log(`🔔 Требуется подтверждение: ${booking.clientName} (ID: ${booking.id}) - до начала ${minutesUntilStart} мин`);
                }
            } catch (error) {
                console.error('Ошибка при обработке времени бронирования:', error, booking);
            }
        });

        // Обновляем статусы найденных бронирований
        if (bookingsToUpdate.length > 0) {
            try {
                console.log(`🤖 Автопереход в PENDING_CONFIRMATION: ${bookingsToUpdate.length} бронирований`);

                // Обновляем каждое бронирование
                for (const booking of bookingsToUpdate) {
                    const bookingId = typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id;
                    
                    const result = await dispatch(updateBookingAsync({
                        id: bookingId,
                        booking: {
                            status: BookingStatus.PENDING_CONFIRMATION
                        }
                    }));

                    if (updateBookingAsync.fulfilled.match(result)) {
                        console.log(`✅ Переведено в ожидание подтверждения: ${booking.clientName} (ID: ${booking.id})`);
                        
                        // Помечаем в глобальном трекере
                        bookingUpdateTracker.markAsUpdated(bookingId);
                    } else {
                        console.error(`❌ Ошибка при переводе в ожидание подтверждения: ${booking.clientName} (ID: ${booking.id})`);
                        // Убираем из обработанных при ошибке, чтобы попробовать снова
                        processedBookingsRef.current.delete(bookingId);
                    }
                }

                // Redux уже обновил состояние через updateBookingAsync.fulfilled
                // Нет необходимости в дополнительном fetchBookings()

            } catch (error) {
                console.error('Ошибка при автоматическом обновлении статусов подтверждения:', error);
            }
        }
    }, [bookings, enabled, confirmationTimeMinutes, dispatch]);

    // Эффект для периодической проверки (НЕ зависит от bookings, чтобы избежать циклов)
    useEffect(() => {
        if (!enabled) {
            return;
        }

        // Немедленная проверка при монтировании
        checkAndUpdateConfirmationStatus();

        // Устанавливаем интервал для периодических проверок
        const interval = setInterval(
            () => checkAndUpdateConfirmationStatus(false), 
            checkIntervalMinutes * 60 * 1000
        );

        return () => {
            clearInterval(interval);
        };
    }, [enabled, checkIntervalMinutes, confirmationTimeMinutes, dispatch]);

    // Отдельный эффект для проверки при изменении списка бронирований
    useEffect(() => {
        if (!enabled) {
            return;
        }

        // Задержка перед проверкой, чтобы избежать слишком частых вызовов
        const timeoutId = setTimeout(() => {
            checkAndUpdateConfirmationStatus(false);
        }, 1000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [bookings.length, enabled]);

    // Компонент ничего не отображает
    return null;
};

export default AutoConfirmationChecker; 