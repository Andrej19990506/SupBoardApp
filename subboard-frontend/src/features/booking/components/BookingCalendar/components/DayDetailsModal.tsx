import React from 'react';
import styled from 'styled-components';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DayStatistics, calculateBookingRevenueLegacy as calculateBookingRevenue } from '../../../utils/calendarUtils';
import { Booking } from '../../../../../types/booking';
import { PricingConfig } from '../../BookingForm/types';
import RecommendationsAnalysis from './RecommendationsAnalysis';

// Константы - базовые настройки цен для обратной совместимости
const DEFAULT_PRICING: PricingConfig = {
    pricingMode: 'hybrid' as const,
    // Цены по типам инвентаря (будут загружены динамически)
    inventoryPricing: {
        // Базовые настройки для основных типов инвентаря
        1: { // SUP доска
            hourlyRate: 300,
            fixedPrices: {
                rent: { '24h': 2000, '48h': 3500, '72h': 5000, 'week': 12000 },
                rafting: 1500,
            },
            deposit: 3000,
            requireDeposit: true,
        },
        2: { // Каяк
            hourlyRate: 400,
            fixedPrices: {
                rent: { '24h': 2500, '48h': 4500, '72h': 6500, 'week': 15000 },
                rafting: 1800,
            },
            deposit: 3000,
            requireDeposit: true,
        },
        3: { // Плот
            hourlyRate: 600,
            fixedPrices: {
                rent: { '24h': 4000, '48h': 7000, '72h': 10000, 'week': 24000 },
                rafting: 2500,
            },
            deposit: 5000,
            requireDeposit: true,
        },
    },
    discounts: {
        enableDiscounts: true,
        rates: {
            vip: 10,
            group: 15,
            repeat: 5
        }
    }
};

interface DayDetailsModalProps {
    isOpen?: boolean;
    date: Date;
    statistics: DayStatistics;
    bookings: Booking[];
    onClose: () => void;
    onAddBooking: (date: Date) => void;
    onEditBooking?: (booking: Booking) => void;
}

// Стили
const ModalOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
    background: #1C1C1E;
    border-radius: 16px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    color: #FFFFFF;
    border: 1px solid #2C2C2E;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;

const ModalHeader = styled.div`
    padding: 24px;
    border-bottom: 1px solid #2C2C2E;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background: #1C1C1E;
    z-index: 10;
`;

const DateTitle = styled.h2`
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #FFFFFF;
`;

const DateSubtitle = styled.div`
    font-size: 14px;
    color: #86868B;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const CloseButton = styled.button`
    background: #2C2C2E;
    border: none;
    border-radius: 8px;
    color: #86868B;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    
    &:hover {
        background: #3A3A3C;
        color: #FFFFFF;
    }
`;

const ModalBody = styled.div`
    padding: 24px;
`;

const Section = styled.div`
    margin-bottom: 32px;
    
    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionTitle = styled.h3`
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    gap: 8px;
`;

// Основная статистика
const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
`;

const StatCard = styled.div`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
`;

const StatValue = styled.div`
    font-size: 28px;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 4px;
`;

const StatLabel = styled.div`
    font-size: 12px;
    color: #86868B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

// Детальная статистика
const DetailStatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
`;

const DetailStatCard = styled.div`
    background: #2C2C2E;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
`;

const DetailStatValue = styled.div<{ $color?: string }>`
    font-size: 20px;
    font-weight: 600;
    color: ${props => props.$color || '#FFFFFF'};
    margin-bottom: 4px;
`;

const DetailStatLabel = styled.div`
    font-size: 11px;
    color: #86868B;
`;

// Список записей
const BookingsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const BookingItem = styled.div`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
`;

const ServiceIcon = styled.div<{ $type: string }>`
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 16px;
    color: #FFFFFF;
    background: ${props => props.$type === 'аренда' ? '#007AFF' : '#FF6B35'};
`;

const BookingInfo = styled.div`
    flex: 1;
`;

const BookingTime = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: #FFFFFF;
    margin-bottom: 4px;
`;

const BookingDetails = styled.div`
    font-size: 14px;
    color: #86868B;
    display: flex;
    align-items: center;
    gap: 12px;
`;

const BookingClient = styled.div`
    font-size: 14px;
    color: #86868B;
    margin-top: 4px;
`;

const BookingRevenue = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: #52C41A;
    text-align: right;
`;

// Информация о клиентах
const ClientsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
`;

const ClientCard = styled.div`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
`;

const ClientName = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: #FFFFFF;
    margin-bottom: 8px;
`;

const ClientInfo = styled.div`
    font-size: 14px;
    color: #86868B;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;



// Временная шкала
const TimelineContainer = styled.div`
    margin-bottom: 24px;
`;

const TimelineGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(15, 1fr);
    gap: 2px;
    margin-bottom: 8px;
