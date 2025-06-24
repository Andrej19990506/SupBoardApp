import type { FC } from 'react';
import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import styled from 'styled-components';
import type { Booking } from '@/types/booking';
import { calculateDayStatistics } from '@features/booking/utils/calendarUtils';
import DayDetailsModal from '../components/DayDetailsModal';

const DesktopCellContainer = styled.button<{
    $isToday: boolean;
    $isSelected: boolean;
    $hasBookings: boolean;
    $isPastDate?: boolean;
    $isFullyBooked?: boolean;
    $isPartiallyBooked?: boolean;
    $utilizationLevel?: 'low' | 'medium' | 'high' | 'full';
}>`
    width: 100%;
    aspect-ratio: 1.2;
    min-height: 80px;
    max-height: 100px;
    padding: 8px;
    border: none;
    border-radius: 8px;
    background: ${({ $isToday, $isPastDate, $utilizationLevel }) => {
        if ($isPastDate) return 'rgba(28, 28, 30, 0.3)';
        if ($isToday) return 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)';
        
        switch ($utilizationLevel) {
            case 'full': return 'linear-gradient(135deg, #FF3B30 0%, #D70015 100%)';
            case 'high': return 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)';
            case 'medium': return 'linear-gradient(135deg, #FFD600 0%, #FF9500 100%)';
            case 'low': return 'linear-gradient(135deg, #30D158 0%, #28CD41 100%)';
            default: return 'rgba(28, 28, 30, 0.6)';
        }
    }};
    border: ${({ $isSelected, $isToday }) => {
        if ($isSelected && !$isToday) return '2px solid #007AFF';
        return '1px solid rgba(58, 58, 60, 0.6)';
    }};
    color: ${({ $isPastDate, $isToday }) => {
        if ($isPastDate) return '#86868B';
        if ($isToday) return '#fff';
        return '#fff';
    }};
    cursor: ${({ $isPastDate }) => $isPastDate ? 'not-allowed' : 'pointer'};
    transition: all 0.2s ease;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    text-align: left;
    font-family: inherit;
    overflow: visible;

    &:hover:not(:disabled) {
        transform: scale(1.02);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 5;
        border-color: rgba(255, 255, 255, 0.3);
    }

    &:active:not(:disabled) {
        transform: scale(0.98);
    }

    &:disabled {
        opacity: 0.5;
    }
`;

const DayNumber = styled.div<{ $isToday: boolean; $isPastDate?: boolean }>`
    font-size: 14px;
    font-weight: ${({ $isToday }) => $isToday ? '700' : '600'};
    color: ${({ $isPastDate, $isToday }) => {
        if ($isPastDate) return '#86868B';
        if ($isToday) return '#fff';
        return '#fff';
    }};
    margin-bottom: 2px;
`;

const StatsContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    margin-top: auto;
`;

const StatRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.8);
`;

const BookingCount = styled.div<{ $count: number }>`
    font-size: 10px;
    font-weight: 600;
    color: ${({ $count }) => {
        if ($count >= 8) return '#FF3B30';
        if ($count >= 5) return '#FF9500';
        if ($count >= 3) return '#FFD600';
        return '#30D158';
    }};
    background: rgba(0, 0, 0, 0.2);
    padding: 1px 4px;
    border-radius: 3px;
    backdrop-filter: blur(4px);
`;

const UtilizationBar = styled.div<{ $percent: number }>`
    width: 100%;
    height: 3px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
    
    &::after {
        content: '';
        display: block;
        width: ${({ $percent }) => Math.min($percent, 100)}%;
        height: 100%;
        background: ${({ $percent }) => {
            if ($percent >= 90) return '#FF3B30';
            if ($percent >= 70) return '#FF9500';
            if ($percent >= 40) return '#FFD600';
            return '#30D158';
        }};
        transition: all 0.3s ease;
    }
`;

const RevenueIndicator = styled.div`
    font-size: 9px;
    font-weight: 600;
    color: #30D158;
    background: rgba(0, 0, 0, 0.2);
    padding: 1px 3px;
    border-radius: 2px;
    backdrop-filter: blur(4px);
`;

const PartialTimeIndicator = styled.div`
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 8px;
    color: #FFD600;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.4);
    padding: 1px 3px;
    border-radius: 2px;
    backdrop-filter: blur(4px);
`;

const TodayLabel = styled.div`
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 8px;
    color: #fff;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.2);
    padding: 1px 4px;
    border-radius: 2px;
    backdrop-filter: blur(4px);
`;

interface DesktopDayCellProps {
    date: Date | null;
    isToday: boolean;
    isSelected: boolean;
    hasBookings: boolean;
    bookings: Booking[];
    allBookings: Booking[];
    totalBoards: number;
    isFullyBooked?: boolean;
    isPartiallyBooked?: boolean;
    availableAfter?: string | null;
    columnIndex?: number;
    onClick: (date: Date) => void;
    onEditBooking: (booking: Booking) => void;
    onAddBooking?: (date: Date) => void;
    onShowHoverCard?: (date: Date, statistics: any, bookings: Booking[], position: { x: number; y: number }) => void;
    onHideHoverCard?: () => void;
}

