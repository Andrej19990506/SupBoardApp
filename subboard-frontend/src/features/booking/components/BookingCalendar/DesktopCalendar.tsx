import { useState, useMemo, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { format, isToday as isTodayFn, isSameDay, startOfMonth, endOfMonth, getDay, addDays, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import styled from 'styled-components';
import DayCell from '@features/booking/components/BookingCalendar/DayCell';
import type { Booking } from '@/types/booking';
import { useAppSelector } from '@features/booking/store/hooks';
import { calculateDayStatistics, calculateBookingRevenueLegacy as calculateBookingRevenue } from '@features/booking/utils/calendarUtils';
import { DEFAULT_PRICING } from '@features/booking/components/BookingForm/PricingDisplay';
import type { PricingConfig } from '@features/booking/components/BookingForm/types';

import DayDetailsModal from '@features/booking/components/BookingCalendar/components/DayDetailsModal';
import HoverCard from '@features/booking/components/BookingCalendar/components/HoverCard';
import DesktopInventoryModal from '@features/booking/components/InventoryModal/DesktopInventoryModal';
import { NotificationBellIcon } from '@features/booking/components/NotificationBell/NotificationBell';
import canoeIcon from '@/assets/canoe.png';
import { motion, AnimatePresence } from 'framer-motion';
import { WeatherWidget } from './components/WeatherWidget';
import { useInventoryTotal } from '@features/booking/components/BookingForm/hooks/useInventoryTotal';
import GalleryModal from '../GalleryModal/GalleryModal';
import ProfileButton from '@features/auth/components/ProfileButton';


const DesktopCalendarContainer = styled.div`
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 50%, #1C1C1E 100%);
    overflow: hidden;
`;

const TopBar = styled.div`
    background: linear-gradient(135deg, #2C2C2E 0%, #3A3A3C 50%, #2C2C2E 100%);
    background-size: 200% 200%;
    animation: backgroundShift 8s ease-in-out infinite;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 
        0 4px 24px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    z-index: 10;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    
    /* Анимированная нижняя граница с градиентом */
    &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(
            90deg,
            #007AFF 0%,
            #52C41A 25%,
            #FFD600 50%,
            #FF6B35 75%,
            #007AFF 100%
        );
        background-size: 200% 100%;
        animation: gradientShift 4s ease-in-out infinite;
    }
    
    /* Верхняя подсветка */
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
        background-size: 200% 100%;
        animation: gradientShift 6s ease-in-out infinite reverse;
    }
    
    @keyframes gradientShift {
        0%, 100% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
    }
    
    @keyframes backgroundShift {
        0%, 100% {
            background-position: 0% 50%;
        }
        25% {
            background-position: 100% 0%;
        }
        50% {
            background-position: 100% 100%;
        }
        75% {
            background-position: 0% 100%;
        }
    }
`;

const NavigationSection = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const MonthNavigator = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 10px 16px;
    backdrop-filter: blur(16px);
    box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
`;

const NavButton = styled.button`
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    padding: 10px;
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    &:hover {
        background: linear-gradient(135deg, rgba(0, 122, 255, 0.2) 0%, rgba(0, 122, 255, 0.1) 100%);
        border-color: rgba(0, 122, 255, 0.3);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 122, 255, 0.2);
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.1);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none;
        background: rgba(255, 255, 255, 0.02);
        border-color: rgba(255, 255, 255, 0.05);
        box-shadow: none;
    }
`;

const CurrentMonth = styled.div`
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    min-width: 180px;
    text-align: center;
    text-transform: capitalize;
