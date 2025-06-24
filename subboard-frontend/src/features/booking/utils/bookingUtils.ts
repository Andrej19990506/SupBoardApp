import { parseISO, addHours, add, areIntervalsOverlapping, max, min } from 'date-fns';
import type { Booking } from '@/types/booking';
import { BookingStatus, PREPARATION_DURATION_HOURS } from '@/types/booking';
import { TOTAL_SEATS } from '@features/booking/constants/bookingConstants';

/**
 * Определяет релевантный временной интервал для бронирования в зависимости от его статуса.
 * Этот интервал показывает, когда доска считается занятой или находится в подготовке.
 *
 * @param booking - Объект бронирования.
 * @returns Объект с датами начала и конца интервала { start: Date, end: Date } или null, если статус COMPLETED.
 */
export const getRelevantBookingInterval = (booking: Booking): { start: Date; end: Date } | null => {
    switch (booking.status) {
        case BookingStatus.BOOKED:
        case BookingStatus.PENDING_CONFIRMATION:
        case BookingStatus.CONFIRMED:
            if (booking.plannedStartTime) {
                const plannedStart = parseISO(booking.plannedStartTime);
                return {
                    start: plannedStart,
                    end: addHours(plannedStart, booking.durationInHours + PREPARATION_DURATION_HOURS),
                };
            }
            return null;
        case BookingStatus.IN_USE:
            if (booking.actualStartTime) {
                const actualStart = parseISO(booking.actualStartTime);
                return {
                    start: actualStart,
                    end: addHours(actualStart, booking.durationInHours + PREPARATION_DURATION_HOURS),
                };
            }
            return null;
        case BookingStatus.COMPLETED:
        case BookingStatus.CANCELLED:
        case BookingStatus.NO_SHOW:
        case BookingStatus.RESCHEDULED:
            return null;
        default:
            const exhaustiveCheck: never = booking.status;
            console.warn(`Unknown booking status: ${exhaustiveCheck}`);
            return null;
    }
};
//Устаревашя функция заменена на getAvailableBoardsForInterval
export const getAvailableBoardsCount = (
    requestedStartTime: Date,
    requestedDurationHours: number,
    allBookings: Booking[],
    totalBoards: number,
    excludeBookingId?: string
): number => {
    const requestedInterval = {
        start: requestedStartTime,
        end: addHours(requestedStartTime, requestedDurationHours),
    };

    const eventPoints: Date[] = [requestedInterval.start, requestedInterval.end];
    const relevantBookings = allBookings.filter(b => b.id !== excludeBookingId);

    relevantBookings.forEach(booking => {
        const interval = getRelevantBookingInterval(booking);
        if (interval && areIntervalsOverlapping(requestedInterval, interval)) {
            if (interval.start >= requestedInterval.start && interval.start <= requestedInterval.end) {
                eventPoints.push(interval.start);
            }
            if (interval.end >= requestedInterval.start && interval.end <= requestedInterval.end) {
                eventPoints.push(interval.end);
            }
        }
    });

    const uniqueSortedEventPoints = Array.from(new Set(eventPoints.map(date => date.getTime())))
        .map(time => new Date(time))
        .sort((a, b) => a.getTime() - b.getTime());
    
    if (uniqueSortedEventPoints.length < 2) { 
        let boardsTakenBySingleBooking = 0;
         relevantBookings.forEach(booking => {
            const interval = getRelevantBookingInterval(booking);
            if (interval && areIntervalsOverlapping(requestedInterval, interval, { inclusive: true })) {
                 boardsTakenBySingleBooking += getBookingInventoryUsage(booking).boards;
            }
        });
        return totalBoards - boardsTakenBySingleBooking;
    }

    let maxOverlappingBoards = 0;

    for (let i = 0; i < uniqueSortedEventPoints.length - 1; i++) {
        const intervalStart = uniqueSortedEventPoints[i];
        const intervalEnd = uniqueSortedEventPoints[i + 1];
        const checkPoint = intervalStart; 

        if (checkPoint >= requestedInterval.end) continue; 

        let currentOverlappingBoards = 0;
        relevantBookings.forEach(booking => {
            const bookingRelevantInterval = getRelevantBookingInterval(booking);
            if (bookingRelevantInterval) {
                if (
                    checkPoint >= bookingRelevantInterval.start &&
                    checkPoint < bookingRelevantInterval.end &&
                    areIntervalsOverlapping(requestedInterval, bookingRelevantInterval, { inclusive: true })
                ) {
                    currentOverlappingBoards += getBookingInventoryUsage(booking).boards;
                }
            }
        });
        if (currentOverlappingBoards > maxOverlappingBoards) {
            maxOverlappingBoards = currentOverlappingBoards;
        }
    }
    
    let boardsAtRequestedStart = 0;
    relevantBookings.forEach(booking => {
        const interval = getRelevantBookingInterval(booking);
        if (interval && requestedInterval.start >= interval.start && requestedInterval.start < interval.end) {
            boardsAtRequestedStart += getBookingInventoryUsage(booking).boards;
        }
    });
    if (boardsAtRequestedStart > maxOverlappingBoards) {
        maxOverlappingBoards = boardsAtRequestedStart;
    }

    return totalBoards - maxOverlappingBoards;
};

