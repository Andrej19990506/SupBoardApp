import React from 'react';
import styled from 'styled-components';
import { DayStatistics } from '../../../utils/calendarUtils';
import { Booking } from '../../../../../types/booking';
import { PricingConfig } from '../../BookingForm/types';
import AnalyticsDashboard from './AnalyticsDashboard';
import RecommendationsPanel from './RecommendationsPanel';

/**
 * ПЛАН РАЗВИТИЯ СИСТЕМЫ АНАЛИТИКИ
 * 
 * 🎯 ЭТАП 1: Расширенная аналитика (ЗАВЕРШЕН ✅)
 * ✅ Базовые метрики (средний чек, эффективность, клиенты)
 * ✅ Конверсия времени и эффективность доходов
 * ✅ Анализ клиентского поведения и прогнозирование
 * ✅ 12 категорий умных рекомендаций с приоритетами
 * 
 * 🎯 ЭТАП 2: Интерактивная визуализация (ЗАВЕРШЕН ✅)
 * ✅ Мини-графики доходности по часам
 * ✅ Круговая диаграмма баланса услуг
 * ✅ Прогресс-бары для KPI метрик
 * ✅ Тепловая карта эффективности времени
 * ✅ Интерактивные элементы с hover эффектами
 * ✅ Модульная архитектура (AnalyticsDashboard + RecommendationsPanel)
 * 
 * 🎯 ЭТАП 3: Сравнительная аналитика (СЛЕДУЮЩИЙ)
 * - Сравнение с предыдущими днями/неделями
 * - Тренды и сезонность
 * - Бенчмарки и целевые показатели
 * - Отклонения от нормы
 * 
 * 🎯 ЭТАП 4: Машинное обучение
 * - Предсказание спроса на основе исторических данных
 * - Оптимальное ценообразование с помощью ML
 * - Сегментация клиентов по поведению
 * - Автоматическое выявление аномалий
 * 
 * 🎯 ЭТАП 5: Интеграция с внешними данными
 * - Погодные условия и их влияние на спрос
 * - Праздники и события в городе
 * - Конкурентный анализ цен
 * - Социальные медиа и отзывы
 * 
 * 🎯 ЭТАП 6: Продвинутые рекомендации
 * - Персонализированные предложения для клиентов
 * - Оптимизация расписания персонала
 * - Автоматическое управление инвентарем
 * - Динамическое ценообразование
 * 
 * 🎯 ЭТАП 7: Экспорт и интеграции
 * - Экспорт отчетов в PDF/Excel
 * - API для интеграции с CRM
 * - Уведомления и алерты
 * - Мобильное приложение для аналитики
 */

interface RecommendationsAnalysisProps {
    date: Date;
    statistics: DayStatistics;
    bookings: Booking[];
    pricingConfig: PricingConfig;
    canAcceptNewBookings: boolean;
    currentHour: number;
}

// Контейнер для компонентов аналитики
const AnalyticsContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 32px;
`;

const RecommendationsAnalysis: React.FC<RecommendationsAnalysisProps> = ({
    date,
    statistics,
    bookings,
    pricingConfig,
    canAcceptNewBookings,
    currentHour
}) => {
    return (
        <AnalyticsContainer>
            {/* Интерактивная аналитика с визуализациями */}
            <AnalyticsDashboard
                date={date}
                statistics={statistics}
                bookings={bookings}
                pricingConfig={pricingConfig}
            />
            
            {/* Умные рекомендации по категориям */}
            <RecommendationsPanel
                date={date}
                statistics={statistics}
                bookings={bookings}
                pricingConfig={pricingConfig}
                canAcceptNewBookings={canAcceptNewBookings}
                currentHour={currentHour}
            />
        </AnalyticsContainer>
    );
};

export default RecommendationsAnalysis; 