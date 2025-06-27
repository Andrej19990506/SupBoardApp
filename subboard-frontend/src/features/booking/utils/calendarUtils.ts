import { format, parseISO, isAfter, isBefore } from 'date-fns';
import type { Booking } from '@/types/booking';
import { ServiceType } from '@/types/booking';
import type { PricingConfig } from '@features/booking/components/BookingForm/types';
import { getBookingInventoryUsage } from './bookingUtils';
import { calculateFlexiblePricing } from '@features/booking/components/BookingForm/flexiblePricingUtils';
import type { InventoryType } from '@/features/booking/services/inventoryApi';

export interface DayStatistics {
    totalSlots: number;
    bookedSlots: number;
    utilizationPercent: number;
    peakHours: string[];
    serviceTypes: ServiceType[];
    timeSlots: TimeSlotInfo[];
    recommendations: string[];
    revenue: number;
}

export interface TimeSlotInfo {
    hour: number;
    available: number;
    booked: number;
    bookings: Booking[];
}

/**
 * Рассчитывает доход для конкретного бронирования с использованием правильных настроек цен
 */
export function calculateBookingRevenue(
    booking: Booking, 
    pricingConfig: PricingConfig, 
    inventoryTypes: InventoryType[] = []
): number {
    // Конвертируем старый формат инвентаря в новый
    const selectedItems: Record<number, number> = {};
    
    // Если есть новый формат selectedItems, используем его
    if ((booking as any).selectedItems) {
        Object.assign(selectedItems, (booking as any).selectedItems);
    } else {
        // Иначе конвертируем из старого формата
        // Нужно найти соответствующие типы инвентаря по именам
        inventoryTypes.forEach(type => {
            const typeName = type.name.toLowerCase();
            if (typeName.includes('сап') || typeName.includes('sup')) {
                if (booking.boardCount && booking.boardCount > 0) {
                    selectedItems[type.id] = booking.boardCount;
                }
            } else if (typeName.includes('каяк') || typeName.includes('kayak')) {
                if (booking.boardWithSeatCount && booking.boardWithSeatCount > 0) {
                    selectedItems[type.id] = booking.boardWithSeatCount;
                }
            } else if (typeName.includes('плот') || typeName.includes('raft')) {
                if (booking.raftCount && booking.raftCount > 0) {
                    selectedItems[type.id] = booking.raftCount;
                }
            }
        });
    }
    
    const costs = calculateFlexiblePricing(
        booking.serviceType,
        selectedItems,
        inventoryTypes,
        booking.durationInHours || (booking.serviceType === 'аренда' ? 24 : 4),
        pricingConfig
    );
    
    return costs.subtotal;
}

/**
 * Рассчитывает статистику для конкретного дня
 */