// Типы инвентаря для расчета занятости
interface InventoryTypeUsage {
    id: number;
    name: string;
    affects_availability: boolean;  // влияет ли на занятость временных слотов
    boards_equivalent: number;      // сколько "досок" эквивалентно одной единице этого типа
}

// Кэш типов инвентаря для оптимизации
let inventoryTypesCache: InventoryTypeUsage[] | null = null;

// Функция для получения типов инвентаря (с кэшем)
async function getInventoryTypesForUsage(): Promise<InventoryTypeUsage[]> {
    if (inventoryTypesCache) {
        return inventoryTypesCache;
    }
    
    try {
        // Импортируем API только при необходимости
        const { inventoryApi } = await import('@/features/booking/services/inventoryApi');
        const response = await inventoryApi.getInventoryTypes();
        
        // Преобразуем типы в формат для расчета занятости
        inventoryTypesCache = response.data.map(type => ({
            id: type.id,
            name: type.name,
            affects_availability: type.affects_availability ?? true, // влияет ли на занятость времени
            boards_equivalent: type.board_equivalent ?? 1 // сколько "досок" эквивалентно одной единице
        }));
        
        return inventoryTypesCache;
    } catch (error) {
        console.warn('Не удалось загрузить типы инвентаря для расчета занятости:', error);
        // Возвращаем пустой массив в случае ошибки
        return [];
    }
}

// Возвращает {boards, accessories} для одной брони
export function getBookingInventoryUsage(booking: Booking): { boards: number; accessories: number } {
    // Новая система инвентаря (приоритет)
    if (booking.selectedItems && Object.keys(booking.selectedItems).length > 0) {
        // Простая логика для синхронного использования
        // Считаем все единицы как доски (основной инвентарь)
        // TODO: В будущем добавить логику с типами инвентаря
        const totalItems = Object.values(booking.selectedItems).reduce((sum, count) => sum + (count || 0), 0);
        return { 
            boards: totalItems,      // Все единицы считаем как основной инвентарь
            accessories: totalItems  // Временно дублируем для совместимости
        };
    }
    
    // Старая система инвентаря (fallback)
    const boards = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0) * 2;
    const accessories = 0; // В старой системе аксессуары не учитывались отдельно
    return { boards, accessories };
}

