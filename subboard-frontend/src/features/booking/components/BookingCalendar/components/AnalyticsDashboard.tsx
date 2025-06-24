import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { DayStatistics, calculateBookingRevenue } from '../../../utils/calendarUtils';
import { Booking } from '../../../../../types/booking';
import { PricingConfig, ClientSearchResult } from '../../BookingForm/types';
import { clientsApi } from '../../../services/clientsApi';

interface AnalyticsDashboardProps {
    date: Date;
    statistics: DayStatistics;
    bookings: Booking[];
    pricingConfig: PricingConfig;
}

// 🎨 СТИЛИ ДЛЯ ИНТЕРАКТИВНОЙ АНАЛИТИКИ

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

const AnalyticsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
`;

const AnalyticsCard = styled.div`
    background: linear-gradient(135deg, #2C2C2E 0%, #3A3A3C 100%);
    border-radius: 12px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
`;

const AnalyticsTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: #86868B;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const AnalyticsValue = styled.div`
    font-size: 20px;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 4px;
`;

const AnalyticsDescription = styled.div`
    font-size: 12px;
    color: #86868B;
    line-height: 1.4;
`;

// 🆕 ИНТЕРАКТИВНЫЕ КОМПОНЕНТЫ

// Мини-график доходности по часам
const RevenueChart = styled.div`
    display: flex;
    align-items: end;
    height: 60px;
    gap: 2px;
    margin-top: 8px;
    padding: 0 4px;
`;

const RevenueBar = styled.div<{ $height: number; $isActive?: boolean }>`
    flex: 1;
    background: ${props => props.$isActive 
        ? 'linear-gradient(to top, #007AFF, #5AC8FA)' 
        : 'linear-gradient(to top, #3A3A3C, #48484A)'
    };
    height: ${props => Math.max(4, props.$height)}px;
    border-radius: 2px;
    transition: all 0.3s ease;
    cursor: pointer;
    position: relative;
    
    &:hover {
        background: linear-gradient(to top, #FFD600, #FF9500);
        transform: scaleY(1.1);
    }
    
    &::after {
        content: '';
        position: absolute;
        top: -2px;
        left: 0;
        right: 0;
        height: 2px;
        background: ${props => props.$isActive ? '#007AFF' : 'transparent'};
        border-radius: 1px;
    }
`;

// Круговая диаграмма
const ServicePieChart = styled.div`
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: conic-gradient(
        #007AFF 0deg,
        #007AFF var(--rent-angle, 180deg),
        #5AC8FA var(--rent-angle, 180deg),
        #5AC8FA 360deg
    );
    position: relative;
    margin: 8px auto;
    
    &::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 30px;
        height: 30px;
        background: #1C1C1E;
        border-radius: 50%;
        transform: translate(-50%, -50%);
    }
`;

// Прогресс-бар для KPI
const ProgressBar = styled.div`
    width: 100%;
    height: 8px;
    background: #3A3A3C;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 8px;
    position: relative;
`;

const ProgressFill = styled.div<{ $percentage: number; $color?: string }>`
    height: 100%;
    width: ${props => Math.min(100, Math.max(0, props.$percentage))}%;
    background: ${props => props.$color || 'linear-gradient(90deg, #007AFF, #5AC8FA)'};
    border-radius: 4px;
    transition: width 0.5s ease;
    position: relative;
    
    &::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 2px;
        height: 100%;
        background: rgba(255, 255, 255, 0.3);
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
    }
`;

// Тепловая карта эффективности времени
const HeatmapGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 2px;
    margin-top: 8px;
`;

