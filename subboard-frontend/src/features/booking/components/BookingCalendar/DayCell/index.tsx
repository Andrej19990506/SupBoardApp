import type { FC } from 'react';
import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Booking } from '@/types/booking';
import { useDevice } from '@shared/hooks/useDevice';
import { calculateDayStatistics } from '@features/booking/utils/calendarUtils';
import DayStatusIndicator from '../components/DayStatusIndicator';
import HoverCard from '../components/HoverCard';
import DayDetailsModal from '../components/DayDetailsModal';
import { CellContainer, DayNumber, BookingIndicator } from '@features/booking/components/BookingCalendar/DayCell/styles';

interface DayCellProps {
    date: Date | null;
    isToday: boolean;
    isSelected: boolean;
    hasBookings: boolean;
    bookings: Booking[];
    allBookings: Booking[]; // Все записи для расчета статистики
    totalBoards: number; // Общее количество досок
    isFullyBooked?: boolean;
    isPartiallyBooked?: boolean;
    availableAfter?: string | null;
    columnIndex?: number; // Индекс колонки в сетке (0-6)
    onClick: (date: Date) => void;
    onEditBooking: (booking: Booking) => void;
    onAddBooking?: (date: Date) => void;
    onViewDay?: (date: Date, statistics?: any, bookings?: Booking[]) => void;
    onShowHoverCard?: (date: Date, statistics: any, bookings: Booking[]) => void;
    onHideHoverCard?: () => void;
    onCancelHideHoverCard?: () => void; // Отмена таймера скрытия при возврате курсора
}