`;

const TimeSlot = styled.div<{ $utilization: number; $available: number; $booked: number }>`
    height: 24px;
    border-radius: 4px;
    background: ${props => {
        if (props.$utilization === 0) return '#2C2C2E';
        if (props.$utilization < 0.3) return '#52C41A';
        if (props.$utilization < 0.7) return '#FFD600';
        return '#FF4D4F';
    }};
    position: relative;
    cursor: pointer;
    
    &::after {
        content: '${({ $utilization, $available, $booked }) => 
            `${Math.round($utilization * 100)}% (${$booked}/${$booked + $available})`
        }';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        z-index: 100;
    }
    
    &:hover::after {
        opacity: 1;
    }
`;

const TimeLabels = styled.div`
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #86868B;
    margin-top: 8px;
`;

// Кнопки действий
const ActionButtons = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid #2C2C2E;
`;

const ActionButton = styled.button`
    flex: 1;
    background: #007AFF;
    border: none;
    border-radius: 12px;
    color: #FFFFFF;
    padding: 16px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
        background: #0056CC;
        transform: translateY(-1px);
    }
    
    &:disabled {
        background: #6C6C6E;
        cursor: not-allowed;
        transform: none;
    }
`;

const SecondaryButton = styled(ActionButton)`
    background: #2C2C2E;
    color: #86868B;
    
    &:hover {
        background: #3A3A3C;
        color: #FFFFFF;
    }
`;