export function calculateDayStatistics(
    date: Date, 
    bookings: Booking[], 
    totalBoards: number,
    pricingConfig?: PricingConfig,
    inventoryTypes: InventoryType[] = []
): DayStatistics {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Получаем ВСЕ бронирования, которые могут влиять на этот день
    // (включая те, что начались раньше, но еще продолжаются + время обслуживания)
    const relevantBookings = bookings.filter(booking => {
        try {
            const bookingStartUTC = parseISO(booking.plannedStartTime);
            
            // Проверяем, что дата валидна
            if (isNaN(bookingStartUTC.getTime())) {
                console.error('Invalid date from parseISO:', booking.plannedStartTime);
                return false;
            }
            
            // Время уже в правильном формате (сохранено как местное время в UTC), используем как есть
            const bookingStartKrasnoyarsk = bookingStartUTC;
            
            // Проверяем валидность durationInHours
            const duration = booking.durationInHours || 24; // Значение по умолчанию 24 часа
            if (isNaN(duration) || duration <= 0) {
                console.error('Invalid durationInHours:', booking.durationInHours, 'for booking:', booking.id);
                return false;
            }
            
            const bookingEndKrasnoyarsk = new Date(bookingStartKrasnoyarsk.getTime() + duration * 60 * 60 * 1000);
            
            // Добавляем 1 час на обслуживание
            const serviceEndKrasnoyarsk = new Date(bookingEndKrasnoyarsk.getTime() + 60 * 60 * 1000);
            
            // Проверяем валидность всех дат
            if (isNaN(bookingStartKrasnoyarsk.getTime()) || 
                isNaN(bookingEndKrasnoyarsk.getTime()) || 
                isNaN(serviceEndKrasnoyarsk.getTime())) {
                return false;
            }
            
            // Создаем начало и конец дня в красноярском времени (без дополнительной конвертации)
            const dayStartKrasnoyarsk = new Date(date);
            dayStartKrasnoyarsk.setHours(9, 0, 0, 0);
            
            const dayEndKrasnoyarsk = new Date(date);
            dayEndKrasnoyarsk.setHours(23, 59, 59, 999);
            
            const intersects = bookingStartKrasnoyarsk < dayEndKrasnoyarsk && serviceEndKrasnoyarsk > dayStartKrasnoyarsk;
            
            
            // Проверяем пересечение бронирования (включая обслуживание) с этим днем
            // Сравниваем все в красноярском времени
            return intersects;
        } catch (error) {
            console.error('Error processing booking in relevantBookings filter:', booking, error);
            return false;
        }
    });
    
    // Отдельно получаем бронирования, которые начинаются именно в этот день
    const dayBookings = bookings.filter(booking => {
        try {
            const bookingStartUTC = parseISO(booking.plannedStartTime);
            
            // Проверяем, что дата валидна
            if (isNaN(bookingStartUTC.getTime())) {
                console.error('Invalid date from parseISO in dayBookings:', booking.plannedStartTime);
                return false;
            }
            
            // Время уже в правильном формате, используем как есть (консистентно с логикой выше)
            const bookingStartKrasnoyarsk = bookingStartUTC;
            const bookingDate = format(bookingStartKrasnoyarsk, 'yyyy-MM-dd');
                     
            return bookingDate === dateStr;
        } catch (error) {
            console.error('Error processing booking in dayBookings filter:', booking, error);
            return false;
        }
    });

    // Создаем временные слоты (09:00 - 23:00) в красноярском времени
    const timeSlots: TimeSlotInfo[] = [];
    for (let hour = 9; hour <= 23; hour++) {
        // Создаем слоты в красноярском времени
        const slotStartKrasnoyarsk = new Date(date);
        slotStartKrasnoyarsk.setHours(hour, 0, 0, 0);
        const slotEndKrasnoyarsk = new Date(date);
        slotEndKrasnoyarsk.setHours(hour + 1, 0, 0, 0);

        let bookedInSlot = 0;
        const slotBookings: Booking[] = [];

        // Используем ВСЕ релевантные бронирования (включая продолжающиеся с предыдущих дней)
        relevantBookings.forEach(booking => {
            try {
                // parseISO возвращает время в UTC, НО оно уже сохранено в UTC, поэтому НЕ конвертируем
                const bookingStartUTC = parseISO(booking.plannedStartTime);
                
                // Проверяем, что дата валидна
                if (isNaN(bookingStartUTC.getTime())) {
                    console.error('Invalid date from parseISO in timeSlot:', booking.plannedStartTime);
                    return;
                }
                
                // Время уже в UTC и корректно отображается во фронтенде, используем его как есть для расчетов
                const bookingStartKrasnoyarsk = bookingStartUTC;
                
                // Проверяем валидность durationInHours
                const duration = booking.durationInHours || 24; // Значение по умолчанию 24 часа
                if (isNaN(duration) || duration <= 0) {
                    console.error('Invalid durationInHours in timeSlot:', booking.durationInHours, 'for booking:', booking.id);
                    return;
                }
                
                const bookingEndKrasnoyarsk = new Date(bookingStartKrasnoyarsk.getTime() + duration * 60 * 60 * 1000);
                
                // Добавляем 1 час на обслуживание после окончания бронирования
                const serviceEndKrasnoyarsk = new Date(bookingEndKrasnoyarsk.getTime() + 60 * 60 * 1000);

                // Проверяем валидность всех дат в timeSlot
                if (isNaN(bookingStartKrasnoyarsk.getTime()) || 
                    isNaN(bookingEndKrasnoyarsk.getTime()) || 
                    isNaN(serviceEndKrasnoyarsk.getTime())) {
                    console.error('Invalid dates in timeSlot:', {
                        bookingStartKrasnoyarsk: bookingStartKrasnoyarsk.getTime(),
                        bookingEndKrasnoyarsk: bookingEndKrasnoyarsk.getTime(),
                        serviceEndKrasnoyarsk: serviceEndKrasnoyarsk.getTime(),
                        booking: booking
                    });
                    return;
                }

                // Проверяем пересечение с временным слотом (включая время обслуживания)
                // Сравниваем все в красноярском времени
                const intersects = bookingStartKrasnoyarsk < slotEndKrasnoyarsk && serviceEndKrasnoyarsk > slotStartKrasnoyarsk;
                               
                if (intersects) {
                    // Используем новую систему подсчета инвентаря
                    const inventoryUsage = getBookingInventoryUsage(booking);
                    bookedInSlot += inventoryUsage.boards;
                    slotBookings.push(booking);
                }
            } catch (error) {
                console.error('Error processing booking in timeSlot:', booking, error);
            }
        });

        timeSlots.push({
            hour,
            available: Math.max(0, totalBoards - bookedInSlot),
            booked: bookedInSlot,
            bookings: slotBookings
        });
    }

    // Находим пиковые часы (загруженность > 70%)
    const peakHours = timeSlots
        .filter(slot => (slot.booked / totalBoards) > 0.7)
        .map(slot => `${slot.hour}:00`);

    // Определяем типы услуг
    const serviceTypes = Array.from(new Set(dayBookings.map(b => b.serviceType)));

    // Общая утилизация - средняя загруженность по всем часам
    const averageUtilization = timeSlots.reduce((sum, slot) => {
        const slotUtilization = totalBoards > 0 ? slot.booked / totalBoards : 0;
        return sum + slotUtilization;
    }, 0) / timeSlots.length;
    const utilizationPercent = Math.round(averageUtilization * 100);
    

    // Рассчитываем доход с правильными настройками цен
    let revenue = 0;
    if (pricingConfig && inventoryTypes.length > 0) {
        revenue = dayBookings.reduce((sum, booking) => {
            return sum + calculateBookingRevenue(booking, pricingConfig, inventoryTypes);
        }, 0);
    } else {
        // Fallback на старый метод, если нет настроек цен или типов инвентаря
        revenue = dayBookings.reduce((sum, booking) => {
            const basePrice = booking.serviceType === 'аренда' ? 1200 : 300;
            const inventory = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0) * 2;
            const hours = booking.serviceType === 'аренда' ? (booking.durationInHours || 24) : 4;
            return sum + (basePrice * inventory * (hours / 24));
        }, 0);
    }

    // Генерируем рекомендации
    const recommendations = generateRecommendations(timeSlots, utilizationPercent, serviceTypes);

    return {
        totalSlots: totalBoards,
        bookedSlots: dayBookings.length,
        utilizationPercent,
        peakHours,
        serviceTypes,
        timeSlots,
        recommendations,
        revenue
    };
}

