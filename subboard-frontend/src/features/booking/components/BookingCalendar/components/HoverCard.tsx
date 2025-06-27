import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DayStatistics } from '@features/booking/utils/calendarUtils';
import { getUtilizationColor, getUtilizationText, calculateBookingRevenueLegacy as calculateBookingRevenue } from '@features/booking/utils/calendarUtils';
import type { Booking } from '@/types/booking';
import { ServiceType } from '@/types/booking';
import { DEFAULT_PRICING } from '@features/booking/components/BookingForm/PricingDisplay';

const HoverCardContainer = styled.div<{ 
    $position: 'center' | 'left' | 'right';
    $verticalPosition: 'below' | 'above';
}>`
    position: absolute;
    ${({ $verticalPosition }) => $verticalPosition === 'below' ? 'top: 100%;' : 'bottom: 100%;'}
    ${({ $position }) => {
        switch ($position) {
            case 'left':
                return 'left: 0; transform: translateX(0);';
            case 'right':
                return 'right: 0; transform: translateX(0);';
            default:
                return 'left: 50%; transform: translateX(-50%);';
        }
    }}
    z-index: 1000;
    background: #1C1C1E;
    border: 1px solid #3A3A3C;
    border-radius: 12px;
    min-width: 280px;
    max-width: 320px;
    max-height: 80vh;
    width: max-content;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    ${({ $verticalPosition }) => $verticalPosition === 'below' ? 'margin-top: 2px;' : 'margin-bottom: 2px;'}
    
    /* Предотвращаем обрезание */
    ${({ $position }) => {
        if ($position === 'left') {
            return 'margin-left: 0;';
        } else if ($position === 'right') {
            return 'margin-right: 0;';
        }
        return '';
    }}
    
    /* Стрелочка - граница */
    &::before {
        content: '';
        position: absolute;
        ${({ $verticalPosition }) => $verticalPosition === 'below' ? 'top: -6px;' : 'bottom: -6px;'}
        ${({ $position }) => {
            switch ($position) {
                case 'left':
                    return 'left: 24px;';
                case 'right':
                    return 'right: 24px;';
                default:
                    return 'left: 50%; transform: translateX(-50%);';
            }
        }}
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        ${({ $verticalPosition }) => 
            $verticalPosition === 'below' 
                ? 'border-bottom: 6px solid #3A3A3C;' 
                : 'border-top: 6px solid #3A3A3C;'
        }
        z-index: 1;
    }
    
    /* Стрелочка - заливка */
    &::after {
        content: '';
        position: absolute;
        ${({ $verticalPosition }) => $verticalPosition === 'below' ? 'top: -5px;' : 'bottom: -5px;'}
        ${({ $position }) => {
            switch ($position) {
                case 'left':
                    return 'left: 24px;';
                case 'right':
                    return 'right: 24px;';
                default:
                    return 'left: 50%; transform: translateX(-50%);';
            }
        }}
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        ${({ $verticalPosition }) => 
            $verticalPosition === 'below' 
                ? 'border-bottom: 5px solid #1C1C1E;' 
                : 'border-top: 5px solid #1C1C1E;'
        }
        z-index: 2;
    }
`;

const CardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 16px 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    background: #1C1C1E;
    border-radius: 12px 12px 0 0;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: #86868B;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }
    
    &:active {
        transform: scale(0.95);
    }
`;

const CardContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    
    /* Красивый скроллбар */
    &::-webkit-scrollbar {
        width: 8px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
        margin: 4px 2px 4px 0;
    }
    
    &::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
        border-radius: 4px;
        border: 2px solid transparent;
        background-clip: content-box;
        transition: all 0.2s ease;
        min-height: 20px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #0056CC 0%, #003D99 100%);
        background-clip: content-box;
    }
`;

const DateTitle = styled.h3`
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
`;

const UtilizationChip = styled.div<{ $color: string }>`
    background: ${({ $color }) => $color};
    color: ${({ $color }) => $color === '#FFD600' ? '#000' : '#fff'};
    padding: 4px 8px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
    padding: 16px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
`;

const StatItem = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
`;

const StatValue = styled.div`
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const StatLabel = styled.div`
    color: #86868B;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
`;

const TimelineContainer = styled.div`
    margin-bottom: 16px;
`;

const TimelineTitle = styled.h4`
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &::before {
        content: '';
        width: 3px;
        height: 14px;
        background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
        border-radius: 2px;
    }
`;

const TimelineGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(15, 1fr);
    gap: 1px;
    margin-bottom: 4px;
`;

const TimeSlot = styled.div<{ $utilization: number; $available: number; $booked: number }>`
    height: 16px;
    border-radius: 2px;
    background: ${({ $utilization }) => {
        if ($utilization >= 0.9) return '#FF4D4F';         // Красный (90%+)
        if ($utilization >= 0.7) return '#FFD600';         // Желтый (70%+)
        if ($utilization >= 0.4) return '#52C41A';         // Зеленый (40%+)
        if ($utilization > 0) return '#007AFF';            // Синий (любая заполненность)
        return '#3A3A3C';                                   // Серый (пусто)
    }};
    position: relative;
    cursor: help;
    transition: all 0.2s ease;
    
    &:hover {
        transform: scaleY(1.2);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    &:hover::after {
        content: '${({ $utilization, $available, $booked }) => 
            `${Math.round($utilization * 100)}% (${$booked}/${$booked + $available})`
        }';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 9px;
        white-space: nowrap;
        z-index: 1001;
        margin-bottom: 2px;
        border: 1px solid #3A3A3C;
    }
`;

const TimeLabels = styled.div`
    display: grid;
    grid-template-columns: repeat(15, 1fr);
    color: #86868B;
    font-size: 9px;
    text-align: center;
    
    span:nth-child(1) { grid-column: 1; text-align: left; }
    span:nth-child(2) { grid-column: 4; }
    span:nth-child(3) { grid-column: 7; }
    span:nth-child(4) { grid-column: 10; }
    span:nth-child(5) { grid-column: 13; }
    span:nth-child(6) { grid-column: 15; text-align: right; }
`;

const BookingsSection = styled.div`
    margin-bottom: 16px;
    padding: 12px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
`;

const BookingItem = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #2C2C2E 0%, #1C1C1E 100%);
    border-radius: 8px;
    margin-bottom: 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
    
    &:hover {
        background: linear-gradient(135deg, #3A3A3C 0%, #2C2C2E 100%);
        border-color: rgba(255, 255, 255, 0.1);
        transform: translateX(2px);
    }
    
    &:last-child {
        margin-bottom: 0;
    }
`;

const ServiceIcon = styled.div<{ $type: ServiceType }>`
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: ${({ $type }) => 
        $type === 'аренда' 
            ? 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)' 
            : 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)'
    };
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
`;

const BookingInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const BookingTime = styled.div`
    color: #fff;
    font-size: 12px;
    font-weight: 500;
`;

const BookingClient = styled.div`
    color: #86868B;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const RecommendationsSection = styled.div`
    padding: 12px;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%);
    border-radius: 10px;
    border: 1px solid rgba(255, 215, 0, 0.2);
    margin-bottom: 16px;
`;

const RecommendationItem = styled.div`
    color: #86868B;
    font-size: 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.4;
    
    &:last-child {
        margin-bottom: 0;
    }
    
    &::before {
        content: '💡';
        font-size: 12px;
        flex-shrink: 0;
        margin-top: 1px;
    }
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 12px;
`;

const StatsDetailGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 16px;
    background: linear-gradient(135deg, #2C2C2E 0%, #3A3A3C 100%);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
`;

const StatsDetailItem = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
`;

const StatsDetailValue = styled.div<{ $color?: string }>`
    color: ${({ $color }) => $color || '#fff'};
    font-size: 16px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const StatsDetailLabel = styled.div`
    color: #86868B;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
`;

const ClientInfoCard = styled.div`
    margin-bottom: 16px;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(0, 122, 255, 0.15) 0%, rgba(0, 122, 255, 0.05) 100%);
    border-radius: 12px;
    border: 1px solid rgba(0, 122, 255, 0.3);
    backdrop-filter: blur(8px);
`;

const ClientInfoHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #007AFF;
`;

const ClientInfoText = styled.div`
    font-size: 11px;
    color: #86868B;
    line-height: 1.4;