`;



const InventoryButton = styled.button`
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    backdrop-filter: blur(16px);
    box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 8px;

    /* Анимированная подсветка */
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transition: left 0.6s ease;
    }

    &:hover {
        transform: translateY(-2px);
        background: linear-gradient(135deg, rgba(82, 196, 26, 0.2) 0%, rgba(82, 196, 26, 0.1) 100%);
        box-shadow: 
            0 6px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        border-color: rgba(82, 196, 26, 0.3);
        
        &::before {
            left: 100%;
        }
    }

    &:active {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
`;

const GalleryButton = styled.button`
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    backdrop-filter: blur(16px);
    box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 8px;

    /* Анимированная подсветка */
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transition: left 0.6s ease;
    }

    &:hover {
        transform: translateY(-2px);
        background: linear-gradient(135deg, rgba(255, 159, 10, 0.2) 0%, rgba(255, 159, 10, 0.1) 100%);
        box-shadow: 
            0 6px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 159, 10, 0.3);
        
        &::before {
            left: 100%;
        }
    }

    &:active {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
`;

const CalendarContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    
    /* Красивый скроллбар */
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: rgba(44, 44, 46, 0.3);
        border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #86868B 0%, #5A5A5E 100%);
        border-radius: 3px;
        transition: background 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #A0A0A5 0%, #7A7A7E 100%);
    }
`;

const MonthGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 400px); /* Фиксированная ширина колонок */
    gap: 20px;
    justify-content: center;
    margin: 0 auto;
    width: fit-content; /* Точная ширина без растягивания */
`;

const MonthCard = styled.div`
    background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%);
    border: 1px solid #3A3A3C;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    
    /* Фиксированные размеры для предотвращения скачков */
    width: 400px;
    height: 600px;
    flex-shrink: 0;
    flex-grow: 0;
    
    /* Позиционирование для контроля размещения */
    position: relative;
    overflow: hidden;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        border-color: #4A4A4C;
    }
`;

const MonthHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #3A3A3C;
`;

const MonthTitle = styled.h3`
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    text-transform: capitalize;
`;

const MonthStats = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
`;

const MonthRevenue = styled.div`
    color: #52C41A;
    font-size: 14px;
    font-weight: 600;
`;

const MonthBookings = styled.div`
    color: #86868B;
    font-size: 11px;
`;

const WeekDaysHeader = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    margin-bottom: 6px;
`;

const WeekDayLabel = styled.div`
    text-align: center;
    color: #86868B;
    padding: 8px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(44, 44, 46, 0.3);
    border-radius: 6px;
`;

const DaysGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
`;

const DayCellWrapper = styled.div`
    background: rgba(28, 28, 30, 0.6);
    border-radius: 6px;
    position: relative;
    overflow: visible;
    transition: all 0.2s ease;
    min-height: 70px;

    &:hover {
        background: rgba(36, 36, 38, 0.8);
        transform: scale(1.02);
        z-index: 5;
    }
`;

const EmptyCell = styled.div`
    min-height: 70px;
    background: transparent;
    border-radius: 6px;
`;

const HoverCardContainer = styled.div`
    /* Занимаем точно такое же место как календарь */
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    
    background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%);
    border: 1px solid #3A3A3C;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    
    /* Плавная анимация появления */
    animation: fadeInScale 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    /* Переопределяем стили HoverCard для отображения в календаре */
    & > div[data-hover-card] {
        position: static !important;
        transform: none !important;
        box-shadow: none !important;
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        height: 100% !important;
        max-height: none !important;
        overflow-y: auto !important;
        
        /* Убираем стрелочки у встроенной карточки */
        &::before,
        &::after {
            display: none !important;
        }
    }