const DesktopDayCell: FC<DesktopDayCellProps> = ({
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
    onShowHoverCard,
    onHideHoverCard,
}) => {
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
    const [showDayDetails, setShowDayDetails] = useState(false);

    if (!date) {
        return <div style={{ minHeight: '70px', background: 'transparent' }} />;
    }

    const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));

    // Рассчитываем статистику для дня
    const dayStatistics = useMemo(() => {
        const stats = calculateDayStatistics(date, allBookings, totalBoards);
        console.log(`[DesktopDayCell] ${format(date, 'yyyy-MM-dd')}:`, {
            hasBookings,
            bookingsCount: bookings.length,
            allBookingsCount: allBookings.length,
            totalBoards,
            utilizationPercent: stats.utilizationPercent,
            revenue: stats.revenue,
            stats
        });
        return stats;
    }, [date, allBookings, totalBoards, hasBookings, bookings.length]);

    // Определяем уровень загруженности
    const utilizationLevel = useMemo(() => {
        const percent = dayStatistics.utilizationPercent;
        if (isFullyBooked || percent >= 90) return 'full';
        if (percent >= 70) return 'high';
        if (percent >= 40) return 'medium';
        if (percent > 0) return 'low';
        return undefined;
    }, [dayStatistics.utilizationPercent, isFullyBooked]);

    const handleClick = () => {
        if (!isPastDate) {
            onClick(date);
        }
    };

    const handleMouseEnter = (event: React.MouseEvent) => {
        if (!isPastDate && onShowHoverCard) {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                setHoverTimeout(null);
            }
            
            const timeout = setTimeout(() => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top - 10;
                
                onShowHoverCard(date, dayStatistics, bookings, { x, y });
            }, 150);
            setHoverTimeout(timeout);
        }
    };

    const handleMouseLeave = () => {
        if (!isPastDate && onHideHoverCard) {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                setHoverTimeout(null);
            }
            
            setTimeout(() => {
                onHideHoverCard();
            }, 100);
        }
    };

    const handleAddBooking = (selectedDate: Date) => {
        if (onAddBooking) {
            onAddBooking(selectedDate);
        } else {
            onClick(selectedDate);
        }
    };

    const handleViewDay = (selectedDate: Date) => {
        setShowDayDetails(true);
    };

    return (
        <>
            <DesktopCellContainer
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                $isToday={isToday}
                $isSelected={isSelected}
                $hasBookings={hasBookings}
                $isPastDate={isPastDate}
                $isFullyBooked={isFullyBooked}
                $isPartiallyBooked={isPartiallyBooked}
                $utilizationLevel={utilizationLevel}
                disabled={isPastDate}
                aria-label={`${format(date, 'd MMMM', { locale: ru })}, ${bookings.length} записей`}
            >
                <DayNumber $isToday={isToday} $isPastDate={isPastDate}>
                    {format(date, 'd')}
                </DayNumber>

                {isToday && <TodayLabel>Сегодня</TodayLabel>}

                {/* Статистика для будущих дней */}
                {(() => {
                    const shouldShow = !isPastDate && (hasBookings || dayStatistics.utilizationPercent > 0);
                    console.log(`[DesktopDayCell] ${format(date, 'yyyy-MM-dd')} shouldShow:`, {
                        isPastDate,
                        hasBookings,
                        utilizationPercent: dayStatistics.utilizationPercent,
                        shouldShow
                    });
                    return shouldShow;
                })() && (
                    <StatsContainer>
                        <StatRow>
                            <BookingCount $count={bookings.length}>
                                {bookings.length} зап.
                            </BookingCount>
                            {dayStatistics.revenue > 0 && (
                                <RevenueIndicator>
                                    {Math.round(dayStatistics.revenue / 1000)}к₽
                                </RevenueIndicator>
                            )}
                        </StatRow>
                        
                        {dayStatistics.utilizationPercent > 0 && (
                            <UtilizationBar $percent={dayStatistics.utilizationPercent} />
                        )}
                    </StatsContainer>
                )}

                {/* Простая статистика для прошедших дней */}
                {isPastDate && hasBookings && (
                    <StatsContainer>
                        <BookingCount $count={bookings.length}>
                            {bookings.length} зап.
                        </BookingCount>
                    </StatsContainer>
                )}

                {/* Индикатор частично занятого дня */}
                {isPartiallyBooked && availableAfter && (
                    <PartialTimeIndicator>
                        с {availableAfter}
                    </PartialTimeIndicator>
                )}


            </DesktopCellContainer>

            {/* Модальное окно деталей дня */}
            <DayDetailsModal
                isOpen={showDayDetails}
                date={date}
                statistics={dayStatistics}
                bookings={bookings}
                onClose={() => setShowDayDetails(false)}
                onAddBooking={(selectedDate) => {
                    setShowDayDetails(false);
                    handleAddBooking(selectedDate);
                }}
                onEditBooking={(booking) => {
                    setShowDayDetails(false);
                    onEditBooking(booking);
                }}
            />
        </>
    );
};

export default DesktopDayCell; 