import React from 'react';
import styled from 'styled-components';
import type { DayStatistics } from '@features/booking/utils/calendarUtils';
import { getUtilizationColor } from '@features/booking/utils/calendarUtils';
import { ServiceType } from '@/types/booking';

const IndicatorContainer = styled.div`
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    pointer-events: none;
    z-index: 10;
`;

const UtilizationBadge = styled.div<{ $color: string; $percent: number }>`
    background: ${({ $color }) => $color};
    color: ${({ $percent }) => $percent >= 70 ? '#fff' : '#000'};
    border-radius: 8px;
    padding: 2px 5px;
    font-size: 9px;
    font-weight: 700;
    min-width: 18px;
    text-align: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    
    /* Анимация пульсации для критической загрузки */
    ${({ $percent }) => $percent >= 90 && `
        animation: pulse 2s infinite;
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
        }
    `}
`;

const ServiceTypeIndicators = styled.div`
    display: flex;
    gap: 1px;
`;

const ServiceTypeIcon = styled.div<{ $type: ServiceType }>`
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: ${({ $type }) => 
        $type === 'аренда' ? '#007AFF' : '#FF6B35'
    };
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 6px;
    color: white;
    font-weight: bold;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
`;

const BookingCountBadge = styled.div`
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-radius: 6px;
    padding: 1px 3px;
    font-size: 8px;
    font-weight: 600;
    min-width: 14px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
`;

const ProgressBar = styled.div<{ $percent: number; $color: string }>`
    width: 20px;
    height: 2px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 1px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    
    &::after {
        content: '';
        display: block;
        width: ${({ $percent }) => $percent}%;
        height: 100%;
        background: ${({ $color }) => $color};
        transition: width 0.3s ease;
        box-shadow: 0 0 2px ${({ $color }) => $color}40;
    }
`;

interface DayStatusIndicatorProps {
    statistics: DayStatistics;
    compact?: boolean;
}

const DayStatusIndicator: React.FC<DayStatusIndicatorProps> = ({ 
    statistics, 
    compact = false 
}) => {
    const utilizationColor = getUtilizationColor(statistics.utilizationPercent);
    
    console.log('[DayStatusIndicator] Rendering:', {
        compact,
        utilizationPercent: statistics.utilizationPercent,
        bookedSlots: statistics.bookedSlots,
        serviceTypes: statistics.serviceTypes,
        utilizationColor,
        statistics
    });
    
    if (compact) {
        // Мобильная версия - только самое важное
        return (
            <IndicatorContainer>
                {statistics.utilizationPercent > 0 && (
                    <UtilizationBadge 
                        $color={utilizationColor} 
                        $percent={statistics.utilizationPercent}
                    >
                        {statistics.utilizationPercent}%
                    </UtilizationBadge>
                )}
                {statistics.bookedSlots > 0 && (
                    <BookingCountBadge>
                        {statistics.bookedSlots}
                    </BookingCountBadge>
                )}
            </IndicatorContainer>
        );
    }

    // Десктопная версия - полная информация
    return (
        <IndicatorContainer>
            {/* Основной индикатор загруженности */}
            {statistics.utilizationPercent > 0 && (
                <UtilizationBadge 
                    $color={utilizationColor} 
                    $percent={statistics.utilizationPercent}
                >
                    {statistics.utilizationPercent}%
                </UtilizationBadge>
            )}

            {/* Индикаторы типов услуг */}
            {statistics.serviceTypes.length > 0 && (
                <ServiceTypeIndicators>
                    {statistics.serviceTypes.map(type => (
                        <ServiceTypeIcon key={type} $type={type}>
                            {type === 'аренда' ? 'А' : 'С'}
                        </ServiceTypeIcon>
                    ))}
                </ServiceTypeIndicators>
            )}

            {/* Количество записей (только если больше 1) */}
            {statistics.bookedSlots > 1 && (
                <BookingCountBadge>
                    {statistics.bookedSlots}
                </BookingCountBadge>
            )}

            {/* Прогресс-бар всегда показываем */}
            <ProgressBar 
                $percent={statistics.utilizationPercent} 
                $color={utilizationColor} 
            />
        </IndicatorContainer>
    );
};

export default DayStatusIndicator; 