const HeatmapCell = styled.div<{ $intensity: number }>`
    aspect-ratio: 1;
    border-radius: 2px;
    background: ${props => {
        const intensity = Math.min(1, Math.max(0, props.$intensity));
        if (intensity === 0) return '#2C2C2E';
        if (intensity < 0.3) return '#3A4A3A';
        if (intensity < 0.6) return '#4A6A4A';
        if (intensity < 0.8) return '#5A8A5A';
        return '#6AAA6A';
    }};
    transition: all 0.3s ease;
    cursor: pointer;
    position: relative;
    
    &:hover {
        transform: scale(1.2);
        z-index: 10;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
    
    &::after {
        content: '${props => Math.round(props.$intensity * 100)}%';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 8px;
        color: ${props => props.$intensity > 0.5 ? '#000' : '#FFF'};
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    &:hover::after {
        opacity: 1;
    }
`;

// Интерактивная карточка с анимацией
const InteractiveAnalyticsCard = styled(AnalyticsCard)`
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 122, 255, 0.15);
        border-color: rgba(0, 122, 255, 0.3);
    }
`;

// Легенда для диаграмм
const ChartLegend = styled.div`
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 8px;
    font-size: 12px;
`;

const LegendItem = styled.div<{ $color: string }>`
    display: flex;
    align-items: center;
    gap: 6px;
    color: #86868B;
    
    &::before {
        content: '';
        width: 12px;
        height: 12px;
        background: ${props => props.$color};
        border-radius: 2px;
    }
`;