`;



interface DesktopCalendarProps {
    bookings: { [date: string]: Booking[] };
    onAddBooking: (date: Date) => void;
    onEditBooking: (booking: Booking) => void;
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const DesktopCalendar: FC<DesktopCalendarProps> = ({
    bookings,
    onAddBooking,
    onEditBooking
}) => {
    console.log('[DesktopCalendar] Component mounted/rendered');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [baseMonth, setBaseMonth] = useState(() => {
        const date = new Date();
        date.setDate(1);
        return date;
    });
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [showDayDetails, setShowDayDetails] = useState(false);
    const [selectedDayData, setSelectedDayData] = useState<{
        date: Date;
        statistics: any;
        bookings: Booking[];
    } | null>(null);
    const [hoverCardData, setHoverCardData] = useState<{
        date: Date;
        statistics: any;
        bookings: Booking[];
        targetMonthIndex: number; // Индекс месяца, где показывать карточку
    } | null>(null);
    
    const boards = useAppSelector(state => {
        console.log('[DesktopCalendar] Redux boards state:', state.boards);
        return state.boards.boards;
    });
    const reduxBookings = useAppSelector(state => {
        console.log('[DesktopCalendar] Redux bookings state:', state.bookings);
        return state.bookings.bookings;
    });
    const fullyBookedDays = useAppSelector(state => state.bookings.fullyBookedDays || []);
    const partiallyBookedDays = useAppSelector(state => state.bookings.partiallyBookedDays || []);
    
    // Новая система инвентаря
    const { totalInventory, loading: inventoryLoading } = useInventoryTotal();
    
    // Состояния загрузки
    const boardsLoading = useAppSelector(state => state.boards.loading);
    const bookingsLoading = useAppSelector(state => state.bookings.isLoading);
    const isDataLoading = boardsLoading || bookingsLoading || inventoryLoading;
    
    // Определяем эффективное количество инвентаря (используем новую систему)
    const effectiveTotalInventory = totalInventory; // Всегда используем новую систему (hook уже имеет fallback на 15)
    
    // Используем данные из Redux store вместо props для актуальности
    const actualBookings = reduxBookings;
    
    console.log('[DesktopCalendar] Data loaded successfully!', {
        boardsCount: boards.length,
        totalInventory,
        effectiveTotalInventory,
        bookingsKeys: Object.keys(actualBookings),
        bookingsCount: Object.keys(actualBookings).length,
        isDataLoading,
        boardsLoading,
        bookingsLoading,
        inventoryLoading
    });

    // Получаем все записи для расчета статистики  
    const allBookings = useMemo(() => {
        const result = Object.values(actualBookings).flat();
        console.log('[DesktopCalendar] Data check:', {
            actualBookings,
            allBookingsCount: result.length,
            boardsCount: boards.length,
            totalInventory,
            effectiveTotalInventory,
            propsBookings: bookings
        });
        return result;
    }, [actualBookings, boards.length, totalInventory, effectiveTotalInventory, bookings]);

    const getDateBookings = (date: Date): Booking[] => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return actualBookings[dateStr] || [];
    };

    // Функция для расчета дохода от списка бронирований
    const calculateRevenueFromBookings = (bookingsList: Booking[]): number => {
        return Math.round(bookingsList.reduce((sum, booking) => {
            return sum + calculateBookingRevenue(booking, DEFAULT_PRICING);
        }, 0));
    };

    // Функция для безопасного создания даты из cellId
    const createDateFromCellId = (cellId: string): Date | null => {
        try {
            if (!cellId || typeof cellId !== 'string') {
                console.warn('Invalid cellId:', cellId);
                return null;
            }
            
            // cellId должен быть в формате 'yyyy-MM-dd'
            const date = new Date(cellId + 'T00:00:00');
            
            // Проверяем, что дата валидна
            if (isNaN(date.getTime())) {
                console.warn('Invalid date created from cellId:', cellId);
                return null;
            }
            
            return date;
        } catch (error) {
            console.error('Error creating date from cellId:', cellId, error);
            return null;
        }
    };

    // Определяем месяцы для отображения (нужно до инициализации smartHover)
    const monthsToDisplay = useMemo(() => {
        const monthsArray: Date[] = [];
        const monthsCount = 3; // Всегда показываем 3 месяца
        
        for (let i = 0; i < monthsCount; i++) {
            const month = new Date(baseMonth);
            month.setMonth(baseMonth.getMonth() + i);
            monthsArray.push(month);
        }
        return monthsArray;
    }, [baseMonth]);

    // Простая и надежная система hover без сложных хуков
    const [isHoverCardVisible, setIsHoverCardVisible] = useState(false);
    const [activeCardCell, setActiveCardCell] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cardElementRef = useRef<HTMLElement | null>(null);
    const isMouseOverCard = useRef(false);
    
    const showHoverCard = (cellId: string) => {
        try {
            const date = createDateFromCellId(cellId);
            if (!date) return;
            
            const dateBookings = getDateBookings(date);
            const dayStatistics = calculateDayStatistics(date, allBookings, effectiveTotalInventory, DEFAULT_PRICING);
            
            // Определяем индекс месяца для показа карточки
            const cellMonthIndex = monthsToDisplay.findIndex(month => {
                const monthStart = startOfMonth(month);
                const monthEnd = endOfMonth(month);
                return date >= monthStart && date <= monthEnd;
            });
            
            let targetMonthIndex = cellMonthIndex;
            if (cellMonthIndex === monthsToDisplay.length - 1) {
                targetMonthIndex = cellMonthIndex - 1;
            } else {
                targetMonthIndex = cellMonthIndex + 1;
            }
            
            setHoverCardData({
                date,
                statistics: dayStatistics,
                bookings: dateBookings,
                targetMonthIndex
            });
            setActiveCardCell(cellId);
            setIsHoverCardVisible(true);
        } catch (error) {
            console.error('Error in showHoverCard:', error);
        }
    };
    
    const hideHoverCard = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        
        hoverTimeoutRef.current = setTimeout(() => {
            if (!isMouseOverCard.current) {
                setIsHoverCardVisible(false);
                setActiveCardCell(null);
                setHoverCardData(null);
            }
        }, 150);
    };
    
    const handleCellMouseEnter = (cellId: string) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        
        if (cellId !== activeCardCell) {
            showHoverCard(cellId);
        }
    };
    
    const handleCellMouseLeave = () => {
        hideHoverCard();
    };
    
    const handleCardMouseEnter = () => {
        isMouseOverCard.current = true;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
    };
    
    const handleCardMouseLeave = (e: React.MouseEvent) => {
        isMouseOverCard.current = false;
        
        // Проверяем, не вернулся ли курсор на ячейку
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget && 
            typeof relatedTarget.closest === 'function' && 
            relatedTarget.closest('[data-day-cell]')) {
            // Курсор вернулся на ячейку - не скрываем карточку
            return;
        }
        
        hideHoverCard();
    };
    
    const smartHover = {
        isCardVisible: isHoverCardVisible,
        activeCell: activeCardCell,
        currentMousePos: null,
        hideCard: () => {
            setIsHoverCardVisible(false);
            setActiveCardCell(null);
            setHoverCardData(null);
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
            }
        },
        setCardElement: (element: HTMLElement | null) => {
            cardElementRef.current = element;
        },
        switchToCell: () => {},
        handleCellMouseEnter,
        handleCellMouseLeave,
        handleCardMouseEnter,
        handleCardMouseLeave
    };

    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
        
        // Используем переданный обработчик из App.tsx, который правильно обрабатывает логику:
        // - Если есть бронирования → открывает BookingsList
        // - Если нет бронирований → открывает форму создания
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
            const dayStatistics = calculateDayStatistics(date, allBookings, effectiveTotalInventory, DEFAULT_PRICING);
            setSelectedDayData({ date, statistics: dayStatistics, bookings: dateBookings });
        }
        
        setShowDayDetails(true);
    };

    const handlePrevMonth = () => {
        setBaseMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setBaseMonth(prev => addMonths(prev, 1));
    };



    const handleShowHoverCard = (date: Date, statistics: any, bookings: Booking[], sourceMonthIndex: number) => {
        // Если карточка уже показана для этого дня, не показываем повторно
        if (hoverCardData && 
            format(hoverCardData.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && 
            smartHover.isCardVisible) {
            return; // Карточка уже показана для этого дня
        }
        
        // Определяем индекс целевого месяца для отображения карточки
        let targetMonthIndex;
        
        if (sourceMonthIndex === monthsToDisplay.length - 1) {
            // Если это крайний правый календарь, показываем карточку в предыдущем
            targetMonthIndex = sourceMonthIndex - 1;
        } else {
            // Иначе показываем в следующем календаре справа
            targetMonthIndex = sourceMonthIndex + 1;
        }
        
        setHoverCardData({
            date,
            statistics,
            bookings,
            targetMonthIndex
        });
        
        // Карточка будет скрыта только при клике на крестик или уходе курсора
    };

    const handleHideHoverCard = () => {
        // Мгновенно скрываем карточку (без таймера)
        smartHover.hideCard();
    };

    const handleHoverCardMouseEnter = () => {
        // Убеждаемся что карточка видима
        if (!smartHover.isCardVisible && hoverCardData) {
            // Карточка управляется через smartHover
        }
    };

    const handleHoverCardMouseLeave = (e: React.MouseEvent) => {
        // Проверяем, не возвращается ли курсор на исходную ячейку
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget) {
            // Если курсор перешел на ячейку дня, не скрываем карточку
            const dayCell = relatedTarget.closest('[data-day-cell]');
            if (dayCell && hoverCardData) {
                const cellDate = dayCell.getAttribute('data-date');
                const cardDate = format(hoverCardData.date, 'yyyy-MM-dd');
                if (cellDate === cardDate) {
                    // Курсор вернулся на исходную ячейку - не скрываем
                    return;
                }
            }
        }
        
        // Когда убрали курсор с карточки - скрываем её
        handleHideHoverCard();
    };

    const handleCancelHideHoverCard = () => {
        // Отменяем скрытие (используется при возврате курсора на ячейку)
        // Теперь эта функция просто заглушка, так как мы не используем таймеры
    };

    const canGoPrev = baseMonth > new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1);
    const canGoNext = baseMonth < new Date(new Date().getFullYear() + 2, new Date().getMonth(), 1);

    // Показываем загрузку если данные еще не загружены
    if (isDataLoading) {
        console.log('[DesktopCalendar] Data is loading, showing loader...', {
            boardsLoading,
            bookingsLoading,
            boardsCount: boards.length,
            bookingsCount: Object.keys(reduxBookings).length
        });
        
        return (
            <DesktopCalendarContainer>
                <TopBar>
                    <NavigationSection>
                        <MonthNavigator>
                            <CurrentMonth>Загрузка...</CurrentMonth>
                        </MonthNavigator>
                        <WeatherWidget />
                    </NavigationSection>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <NotificationBellIcon />
                        <InventoryButton
                            onClick={() => setShowInventoryModal(true)}
                            title="Управление инвентарем"
                        >
                            <img src={canoeIcon} alt="Инвентарь" style={{ width: 20, height: 20 }} />
                            Инвентарь
                        </InventoryButton>
                        <GalleryButton
                            onClick={() => setShowGalleryModal(true)}
                            title="Галерея инвентаря"
                        >
                            📸 Галерея
                        </GalleryButton>
                        <ProfileButton />
                    </div>
                </TopBar>
                <CalendarContent>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: '100%',
                        color: '#fff',
                        fontSize: '18px'
                    }}>
                        Загрузка данных...
                    </div>
                </CalendarContent>
            </DesktopCalendarContainer>
        );
    }

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



    return (
        <DesktopCalendarContainer>
            <TopBar>
                <NavigationSection>
                    <MonthNavigator>
                        <NavButton 
                            onClick={handlePrevMonth}
                            disabled={!canGoPrev}
                            title="Предыдущий месяц"
                        >
                            ←
                        </NavButton>
                        <CurrentMonth>
                            {format(baseMonth, 'LLLL yyyy', { locale: ru })}
                        </CurrentMonth>
                        <NavButton 
                            onClick={handleNextMonth}
                            disabled={!canGoNext}
                            title="Следующий месяц"
                        >
                            →
                        </NavButton>
                    </MonthNavigator>
                    
                    <WeatherWidget />
                </NavigationSection>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <NotificationBellIcon />
                    <InventoryButton
                        onClick={() => setShowInventoryModal(true)}
                        title="Управление инвентарем"
                    >
                        <img src={canoeIcon} alt="Инвентарь" style={{ width: 20, height: 20 }} />
                        Инвентарь
                    </InventoryButton>
                    <GalleryButton
                        onClick={() => setShowGalleryModal(true)}
                        title="Галерея инвентаря"
                    >
                        📸 Галерея
                    </GalleryButton>
                    <ProfileButton />
                </div>
            </TopBar>

            <CalendarContent>
                <MonthGrid>
                    {monthsToDisplay.map((month, monthIndex) => {
                        // Проверяем, нужно ли показать hover-карточку в этом месте
                        const showHoverCard = isHoverCardVisible && hoverCardData && hoverCardData.targetMonthIndex === monthIndex;
                        
                        const daysGrid = getMonthGrid(month);
                        const monthStart = startOfMonth(month);
                        const monthEnd = endOfMonth(month);
                        const monthBookings = Object.entries(actualBookings)
                            .filter(([dateStr]) => {
                                const date = new Date(dateStr + 'T00:00:00');
                                return date >= monthStart && date <= monthEnd;
                            })
                            .flatMap(([, bookings]) => bookings);

                        const monthRevenue = calculateRevenueFromBookings(monthBookings);

                        return (
                            <MonthCard key={format(month, 'yyyy-MM')}>
                                {/* Обычный календарь */}
                                <div style={{ 
                                    width: '100%', 
                                    height: '100%',
                                    opacity: showHoverCard ? 0 : 1,
                                    transition: 'opacity 0.3s ease',
                                    pointerEvents: showHoverCard ? 'none' : 'auto'
                                }}>
                                    <MonthHeader>
                                        <MonthTitle>
                                            {format(month, 'LLLL yyyy', { locale: ru })}
                                        </MonthTitle>
                                        <MonthStats>
                                            <MonthRevenue>
                                                💰 {monthRevenue.toLocaleString('ru-RU')}₽
                                            </MonthRevenue>
                                            <MonthBookings>
                                                {monthBookings.length} записей • {monthBookings.filter(b => b.serviceType === 'аренда').length} аренд • {monthBookings.filter(b => b.serviceType === 'сплав').length} сплавов
                                            </MonthBookings>
                                        </MonthStats>
                                    </MonthHeader>
                                    
                                    <WeekDaysHeader>
                                        {weekDays.map((day) => (
                                            <WeekDayLabel key={day}>{day}</WeekDayLabel>
                                        ))}
                                    </WeekDaysHeader>
                                    
                                    <DaysGrid>
                                        {daysGrid.map((day, idx) => {
                                            if (!day) {
                                                return <EmptyCell key={idx} />;
                                            }

                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const dateBookings = getDateBookings(day);
                                            const hasBookings = dateBookings.length > 0;
                                            const isFullyBooked = fullyBookedDays.includes(dateStr);
                                            const partialDay = partiallyBookedDays.find(d => d.date === dateStr);
                                            const isPartiallyBooked = !!partialDay;
                                            const columnIndex = idx % 7;
                                            
                                            if (dateStr === '2025-06-19') {
                                                console.log(`[DesktopCalendar] ${dateStr} data:`, {
                                                    dateBookings,
                                                    hasBookings,
                                                    allBookingsCount: allBookings.length,
                                                    totalBoards: effectiveTotalInventory, // Новая система
                                                    totalInventory, // Новая система
                                                    effectiveTotalInventory, // Используемое значение
                                                    actualBookings,
                                                    boards
                                                });
                                            }
                                            
                                            return (
                                                <DayCellWrapper key={dateStr}>
                                                    <DayCell
                                                        date={day}
                                                        isToday={isTodayFn(day)}
                                                        isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
                                                        hasBookings={hasBookings}
                                                        bookings={dateBookings}
                                                        allBookings={allBookings}
                                                        totalBoards={effectiveTotalInventory}
                                                        isFullyBooked={isFullyBooked}
                                                        isPartiallyBooked={isPartiallyBooked}
                                                        availableAfter={partialDay ? partialDay.available_after : null}
                                                        columnIndex={columnIndex}
                                                        onClick={handleDayClick}
                                                        onEditBooking={onEditBooking}
                                                        onAddBooking={onAddBooking}
                                                        onViewDay={handleViewDay}
                                                        onShowHoverCard={
                                                            showHoverCard
                                                                ? undefined 
                                                                : (date: Date, statistics: any, bookings: Booking[]) => {
                                                                    try {
                                                                        const cellId = format(date, 'yyyy-MM-dd');
                                                                        if (!cellId) {
                                                                            console.warn('Invalid cellId in onShowHoverCard');
                                                                            return;
                                                                        }
                                                                        handleCellMouseEnter(cellId);
                                                                    } catch (error) {
                                                                        console.error('Error in onShowHoverCard:', error);
                                                                    }
                                                                }
                                                        }
                                                        onHideHoverCard={
                                                            showHoverCard
                                                                ? undefined
                                                                : () => {
                                                                    try {
                                                                        handleCellMouseLeave();
                                                                    } catch (error) {
                                                                        console.error('Error in onHideHoverCard:', error);
                                                                    }
                                                                }
                                                        }
                                                        onCancelHideHoverCard={
                                                            showHoverCard
                                                                ? undefined
                                                                : handleCancelHideHoverCard
                                                        }
                                                    />
                                                </DayCellWrapper>
                                            );
                                        })}
                                    </DaysGrid>
                                </div>
                                
                                {/* Hover-карточка накладывается поверх */}
                                {isHoverCardVisible && hoverCardData && hoverCardData.targetMonthIndex === monthIndex && (
                                    <HoverCardContainer
                                        ref={(el) => {
                                            cardElementRef.current = el;
                                        }}
                                        onMouseEnter={handleCardMouseEnter}
                                        onMouseLeave={handleCardMouseLeave}
                                    >
                                        <HoverCard
                                            date={hoverCardData.date}
                                            statistics={hoverCardData.statistics}
                                            bookings={hoverCardData.bookings}
                                            onAddBooking={(date) => {
                                                setIsHoverCardVisible(false);
                                                setActiveCardCell(null);
                                                setHoverCardData(null);
                                                onAddBooking(date);
                                            }}
                                            onViewDay={(date: Date, stats?: any, bookings?: Booking[]) => {
                                                setIsHoverCardVisible(false);
                                                setActiveCardCell(null);
                                                setHoverCardData(null);
                                                handleViewDay(date, stats, bookings);
                                            }}
                                            onClose={() => {
                                                setIsHoverCardVisible(false);
                                                setActiveCardCell(null);
                                                setHoverCardData(null);
                                            }}
                                        />
                                    </HoverCardContainer>
                                )}
                            </MonthCard>
                        );
                    })}
                </MonthGrid>
            </CalendarContent>
            
            {/* Глобальное модальное окно деталей дня */}
            {showDayDetails && selectedDayData && (
                <DayDetailsModal
                    isOpen={showDayDetails}
                    date={selectedDayData.date}
                    statistics={selectedDayData.statistics}
                    bookings={selectedDayData.bookings}
                    onClose={() => {
                        setShowDayDetails(false);
                        setSelectedDayData(null);
                    }}
                    onAddBooking={(date) => {
                        setShowDayDetails(false);
                        setSelectedDayData(null);
                        onAddBooking(date);
                    }}
                    onEditBooking={(booking) => {
                        setShowDayDetails(false);
                        setSelectedDayData(null);
                        onEditBooking(booking);
                    }}
                />
            )}
            
            {/* Модальное окно управления инвентарем */}
            <DesktopInventoryModal
                isOpen={showInventoryModal}
                onClose={() => setShowInventoryModal(false)}
            />
            
            {/* Модальное окно галереи инвентаря */}
            <GalleryModal
                isOpen={showGalleryModal}
                onClose={() => setShowGalleryModal(false)}
            />
        </DesktopCalendarContainer>
    );
};

export default DesktopCalendar; 