// Асинхронная версия для более точного расчета с типами инвентаря
export async function getBookingInventoryUsageDetailed(booking: Booking): Promise<{ boards: number; accessories: number }> {
    // Новая система инвентаря (приоритет)
    if (booking.selectedItems && Object.keys(booking.selectedItems).length > 0) {
        try {
            const inventoryTypes = await getInventoryTypesForUsage();
            const typesMap = new Map(inventoryTypes.map(t => [t.id, t]));
            
            let totalBoards = 0;
            let totalAccessories = 0;
            
            Object.entries(booking.selectedItems).forEach(([typeIdStr, count]) => {
                const typeId = parseInt(typeIdStr);
                const type = typesMap.get(typeId);
                const itemCount = count || 0;
                
                if (type) {
                    if (type.affects_availability) {
                        // Основной инвентарь (SUP доски, каяки, плоты) - влияет на занятость времени
                        totalBoards += itemCount * type.boards_equivalent;
                    } else {
                        // Аксессуары (жилеты, весла, сумки) - не влияют на временные слоты
                        totalAccessories += itemCount;
                    }
                } else {
                    // Если тип не найден, считаем как основной инвентарь
                    console.warn(`Inventory type ${typeId} not found, treating as board`);
                    totalBoards += itemCount;
                }
            });
            
            return { boards: totalBoards, accessories: totalAccessories };
        } catch (error) {
            console.warn('Ошибка при детальном расчете инвентаря:', error);
            // Fallback к простому расчету
            const totalItems = Object.values(booking.selectedItems).reduce((sum, count) => sum + (count || 0), 0);
            return { boards: totalItems, accessories: 0 };
        }
    }
    
    // Старая система инвентаря (fallback)
    const boards = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0) * 2;
    const accessories = 0;
    return { boards, accessories };
}

// Возвращает количество доступных кресел на заданное время
export const getAvailableSeatsCount = (
    requestedStartTime: Date,
    requestedDurationHours: number,
    allBookings: Booking[],
    totalSeats: number,
    excludeBookingId?: string
): number => {
    const requestedInterval = {
        start: requestedStartTime,
        end: addHours(requestedStartTime, requestedDurationHours),
    };

    const relevantBookings = allBookings.filter(b => b.id !== excludeBookingId);
    let maxOverlappingSeats = 0;

    // Создаем список всех временных точек (начало и конец бронирований)
    const eventPoints: Date[] = [requestedInterval.start, requestedInterval.end];

    relevantBookings.forEach(booking => {
        const interval = getRelevantBookingInterval(booking);
        if (interval && areIntervalsOverlapping(requestedInterval, interval)) {
            if (interval.start >= requestedInterval.start && interval.start <= requestedInterval.end) {
                eventPoints.push(interval.start);
            }
            if (interval.end >= requestedInterval.start && interval.end <= requestedInterval.end) {
                eventPoints.push(interval.end);
            }
        }
    });

    // Сортируем уникальные временные точки
    const uniqueSortedEventPoints = Array.from(new Set(eventPoints.map(date => date.getTime())))
        .map(time => new Date(time))
        .sort((a, b) => a.getTime() - b.getTime());

    // Проверяем каждый интервал между временными точками
    for (let i = 0; i < uniqueSortedEventPoints.length - 1; i++) {
        const intervalStart = uniqueSortedEventPoints[i];
        const intervalEnd = uniqueSortedEventPoints[i + 1];
        const intervalMiddle = new Date((intervalStart.getTime() + intervalEnd.getTime()) / 2);

        let overlappingSeats = 0;

        relevantBookings.forEach(booking => {
            const bookingInterval = getRelevantBookingInterval(booking);
            if (bookingInterval && 
                intervalMiddle >= bookingInterval.start && 
                intervalMiddle < bookingInterval.end) {
                const { accessories } = getBookingInventoryUsage(booking);
                overlappingSeats += accessories;
            }
        });

        maxOverlappingSeats = Math.max(maxOverlappingSeats, overlappingSeats);
    }

    return Math.max(0, totalSeats - maxOverlappingSeats);
};

// Удалена устаревшая функция getAvailableSeatsCount

/**
 * Возвращает массив свободных досок на указанный интервал времени с учётом связей board_bookings.
 * @param requestedStartTime - Желаемое время начала.
 * @param requestedDurationHours - Желаемая продолжительность в часах.
 * @param boards - Массив всех досок.
 * @param bookings - Массив всех бронирований.
 * @param boardBookings - Массив связей board_bookings.
 * @param excludeBookingId - (Опционально) ID бронирования, которое нужно исключить (например, при редактировании).
 * @returns Массив свободных досок.
 */
