import React from 'react';
import styled from 'styled-components';
import { DayStatistics, calculateBookingRevenue } from '../../../utils/calendarUtils';
import { Booking } from '../../../../../types/booking';
import { PricingConfig } from '../../BookingForm/types';

interface RecommendationsPanelProps {
    date: Date;
    statistics: DayStatistics;
    bookings: Booking[];
    pricingConfig: PricingConfig;
    canAcceptNewBookings: boolean;
    currentHour: number;
}

interface RecommendationWithPriority {
    text: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
}

// 🎨 СТИЛИ ДЛЯ РЕКОМЕНДАЦИЙ

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

const RecommendationsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const RecommendationItem = styled.div<{ $priority?: 'high' | 'medium' | 'low' }>`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    font-size: 14px;
    line-height: 1.5;
    color: #FFFFFF;
    border-left: 4px solid ${props => {
        switch (props.$priority) {
            case 'high': return '#FF4D4F';
            case 'medium': return '#FFD600';
            case 'low': return '#52C41A';
            default: return '#007AFF';
        }
    }};
    position: relative;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    }
`;

const RecommendationCategory = styled.div`
    margin-bottom: 16px;
`;

const CategoryTitle = styled.h4`
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
    date,
    statistics,
    bookings,
    pricingConfig,
    canAcceptNewBookings,
    currentHour
}) => {
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
            client.totalRevenue += calculateBookingRevenue(booking, pricingConfig);
            client.totalInventory += (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
        });
        
        return Array.from(clientsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    };

    // Расширенная аналитика для рекомендаций
    const getAnalyticsForRecommendations = () => {
        const clients = clientsAnalysis();
        const totalRevenue = bookings.reduce((sum, booking) => sum + calculateBookingRevenue(booking, pricingConfig), 0);
        const avgRevenuePerBooking = bookings.length > 0 ? totalRevenue / bookings.length : 0;

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
            };
        });

        const bestRevenueHour = revenueByHour.reduce((max, current) => 
            current.revenue > max.revenue ? current : max, { hour: 0, revenue: 0, bookingsCount: 0 }
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

        // Анализ клиентского поведения
        const clientBehavior = {
            newClients: clients.filter(c => c.bookings.length === 1).length,
            returningClients: clients.filter(c => c.bookings.length > 1).length,
            vipPotential: clients.filter(c => c.totalRevenue > 5000).length,
        };

        // Оценка упущенной выгоды
        const maxPossibleRevenue = statistics.timeSlots.reduce((sum, slot) => {
            const totalSlots = slot.available + slot.booked;
            return sum + (totalSlots * avgRevenuePerBooking);
        }, 0);
        const missedRevenue = maxPossibleRevenue - totalRevenue;
        const revenueEfficiency = maxPossibleRevenue > 0 ? (totalRevenue / maxPossibleRevenue) * 100 : 0;

        // Эффективность использования инвентаря
        const totalSlots = statistics.timeSlots.length;
        const occupiedSlots = statistics.timeSlots.filter(slot => slot.booked > 0).length;
        const inventoryEfficiency = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

        return {
            clients,
            totalRevenue,
            avgRevenuePerBooking,
            uniqueClients: clients.length,
            bestRevenueHour,
            timeConversionRate,
            serviceAnalysis,
            projectedBookings,
            clientBehavior,
            missedRevenue,
            revenueEfficiency,
            inventoryEfficiency
        };
    };

    // Генерация умных рекомендаций с приоритетами
    const generateRecommendations = (): RecommendationWithPriority[] => {
        const recommendations: RecommendationWithPriority[] = [];
        const analytics = getAnalyticsForRecommendations();
        const utilizationPercent = statistics.utilizationPercent;
        const rentCount = bookings.filter(b => b.serviceType === 'аренда').length;
        const raftingCount = bookings.filter(b => b.serviceType === 'сплав').length;
        
        // Анализ доступности
        const availableSlots = statistics.timeSlots.filter(slot => slot.available > 0);
        const totalAvailable = statistics.timeSlots.reduce((sum, slot) => sum + slot.available, 0);
        
        // Анализ непрерывных блоков для сплавов
        const continuousBlocks = [];
        let currentBlock = [];
        
        for (let i = 0; i < statistics.timeSlots.length; i++) {
            const slot = statistics.timeSlots[i];
            if (slot.available > 0) {
                currentBlock.push(slot);
            } else {
                if (currentBlock.length >= 5) {
                    continuousBlocks.push([...currentBlock]);
                }
                currentBlock = [];
            }
        }
        if (currentBlock.length >= 5) {
            continuousBlocks.push(currentBlock);
        }

        // 🎨 КРИТИЧЕСКИЕ РЕКОМЕНДАЦИИ (HIGH PRIORITY)
        if (!canAcceptNewBookings) {
            if (currentHour >= 23) {
                recommendations.push({
                    text: '🔴 Рабочий день завершен (23:00) - новые бронирования недоступны до завтра. Подготовьте план на следующий день.',
                    priority: 'high',
                    category: 'Рабочее время'
                });
            } else if (currentHour < 9) {
                recommendations.push({
                    text: '🔴 Рабочий день еще не начался (с 9:00) - подготовьте инвентарь и проверьте готовность оборудования.',
                    priority: 'high',
                    category: 'Рабочее время'
                });
            }
        }

        if (canAcceptNewBookings && totalAvailable === 0) {
            recommendations.push({
                text: '🔴 День полностью загружен - рассмотрите возможность переноса заказов на другие дни или увеличение цен на 20-30%.',
                priority: 'high',
                category: 'Загруженность'
            });
        }

        // Рекомендации по конверсии времени
        if (analytics.timeConversionRate < 50) {
            recommendations.push({
                text: `⏰ Низкая конверсия времени (${Math.round(analytics.timeConversionRate)}%) - много свободного времени не используется. Проведите маркетинговую кампанию или снизьте цены для привлечения клиентов.`,
                priority: 'high',
                category: 'Конверсия'
            });
        }

        // Рекомендации по эффективности доходов
        if (analytics.revenueEfficiency < 60) {
            recommendations.push({
                text: `💸 Низкая эффективность доходов (${Math.round(analytics.revenueEfficiency)}%) - упущено ${Math.round(analytics.missedRevenue).toLocaleString('ru-RU')}₽. Оптимизируйте ценообразование и загрузку.`,
                priority: 'high',
                category: 'Доходность'
            });
        }

        // 🟡 РЕКОМЕНДАЦИИ СРЕДНЕЙ ВАЖНОСТИ (MEDIUM PRIORITY)
        if (canAcceptNewBookings) {
            if (continuousBlocks.length === 0 && availableSlots.length > 0) {
                const availableHours = availableSlots.map(s => `${s.hour}:00`).join(', ');
                recommendations.push({
                    text: `🟡 Сплавы невозможны (нужно 5ч подряд). Доступно для аренды: ${availableHours}. Акцентируйте продажи на аренде.`,
                    priority: 'medium',
                    category: 'Услуги'
                });
            } else if (continuousBlocks.length > 0) {
                const bestBlock = continuousBlocks[0];
                const startHour = bestBlock[0].hour;
                const endHour = bestBlock[bestBlock.length - 1].hour + 1;
                recommendations.push({
                    text: `🟢 Оптимальное время для сплава: ${startHour}:00-${endHour}:00 (${bestBlock.length} часов подряд). Активно предлагайте сплавы в это время.`,
                    priority: 'medium',
                    category: 'Услуги'
                });
            }
        }

        // Рекомендации по ценообразованию
        if (canAcceptNewBookings) {
            if (utilizationPercent > 90) {
                recommendations.push({
                    text: `💰 Очень высокий спрос (${utilizationPercent}%) - рекомендуется повысить цены на 15-20% для максимизации прибыли. Текущий доход: ${Math.round(analytics.totalRevenue).toLocaleString('ru-RU')}₽`,
                    priority: 'medium',
                    category: 'Ценообразование'
                });
            } else if (utilizationPercent < 30) {
                recommendations.push({
                    text: `📉 Низкая загруженность (${utilizationPercent}%) - рассмотрите скидки 10-15% или акционные предложения для привлечения клиентов.`,
                    priority: 'medium',
                    category: 'Ценообразование'
                });
            }
        }

        // Анализ клиентской базы
        if (analytics.uniqueClients > 3) {
            recommendations.push({
                text: `👥 Много клиентов (${analytics.uniqueClients}) - день с высокой социальной активностью. Обеспечьте дополнительный персонал и следите за качеством обслуживания.`,
                priority: 'medium',
                category: 'Обслуживание'
            });
        } else if (analytics.uniqueClients === 1 && analytics.totalRevenue > 8000) {
            recommendations.push({
                text: `💎 Крупный клиент на весь день (${Math.round(analytics.totalRevenue).toLocaleString('ru-RU')}₽) - обеспечьте VIP обслуживание и предложите дополнительные услуги.`,
                priority: 'medium',
                category: 'VIP обслуживание'
            });
        }

        // Рекомендации по инвентарю
        const peakSlots = statistics.timeSlots.filter(slot => {
            const total = slot.available + slot.booked;
            return total > 0 && (slot.booked / total) > 0.8;
        });
        
        if (peakSlots.length > 0) {
            const peakTimes = peakSlots.map(s => `${s.hour}:00`).join(', ');
            recommendations.push({
                text: `⚠️ Пиковая загрузка в ${peakTimes} - подготовьте резервный инвентарь и дополнительный персонал. Эффективность использования: ${Math.round(analytics.inventoryEfficiency)}%`,
                priority: 'medium',
                category: 'Инвентарь'
            });
        }

        // Аналитика эффективности
        if (analytics.avgRevenuePerBooking < 3000) {
            recommendations.push({
                text: `📊 Низкий средний чек (${Math.round(analytics.avgRevenuePerBooking).toLocaleString('ru-RU')}₽/заказ) - рассмотрите возможность предложения дополнительных услуг или увеличения продолжительности аренды.`,
                priority: 'medium',
                category: 'Эффективность'
            });
        }

        // Рекомендации по конверсии времени
        if (analytics.timeConversionRate > 90) {
            recommendations.push({
                text: `🔥 Очень высокая конверсия времени (${Math.round(analytics.timeConversionRate)}%) - возможно перегрузка. Рассмотрите повышение цен или расширение инвентаря.`,
                priority: 'medium',
                category: 'Конверсия'
            });
        }

        // Рекомендации по самому доходному часу
        if (analytics.bestRevenueHour.revenue > 0) {
            const revenueShare = (analytics.bestRevenueHour.revenue / analytics.totalRevenue) * 100;
            if (revenueShare > 40) {
                recommendations.push({
                    text: `⭐ Час ${analytics.bestRevenueHour.hour}:00 приносит ${Math.round(revenueShare)}% дневного дохода (${Math.round(analytics.bestRevenueHour.revenue).toLocaleString('ru-RU')}₽). Усильте маркетинг на это время и подготовьте лучший сервис.`,
                    priority: 'medium',
                    category: 'Пиковые часы'
                });
            }
        }

        // Рекомендации по балансу услуг
        if (analytics.serviceAnalysis.rent.count > 0 && analytics.serviceAnalysis.rafting.count > 0) {
            const rentShare = (analytics.serviceAnalysis.rent.revenue / analytics.totalRevenue) * 100;
            if (rentShare > 80) {
                recommendations.push({
                    text: `🏠 Аренда доминирует (${Math.round(rentShare)}% дохода) - диверсифицируйте предложения. Активно продвигайте сплавы для снижения рисков.`,
                    priority: 'medium',
                    category: 'Диверсификация'
                });
            } else if (rentShare < 20) {
                recommendations.push({
                    text: `🌊 Сплавы доминируют (${Math.round(100 - rentShare)}% дохода) - развивайте аренду для стабильного дохода и менее зависимой от погоды бизнес-модели.`,
                    priority: 'medium',
                    category: 'Диверсификация'
                });
            }
        }

        // Рекомендации по новым клиентам
        if (analytics.clientBehavior.returningClients > analytics.clientBehavior.newClients * 2) {
            recommendations.push({
                text: `🔄 Много постоянных клиентов (${analytics.clientBehavior.returningClients}) - стабильная база! Но нужно привлекать новых клиентов для роста.`,
                priority: 'medium',
                category: 'Клиентская база'
            });
        }

        // Прогнозные рекомендации
        if (analytics.projectedBookings > 0) {
            const currentBookings = bookings.length;
            const growthPotential = currentBookings > 0 ? (analytics.projectedBookings / currentBookings) * 100 : 0;
            
            if (growthPotential > 50) {
                recommendations.push({
                    text: `📈 Прогноз показывает потенциал роста на ${Math.round(growthPotential)}% (+${analytics.projectedBookings} заказов). Подготовьте дополнительный инвентарь и персонал.`,
                    priority: 'medium',
                    category: 'Прогнозирование'
                });
            } else if (growthPotential < 10) {
                recommendations.push({
                    text: `📉 Низкий прогноз роста (${Math.round(growthPotential)}%) - активизируйте продажи или проведите акции для привлечения клиентов.`,
                    priority: 'medium',
                    category: 'Прогнозирование'
                });
            }
        }

        // 🟢 ИНФОРМАЦИОННЫЕ РЕКОМЕНДАЦИИ (LOW PRIORITY)
        if (canAcceptNewBookings) {
            if (rentCount === 0 && raftingCount > 0) {
                recommendations.push({
                    text: `🏠 В этот день только сплавы (${raftingCount}) - активно предлагайте аренду постоянным клиентам для увеличения дохода.`,
                    priority: 'low',
                    category: 'Баланс услуг'
                });
            } else if (raftingCount === 0 && rentCount > 0) {
                recommendations.push({
                    text: `🌊 В этот день только аренда (${rentCount}) - рекламируйте сплавы в социальных сетях для привлечения новых клиентов.`,
                    priority: 'low',
                    category: 'Баланс услуг'
                });
            } else if (rentCount === 0 && raftingCount === 0) {
                recommendations.push({
                    text: '📅 Свободный день - отличная возможность для проведения акций, технического обслуживания оборудования и привлечения новых клиентов.',
                    priority: 'low',
                    category: 'Стратегия'
                });
            }
        }

        if (utilizationPercent > 70 && utilizationPercent <= 90) {
            recommendations.push({
                text: `📈 Хорошая загруженность (${utilizationPercent}%) - текущие цены оптимальны. Рассмотрите небольшое повышение на популярные услуги (+5-10%).`,
                priority: 'low',
                category: 'Ценообразование'
            });
        }

        // Аналитика эффективности
        if (analytics.avgRevenuePerBooking > 5000) {
            recommendations.push({
                text: `💰 Высокий средний чек (${Math.round(analytics.avgRevenuePerBooking).toLocaleString('ru-RU')}₽/заказ) - отличная работа! Продолжайте фокусироваться на премиальных услугах.`,
                priority: 'low',
                category: 'Эффективность'
            });
        }

        if (analytics.revenueEfficiency > 85) {
            recommendations.push({
                text: `🎯 Отличная эффективность доходов (${Math.round(analytics.revenueEfficiency)}%) - вы близки к максимальному потенциалу! Поддерживайте текущую стратегию.`,
                priority: 'low',
                category: 'Доходность'
            });
        }

        // Рекомендации по новым клиентам
        if (analytics.clientBehavior.newClients > analytics.clientBehavior.returningClients) {
            recommendations.push({
                text: `🆕 Много новых клиентов (${analytics.clientBehavior.newClients} из ${analytics.uniqueClients}) - отличная возможность для создания программы лояльности и удержания клиентов.`,
                priority: 'low',
                category: 'Клиентская база'
            });
        }

        // Рекомендации по VIP потенциалу
        if (analytics.clientBehavior.vipPotential > 0) {
            const vipShare = (analytics.clientBehavior.vipPotential / analytics.uniqueClients) * 100;
            if (vipShare > 30) {
                recommendations.push({
                    text: `💎 Высокий VIP потенциал (${analytics.clientBehavior.vipPotential} клиентов, ${Math.round(vipShare)}%) - создайте премиум программу с эксклюзивными предложениями.`,
                    priority: 'low',
                    category: 'VIP программа'
                });
            }
        }

        return recommendations.slice(0, 12); // Ограничиваем количество рекомендаций
    };

    const recommendations = generateRecommendations();

    // Группируем рекомендации по категориям
    const groupedRecommendations = recommendations.reduce((acc, rec) => {
        if (!acc[rec.category]) {
            acc[rec.category] = [];
        }
        acc[rec.category].push(rec);
        return acc;
    }, {} as Record<string, RecommendationWithPriority[]>);

    return (
        <Section>
            <SectionTitle>💡 Умные рекомендации</SectionTitle>
            
            <RecommendationsList>
                {Object.entries(groupedRecommendations).map(([category, recs]) => (
                    <RecommendationCategory key={category}>
                        <CategoryTitle>
                            {category === 'Рабочее время' && '⏰'}
                            {category === 'Загруженность' && '📊'}
                            {category === 'Услуги' && '🛥️'}
                            {category === 'Ценообразование' && '💰'}
                            {category === 'Баланс услуг' && '⚖️'}
                            {category === 'Стратегия' && '🎯'}
                            {category === 'Обслуживание' && '👥'}
                            {category === 'VIP обслуживание' && '💎'}
                            {category === 'Инвентарь' && '📦'}
                            {category === 'Эффективность' && '📈'}
                            {category === 'Конверсия' && '⏰'}
                            {category === 'Доходность' && '💸'}
                            {category === 'Пиковые часы' && '⭐'}
                            {category === 'Диверсификация' && '🔄'}
                            {category === 'Клиентская база' && '👥'}
                            {category === 'VIP программа' && '💎'}
                            {category === 'Прогнозирование' && '🔮'}
                            {category}
                        </CategoryTitle>
                        {recs.map((rec, index) => (
                            <RecommendationItem key={index} $priority={rec.priority}>
                                {rec.text}
                            </RecommendationItem>
                        ))}
                    </RecommendationCategory>
                ))}
            </RecommendationsList>
        </Section>
    );
};

export default RecommendationsPanel; 