/**
 * Генерирует рекомендации для дня
 */
function generateRecommendations(
    timeSlots: TimeSlotInfo[], 
    utilizationPercent: number, 
    serviceTypes: ServiceType[]
): string[] {
    const recommendations: string[] = [];

    // Рекомендации по времени
    const bestSlots = timeSlots
        .filter(slot => slot.available > slot.booked)
        .sort((a, b) => b.available - a.available)
        .slice(0, 3);

    if (bestSlots.length > 0) {
        const bestTimes = bestSlots.map(slot => `${slot.hour}:00`).join(', ');
        recommendations.push(`Лучшее время: ${bestTimes}`);
    }

    // Рекомендации по загруженности
    if (utilizationPercent > 80) {
        recommendations.push('Высокая загруженность - бронируйте заранее');
    } else if (utilizationPercent < 30) {
        recommendations.push('Много свободного времени');
    }

    // Рекомендации по типам услуг
    if (serviceTypes.includes('сплав' as ServiceType)) {
        recommendations.push('Популярный день для сплавов');
    }

    return recommendations;
}

/**
 * Возвращает цвет для индикатора загруженности
 */
export function getUtilizationColor(percent: number): string {
    if (percent >= 90) return '#FF4D4F'; // Красный - критическая загрузка
    if (percent >= 70) return '#FFD600'; // Желтый - высокая загрузка
    if (percent >= 40) return '#52C41A'; // Зеленый - средняя загрузка
    return '#86868B'; // Серый - низкая загрузка
}

/**
 * Возвращает текстовое описание загруженности
 */
export function getUtilizationText(percent: number): string {
    if (percent >= 90) return 'Критическая загрузка';
    if (percent >= 70) return 'Высокая загрузка';
    if (percent >= 40) return 'Средняя загрузка';
    if (percent >= 10) return 'Низкая загрузка';
    return 'Свободно';
}

// Wrapper функции для обратной совместимости (deprecated)

/**
 * @deprecated Используйте calculateBookingRevenue с inventoryTypes
 */
export function calculateBookingRevenueLegacy(booking: Booking, pricingConfig: PricingConfig): number {
    return calculateBookingRevenue(booking, pricingConfig, []);
}

/**
 * @deprecated Используйте calculateDayStatistics с inventoryTypes  
 */
export function calculateDayStatisticsLegacy(
    date: Date, 
    bookings: Booking[], 
    totalBoards: number,
    pricingConfig?: PricingConfig
): DayStatistics {
    return calculateDayStatistics(date, bookings, totalBoards, pricingConfig, []);
} 