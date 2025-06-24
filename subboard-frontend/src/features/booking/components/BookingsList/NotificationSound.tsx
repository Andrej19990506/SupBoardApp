import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { differenceInMinutes, parseISO } from 'date-fns';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';

interface NotificationSoundProps {
    bookings: Booking[];
    enabled?: boolean;
}

const NotificationSound: React.FC<NotificationSoundProps> = ({ bookings, enabled = true }) => {
    const lastNotificationRef = useRef<Set<string>>(new Set());
    const audioContextRef = useRef<AudioContext | null>(null);
    const lastBookingsHashRef = useRef<string>('');
    const isInitializedRef = useRef<boolean>(false);

    // Создаем хеш для определения реальных изменений в бронированиях
    const bookingsHash = useMemo(() => {
        return bookings
            .map(b => `${b.id}-${b.status}-${b.plannedStartTime}-${b.actualStartTime}`)
            .sort()
            .join('|');
    }, [bookings]);

    // Создаем звуковой контекст
    useEffect(() => {
        const createAudioContext = () => {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (error) {
                console.warn('Аудио контекст не поддерживается:', error);
            }
        };

        createAudioContext();

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Функция для воспроизведения звука
    const playNotificationSound = (type: 'urgent' | 'warning' | 'info') => {
        if (!audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Настройки звука в зависимости от типа
        switch (type) {
            case 'urgent':
                // Высокий тревожный звук
                oscillator.frequency.setValueAtTime(800, ctx.currentTime);
                oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.3);
                break;

            case 'warning':
                // Средний предупреждающий звук
                oscillator.frequency.setValueAtTime(600, ctx.currentTime);
                oscillator.frequency.setValueAtTime(650, ctx.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.3);
                break;

            case 'info':
                // Мягкий информационный звук
                oscillator.frequency.setValueAtTime(400, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.2);
                break;
        }
    };

    // Выносим логику проверки уведомлений в отдельную функцию
    const checkAndPlayNotifications = useCallback(() => {
        const now = new Date();
        const currentNotifications = new Set<string>();

        bookings.forEach(booking => {
            const plannedTime = parseISO(booking.plannedStartTime);
            const minutesUntilStart = differenceInMinutes(plannedTime, now);

            // Создаем уникальный ключ для уведомления
            const createNotificationKey = (bookingId: string, type: string) => `${bookingId}-${type}`;

            switch (booking.status) {
                case BookingStatus.BOOKED:
                    // Критическое опоздание (15+ минут)
                    if (minutesUntilStart < -15) {
                        const key = createNotificationKey(booking.id, 'critical-overdue');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('urgent');
                            currentNotifications.add(key);
                        }
                    }
                    // Опоздание (1-15 минут)
                    else if (minutesUntilStart < 0) {
                        const key = createNotificationKey(booking.id, 'overdue');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('warning');
                            currentNotifications.add(key);
                        }
                    }
                    // Клиент должен прийти через 5 минут
                    else if (minutesUntilStart === 5) {
                        const key = createNotificationKey(booking.id, 'upcoming-5min');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('info');
                            currentNotifications.add(key);
                        }
                    }
                    // Клиент должен прийти сейчас
                    else if (minutesUntilStart === 0) {
                        const key = createNotificationKey(booking.id, 'now');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('warning');
                            currentNotifications.add(key);
                        }
                    }
                    break;

                case BookingStatus.PENDING_CONFIRMATION:
                    // Уведомление о необходимости подтверждения
                    const key = createNotificationKey(booking.id, 'needs-confirmation');
                    if (!lastNotificationRef.current.has(key)) {
                        playNotificationSound('warning');
                        currentNotifications.add(key);
                    }
                    break;

                case BookingStatus.CONFIRMED:
                    // Критическое опоздание (15+ минут)
                    if (minutesUntilStart < -15) {
                        const key = createNotificationKey(booking.id, 'confirmed-critical-overdue');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('urgent');
                            currentNotifications.add(key);
                        }
                    }
                    // Опоздание (1-15 минут)
                    else if (minutesUntilStart < 0) {
                        const key = createNotificationKey(booking.id, 'confirmed-overdue');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('warning');
                            currentNotifications.add(key);
                        }
                    }
                    // Подтвержденный клиент должен прийти через 5 минут
                    else if (minutesUntilStart === 5) {
                        const key = createNotificationKey(booking.id, 'confirmed-upcoming-5min');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('info');
                            currentNotifications.add(key);
                        }
                    }
                    // Подтвержденный клиент должен прийти сейчас
                    else if (minutesUntilStart === 0) {
                        const key = createNotificationKey(booking.id, 'confirmed-now');
                        if (!lastNotificationRef.current.has(key)) {
                            playNotificationSound('warning');
                            currentNotifications.add(key);
                        }
                    }
                    break;

                case BookingStatus.IN_USE:
                    if (booking.actualStartTime) {
                        const startTime = parseISO(booking.actualStartTime);
                        const endTime = new Date(startTime.getTime() + booking.durationInHours * 60 * 60 * 1000);
                        const minutesUntilReturn = differenceInMinutes(endTime, now);

                        // Время возврата подошло
                        if (minutesUntilReturn === 0) {
                            const key = createNotificationKey(booking.id, 'return-time');
                            if (!lastNotificationRef.current.has(key)) {
                                playNotificationSound('info');
                                currentNotifications.add(key);
                            }
                        }
                        // Просрочка возврата
                        else if (minutesUntilReturn < -10) {
                            const key = createNotificationKey(booking.id, 'return-overdue');
                            if (!lastNotificationRef.current.has(key)) {
                                playNotificationSound('urgent');
                                currentNotifications.add(key);
                            }
                        }
                    }
                    break;
            }
        });

        // Обновляем список уведомлений
        lastNotificationRef.current = new Set([
            ...Array.from(lastNotificationRef.current),
            ...Array.from(currentNotifications)
        ]);

        // Очищаем старые уведомления (старше 1 часа)
        const activeBookingIds = new Set(bookings.map(b => b.id));
        
        lastNotificationRef.current = new Set(
            Array.from(lastNotificationRef.current).filter(key => {
                const bookingId = key.split('-')[0];
                return activeBookingIds.has(bookingId);
            })
        );
    }, [bookings, playNotificationSound]);

    // Анализируем бронирования и воспроизводим звуки
    useEffect(() => {
        // Если звуки отключены, ничего не делаем
        if (!enabled) return;

        // Проверяем, действительно ли изменились данные
        if (bookingsHash === lastBookingsHashRef.current) {
            return; // Данные не изменились, не воспроизводим звуки
        }

        // При первой инициализации или если данные пустые, не воспроизводим звуки
        if (!isInitializedRef.current || bookings.length === 0) {
            isInitializedRef.current = true;
            lastBookingsHashRef.current = bookingsHash;
            return;
        }

        // Добавляем задержку, чтобы избежать звуков при быстрых переключениях UI
        const soundTimeout = setTimeout(() => {
            // Проверяем еще раз, что данные все еще актуальны
            if (bookingsHash === lastBookingsHashRef.current) {
                checkAndPlayNotifications();
            }
        }, 500); // Задержка 500мс

        lastBookingsHashRef.current = bookingsHash;

        return () => {
            clearTimeout(soundTimeout);
        };
    }, [bookings, enabled, bookingsHash, checkAndPlayNotifications]);

    // Компонент не отображает ничего
    return null;
};

export default NotificationSound; 