`;

const ActionButton = styled.button`
    flex: 1;
    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    
    &:hover {
        background: linear-gradient(135deg, #0056CC 0%, #003D99 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
    }
    
    &:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
    }
    
    &:last-child {
        background: linear-gradient(135deg, #3A3A3C 0%, #2C2C2E 100%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        
        &:hover {
            background: linear-gradient(135deg, #4A4A4C 0%, #3A3A3C 100%);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
        
        &:hover {
            transform: none;
            box-shadow: none;
        }
    }
`;

interface HoverCardProps {
    date: Date;
    statistics: DayStatistics;
    bookings: Booking[];
    onAddBooking: (date: Date) => void;
    onViewDay: (date: Date) => void;
    onClose?: () => void; // Функция для закрытия карточки
    columnIndex?: number; // Индекс колонки в сетке (0-6)
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const HoverCard: React.FC<HoverCardProps> = ({
    date,
    statistics,
    bookings,
    onAddBooking,
    onViewDay,
    onClose,
    columnIndex,
    onMouseEnter,
    onMouseLeave
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isProcessingClick, setIsProcessingClick] = useState(false);
    const [position, setPosition] = useState<'center' | 'left' | 'right'>(() => {
        // Определяем начальную позицию на основе columnIndex
        if (columnIndex !== undefined) {
            if (columnIndex <= 1) return 'left';  // Первые две колонки - карточка слева
            if (columnIndex >= 5) return 'right'; // Последние две колонки - карточка справа
        }
        return 'center';
    });
    const [verticalPosition, setVerticalPosition] = useState<'below' | 'above'>('below');
    
    useEffect(() => {
        const determinePosition = () => {
            const parentElement = cardRef.current?.parentElement;
            if (parentElement) {
                const rect = parentElement.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const cardWidth = 320;
                const cardHeight = 400; // Примерная высота карточки
                
                // Определяем горизонтальную позицию
                if (columnIndex === undefined) {
                    const centerLeft = rect.left + rect.width / 2 - cardWidth / 2;
                    const centerRight = centerLeft + cardWidth;
                    
                    if (centerLeft < 10) {
                        setPosition('left');
                    } else if (centerRight > viewportWidth - 10) {
                        setPosition('right');
                    } else {
                        setPosition('center');
                    }
                }
                
                // Определяем вертикальную позицию
                const spaceBelow = viewportHeight - rect.bottom;
                const spaceAbove = rect.top;
                
                if (spaceBelow < cardHeight && spaceAbove > cardHeight) {
                    setVerticalPosition('above');
                } else {
                    setVerticalPosition('below');
                }
            }
        };
        
        determinePosition();
        window.addEventListener('resize', determinePosition);
        window.addEventListener('scroll', determinePosition);
        return () => {
            window.removeEventListener('resize', determinePosition);
            window.removeEventListener('scroll', determinePosition);
        };
    }, [columnIndex]);

    const utilizationColor = getUtilizationColor(statistics.utilizationPercent);
    const utilizationText = getUtilizationText(statistics.utilizationPercent);
    
    // Проверяем рабочее время (9:00 - 23:00)
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = format(now, 'yyyy-MM-dd');
    const selectedDate = format(date, 'yyyy-MM-dd');
    const isToday = currentDate === selectedDate;
    const isWorkingHours = currentHour >= 9 && currentHour < 23;
    const canAcceptNewBookings = !isToday || isWorkingHours;
    
    // Показываем только первые 3 записи
    const displayBookings = bookings.slice(0, 3);
    const hasMoreBookings = bookings.length > 3;

    // Создаем данные для временной шкалы (9:00-23:00, каждый час)
    const timelineSlots = [];
    // Используем реальное количество досок из статистики
    const totalBoards = statistics.totalSlots || 15;
    
    for (let hour = 9; hour <= 23; hour++) {
        const slot = statistics.timeSlots.find(s => s.hour === hour);
        // Используем реальное количество досок
        const utilization = slot ? slot.booked / totalBoards : 0;
        timelineSlots.push({
            utilization,
            available: slot ? slot.available : totalBoards,
            booked: slot ? slot.booked : 0
        });
    }

    return (
        <HoverCardContainer 
            ref={cardRef}
            $position={position}
            $verticalPosition={verticalPosition}
            data-hover-card
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <CardHeader>
                <div>
                    <DateTitle>
                        {format(date, 'd MMMM', { locale: ru })}
                    </DateTitle>
                    <div style={{ 
                        fontSize: '11px', 
                        color: '#86868B', 
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        {(() => {
                            const dayOfWeek = format(date, 'EEEE', { locale: ru });
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            
                            return (
                                <>
                                    <span>{dayOfWeek}</span>
                                    {isWeekend && <span style={{ color: '#FFD600' }}>🌟 Выходной</span>}
                                    {isToday && <span style={{ color: '#52C41A' }}>📅 Сегодня</span>}
                                </>
                            );
                        })()}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UtilizationChip $color={utilizationColor}>
                        {statistics.utilizationPercent}%
                    </UtilizationChip>
                    {onClose && (
                        <CloseButton
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onClose();
                            }}
                            title="Закрыть"
                        >
                            ✕
                        </CloseButton>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                <StatsGrid>
                <StatItem>
                    <StatValue>{statistics.bookedSlots}</StatValue>
                    <StatLabel>Записей</StatLabel>
                </StatItem>
                <StatItem>
                    <StatValue>{Math.min(...statistics.timeSlots.map(slot => slot.available))}</StatValue>
                    <StatLabel>Свободно</StatLabel>
                </StatItem>
            </StatsGrid>

            {/* Дополнительная статистика */}
            <StatsDetailGrid>
                <StatsDetailItem>
                    <StatsDetailValue $color="#007AFF">
                        {bookings.filter(b => b.serviceType === 'аренда').length}
                    </StatsDetailValue>
                    <StatsDetailLabel>Аренда</StatsDetailLabel>
                </StatsDetailItem>
                <StatsDetailItem>
                    <StatsDetailValue $color="#FF6B35">
                        {bookings.filter(b => b.serviceType === 'сплав').length}
                    </StatsDetailValue>
                    <StatsDetailLabel>Сплав</StatsDetailLabel>
                </StatsDetailItem>
                <StatsDetailItem>
                    <StatsDetailValue $color="#52C41A">
                        {Math.round(bookings.reduce((sum, booking) => {
                            return sum + calculateBookingRevenue(booking, DEFAULT_PRICING);
                        }, 0)).toLocaleString('ru-RU')}₽
                    </StatsDetailValue>
                    <StatsDetailLabel>Доход</StatsDetailLabel>
                </StatsDetailItem>
            </StatsDetailGrid>

            <TimelineContainer>
                <TimelineTitle>Загруженность по часам</TimelineTitle>
                <TimelineGrid>
                    {timelineSlots.map((slot, index) => (
                        <TimeSlot 
                            key={index} 
                            $utilization={slot.utilization}
                            $available={slot.available}
                            $booked={slot.booked}
                        />
                    ))}
                </TimelineGrid>
                <TimeLabels>
                    <span>9:00</span>
                    <span>12:00</span>
                    <span>15:00</span>
                    <span>18:00</span>
                    <span>21:00</span>
                    <span>23:00</span>
                </TimeLabels>
            </TimelineContainer>

            <ActionButtons>
                <ActionButton 
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (isProcessingClick || !canAcceptNewBookings) return;
                        setIsProcessingClick(true);
                        setTimeout(() => setIsProcessingClick(false), 300);
                        onAddBooking(date);
                    }}
                    style={{
                        background: !canAcceptNewBookings ? '#6C6C6E' : 
                                   statistics.utilizationPercent > 90 ? '#FF4D4F' : '#007AFF',
                        opacity: (!canAcceptNewBookings || statistics.utilizationPercent > 95) ? 0.6 : 1
                    }}
                    disabled={!canAcceptNewBookings || statistics.utilizationPercent > 95 || isProcessingClick}
                    title={
                        !canAcceptNewBookings ? 
                            (currentHour >= 23 ? 'Рабочий день завершен (23:00)' : 'Рабочий день еще не начался (с 9:00)') :
                        statistics.utilizationPercent > 95 ? 'День полностью загружен' : 'Добавить новую запись'
                    }
                >
                    {!canAcceptNewBookings ? '⏰ Рабочий день завершен' :
                     statistics.utilizationPercent > 90 ? '⚠️ Добавить' : '➕ Добавить запись'}
                </ActionButton>
                <ActionButton 
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (isProcessingClick) return;
                        setIsProcessingClick(true);
                        setTimeout(() => setIsProcessingClick(false), 300);
                        onViewDay(date);
                    }}
                    disabled={isProcessingClick}
                >
                    📋 Подробнее ({bookings.length})
                </ActionButton>
            </ActionButtons>
            </CardContent>
        </HoverCardContainer>
    );
};

export default HoverCard; 