const getUtilizationColor = (percent: number) => {
    if (percent >= 90) return '#FF4D4F';
    if (percent >= 70) return '#FFD600';
    if (percent >= 30) return '#52C41A';
    return '#86868B';
};

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
    isOpen = true,
    date,
    statistics,
    bookings,
    onClose,
    onAddBooking,
    onEditBooking
}) => {
    // Проверяем рабочее время
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = format(now, 'yyyy-MM-dd');
    const selectedDate = format(date, 'yyyy-MM-dd');
    const isToday = currentDate === selectedDate;
    const isWorkingHours = currentHour >= 9 && currentHour < 23;
    const canAcceptNewBookings = !isToday || isWorkingHours;

    // Создаем данные для временной шкалы
    const timelineSlots = [];
    const totalBoards = statistics.totalSlots || 15;
    
    for (let hour = 9; hour <= 23; hour++) {
        const slot = statistics.timeSlots.find(s => s.hour === hour);
        const utilization = slot ? slot.booked / totalBoards : 0;
        timelineSlots.push({
            hour,
            utilization,
            available: slot ? slot.available : totalBoards,
            booked: slot ? slot.booked : 0
        });
    }

    // Анализ клиентов
    const clientsAnalysis = () => {
        const clientsMap = new Map();
        
        bookings.forEach(booking => {
            const clientName = booking.clientName;
            if (!clientsMap.has(clientName)) {
                clientsMap.set(clientName, {
                    name: clientName,
                    phone: booking.phone,
                    bookings: [],
                    totalRevenue: 0,
                    totalInventory: 0
                });
            }
            
            const client = clientsMap.get(clientName);
            client.bookings.push(booking);
            client.totalRevenue += calculateBookingRevenue(booking, DEFAULT_PRICING);
            client.totalInventory += (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
        });
        
        return Array.from(clientsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    };

    const clients = clientsAnalysis();

    if (!isOpen) return null;

    return (
        <ModalOverlay onClick={onClose}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                    <div>
                        <DateTitle>
                            {format(date, 'd MMMM yyyy', { locale: ru })}
                        </DateTitle>
                        <DateSubtitle>
                            <span>{format(date, 'EEEE', { locale: ru })}</span>
                            {(date.getDay() === 0 || date.getDay() === 6) && <span style={{ color: '#FFD600' }}>🌟 Выходной</span>}
                            {isToday && <span style={{ color: '#52C41A' }}>📅 Сегодня</span>}
                            <span style={{ color: getUtilizationColor(statistics.utilizationPercent) }}>
                                {statistics.utilizationPercent}% загруженность
                            </span>
                        </DateSubtitle>
                    </div>
                    <CloseButton onClick={onClose}>
                        ✕
                    </CloseButton>
                </ModalHeader>

                <ModalBody>
                    {/* Основная статистика */}
                    <Section>
                        <SectionTitle>📊 Общая статистика</SectionTitle>
                        <StatsGrid>
                            <StatCard>
                                <StatValue>{statistics.bookedSlots}</StatValue>
                                <StatLabel>Записей</StatLabel>
                            </StatCard>
                            <StatCard>
                                <StatValue>{Math.min(...statistics.timeSlots.map(slot => slot.available))}</StatValue>
                                <StatLabel>Мин. свободно</StatLabel>
                            </StatCard>
                            <StatCard>
                                <StatValue>{Math.max(...statistics.timeSlots.map(slot => slot.available))}</StatValue>
                                <StatLabel>Макс. свободно</StatLabel>
                            </StatCard>
                            <StatCard>
                                <StatValue style={{ color: getUtilizationColor(statistics.utilizationPercent) }}>
                                    {statistics.utilizationPercent}%
                                </StatValue>
                                <StatLabel>Загруженность</StatLabel>
                            </StatCard>
                        </StatsGrid>

                        <DetailStatsGrid>
                            <DetailStatCard>
                                <DetailStatValue $color="#007AFF">
                                    {bookings.filter(b => b.serviceType === 'аренда').length}
                                </DetailStatValue>
                                <DetailStatLabel>Аренда</DetailStatLabel>
                            </DetailStatCard>
                            <DetailStatCard>
                                <DetailStatValue $color="#FF6B35">
                                    {bookings.filter(b => b.serviceType === 'сплав').length}
                                </DetailStatValue>
                                <DetailStatLabel>Сплав</DetailStatLabel>
                            </DetailStatCard>
                            <DetailStatCard>
                                <DetailStatValue $color="#52C41A">
                                    {Math.round(bookings.reduce((sum, booking) => {
                                        return sum + calculateBookingRevenue(booking, DEFAULT_PRICING);
                                    }, 0)).toLocaleString('ru-RU')}₽
                                </DetailStatValue>
                                <DetailStatLabel>Общий доход</DetailStatLabel>
                            </DetailStatCard>
                            <DetailStatCard>
                                <DetailStatValue $color="#FFD600">
                                    {bookings.reduce((sum, b) => sum + ((b.boardCount || 0) + (b.boardWithSeatCount || 0) + (b.raftCount || 0)), 0)}
                                </DetailStatValue>
                                <DetailStatLabel>Инвентарь</DetailStatLabel>
                            </DetailStatCard>
                        </DetailStatsGrid>
                    </Section>

                    {/* Временная шкала */}
                    <Section>
                        <SectionTitle>⏰ Загруженность по часам</SectionTitle>
                        <TimelineContainer>
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
                    </Section>

                    {/* Список записей */}
                    {bookings.length > 0 && (
                        <Section>
                            <SectionTitle>📋 Записи ({bookings.length})</SectionTitle>
                            <BookingsList>
                                {bookings.map(booking => {
                                    const inventory = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
                                    const duration = booking.serviceType === 'аренда' ? `${booking.durationInHours || 24}ч` : '4ч';
                                    const revenue = calculateBookingRevenue(booking, DEFAULT_PRICING);
                                    
                                    return (
                                        <BookingItem key={booking.id}>
                                            <ServiceIcon $type={booking.serviceType}>
                                                {booking.serviceType === 'аренда' ? 'А' : 'С'}
                                            </ServiceIcon>
                                            <BookingInfo>
                                                <BookingTime>
                                                    {format(parseISO(booking.plannedStartTime), 'HH:mm')}
                                                </BookingTime>
                                                <BookingDetails>
                                                    <span>{inventory} шт</span>
                                                    <span>•</span>
                                                    <span>{duration}</span>
                                                    <span>•</span>
                                                    <span>{booking.serviceType}</span>
                                                </BookingDetails>
                                                <BookingClient>
                                                    {booking.clientName}
                                                    {booking.phone && (
                                                        <span style={{ color: '#52C41A', marginLeft: '8px' }}>
                                                            📞 {booking.phone}
                                                        </span>
                                                    )}
                                                </BookingClient>
                                            </BookingInfo>
                                            <BookingRevenue>
                                                {Math.round(revenue).toLocaleString('ru-RU')}₽
                                            </BookingRevenue>
                                            {onEditBooking && (
                                                <button
                                                    onClick={() => {
                                                        onEditBooking(booking);
                                                        onClose();
                                                    }}
                                                    style={{
                                                        background: '#2C2C2E',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        color: '#86868B',
                                                        padding: '8px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </BookingItem>
                                    );
                                })}
                            </BookingsList>
                        </Section>
                    )}

                    {/* Информация о клиентах */}
                    {clients.length > 0 && (
                        <Section>
                            <SectionTitle>👥 Клиенты ({clients.length})</SectionTitle>
                            <ClientsGrid>
                                {clients.map((client, index) => (
                                    <ClientCard key={index}>
                                        <ClientName>{client.name}</ClientName>
                                        <ClientInfo>
                                            {client.phone && (
                                                <div>📞 {client.phone}</div>
                                            )}
                                            <div>📋 {client.bookings.length} записей</div>
                                            <div>💰 {Math.round(client.totalRevenue).toLocaleString('ru-RU')}₽</div>
                                            <div>📦 {client.totalInventory} единиц инвентаря</div>
                                        </ClientInfo>
                                    </ClientCard>
                                ))}
                            </ClientsGrid>
                        </Section>
                    )}

                    {/* Аналитика и рекомендации */}
                    <RecommendationsAnalysis
                        date={date}
                        statistics={statistics}
                        bookings={bookings}
                        pricingConfig={DEFAULT_PRICING}
                        canAcceptNewBookings={canAcceptNewBookings}
                        currentHour={currentHour}
                    />

                    {/* Кнопки действий */}
                    <ActionButtons>
                        <ActionButton
                            onClick={() => {
                                onAddBooking(date);
                                onClose();
                            }}
                            disabled={!canAcceptNewBookings || statistics.utilizationPercent > 95}
                        >
                            ➕ Добавить запись
                        </ActionButton>
                        <SecondaryButton onClick={onClose}>
                            Закрыть
                        </SecondaryButton>
                    </ActionButtons>
                </ModalBody>
            </ModalContent>
        </ModalOverlay>
    );
};

export default DayDetailsModal; 