const DayCell: FC<DayCellProps> = ({
    date,
    isToday,
    isSelected,
    hasBookings,
    bookings,
    allBookings,
    totalBoards,
    isFullyBooked,
    isPartiallyBooked,
    availableAfter,
    columnIndex,
    onClick,
    onEditBooking,
    onAddBooking,
    onViewDay,
    onShowHoverCard,
    onHideHoverCard,
    onCancelHideHoverCard,
}: DayCellProps) => {
    // Определяем тип устройства (хук должен вызываться всегда)
    const { isDesktop, isLaptop } = useDevice();
    
    // Инициализируем состояние всегда (для соблюдения правил хуков)
    const [showHoverCard, setShowHoverCard] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
    const [showDayDetails, setShowDayDetails] = useState(false);
    
    // Для мобильной версии отключаем hover-карточки
    const isMobile = !isDesktop && !isLaptop;

    if (!date) {
        return <CellContainer as="div" $isToday={false} $isSelected={false} $hasBookings={false} />;
    }

    const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));

    // Рассчитываем статистику для дня
    const dayStatistics = useMemo(() => {
        const stats = calculateDayStatistics(date, allBookings, totalBoards);
        return stats;
    }, [date, allBookings, totalBoards, hasBookings, bookings.length]);

    const handleClick = () => {
        if (!isPastDate) {
            console.log(`[DayCell] Клик по дате: ${date?.toISOString()}`);
            onClick(date);
        }
    };

    const handleMouseEnter = () => {
        if (!isMobile && !isPastDate) {
            // Убираем предыдущий таймаут, если есть
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                setHoverTimeout(null);
            }
            
            // Отменяем таймер скрытия если возвращаемся на ячейку
            if (onCancelHideHoverCard && typeof onCancelHideHoverCard === 'function') {
                onCancelHideHoverCard();
            }
            
            // Показываем карточку с задержкой
            const timeout = setTimeout(() => {
                if (onShowHoverCard && typeof onShowHoverCard === 'function') {
                    // Используем внешний обработчик для показа карточки в соседнем календаре
                    onShowHoverCard(date, dayStatistics, bookings);
                } else {
                    // Fallback: показываем локальную карточку
                    setShowHoverCard(true);
                }
            }, 200);
            setHoverTimeout(timeout);
        }
    };

    const handleMouseLeave = (e: React.MouseEvent) => {
        if (!isMobile && !isPastDate) {
            // Убираем таймаут показа
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                setHoverTimeout(null);
            }
            
            // Проверяем, не переходим ли мы на hover-карточку
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (relatedTarget && 
                typeof relatedTarget.closest === 'function' && 
                relatedTarget.closest('[data-hover-card]')) {
                // Курсор перешел на hover-карточку - не запускаем скрытие
                return;
            }
            
            // Для локальной карточки (fallback) всё ещё скрываем при уводе курсора
            if (!onHideHoverCard) {
                setTimeout(() => {
                    setShowHoverCard(false);
                }, 150);
            }
            // Для внешних hover-карточек запускаем таймер скрытия через внешний обработчик
            else if (onHideHoverCard && typeof onHideHoverCard === 'function') {
                // Добавляем небольшую задержку чтобы дать время курсору перейти на карточку
                setTimeout(() => {
                    onHideHoverCard();
                }, 50);
            }
        }
    };

    const handleCardMouseEnter = () => {
        // Карточка видна - убираем таймауты скрытия
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
        }
        setShowHoverCard(true);
    };

    const handleCardMouseLeave = () => {
        // Скрываем с небольшой задержкой, чтобы дать время на клик
        setTimeout(() => {
            setShowHoverCard(false);
        }, 100);
    };

    const handleAddBooking = (selectedDate: Date) => {
        // Принудительно скрываем карточку немедленно
        setShowHoverCard(false);
        // Убираем все таймауты
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
        }
        
        // Небольшая задержка чтобы карточка успела скрыться
        setTimeout(() => {
            if (onAddBooking) {
                onAddBooking(selectedDate);
            } else {
                onClick(selectedDate);
            }
        }, 50);
    };

    const handleViewDay = (selectedDate: Date) => {
        // Принудительно скрываем карточку немедленно
        setShowHoverCard(false);
        // Убираем все таймауты
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
        }
        
        // Небольшая задержка чтобы карточка успела скрыться
        setTimeout(() => {
            if (onViewDay) {
                // Передаем статистику и записи во внешний обработчик
                onViewDay(selectedDate, dayStatistics, bookings);
            } else {
                // Fallback: открываем локальное модальное окно
                setShowDayDetails(true);
            }
        }, 50);
    };

    return (
        <>
            <CellContainer
                type="button"
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                $isToday={isToday}
                $isSelected={isSelected}
                $hasBookings={hasBookings}
                $isPastDate={isPastDate}
                $isFullyBooked={isFullyBooked}
                $isPartiallyBooked={isPartiallyBooked}
                disabled={isPastDate}
                aria-label={`День ${format(date, 'd')}`}
                style={{ position: 'relative' }}
                data-day-cell
                data-date={format(date, 'yyyy-MM-dd')}
            >
                <DayNumber $isToday={isToday} $isPastDate={isPastDate}>
                    {format(date, 'd')}
                </DayNumber>
                
                {/* Индикаторы статистики (только для будущих дней) */}
                {(() => {
                    const shouldShow = !isPastDate && (hasBookings || dayStatistics.utilizationPercent > 0);
                    return shouldShow;
                })() && (
                    <DayStatusIndicator 
                        statistics={dayStatistics}
                        compact={isMobile}
                    />
                )}

                {/* Простой индикатор для прошедших дней */}
                {isPastDate && hasBookings && (
                    <BookingIndicator $isPastDate={isPastDate}>
                        {bookings.length}
                    </BookingIndicator>
                )}

                {/* Hover-карточка для десктопа */}
                {showHoverCard && !isMobile && !isPastDate && (
                    <HoverCard
                        date={date}
                        statistics={dayStatistics}
                        bookings={bookings}
                        onAddBooking={handleAddBooking}
                        onViewDay={handleViewDay}
                        onClose={() => setShowHoverCard(false)}
                        columnIndex={columnIndex}
                        onMouseEnter={handleCardMouseEnter}
                        onMouseLeave={handleCardMouseLeave}
                    />
                )}
                
                {/* Индикатор частично занятого дня */}
                {isPartiallyBooked && availableAfter && (
                    <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '2px',
                        fontSize: '8px',
                        color: '#FFD600',
                        fontWeight: 'bold',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                    }}>
                        {availableAfter}
                    </div>
                )}
            </CellContainer>

            {/* Модальное окно деталей дня (только если нет внешнего обработчика) */}
            {!onViewDay && showDayDetails && (
                <DayDetailsModal
                    date={date}
                    statistics={dayStatistics}
                    bookings={bookings}
                    onClose={() => setShowDayDetails(false)}
                    onAddBooking={(selectedDate) => {
                        setShowDayDetails(false);
                        handleAddBooking(selectedDate);
                    }}
                    onEditBooking={(booking: Booking) => {
                        setShowDayDetails(false);
                        onEditBooking(booking);
                    }}
                />
            )}
        </>
    );
};

export type { DayCellProps };
export default DayCell; 