// Tooltip для интерактивных элементов
const Tooltip = styled.div<{ $show: boolean; $x: number; $y: number }>`
    position: fixed;
    top: ${props => props.$y}px;
    left: ${props => props.$x}px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    z-index: 1000;
    opacity: ${props => props.$show ? 1 : 0};
    transition: opacity 0.2s ease;
    transform: translate(-50%, -100%);
    
    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.9);
    }
`;

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
    date,
    statistics,
    bookings,
    pricingConfig
}) => {
    // 🆕 Состояние для интерактивности
    const [tooltip, setTooltip] = React.useState<{
        show: boolean;
        x: number;
        y: number;
        content: string;
    }>({ show: false, x: 0, y: 0, content: '' });

    // 🆕 Состояние для данных клиентов из API
    const [clientsData, setClientsData] = useState<Map<string, ClientSearchResult>>(new Map());
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    // Обработчики для интерактивности
    const handleMouseEnter = (event: React.MouseEvent, content: string) => {
        setTooltip({
            show: true,
            x: event.clientX,
            y: event.clientY,
            content
        });
    };

    const handleMouseLeave = () => {
        setTooltip({ show: false, x: 0, y: 0, content: '' });
    };

    // 🆕 Загрузка данных клиентов из API
    useEffect(() => {
        const loadClientsData = async () => {
            if (bookings.length === 0) return;

            setIsLoadingClients(true);
            const newClientsData = new Map<string, ClientSearchResult>();

            try {
                // Получаем уникальные номера телефонов из бронирований
                const uniquePhones = Array.from(new Set(bookings.map(b => b.phone)));
                
                // Загружаем данные клиентов по номерам телефонов
                console.log('[AnalyticsDashboard] Загружаем данные для телефонов:', uniquePhones);
                
                for (const phone of uniquePhones) {
                    try {
                        // Ищем клиента по номеру телефона (используем часть номера для поиска)
                        // Берем последние 7 цифр и ищем по первым 3 из них
                        const cleanPhone = phone.replace(/\D/g, '');
                        const searchQuery = cleanPhone.slice(-7, -4); // например, из "79131771223" берем "177"
                        console.log(`[AnalyticsDashboard] Поиск клиента: phone=${phone}, cleanPhone=${cleanPhone}, searchQuery=${searchQuery}`);
                        
                        const response = await clientsApi.searchClients(searchQuery, 5);
                        console.log(`[AnalyticsDashboard] Результат поиска для ${phone}:`, response.data);
                        
                        // Находим точное совпадение по номеру телефона
                        const exactMatch = response.data.find(client => 
                            client.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
                        );
                        
                        if (exactMatch) {
                            console.log(`[AnalyticsDashboard] Найдено точное совпадение для ${phone}:`, exactMatch);
                            newClientsData.set(phone, exactMatch);
                        } else {
                            console.warn(`[AnalyticsDashboard] Точное совпадение не найдено для ${phone}`);
                        }
                    } catch (error) {
                        console.warn(`Не удалось загрузить данные для клиента с телефоном ${phone}:`, error);
                    }
                }

                console.log('[AnalyticsDashboard] Итоговые данные клиентов:', newClientsData);

                setClientsData(newClientsData);
            } catch (error) {
                console.error('Ошибка загрузки данных клиентов:', error);
            } finally {
                setIsLoadingClients(false);
            }
        };

        loadClientsData();
    }, [bookings]);

    // 🆕 Улучшенный анализ клиентов с данными из API
    const clientsAnalysis = () => {
        const clientsMap = new Map();
        console.log('[AnalyticsDashboard] Начинаем анализ клиентов. clientsData:', clientsData);
        
        bookings.forEach(booking => {
            const clientName = booking.clientName;
            if (!clientsMap.has(clientName)) {
                // Получаем данные клиента из API по номеру телефона
                const clientApiData = clientsData.get(booking.phone);
                console.log(`[AnalyticsDashboard] Клиент ${clientName} (${booking.phone}):`, {
                    clientApiData,
                    totalBookings: clientApiData?.totalBookings,
                    isVIP: clientApiData?.isVIP
                });
                
                clientsMap.set(clientName, {
                    name: clientName,
                    phone: booking.phone,
                    bookings: [],
                    totalRevenue: 0,
                    totalInventory: 0,
                    // 🎯 Используем данные из API клиентов (total_bookings_count из базы данных)
                    totalBookingsCount: clientApiData?.totalBookings || 1,
                    completedBookingsCount: 0, // пока считаем по текущим данным
                    isVip: clientApiData?.isVIP || false,
                    // Дополнительные данные из API
                    lastBookingDate: clientApiData?.lastBookingDate,
                    hasApiData: !!clientApiData
                });
            }
            
            const client = clientsMap.get(clientName);
            client.bookings.push(booking);
            client.totalRevenue += calculateBookingRevenue(booking, pricingConfig);
            client.totalInventory += (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
            
            // Пересчитываем только завершенные бронирования по текущим данным
            client.completedBookingsCount = client.bookings.filter((b: Booking) => b.status === 'completed').length;
        });
        
        return Array.from(clientsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    };

    // Расширенная аналитика
    const getAdvancedAnalytics = () => {
        const clients = clientsAnalysis();
        const totalRevenue = bookings.reduce((sum, booking) => sum + calculateBookingRevenue(booking, pricingConfig), 0);
        const totalInventory = bookings.reduce((sum, b) => sum + ((b.boardCount || 0) + (b.boardWithSeatCount || 0) + (b.raftCount || 0)), 0);
        const avgRevenuePerBooking = bookings.length > 0 ? totalRevenue / bookings.length : 0;

        // Эффективность использования инвентаря
        const totalSlots = statistics.timeSlots.length;
        const occupiedSlots = statistics.timeSlots.filter(slot => slot.booked > 0).length;
        const inventoryEfficiency = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

        // Анализ доходности по часам
        const revenueByHour = statistics.timeSlots.map(slot => {
            const hourBookings = slot.bookings || [];
            const hourRevenue = hourBookings.reduce((sum, booking) => 
                sum + calculateBookingRevenue(booking, pricingConfig), 0
            );
            return {
                hour: slot.hour,
                revenue: hourRevenue,
                bookingsCount: hourBookings.length,
                revenuePerBooking: hourBookings.length > 0 ? hourRevenue / hourBookings.length : 0
            };
        });

        const bestRevenueHour = revenueByHour.reduce((max, current) => 
            current.revenue > max.revenue ? current : max, { hour: 0, revenue: 0, bookingsCount: 0, revenuePerBooking: 0 }
        );

        // Конверсия времени
        const totalAvailableHours = statistics.timeSlots.reduce((sum, slot) => sum + slot.available + slot.booked, 0);
        const totalBookedHours = statistics.timeSlots.reduce((sum, slot) => sum + slot.booked, 0);
        const timeConversionRate = totalAvailableHours > 0 ? (totalBookedHours / totalAvailableHours) * 100 : 0;

        // Анализ типов услуг
        const serviceAnalysis = {
            rent: {
                count: bookings.filter(b => b.serviceType === 'аренда').length,
                revenue: bookings.filter(b => b.serviceType === 'аренда')
                    .reduce((sum, b) => sum + calculateBookingRevenue(b, pricingConfig), 0),
            },
            rafting: {
                count: bookings.filter(b => b.serviceType === 'сплав').length,
                revenue: bookings.filter(b => b.serviceType === 'сплав')
                    .reduce((sum, b) => sum + calculateBookingRevenue(b, pricingConfig), 0),
            }
        };

        // Прогноз загруженности
        const currentHour = new Date().getHours();
        const remainingHours = statistics.timeSlots.filter(slot => slot.hour > currentHour);
        const avgBookingsPerHour = bookings.length / statistics.timeSlots.length;
        const projectedBookings = Math.round(avgBookingsPerHour * remainingHours.length);

        // Анализ клиентского поведения (с учетом данных из API)
        const clientBehavior = {
            // Новые клиенты: у кого totalBookingsCount = 1 (из базы данных)
            newClients: clients.filter(c => c.totalBookingsCount === 1).length,
            // Возвращающиеся клиенты: у кого totalBookingsCount > 1 (из базы данных)
            returningClients: clients.filter(c => c.totalBookingsCount > 1).length,
            // VIP клиенты: по флагу из API
            vipClients: clients.filter(c => c.isVip).length,
            // Потенциальные VIP: высокий доход, но еще не VIP
            vipPotential: clients.filter(c => c.totalRevenue > 5000 && !c.isVip).length,
            // Клиенты с данными из API
            clientsWithApiData: clients.filter(c => c.hasApiData).length,
        };

        // 🔧 Исправленная оценка упущенной выгоды
        // Считаем максимальный потенциальный доход более реалистично
        const maxPossibleRevenue = statistics.timeSlots.reduce((sum, slot) => {
            // Максимальный доход = количество доступных досок * средний доход с доски
            // Предполагаем, что средний доход с доски = avgRevenuePerBooking (так как обычно 1 бронирование = 1 доска)
            const maxRevenueForSlot = slot.available * (avgRevenuePerBooking || 4000); // fallback 4000₽
            return sum + maxRevenueForSlot;
        }, 0);
        const missedRevenue = maxPossibleRevenue - totalRevenue;
        const revenueEfficiency = maxPossibleRevenue > 0 ? (totalRevenue / maxPossibleRevenue) * 100 : 0;

        // 🐛 Отладочная информация для упущенной выгоды
        console.log('📊 [MISSED REVENUE DEBUG]', {
            totalAvailableSlots: statistics.timeSlots.reduce((sum, slot) => sum + slot.available, 0),
            avgRevenuePerBooking: Math.round(avgRevenuePerBooking),
            maxPossibleRevenue: Math.round(maxPossibleRevenue),
            totalRevenue: Math.round(totalRevenue),
            missedRevenue: Math.round(missedRevenue),
            revenueEfficiency: Math.round(revenueEfficiency),
            timeSlots: statistics.timeSlots.map(slot => ({
                hour: slot.hour,
                available: slot.available,
                booked: slot.booked,
                potentialRevenue: slot.available * (avgRevenuePerBooking || 4000)
            }))
        });

        return {
            clients,
            totalRevenue,
            avgRevenuePerBooking,
            inventoryEfficiency,
            uniqueClients: clients.length,
            revenueByHour,
            bestRevenueHour,
            timeConversionRate,
            serviceAnalysis,
            projectedBookings,
            clientBehavior,
            missedRevenue,
            revenueEfficiency
        };
    };

    const analytics = getAdvancedAnalytics();

    return (
        <Section>
            <SectionTitle>📊 Интерактивная аналитика</SectionTitle>
            
            <AnalyticsGrid>
                {/* Средний чек с прогресс-баром */}
                <InteractiveAnalyticsCard
                    onMouseEnter={(e) => handleMouseEnter(e, `Средний чек: ${Math.round(analytics.avgRevenuePerBooking)}₽. Цель: 4000₽`)}
                    onMouseLeave={handleMouseLeave}
                >
                    <AnalyticsTitle>Средний чек</AnalyticsTitle>
                    <AnalyticsValue>{Math.round(analytics.avgRevenuePerBooking).toLocaleString('ru-RU')}₽</AnalyticsValue>
                    <AnalyticsDescription>На заказ • Цель: 4000₽+</AnalyticsDescription>
                    <ProgressBar>
                        <ProgressFill 
                            $percentage={(analytics.avgRevenuePerBooking / 4000) * 100}
                            $color={analytics.avgRevenuePerBooking >= 4000 ? 'linear-gradient(90deg, #52C41A, #73D13D)' : 'linear-gradient(90deg, #007AFF, #5AC8FA)'}
                        />
                    </ProgressBar>
                </InteractiveAnalyticsCard>
                
                {/* Эффективность инвентаря с тепловой картой */}
                <InteractiveAnalyticsCard
                    onMouseEnter={(e) => handleMouseEnter(e, `Эффективность: ${Math.round(analytics.inventoryEfficiency)}%. Цель: 80%+`)}
                    onMouseLeave={handleMouseLeave}
                >
                    <AnalyticsTitle>Эффективность инвентаря</AnalyticsTitle>
                    <AnalyticsValue>{Math.round(analytics.inventoryEfficiency)}%</AnalyticsValue>
                    <AnalyticsDescription>Временных слотов занято • Цель: 80%+</AnalyticsDescription>
                    <HeatmapGrid>
                        {statistics.timeSlots.map((slot, index) => {
                            const total = slot.available + slot.booked;
                            const intensity = total > 0 ? slot.booked / total : 0;
                            return (
                                <HeatmapCell
                                    key={index}
                                    $intensity={intensity}
                                    onMouseEnter={(e) => handleMouseEnter(e, `${slot.hour}:00 - ${Math.round(intensity * 100)}% загружен`)}
                                    onMouseLeave={handleMouseLeave}
                                />
                            );
                        })}
                    </HeatmapGrid>
                </InteractiveAnalyticsCard>
                
                {/* Клиентская база */}
                <InteractiveAnalyticsCard
                    onMouseEnter={(e) => handleMouseEnter(e, `${analytics.uniqueClients} уникальных клиентов, ${analytics.clientBehavior.returningClients} возвращающихся, ${analytics.clientBehavior.vipClients} VIP`)}
                    onMouseLeave={handleMouseLeave}
                >
                    <AnalyticsTitle>Клиентская база {isLoadingClients && '⏳'}</AnalyticsTitle>
                    <AnalyticsValue>{analytics.uniqueClients}</AnalyticsValue>
                    <AnalyticsDescription>
                        Уникальных • VIP: {analytics.clientBehavior.vipClients} • 
                        Возвращающихся: {analytics.clientBehavior.returningClients}
                    </AnalyticsDescription>
                    <ProgressBar>
                        <ProgressFill 
                            $percentage={analytics.uniqueClients > 0 ? (analytics.clientBehavior.returningClients / analytics.uniqueClients) * 100 : 0}
                            $color="linear-gradient(90deg, #FFD600, #FF9500)"
                        />
                    </ProgressBar>
                </InteractiveAnalyticsCard>
                
                {/* Доходность по часам с мини-графиком */}
                {analytics.revenueByHour.length > 0 && (
                    <InteractiveAnalyticsCard
                        onMouseEnter={(e) => handleMouseEnter(e, `Доходность по часам. Пик: ${analytics.bestRevenueHour.hour}:00`)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <AnalyticsTitle>Доходность по часам</AnalyticsTitle>
                        <AnalyticsValue>{Math.round(analytics.bestRevenueHour.revenue).toLocaleString('ru-RU')}₽</AnalyticsValue>
                        <AnalyticsDescription>Пиковый час: {analytics.bestRevenueHour.hour}:00</AnalyticsDescription>
                        <RevenueChart>
                            {analytics.revenueByHour.map((hourData, index) => {
                                const maxRevenue = Math.max(...analytics.revenueByHour.map(h => h.revenue));
                                const height = maxRevenue > 0 ? (hourData.revenue / maxRevenue) * 56 : 4;
                                const isActive = hourData.hour === analytics.bestRevenueHour.hour;
                                
                                return (
                                    <RevenueBar
                                        key={index}
                                        $height={height}
                                        $isActive={isActive}
                                        onMouseEnter={(e) => handleMouseEnter(e, `${hourData.hour}:00 - ${Math.round(hourData.revenue)}₽`)}
                                        onMouseLeave={handleMouseLeave}
                                    />
                                );
                            })}
                        </RevenueChart>
                    </InteractiveAnalyticsCard>
                )}
                
                {/* Конверсия времени */}
                <InteractiveAnalyticsCard
                    onMouseEnter={(e) => handleMouseEnter(e, `Конверсия времени: ${Math.round(analytics.timeConversionRate)}%. Оптимум: 75-85%`)}
                    onMouseLeave={handleMouseLeave}
                >
                    <AnalyticsTitle>Конверсия времени</AnalyticsTitle>
                    <AnalyticsValue>{Math.round(analytics.timeConversionRate)}%</AnalyticsValue>
                    <AnalyticsDescription>От доступного времени • Оптимум: 75-85%</AnalyticsDescription>
                    <ProgressBar>
                        <ProgressFill 
                            $percentage={analytics.timeConversionRate}
                            $color={
                                analytics.timeConversionRate >= 75 && analytics.timeConversionRate <= 85 
                                    ? 'linear-gradient(90deg, #52C41A, #73D13D)'
                                    : analytics.timeConversionRate > 85
                                    ? 'linear-gradient(90deg, #FF4D4F, #FF7875)'
                                    : 'linear-gradient(90deg, #FFD600, #FF9500)'
                            }
                        />
                    </ProgressBar>
                </InteractiveAnalyticsCard>
                
                {/* Эффективность доходов */}
                <InteractiveAnalyticsCard
                    onMouseEnter={(e) => handleMouseEnter(e, `Эффективность: ${Math.round(analytics.revenueEfficiency)}%. Упущено: ${Math.round(analytics.missedRevenue).toLocaleString('ru-RU')}₽ (от свободных досок)`)}
                    onMouseLeave={handleMouseLeave}
                >
                    <AnalyticsTitle>Эффективность доходов</AnalyticsTitle>
                    <AnalyticsValue>{Math.round(analytics.revenueEfficiency)}%</AnalyticsValue>
                    <AnalyticsDescription>От максимального потенциала • Упущено: {Math.round(analytics.missedRevenue).toLocaleString('ru-RU')}₽</AnalyticsDescription>
                    <ProgressBar>
                        <ProgressFill 
                            $percentage={analytics.revenueEfficiency}
                            $color={
                                analytics.revenueEfficiency >= 80 
                                    ? 'linear-gradient(90deg, #52C41A, #73D13D)'
                                    : analytics.revenueEfficiency >= 60
                                    ? 'linear-gradient(90deg, #FFD600, #FF9500)'
                                    : 'linear-gradient(90deg, #FF4D4F, #FF7875)'
                            }
                        />
                    </ProgressBar>
                </InteractiveAnalyticsCard>
                
                {/* Новые клиенты */}
                <InteractiveAnalyticsCard
                    onMouseEnter={(e) => handleMouseEnter(e, `${analytics.clientBehavior.newClients} новых из ${analytics.uniqueClients}. VIP потенциал: ${analytics.clientBehavior.vipPotential}`)}
                    onMouseLeave={handleMouseLeave}
                >
                    <AnalyticsTitle>Новые клиенты</AnalyticsTitle>
                    <AnalyticsValue>{analytics.clientBehavior.newClients}</AnalyticsValue>
                    <AnalyticsDescription>Из {analytics.uniqueClients} общих • VIP потенциал: {analytics.clientBehavior.vipPotential}</AnalyticsDescription>
                    <ProgressBar>
                        <ProgressFill 
                            $percentage={analytics.uniqueClients > 0 ? (analytics.clientBehavior.newClients / analytics.uniqueClients) * 100 : 0}
                            $color="linear-gradient(90deg, #5AC8FA, #007AFF)"
                        />
                    </ProgressBar>
                </InteractiveAnalyticsCard>
                
                {/* Баланс услуг с круговой диаграммой */}
                {(analytics.serviceAnalysis.rent.revenue + analytics.serviceAnalysis.rafting.revenue) > 0 && (
                    <InteractiveAnalyticsCard
                        onMouseEnter={(e) => handleMouseEnter(e, `Аренда: ${Math.round((analytics.serviceAnalysis.rent.revenue / (analytics.serviceAnalysis.rent.revenue + analytics.serviceAnalysis.rafting.revenue)) * 100)}%, Сплав: ${Math.round((analytics.serviceAnalysis.rafting.revenue / (analytics.serviceAnalysis.rent.revenue + analytics.serviceAnalysis.rafting.revenue)) * 100)}%`)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <AnalyticsTitle>Баланс услуг</AnalyticsTitle>
                        <AnalyticsValue>{Math.round((analytics.serviceAnalysis.rent.revenue / (analytics.serviceAnalysis.rent.revenue + analytics.serviceAnalysis.rafting.revenue)) * 100)}%</AnalyticsValue>
                        <AnalyticsDescription>Аренда от общего дохода</AnalyticsDescription>
                        <ServicePieChart 
                            style={{
                                '--rent-angle': `${(analytics.serviceAnalysis.rent.revenue / (analytics.serviceAnalysis.rent.revenue + analytics.serviceAnalysis.rafting.revenue)) * 360}deg`
                            } as React.CSSProperties}
                        />
                        <ChartLegend>
                            <LegendItem $color="#007AFF">Аренда</LegendItem>
                            <LegendItem $color="#5AC8FA">Сплав</LegendItem>
                        </ChartLegend>
                    </InteractiveAnalyticsCard>
                )}
                
                {/* Прогноз на день */}
                {analytics.projectedBookings > 0 && (
                    <InteractiveAnalyticsCard
                        onMouseEnter={(e) => handleMouseEnter(e, `Прогноз: +${analytics.projectedBookings} заказов на основе текущих трендов`)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <AnalyticsTitle>Прогноз на день</AnalyticsTitle>
                        <AnalyticsValue>+{analytics.projectedBookings}</AnalyticsValue>
                        <AnalyticsDescription>Ожидаемых заказов • На основе текущих трендов</AnalyticsDescription>
                        <ProgressBar>
                            <ProgressFill 
                                $percentage={Math.min(100, (analytics.projectedBookings / 10) * 100)}
                                $color="linear-gradient(90deg, #73D13D, #52C41A)"
                            />
                        </ProgressBar>
                    </InteractiveAnalyticsCard>
                )}
            </AnalyticsGrid>
            
            {/* Интерактивный tooltip */}
            <Tooltip 
                $show={tooltip.show} 
                $x={tooltip.x} 
                $y={tooltip.y}
            >
                {tooltip.content}
            </Tooltip>
        </Section>
    );
};

export default AnalyticsDashboard; 