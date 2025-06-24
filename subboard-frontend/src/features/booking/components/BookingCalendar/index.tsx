import { useState, useMemo } from 'react';
import type { FC } from 'react';
import { format, isToday as isTodayFn, isSameDay, startOfMonth, endOfMonth, getDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import styled from 'styled-components';
import DayCell from '@features/booking/components/BookingCalendar/DayCell';
import DesktopCalendar from '@features/booking/components/BookingCalendar/DesktopCalendar';
import MobileCalendar from '@features/booking/components/BookingCalendar/MobileCalendar';
import type { Booking } from '@/types/booking';
import { media } from '@shared/styles/breakpoints';
import { useAppSelector } from '@features/booking/store/hooks';
import { useDevice } from '@shared/hooks/useDevice';
import { calculateDayStatistics } from '@features/booking/utils/calendarUtils';
import DayDetailsModal from '@features/booking/components/BookingCalendar/components/DayDetailsModal';
import { useInventoryTotal } from '@features/booking/components/BookingForm/hooks/useInventoryTotal';

const CalendarContainer = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;

    ${media.desktop} {
        height: calc(100vh - 48px - 40px); /* 100vh - padding App.tsx (2*24px) - padding CalendarContainer (2*20px) */
        overflow-y: auto;
        padding-right: 10px; /* Добавляем небольшой отступ справа, чтобы скроллбар не перекрывал контент */

        /* Стилизация скроллбара для Webkit (Chrome, Safari, Edge) */
        &::-webkit-scrollbar {
            width: 3px;
        }

        &::-webkit-scrollbar-track {
            background: #2C2C2E; /* Цвет фона трека */
            border-radius: 2px;
        }

        &::-webkit-scrollbar-thumb {
            background-color: #86868B; /* Цвет самого скроллбара */
            border-radius: 2px;
            border: 2px solid #2C2C2E; /* Опциональная рамка, чтобы создать отступ от трека */
        }

        &::-webkit-scrollbar-thumb:hover {
            background-color: #555; /* Цвет скроллбара при наведении */
        }
    }
`;

const MonthContainer = styled.div`
    background: #1C1C1E;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    overflow: visible;
`;

const MonthHeader = styled.div`
    font-size: 1.25rem;
    color: #fff;
    margin-bottom: 1rem;
    text-transform: capitalize;
`;

const WeekDaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    margin-bottom: 8px;
`;

const WeekDay = styled.div`
    text-align: center;
    color: #86868B;
    padding: 8px 0;
    font-size: 0.875rem;
`;

const DaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: #2C2C2E;
    overflow: visible;
`;

const DayCellWrapper = styled.div`
    background: #1C1C1E;
    padding: 2px;
    position: relative;
    overflow: visible;
`;

const EmptyCell = styled.div`
    aspect-ratio: 1;
    background: #1C1C1E;
`;

interface CalendarProps {
    bookings: { [date: string]: Booking[] };
    onAddBooking: (date: Date) => void;
    onEditBooking: (booking: Booking) => void;
    onInventoryClick?: () => void;
    onGalleryClick?: () => void;
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const BookingCalendar: FC<CalendarProps> = ({
    bookings,
    onAddBooking,
    onEditBooking,
    onInventoryClick,
    onGalleryClick
}) => {
    // Все хуки должны быть вызваны в начале компонента
    const { isDesktop, isLaptop } = useDevice();
    
    console.log('[BookingCalendar] Device check:', {
        windowWidth: window.innerWidth,
        isDesktop,
        isLaptop,
        willUseDesktop: isDesktop || isLaptop,
        actuallyUsing: (isDesktop || isLaptop) ? 'DesktopCalendar' : 'MobileCalendar'
    });
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showDayDetails, setShowDayDetails] = useState(false);
    const [selectedDayData, setSelectedDayData] = useState<{
        date: Date;
        statistics: any;
        bookings: Booking[];
    } | null>(null);
    const boards = useAppSelector(state => state.boards.boards);
    const reduxBookings = useAppSelector(state => state.bookings.bookings);
    const fullyBookedDays = useAppSelector(state => state.bookings.fullyBookedDays || []);
    const partiallyBookedDays = useAppSelector(state => state.bookings.partiallyBookedDays || []);
    
    // Новая система инвентаря
    const { totalInventory, loading: inventoryLoading } = useInventoryTotal();
    const effectiveTotalInventory = totalInventory; // Всегда используем новую систему (hook уже имеет fallback на 15)
    
    // Используем данные из Redux store вместо props для актуальности
    const actualBookings = reduxBookings;

    // Мобильная версия календаря - хуки для мобильной версии
    const monthsToDisplay = useMemo(() => {
        const monthsArray: Date[] = [];
        const baseMonth = new Date();
        baseMonth.setDate(1);
        // Показываем текущий и следующие 2 месяца
        for (let i = 0; i < 3; i++) {
            const month = new Date(baseMonth);
            month.setMonth(baseMonth.getMonth() + i);
            monthsArray.push(month);
        }
        return monthsArray;
    }, []);

    // Получаем все записи для расчета статистики  
    const allBookings = useMemo(() => {
        return Object.values(actualBookings).flat();
    }, [actualBookings]);

    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
        onAddBooking(date);
    };

    const handleViewDay = (date: Date, statistics?: any, bookings?: Booking[]) => {
        setSelectedDate(date);
        
        // Если данные переданы напрямую, используем их
        if (statistics && bookings) {
            setSelectedDayData({ date, statistics, bookings });
        } else {
            // Иначе рассчитываем данные
            const dateBookings = getDateBookings(date);
            const dayStatistics = calculateDayStatistics(date, allBookings, effectiveTotalInventory);
            setSelectedDayData({ date, statistics: dayStatistics, bookings: dateBookings });
        }
        
        setShowDayDetails(true);
    };

    function getMonthGrid(month: Date) {
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        let startOffset = getDay(start) - 1;
        if (startOffset < 0) startOffset = 6;
        const days: (Date | null)[] = [];
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let d = 0; d < end.getDate(); d++) {
            days.push(addDays(start, d));
        }
        while (days.length % 7 !== 0) days.push(null);
        return days;
    }

    const getDateBookings = (date: Date): Booking[] => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return actualBookings[dateStr] || [];
    };

    // Функция для проверки, полностью ли день занят
    function isDayFullyBooked(date: Date, bookings: Booking[], boards: any[]): boolean {
        const totalBoards = effectiveTotalInventory;
        // Проверяем по 5-минутным интервалам с 2:00 до 16:00 UTC
        const intervalMinutes = 5;
        const startHour = 2;
        const endHour = 16;
        const intervalsPerHour = 60 / intervalMinutes;
        for (let hour = startHour; hour < endHour; hour++) {
            for (let part = 0; part < intervalsPerHour; part++) {
                const minute = part * intervalMinutes;
                const intervalStart = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0));
                const intervalEnd = new Date(intervalStart.getTime() + intervalMinutes * 60 * 1000);
                let freeBoards = totalBoards;
                for (const booking of bookings) {
                    const bookingStart = new Date(booking.plannedStartTime); // UTC
                    const bookingEnd = new Date(bookingStart.getTime() + booking.durationInHours * 60 * 60 * 1000);
                    if (intervalStart < bookingEnd && intervalEnd > bookingStart) {
                        freeBoards -= booking.boardCount || 0;
                    }
                }
                if (freeBoards <= 0) {
                    console.log(`[isDayFullyBooked] UTC Дата: ${date.toISOString()}, ${hour}:${minute.toString().padStart(2, '0')}, ВСЕ ДОСКИ ЗАНЯТЫ`);
                    return true;
                }
            }
        }
        return false;
    }

    // Функция для поиска первого времени, когда доски становятся доступны
    function getFirstAvailableTime(date: Date, bookings: Booking[], boards: any[]): Date | null {
        const totalBoards = effectiveTotalInventory;
        const intervalMinutes = 5;
        const startHour = 0;
        const endHour = 24;
        const intervalsPerHour = 60 / intervalMinutes;
        for (let hour = startHour; hour < endHour; hour++) {
            for (let part = 0; part < intervalsPerHour; part++) {
                const minute = part * intervalMinutes;
                const intervalStart = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0));
                const intervalEnd = new Date(intervalStart.getTime() + intervalMinutes * 60 * 1000);
                let freeBoards = totalBoards;
                for (const booking of bookings) {
                    const bookingStart = new Date(booking.plannedStartTime); // UTC
                    const bookingEnd = new Date(bookingStart.getTime() + booking.durationInHours * 60 * 60 * 1000);
                    if (intervalStart < bookingEnd && intervalEnd > bookingStart) {
                        freeBoards -= booking.boardCount || 0;
                    }
                }
                if (freeBoards > 0) {
                    return intervalStart;
                }
            }
        }
        return null;
    }

    // Если это десктоп или ноутбук, используем новый DesktopCalendar
    if (isDesktop || isLaptop) {
        return (
            <DesktopCalendar
                bookings={actualBookings}
                onAddBooking={onAddBooking}
                onEditBooking={onEditBooking}
            />
        );
    }

    // Рендер мобильной версии
    console.log('[BookingCalendar] Using MOBILE version');
    return (
        <MobileCalendar
            bookings={actualBookings}
            onAddBooking={onAddBooking}
            onEditBooking={onEditBooking}
            onInventoryClick={onInventoryClick || (() => {})}
            onGalleryClick={onGalleryClick || (() => {})}
        />
    );
};

export type { CalendarProps, Booking };
export default BookingCalendar; 