export function getAvailableBoardsForInterval(
  requestedStartTime: Date,
  requestedDurationHours: number,
  boards: { id: string | number }[],
  bookings: { id: string; plannedStartTime: string; durationInHours: number; status: string }[],
  boardBookings: { id: number; board_id: string | number; booking_id: string }[],
  excludeBookingId?: string
): { id: string | number }[] {
  const requestedInterval = {
    start: requestedStartTime,
    end: addHours(requestedStartTime, requestedDurationHours),
  };

  const bookingsMap = new Map(bookings.map(b => [b.id, b]));

  return boards.filter(board => {
    const boardLinks = boardBookings.filter(bb => bb.board_id === board.id);
    for (const link of boardLinks) {
      if (excludeBookingId && link.booking_id === excludeBookingId) continue;
      const booking = bookingsMap.get(link.booking_id);
      if (!booking) continue;
      const bookingStart = parseISO(booking.plannedStartTime);
      // Добавляем время обслуживания (1 час) после окончания бронирования
      const bookingEnd = addHours(bookingStart, booking.durationInHours + PREPARATION_DURATION_HOURS);
      if (
        areIntervalsOverlapping(
          { start: bookingStart, end: bookingEnd },
          requestedInterval
        )
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Детальный анализ доступности инвентаря с информацией о конфликтах
 * @param requestedStartTime - Желаемое время начала
 * @param requestedDurationHours - Желаемая продолжительность в часах
 * @param allBookings - Все бронирования
 * @param totalBoards - Общее количество досок
 * @param totalSeats - Общее количество кресел
 * @param excludeBookingId - ID бронирования для исключения
 * @returns Детальная информация о доступности
 */
export const getDetailedAvailabilityInfo = (
    requestedStartTime: Date,
    requestedDurationHours: number,
    allBookings: Booking[],
    totalBoards: number,
    totalSeats: number,
    excludeBookingId?: string
): {
    availableBoards: number;
    availableSeats: number;
    conflicts: Array<{
        time: Date;
        availableBoards: number;
        availableSeats: number;
        conflictingBookings: Array<{
            id: string;
            clientName: string;
            startTime: Date;
            endTime: Date;
            boards: number;
            seats: number;
        }>;
    }>;
    worstPeriod: {
        time: Date;
        availableBoards: number;
        availableSeats: number;
    } | null;
} => {
    const requestedInterval = {
        start: requestedStartTime,
        end: addHours(requestedStartTime, requestedDurationHours),
    };

    const relevantBookings = allBookings.filter(b => b.id !== excludeBookingId);
    
    // Создаем список всех временных точек для анализа
    const eventPoints: Date[] = [requestedInterval.start, requestedInterval.end];
    
    relevantBookings.forEach(booking => {
        const interval = getRelevantBookingInterval(booking);
        if (interval && areIntervalsOverlapping(requestedInterval, interval)) {
            if (interval.start >= requestedInterval.start && interval.start <= requestedInterval.end) {
                eventPoints.push(interval.start);
            }
            if (interval.end >= requestedInterval.start && interval.end <= requestedInterval.end) {
                eventPoints.push(interval.end);
            }
        }
    });

    // Сортируем уникальные временные точки
    const uniqueSortedEventPoints = Array.from(new Set(eventPoints.map(date => date.getTime())))
        .map(time => new Date(time))
        .sort((a, b) => a.getTime() - b.getTime());

    const conflicts: Array<{
        time: Date;
        availableBoards: number;
        availableSeats: number;
        conflictingBookings: Array<{
            id: string;
            clientName: string;
            startTime: Date;
            endTime: Date;
            boards: number;
            seats: number;
        }>;
    }> = [];

    let minAvailableBoards = totalBoards;
    let minAvailableSeats = totalSeats;
    let worstPeriod: { time: Date; availableBoards: number; availableSeats: number; } | null = null;

    // Анализируем каждый интервал
    for (let i = 0; i < uniqueSortedEventPoints.length - 1; i++) {
        const intervalStart = uniqueSortedEventPoints[i];
        const intervalEnd = uniqueSortedEventPoints[i + 1];
        const checkPoint = new Date((intervalStart.getTime() + intervalEnd.getTime()) / 2);

        if (checkPoint >= requestedInterval.end) continue;

        let occupiedBoards = 0;
        let occupiedSeats = 0;
        const conflictingBookings: Array<{
            id: string;
            clientName: string;
            startTime: Date;
            endTime: Date;
            boards: number;
            seats: number;
        }> = [];

        relevantBookings.forEach(booking => {
            const bookingInterval = getRelevantBookingInterval(booking);
            if (bookingInterval && 
                checkPoint >= bookingInterval.start && 
                checkPoint < bookingInterval.end) {
                
                const { boards, accessories } = getBookingInventoryUsage(booking);
                occupiedBoards += boards;
                occupiedSeats += accessories; // Временно используем accessories вместо seats

                conflictingBookings.push({
                    id: booking.id,
                    clientName: booking.clientName,
                    startTime: bookingInterval.start,
                    endTime: bookingInterval.end,
                    boards,
                    seats: accessories // Временно для совместимости
                });
            }
        });

        const availableBoards = Math.max(0, totalBoards - occupiedBoards);
        const availableSeats = Math.max(0, totalSeats - occupiedSeats);

        // Сохраняем информацию о конфликте
        conflicts.push({
            time: checkPoint,
            availableBoards,
            availableSeats,
            conflictingBookings
        });

        // Обновляем минимальные значения и худший период
        if (availableBoards < minAvailableBoards || 
            (availableBoards === minAvailableBoards && availableSeats < minAvailableSeats)) {
            minAvailableBoards = availableBoards;
            minAvailableSeats = availableSeats;
            worstPeriod = {
                time: checkPoint,
                availableBoards,
                availableSeats
            };
        }
    }

    return {
        availableBoards: minAvailableBoards,
        availableSeats: minAvailableSeats,
        conflicts,
        worstPeriod
    };
};

/**
 * Генерирует информативное сообщение об ограничениях инвентаря
 * @param availabilityInfo - Информация о доступности
 * @param requestedRafts - Запрашиваемое количество плотов
 * @param serviceType - Тип услуги
 * @param showAvailabilityInfo - Показывать информацию о доступности даже если не превышены лимиты
 * @returns Текст предупреждения
 */
export const generateInventoryWarningMessage = (
    availabilityInfo: ReturnType<typeof getDetailedAvailabilityInfo>,
    requestedRafts: number,
    serviceType: string,
    showAvailabilityInfo: boolean = false
): string => {
    const { availableBoards, availableSeats, worstPeriod } = availabilityInfo;
    
    console.log('[WARNING_GENERATOR]', {
        serviceType,
        availableBoards,
        availableSeats,
        requestedRafts,
        showAvailabilityInfo
    });
    
    // Проверяем тип услуги (поддерживаем разные варианты названий)
    const isRent = serviceType === 'rent' || serviceType === 'аренда';
    const isRafting = serviceType === 'rafting' || serviceType === 'рафтинг';
    
    if (isRent) {
        // Для аренды: каждый плот требует 2 доски
        const maxRaftsByBoards = Math.floor(availableBoards / 2);
        const maxRaftsBySeats = Math.floor(availableSeats / 2);
        const actualMaxRafts = Math.min(maxRaftsByBoards, maxRaftsBySeats);
        
        console.log('[WARNING_GENERATOR] RENT:', {
            maxRaftsByBoards,
            maxRaftsBySeats,
            actualMaxRafts,
            condition1: requestedRafts > actualMaxRafts,
            condition2: showAvailabilityInfo && actualMaxRafts === 0
        });
        
        if (requestedRafts > actualMaxRafts || (showAvailabilityInfo && actualMaxRafts === 0)) {
            const availableBoards = availabilityInfo.availableBoards;
            const availableSeats = availabilityInfo.availableSeats;
            
            let detailedMessage = `Доступно: ${availableBoards} досок, ${availableSeats} кресел`;
            
            if (actualMaxRafts === 0) {
                detailedMessage += ` → невозможно собрать комплект для аренды`;
            } else {
                detailedMessage += ` → максимум ${actualMaxRafts} комплектов`;
            }
            
            if (worstPeriod) {
                const timeStr = worstPeriod.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const peakHour = worstPeriod.time.getHours();
                detailedMessage += ` (пик загрузки в ${timeStr})`;
                
                // Добавляем подсказку о возможности бронирования после пика
                if (peakHour < 23) {
                    const hoursAfterPeak = 23 - peakHour;
                    const nextAvailableTime = `${peakHour + 1}:00`;
                    
                    if (hoursAfterPeak >= 4) { // Достаточно времени для аренды (минимум 4 часа)
                        detailedMessage += `. 💡 Предложите аренду с ${nextAvailableTime} (доступно ${hoursAfterPeak}ч до закрытия)`;
                    } else if (hoursAfterPeak >= 1) {
                        detailedMessage += `. 💡 Возможна короткая аренда с ${nextAvailableTime} (${hoursAfterPeak}ч до закрытия)`;
                    }
                }
            }
            
            console.log('[WARNING_GENERATOR] RENT MESSAGE:', detailedMessage);
            return detailedMessage;
        }
    } else if (isRafting) {
        // Для рафтинга: каждый плот требует 1 доску и 2 кресла
        const maxRaftsBySeats = Math.floor(availableSeats / 2);
        const actualMaxRafts = Math.min(availableBoards, maxRaftsBySeats);
        
        console.log('[WARNING_GENERATOR] RAFTING:', {
            maxRaftsBySeats,
            actualMaxRafts,
            condition1: requestedRafts > actualMaxRafts,
            condition2: showAvailabilityInfo && actualMaxRafts === 0
        });
        
        if (requestedRafts > actualMaxRafts || (showAvailabilityInfo && actualMaxRafts === 0)) {
            const availableBoards = availabilityInfo.availableBoards;
            const availableSeats = availabilityInfo.availableSeats;
            
            let detailedMessage = `Доступно: ${availableBoards} досок, ${availableSeats} кресел`;
            
            if (actualMaxRafts === 0) {
                detailedMessage += ` → рафтинг невозможен`;
            } else {
                detailedMessage += ` → возможно ${actualMaxRafts} групп рафтинга`;
            }
            
            if (worstPeriod) {
                const timeStr = worstPeriod.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const peakHour = worstPeriod.time.getHours();
                detailedMessage += ` (пик загрузки в ${timeStr})`;
                
                // Для рафтинга нужно минимум 5 часов
                if (peakHour < 23) {
                    const hoursAfterPeak = 23 - peakHour;
                    const nextAvailableTime = `${peakHour + 1}:00`;
                    
                    if (hoursAfterPeak >= 5) { // Достаточно времени для полного рафтинга
                        detailedMessage += `. 💡 Предложите рафтинг с ${nextAvailableTime} (доступно ${hoursAfterPeak}ч)`;
                    } else if (hoursAfterPeak >= 4) {
                        detailedMessage += `. 💡 После ${timeStr} возможна только аренда (рафтинг требует 5ч)`;
                    } else if (hoursAfterPeak >= 1) {
                        detailedMessage += `. 💡 После ${timeStr} только короткая аренда (${hoursAfterPeak}ч до закрытия)`;
                    }
                }
            }
            
            console.log('[WARNING_GENERATOR] RAFTING MESSAGE:', detailedMessage);
            return detailedMessage;
        }
    }
    
    // Общие предупреждения для любого типа услуги
    if (showAvailabilityInfo && availableBoards === 0) {
        let message = `Весь инвентарь занят: 0 из 14 досок свободно`;
        
        if (worstPeriod) {
            const timeStr = worstPeriod.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const peakHour = worstPeriod.time.getHours();
            message += ` (максимальная загрузка в ${timeStr})`;
            
            // Универсальная подсказка для любого типа услуги
            if (peakHour < 23) {
                const hoursAfterPeak = 23 - peakHour;
                const nextAvailableTime = `${peakHour + 1}:00`;
                
                if (hoursAfterPeak >= 5) {
                    message += `. 💡 Предложите бронь с ${nextAvailableTime} (${hoursAfterPeak}ч до закрытия)`;
                } else if (hoursAfterPeak >= 4) {
                    message += `. 💡 С ${nextAvailableTime} возможна аренда (${hoursAfterPeak}ч), рафтинг не успеем`;
                } else if (hoursAfterPeak >= 1) {
                    message += `. 💡 С ${nextAvailableTime} только короткая аренда (${hoursAfterPeak}ч)`;
                }
            }
        }
        
        console.log('[WARNING_GENERATOR] GENERAL MESSAGE:', message);
        return message;
    }
    
    console.log('[WARNING_GENERATOR] NO MESSAGE');
    return '';
}; 