import React, { useState, useEffect, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { openWeatherTooltip, closeWeatherTooltip, updateWeatherData } from '../../../store/slices/notifications-slice/notificationsSlice';

// Добавляем действие для управления состоянием тултипа погоды
interface WeatherTooltipState {
    isOpen: boolean;
    weatherData: WeatherData | null;
}

// CSS анимации для тултипа
const GlobalStyle = createGlobalStyle`
    @keyframes fadeInScale {
        0% {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
        }
        100% {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
`;

interface WeatherData {
    temperature?: number;
    windSpeed?: number;
    condition?: string;
    location?: string;
    precipitation?: number; // мм/ч
    rain?: number; // мм/ч
    snowfall?: number; // см/ч
    humidity?: number; // %
    isLoading?: boolean;
    error?: string;
}

const WeatherContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    min-width: 0;
    max-width: 200px;
    box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    
    /* Мобильная адаптация */
    @media (max-width: 480px) {
        gap: 4px;
        padding: 4px 8px;
        border-radius: 8px;
        max-width: 120px;
        min-width: 100px;
    }
    
    @media (max-width: 360px) {
        gap: 3px;
        padding: 3px 6px;
        max-width: 100px;
        min-width: 80px;
    }
    
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
        pointer-events: none;
    }
    
    &:hover {
        background: linear-gradient(135deg, rgba(58, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
        border-color: rgba(59, 130, 246, 0.3);
        transform: translateY(-1px);
        box-shadow: 
            0 6px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        
        &::before {
            left: 100%;
        }
        
        @media (max-width: 480px) {
            transform: none; /* Отключаем анимацию на мобильных */
        }
    }
    
    &:active {
        transform: translateY(0);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
`;

const WeatherIcon = styled.div`
    font-size: 16px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    flex-shrink: 0;
    
    @media (max-width: 480px) {
        font-size: 14px;
    }
    
    @media (max-width: 360px) {
        font-size: 12px;
    }
`;

const WeatherInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    overflow: hidden;
    
    @media (max-width: 480px) {
        gap: 0;
    }
`;

const Temperature = styled.div`
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    
    @media (max-width: 480px) {
        font-size: 11px;
    }
    
    @media (max-width: 360px) {
        font-size: 10px;
    }
`;

const Details = styled.div`
    font-size: 9px;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    
    @media (max-width: 480px) {
        font-size: 8px;
    }
    
    @media (max-width: 360px) {
        font-size: 7px;
        display: none; /* Скрываем детали на очень маленьких экранах */
    }
`;

const LoadingText = styled.div`
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
    
    @media (max-width: 480px) {
        font-size: 9px;
    }
    
    @media (max-width: 360px) {
        font-size: 8px;
    }
`;

const WeatherTooltip = styled.div`
    width: 380px;
    max-height: 80vh; /* Ограничиваем высоту 80% от высоты экрана */
    background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    backdrop-filter: blur(20px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
    color: #ffffff;
    overflow: hidden;
    animation: fadeInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    display: flex;
    flex-direction: column;
    
    /* Мобильная адаптация тултипа */
    @media (max-width: 480px) {
        width: calc(100vw - 20px);
        max-width: 360px;
        max-height: 85vh;
        border-radius: 12px;
    }
    
    @media (max-width: 360px) {
        width: calc(100vw - 16px);
        max-width: 340px;
        max-height: 90vh;
        border-radius: 10px;
    }
`;

const TooltipHeader = styled.div`
    padding: 20px 24px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    @media (max-width: 480px) {
        padding: 16px 20px;
    }
    
    @media (max-width: 360px) {
        padding: 14px 16px;
    }
`;

const TooltipTitle = styled.h3`
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    
    &:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
    }
`;

const TooltipContent = styled.div`
    padding: 20px 24px;
    overflow-y: auto;
    flex: 1;
    
    @media (max-width: 480px) {
        padding: 16px 20px;
    }
    
    @media (max-width: 360px) {
        padding: 14px 16px;
    }
    
    /* Кастомный скролл */
    &::-webkit-scrollbar {
        width: 6px;
        
        @media (max-width: 480px) {
            width: 4px;
        }
    }
    
    &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        
        &:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    }
`;

const WeatherSection = styled.div`
    margin-bottom: 24px;
`;

const WeatherMainInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
`;

const WeatherIconLarge = styled.div`
    font-size: 48px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
`;

const WeatherDetails = styled.div`
    flex: 1;
`;

const WeatherTemperature = styled.div`
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 4px;
`;

const WeatherCondition = styled.div`
    font-size: 16px;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 4px;
`;

const WeatherLocation = styled.div`
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
`;

const WeatherGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
`;

const WeatherCard = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
`;

const WeatherCardTitle = styled.div`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const WeatherCardValue = styled.div`
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
`;

const RecommendationsSection = styled.div`
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
    margin-bottom: 20px;
`;

const RecommendationsTitle = styled.h4`
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const RecommendationItem = styled.div<{ $priority?: 'high' | 'medium' | 'low' }>`
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    font-size: 13px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.9);
    border-left: 3px solid ${props => {
        switch (props.$priority) {
            case 'high': return '#FF4D4F';
            case 'medium': return '#FFD600';
            case 'low': return '#52C41A';
            default: return '#007AFF';
        }
    }};
`;

const RefreshButton = styled.button`
    width: 100%;
    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
    border: none;
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    
    &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(0, 122, 255, 0.4);
    }
    
    &:active {
        transform: translateY(0);
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }
`;

interface WeatherTooltipProps {
    weatherData: WeatherData;
    onRefresh: () => void;
    onClose: () => void;
}

interface WeatherRecommendation {
    text: string;
    priority: 'high' | 'medium' | 'low';
    icon: string;
}

// Компонент тултипа с погодными рекомендациями
const WeatherTooltipComponent: React.FC<WeatherTooltipProps> = ({ weatherData, onRefresh, onClose }) => {
    // Данные успешно получены
    
    // Генерация иконки погоды
    const getWeatherIcon = (condition: string, temperature?: number): string => {
        const lowerCondition = condition.toLowerCase();
        if (lowerCondition.includes('ясно')) return '☀️';
        if (lowerCondition.includes('облачно')) return '☁️';
        if (lowerCondition.includes('туман')) return '🌫️';
        if (lowerCondition.includes('дождь') || lowerCondition.includes('ливень')) return '🌧️';
        if (lowerCondition.includes('снег')) return '❄️';
        if (lowerCondition.includes('гроза')) return '⛈️';
        if (temperature && temperature > 25) return '🌞';
        if (temperature && temperature < 5) return '🥶';
        return '🌤️';
    };

    // Генерация погодных рекомендаций
    const generateWeatherRecommendations = (): WeatherRecommendation[] => {
        const recommendations: WeatherRecommendation[] = [];
        const { temperature, windSpeed, condition, precipitation, rain, snowfall, humidity } = weatherData;
        
        // Флаги для отслеживания критических условий
        let hasCriticalConditions = false;
        let hasGoodConditions = true;

        // Рекомендации по температуре
        if (temperature !== undefined) {
            if (temperature > 30) {
                recommendations.push({
                    text: `🔥 Очень жарко (${temperature.toFixed(1)}°C) - высокий риск теплового удара на воде. Сократите время сплавов, обеспечьте больше питьевой воды и головные уборы.`,
                    priority: 'high',
                    icon: '🌡️'
                });
                hasGoodConditions = false;
            } else if (temperature > 25) {
                recommendations.push({
                    text: `☀️ Идеальная температура для SUP (${temperature.toFixed(1)}°C) - комфортные условия для всех возрастов. Ожидается максимальный спрос.`,
                    priority: 'low',
                    icon: '🏄‍♂️'
                });
            } else if (temperature > 20) {
                recommendations.push({
                    text: `🌤️ Хорошая погода для сплавов (${temperature.toFixed(1)}°C) - комфортно для активных людей. Возможно понадобятся гидрокостюмы для детей.`,
                    priority: 'low',
                    icon: '🚣'
                });
            } else if (temperature > 15) {
                recommendations.push({
                    text: `🌊 Прохладно для водных активностей (${temperature.toFixed(1)}°C) - обязательны гидрокостюмы. Многие клиенты могут отказаться.`,
                    priority: 'medium',
                    icon: '🤿'
                });
                hasGoodConditions = false;
            } else if (temperature > 10) {
                recommendations.push({
                    text: `❄️ Холодно для SUP (${temperature.toFixed(1)}°C) - только для опытных в полных гидрокостюмах. Рекомендуем отменить занятия для новичков.`,
                    priority: 'high',
                    icon: '🥶'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else {
                recommendations.push({
                    text: `🚫 Слишком холодно (${temperature.toFixed(1)}°C) - крайне опасно для водных активностей. Рекомендуем отменить все сплавы.`,
                    priority: 'high',
                    icon: '⛔'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            }
        }

        // Рекомендации по ветру
        if (windSpeed !== undefined) {
            if (windSpeed > 15) {
                recommendations.push({
                    text: `💨 Опасный ветер (${windSpeed.toFixed(1)} м/с) - ОТМЕНИТЕ все сплавы! Высокие волны делают SUP крайне опасным.`,
                    priority: 'high',
                    icon: '🚫'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (windSpeed > 10) {
                recommendations.push({
                    text: `🌬️ Сильный ветер (${windSpeed.toFixed(1)} м/с) - только для очень опытных. Рассмотрите отмену для новичков и детей. Усложненные условия.`,
                    priority: 'high',
                    icon: '⚠️'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (windSpeed > 7) {
                recommendations.push({
                    text: `💨 Умеренный ветер (${windSpeed.toFixed(1)} м/с) - подходит для уверенных пользователей. Новичкам будет сложно держать равновесие.`,
                    priority: 'medium',
                    icon: '🏄'
                });
                hasGoodConditions = false;
            } else if (windSpeed > 3) {
                recommendations.push({
                    text: `🌊 Легкий ветер (${windSpeed.toFixed(1)} м/с) - комфортные условия для SUP. Небольшие волны добавят интереса опытным.`,
                    priority: 'low',
                    icon: '🏄‍♂️'
                });
            } else {
                recommendations.push({
                    text: `🪞 Зеркальная гладь (${windSpeed.toFixed(1)} м/с) - идеальные условия для начинающих и фотосессий. Максимальная стабильность досок.`,
                    priority: 'low',
                    icon: '📸'
                });
            }
        }

        // Рекомендации по условиям
        if (condition) {
            const lowerCondition = condition.toLowerCase();
            
            if (lowerCondition.includes('гроза')) {
                recommendations.push({
                    text: `⛈️ ГРОЗА - немедленно эвакуируйте всех с воды! Молния на открытой воде смертельно опасна.`,
                    priority: 'high',
                    icon: '🚫'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (lowerCondition.includes('дождь') || lowerCondition.includes('ливень')) {
                recommendations.push({
                    text: `🌧️ Дождь делает SUP доски скользкими и опасными. Клиенты будут мокрыми и замерзшими. Лучше отменить.`,
                    priority: 'high',
                    icon: '☔'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (lowerCondition.includes('туман')) {
                recommendations.push({
                    text: `🌫️ Туман на воде ОПАСЕН - плохая видимость может привести к потере ориентации. Ограничьте зону плавания.`,
                    priority: 'high',
                    icon: '👁️'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (lowerCondition.includes('ясно') && hasGoodConditions) {
                recommendations.push({
                    text: `☀️ Отличная погода для SUP! Максимальный комфорт и безопасность. Ожидайте высокий спрос.`,
                    priority: 'low',
                    icon: '🎯'
                });
            }
        }

        // Рекомендации по осадкам
        if (precipitation !== undefined && precipitation > 0) {
            if (precipitation > 5) {
                recommendations.push({
                    text: `🌧️ Сильный дождь (${precipitation.toFixed(1)} мм/ч) - ОТМЕНИТЕ сплавы! Плохая видимость и скользкие доски опасны.`,
                    priority: 'high',
                    icon: '🚫'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (precipitation > 2) {
                recommendations.push({
                    text: `☔ Дождь (${precipitation.toFixed(1)} мм/ч) - очень дискомфортно на воде. Большинство клиентов откажется или потребует перенос.`,
                    priority: 'high',
                    icon: '⚠️'
                });
                hasCriticalConditions = true;
                hasGoodConditions = false;
            } else if (precipitation > 1) {
                recommendations.push({
                    text: `🌦️ Моросящий дождь (${precipitation.toFixed(1)} мм/ч) - доски станут скользкими. Подойдет только для любителей экстрима.`,
                    priority: 'medium',
                    icon: '☔'
                });
                hasGoodConditions = false;
            } else {
                recommendations.push({
                    text: `💧 Легкая морось (${precipitation.toFixed(1)} мм/ч) - может усилиться. Следите за прогнозом и будьте готовы к отмене.`,
                    priority: 'medium',
                    icon: '🌈'
                });
                hasGoodConditions = false;
            }
        }

        // Рекомендации по снегопаду
        if (snowfall !== undefined && snowfall > 0) {
            if (snowfall > 1) {
                recommendations.push({
                    text: `❄️ Снегопад (${snowfall.toFixed(1)} см/ч) - ЗАКРЫТО! Водные активности в снегопад смертельно опасны.`, 
                    priority: 'high',
                    icon: '🚫'
                });
            } else {
                recommendations.push({
                    text: `🌨️ Легкий снег (${snowfall.toFixed(1)} см/ч) - крайне опасно! Риск переохлаждения очень высок. Отмените все сплавы.`,
                    priority: 'high',
                    icon: '⛔'
                });
            }
            hasCriticalConditions = true;
            hasGoodConditions = false;
        }

        // Рекомендации по влажности (только если нет критических условий)
        if (humidity !== undefined && !hasCriticalConditions) {
            if (humidity > 90) {
                recommendations.push({
                    text: `💧 Экстремальная влажность (${Math.round(humidity)}%) - быстрое утомление на воде. Сократите время сплавов, обеспечьте больше воды.`,
                    priority: 'medium',
                    icon: '💦'
                });
            } else if (humidity < 20) {
                recommendations.push({
                    text: `🏜️ Очень сухой воздух (${Math.round(humidity)}%) - высокий риск обезвоживания на солнце. Увеличьте частоту перерывов на воду.`,
                    priority: 'medium',
                    icon: '🚰'
                });
            }
        }

        // Комбинированные рекомендации (только если нет критических условий)
        if (temperature !== undefined && windSpeed !== undefined && !hasCriticalConditions) {
            if (temperature > 22 && windSpeed < 5 && (precipitation || 0) === 0 && hasGoodConditions) {
                recommendations.push({
                    text: `🏆 ИДЕАЛЬНЫЕ условия для SUP! ${temperature.toFixed(1)}°C, ветер ${windSpeed.toFixed(1)} м/с, без осадков - максимальный комфорт и спрос.`,
                    priority: 'low',
                    icon: '⭐'
                });
            } else if (temperature < 12 && windSpeed > 8) {
                recommendations.push({
                    text: `❄️💨 Экстремально опасные условия! Холод ${temperature.toFixed(1)}°C + ветер ${windSpeed.toFixed(1)} м/с = высокий риск переохлаждения на воде.`,
                    priority: 'high',
                    icon: '🚫'
                });
            } else if (temperature > 28 && windSpeed < 2) {
                recommendations.push({
                    text: `🔥🌊 Жара + штиль = риск теплового удара. Сократите время на воде, больше перерывов в тени.`,
                    priority: 'medium',
                    icon: '⚠️'
                });
            }
        }

        // Убираем дубликаты и сортируем по приоритету
        const uniqueRecommendations = recommendations.filter((rec, index, arr) => 
            arr.findIndex(r => r.text === rec.text) === index
        );

        // Сортируем по приоритету: high -> medium -> low
        const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        const sortedRecommendations = uniqueRecommendations.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );

        // Если есть критические условия, показываем только их (максимум 3)
        if (hasCriticalConditions) {
            return sortedRecommendations.filter(rec => rec.priority === 'high').slice(0, 3);
        }

        // Иначе показываем все рекомендации (максимум 4)
        return sortedRecommendations.slice(0, 4);
    };

    const recommendations = generateWeatherRecommendations();
    const weatherIcon = getWeatherIcon(weatherData.condition || '', weatherData.temperature);

    return (
        <>
            <GlobalStyle />
            <WeatherTooltip>
                <TooltipHeader>
                    <TooltipTitle>
                        {weatherIcon} Погодные условия
                    </TooltipTitle>
                    <CloseButton onClick={onClose}>✕</CloseButton>
                </TooltipHeader>

                <TooltipContent>
                    <WeatherSection>
                        <WeatherMainInfo>
                            <WeatherIconLarge>{weatherIcon}</WeatherIconLarge>
                            <WeatherDetails>
                                <WeatherTemperature>
                                    {weatherData.temperature?.toFixed(1) || '--'}°C
                                </WeatherTemperature>
                                <WeatherCondition>
                                    {weatherData.condition || 'Загрузка...'}
                                </WeatherCondition>
                                <WeatherLocation>
                                    📍 {weatherData.location || 'Определение локации...'}
                                </WeatherLocation>
                            </WeatherDetails>
                        </WeatherMainInfo>

                        <WeatherGrid>
                            <WeatherCard>
                                <WeatherCardTitle>Ветер</WeatherCardTitle>
                                <WeatherCardValue>
                                    💨 {weatherData.windSpeed?.toFixed(1) || '--'} м/с
                                </WeatherCardValue>
                            </WeatherCard>
                            <WeatherCard>
                                <WeatherCardTitle>Влажность</WeatherCardTitle>
                                <WeatherCardValue>
                                    💧 {weatherData.humidity ? Math.round(weatherData.humidity) : '--'}%
                                </WeatherCardValue>
                            </WeatherCard>
                        </WeatherGrid>
                        
                        {/* Дополнительная информация об осадках - только если есть */}
                        {(weatherData.precipitation || 0) > 0 && (
                            <WeatherGrid>
                                <WeatherCard>
                                    <WeatherCardTitle>Осадки</WeatherCardTitle>
                                    <WeatherCardValue>
                                        🌧️ {(weatherData.precipitation || 0).toFixed(1)} мм/ч
                                    </WeatherCardValue>
                                </WeatherCard>
                                {(weatherData.rain || 0) > 0 && (
                                    <WeatherCard>
                                        <WeatherCardTitle>Дождь</WeatherCardTitle>
                                        <WeatherCardValue>
                                            ☔ {(weatherData.rain || 0).toFixed(1)} мм/ч
                                        </WeatherCardValue>
                                    </WeatherCard>
                                )}
                            </WeatherGrid>
                        )}
                        
                        {/* Снегопад - отдельно, если есть */}
                        {(weatherData.snowfall || 0) > 0 && (
                            <WeatherGrid>
                                <WeatherCard>
                                    <WeatherCardTitle>Снег</WeatherCardTitle>
                                    <WeatherCardValue>
                                        ❄️ {(weatherData.snowfall || 0).toFixed(1)} см/ч
                                    </WeatherCardValue>
                                </WeatherCard>
                            </WeatherGrid>
                        )}
                    </WeatherSection>

                    {recommendations.length > 0 && (
                        <RecommendationsSection>
                            <RecommendationsTitle>
                                💡 Рекомендации по погоде
                            </RecommendationsTitle>
                            {recommendations.map((rec, index) => (
                                <RecommendationItem key={index} $priority={rec.priority}>
                                    {rec.icon} {rec.text}
                                </RecommendationItem>
                            ))}
                        </RecommendationsSection>
                    )}

                    <RefreshButton 
                        onClick={onRefresh}
                        disabled={weatherData.isLoading}
                    >
                        {weatherData.isLoading ? '⏳ Обновление...' : '🔄 Обновить погоду'}
                    </RefreshButton>
                </TooltipContent>
            </WeatherTooltip>
        </>
    );
};

// Глобальный компонент тултипа погоды для рендеринга на уровне App
export const WeatherTooltipGlobal: React.FC = () => {
    const dispatch = useAppDispatch();
    const { isOpen, data: weatherData } = useAppSelector(state => state.notifications.weatherTooltip);
    const [tooltipPosition, setTooltipPosition] = React.useState({ top: 70, left: 20 });
    const [arrowPosition, setArrowPosition] = React.useState({ left: 20, isAbove: false });
    const [screenSize, setScreenSize] = React.useState({ width: window.innerWidth, height: window.innerHeight });

    // Отслеживаем изменение размера экрана для тултипа
    useEffect(() => {
        const handleResize = () => {
            setScreenSize({ width: window.innerWidth, height: window.innerHeight });
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const handleRefresh = async () => {
        // Обновляем погоду и сохраняем в Redux
        try {
            const updatedWeatherData = await fetchWeatherDataForGlobal();
            dispatch(updateWeatherData(updatedWeatherData));
        } catch (error) {
            console.error('Ошибка обновления погоды:', error);
        }
    };

    const handleClose = () => {
        dispatch(closeWeatherTooltip());
    };

    // Вычисляем позицию тултипа относительно погодного виджета
    useEffect(() => {
        if (isOpen) {
            const weatherWidget = document.querySelector('[data-weather-widget]');
            if (weatherWidget) {
                const widgetRect = weatherWidget.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const isMobile = viewportWidth <= 480;
                
                // Динамические размеры тултипа в зависимости от экрана
                const tooltipWidth = isMobile 
                    ? Math.min(viewportWidth - (viewportWidth <= 360 ? 16 : 20), viewportWidth <= 360 ? 340 : 360)
                    : 380;
                const maxTooltipHeight = Math.min(500, viewportHeight * (isMobile ? 0.9 : 0.8));
                
                let tooltipTop = widgetRect.bottom + scrollTop + (isMobile ? 8 : 12);
                
                // Проверяем, помещается ли тултип внизу экрана
                const availableSpaceBelow = viewportHeight - (widgetRect.bottom - scrollTop);
                const availableSpaceAbove = widgetRect.top - scrollTop;
                
                // На мобильных устройствах отдаем приоритет показу снизу
                if (!isMobile && availableSpaceBelow < maxTooltipHeight + 20 && availableSpaceAbove > maxTooltipHeight + 20) {
                    tooltipTop = widgetRect.top + scrollTop - maxTooltipHeight - 12;
                }
                // Если не помещается ни сверху, ни снизу - позиционируем так, чтобы влезло
                else if (availableSpaceBelow < maxTooltipHeight + 20) {
                    tooltipTop = scrollTop + viewportHeight - maxTooltipHeight - (isMobile ? 10 : 20);
                }
                
                // Позиционирование по горизонтали
                let tooltipLeft;
                if (isMobile) {
                    // На мобильных центрируем относительно экрана
                    tooltipLeft = (viewportWidth - tooltipWidth) / 2;
                    tooltipLeft = Math.max(viewportWidth <= 360 ? 8 : 10, tooltipLeft);
                } else {
                    // На десктопе центрируем относительно виджета
                    tooltipLeft = widgetRect.left + scrollLeft + (widgetRect.width / 2) - (tooltipWidth / 2);
                    
                    // Проверяем границы экрана
                    if (tooltipLeft + tooltipWidth > viewportWidth - 20) {
                        tooltipLeft = viewportWidth - tooltipWidth - 20;
                    }
                    if (tooltipLeft < 20) {
                        tooltipLeft = 20;
                    }
                }
                
                // Вычисляем позицию стрелочки
                const widgetCenter = widgetRect.left + scrollLeft + (widgetRect.width / 2);
                let arrowLeft = widgetCenter - tooltipLeft;
                
                // Ограничиваем позицию стрелочки
                const arrowMargin = isMobile ? 15 : 20;
                if (arrowLeft < arrowMargin) arrowLeft = arrowMargin;
                if (arrowLeft > tooltipWidth - arrowMargin) arrowLeft = tooltipWidth - arrowMargin;
                
                // Определяем направление стрелочки
                const isTooltipAbove = tooltipTop < widgetRect.top + scrollTop;
                
                setTooltipPosition({
                    top: tooltipTop,
                    left: tooltipLeft
                });
                
                setArrowPosition({
                    left: arrowLeft,
                    isAbove: isTooltipAbove
                });
            }
        }
    }, [isOpen, screenSize]);

    // Закрытие тултипа при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen) {
                const target = event.target as HTMLElement;
                const isClickOnWidget = target.closest('[data-weather-widget]');
                const isClickOnTooltip = target.closest('[data-weather-tooltip-global]');
                
                if (!isClickOnWidget && !isClickOnTooltip) {
                    dispatch(closeWeatherTooltip());
                }
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, dispatch]);

    if (!isOpen || !weatherData) return null;

    // Преобразуем данные из Redux формата в WeatherData формат
    const convertedWeatherData: WeatherData = {
        temperature: weatherData.temperature,
        windSpeed: weatherData.windSpeed,
        condition: weatherData.condition,
        location: weatherData.location,
        precipitation: weatherData.precipitation || 0,
        rain: weatherData.rain || 0,
        snowfall: weatherData.snowfall || 0,
        humidity: weatherData.humidity,
        isLoading: false
    };

    return (
        <div 
            data-weather-tooltip-global
            style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                zIndex: 10000,
                pointerEvents: 'auto'
            }}
        >
            {/* Стрелочка указывающая на виджет */}
            <div style={{
                position: 'absolute',
                top: arrowPosition.isAbove ? '100%' : (screenSize.width <= 480 ? '-8px' : '-10px'),
                left: `${arrowPosition.left}px`, // Динамическая позиция стрелочки
                width: '0',
                height: '0',
                borderLeft: `${screenSize.width <= 480 ? '8px' : '10px'} solid transparent`,
                borderRight: `${screenSize.width <= 480 ? '8px' : '10px'} solid transparent`,
                borderBottom: arrowPosition.isAbove ? 'none' : `${screenSize.width <= 480 ? '8px' : '10px'} solid #1C1C1E`,
                borderTop: arrowPosition.isAbove ? `${screenSize.width <= 480 ? '8px' : '10px'} solid #1C1C1E` : 'none',
                filter: 'drop-shadow(0 -4px 8px rgba(0, 0, 0, 0.4))',
                zIndex: 10001
            }} />
            <WeatherTooltipComponent
                weatherData={convertedWeatherData}
                onRefresh={handleRefresh}
                onClose={handleClose}
            />
        </div>
    );
};

// Функция для получения данных о погоде (вынесена из компонента)
const fetchWeatherDataForGlobal = async (): Promise<WeatherData> => {
    try {
        // Координаты для коррекции неточной геолокации (ул. Вильского 34, Красноярск)
        const BUSINESS_LOCATION = {
            latitude: 56.0215,
            longitude: 92.7565,
            name: 'Красноярск, Россия'
        };

        // Функция для расчета расстояния между двумя точками
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const R = 6371; // Радиус Земли в км
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        // Получаем геолокацию
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
                enableHighAccuracy: false,
                maximumAge: 600000
            });
        });

        const { latitude, longitude } = position.coords;
        
        // Проверяем точность геолокации
        let finalLatitude = latitude;
        let finalLongitude = longitude;
        
        const distanceFromBusiness = calculateDistance(latitude, longitude, BUSINESS_LOCATION.latitude, BUSINESS_LOCATION.longitude);
        if (distanceFromBusiness > 100) {
            finalLatitude = BUSINESS_LOCATION.latitude;
            finalLongitude = BUSINESS_LOCATION.longitude;
        }
        
        // Запрос к Open-Meteo API с hourly данными тоже
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${finalLatitude}&longitude=${finalLongitude}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&hourly=precipitation,rain,showers,snowfall&forecast_days=1&timezone=auto`;
        const weatherResponse = await fetch(weatherUrl);
        
        if (!weatherResponse.ok) {
            throw new Error(`Ошибка API погоды: ${weatherResponse.status}`);
        }
        
        const weatherJson = await weatherResponse.json();
        
        // API данные успешно получены
        
        // Получаем название локации через Yandex Geocoder API
        let locationName = 'Текущая локация';
        try {
            const yandexApiKey = '611aec33-5f96-495f-8440-fb86f0922a83';
            const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=${yandexApiKey}&geocode=${finalLongitude},${finalLatitude}&format=json&lang=ru_RU&results=1`;
            
            const geocodeResponse = await fetch(geocodeUrl, {
                headers: {
                    'User-Agent': 'SUPBoard/1.0',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
            
            if (geocodeResponse.ok) {
                const geocodeData = await geocodeResponse.json();
                const geoObject = geocodeData.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
                if (geoObject) {
                    const metaData = geoObject.metaDataProperty?.GeocoderMetaData;
                    const address = metaData?.Address;
                    
                    if (address) {
                        const components = address.Components;
                        const locality = components?.find((c: any) => c.kind === 'locality')?.name;
                        const country = components?.find((c: any) => c.kind === 'country')?.name;
                        
                        if (locality && country) {
                            locationName = `${locality}, ${country}`;
                        } else if (locality) {
                            locationName = locality;
                        }
                    }
                    
                    if (locationName === 'Текущая локация') {
                        locationName = geoObject.name || geoObject.description || 'Определенная локация';
                    }
                }
            }
        } catch (geocodeError) {
            console.warn('Ошибка геокодирования:', geocodeError);
        }

        // Преобразуем код погоды в описание
        const getWeatherCondition = (code: number): string => {
            if (code === 0) return 'ясно';
            if (code <= 3) return 'облачно';
            if (code <= 48) return 'туман';
            if (code <= 67) return 'дождь';
            if (code <= 77) return 'снег';
            if (code <= 82) return 'ливень';
            if (code <= 86) return 'снегопад';
            if (code <= 99) return 'гроза';
            return 'переменная';
        };

        // Получаем текущие осадки из hourly данных (первый час)
        const currentHourPrecipitation = weatherJson.hourly?.precipitation?.[0] || 0;
        const currentHourRain = weatherJson.hourly?.rain?.[0] || 0;
        const currentHourShowers = weatherJson.hourly?.showers?.[0] || 0;
        const currentHourSnowfall = weatherJson.hourly?.snowfall?.[0] || 0;

        const finalData = {
            temperature: weatherJson.current?.temperature_2m,
            windSpeed: weatherJson.current?.wind_speed_10m,
            condition: getWeatherCondition(weatherJson.current?.weather_code || 0),
            location: locationName,
            precipitation: currentHourPrecipitation,
            rain: currentHourRain + currentHourShowers, // Сумма дождя и ливней
            snowfall: currentHourSnowfall,
            humidity: weatherJson.current?.relative_humidity_2m,
            isLoading: false
        };

        // Финальные данные успешно сформированы

        return finalData;

    } catch (error) {
        console.error('Ошибка получения погодных данных:', error);
        
        // Fallback данные
        return {
            temperature: 20 + Math.random() * 15,
            windSpeed: Math.random() * 12,
            condition: ['ясно', 'облачно', 'ветрено', 'переменная'][Math.floor(Math.random() * 4)],
            location: 'Ваша локация',
            precipitation: 0,
            rain: 0,
            snowfall: 0,
            humidity: 50 + Math.random() * 40, // 50-90%
            isLoading: false,
            error: undefined
        };
    }
};

export const WeatherWidget: React.FC = () => {
    const dispatch = useAppDispatch();
    const [weatherData, setWeatherData] = useState<WeatherData>({
        isLoading: true
    });
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 360);
    const geocodeCache = useRef<Map<string, string>>(new Map());

    // Отслеживаем изменение размера экрана
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 360);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Координаты для коррекции неточной геолокации (ул. Вильского 34, Красноярск)
    const BUSINESS_LOCATION = {
        latitude: 56.0215,
        longitude: 92.7565,
        name: 'Красноярск, Россия'
    };

    // Функция для расчета расстояния между двумя точками (формула гаверсинуса)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Радиус Земли в км
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Расстояние в км
    };
    
    // Функция для проверки, нужно ли корректировать геолокацию
    const shouldCorrectLocation = (lat: number, lng: number): boolean => {
        const distanceFromBusiness = calculateDistance(lat, lng, BUSINESS_LOCATION.latitude, BUSINESS_LOCATION.longitude);
        const MAX_REASONABLE_DISTANCE = 100; // км
        
        return distanceFromBusiness > MAX_REASONABLE_DISTANCE;
    };

    // Функция для получения погодных данных
    const fetchWeatherData = async () => {
        try {
            setWeatherData(prev => ({ ...prev, isLoading: true, error: undefined }));
            
            // Проверяем поддержку геолокации
            if (!navigator.geolocation) {
                throw new Error('Геолокация не поддерживается браузером');
            }
            
            // Получаем геолокацию пользователя
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve, 
                    (error) => {
                        let errorMessage = 'Ошибка получения геолокации';
                        switch (error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage = 'Доступ к геолокации запрещен';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage = 'Местоположение недоступно';
                                break;
                            case error.TIMEOUT:
                                errorMessage = 'Таймаут получения геолокации';
                                break;
                        }
                        reject(new Error(errorMessage));
                    }, 
                    {
                        timeout: 10000,
                        enableHighAccuracy: false,
                        maximumAge: 600000 // Кэшируем на 10 минут для виджета
                    }
                );
            });

            const { latitude, longitude } = position.coords;
            
            // Проверяем точность геолокации
            let finalLatitude = latitude;
            let finalLongitude = longitude;
            let locationCorrected = false;
            
            // Проверяем, не слишком ли далеко от ожидаемой локации бизнеса
            if (shouldCorrectLocation(latitude, longitude)) {
                finalLatitude = BUSINESS_LOCATION.latitude;
                finalLongitude = BUSINESS_LOCATION.longitude;
                locationCorrected = true;
            }
            
            // Запрос к Open-Meteo API с hourly данными тоже (для виджета)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${finalLatitude}&longitude=${finalLongitude}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&hourly=precipitation,rain,showers,snowfall&forecast_days=1&timezone=auto`;
            
            const weatherResponse = await fetch(weatherUrl);
            
            if (!weatherResponse.ok) {
                throw new Error(`Ошибка API погоды: ${weatherResponse.status} ${weatherResponse.statusText}`);
            }
            
            const weatherJson = await weatherResponse.json();
            
            // API данные для виджета успешно получены
            
            // Получаем название локации через Yandex Geocoder API
            let locationName = 'Текущая локация';
            
            // Проверяем кэш сначала
            const cacheKey = `${finalLatitude.toFixed(3)},${finalLongitude.toFixed(3)}`;
            const cachedLocation = geocodeCache.current.get(cacheKey);
            
            if (cachedLocation) {
                locationName = cachedLocation;
            } else {
                // Всегда получаем название локации через Yandex Geocoder API
                try {
                    const yandexApiKey = '611aec33-5f96-495f-8440-fb86f0922a83';
                    const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=${yandexApiKey}&geocode=${finalLongitude},${finalLatitude}&format=json&lang=ru_RU&results=1`;
                    
                    const geocodeResponse = await fetch(geocodeUrl, {
                        headers: {
                            'User-Agent': 'SUPBoard/1.0',
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(10000) // Таймаут 10 секунд
                    });
                    
                    if (geocodeResponse.ok) {
                        const geocodeData = await geocodeResponse.json();
                        
                        const geoObject = geocodeData.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
                        if (geoObject) {
                            const metaData = geoObject.metaDataProperty?.GeocoderMetaData;
                            const address = metaData?.Address;
                            
                            if (address) {
                                const components = address.Components;
                                const locality = components?.find((c: any) => c.kind === 'locality')?.name;
                                const adminArea = components?.find((c: any) => c.kind === 'province')?.name;
                                const country = components?.find((c: any) => c.kind === 'country')?.name;
                                
                                if (locality && country) {
                                    locationName = `${locality}, ${country}`;
                                } else if (locality) {
                                    locationName = locality;
                                } else if (adminArea && country) {
                                    locationName = `${adminArea}, ${country}`;
                                } else if (adminArea) {
                                    locationName = adminArea;
                                }
                            }
                            
                            // Fallback к полному адресу если не удалось извлечь компоненты
                            if (locationName === 'Текущая локация') {
                                locationName = geoObject.name || geoObject.description || 'Определенная локация';
                            }
                            
                            // Сохраняем в кэш
                            geocodeCache.current.set(cacheKey, locationName);
                        } else {
                            locationName = `${finalLatitude.toFixed(2)}°, ${finalLongitude.toFixed(2)}°`;
                        }
                    } else {
                        locationName = `${finalLatitude.toFixed(2)}°, ${finalLongitude.toFixed(2)}°`;
                    }
                } catch (geocodeError) {
                    locationName = `${finalLatitude.toFixed(2)}°, ${finalLongitude.toFixed(2)}°`;
                }
            }

            // Преобразуем код погоды в понятное описание
            const getWeatherCondition = (code: number): string => {
                if (code === 0) return 'ясно';
                if (code <= 3) return 'облачно';
                if (code <= 48) return 'туман';
                if (code <= 67) return 'дождь';
                if (code <= 77) return 'снег';
                if (code <= 82) return 'ливень';
                if (code <= 86) return 'снегопад';
                if (code <= 99) return 'гроза';
                return 'переменная';
            };

            // Получаем текущие осадки из hourly данных (первый час) для виджета
            const currentHourPrecipitation = weatherJson.hourly?.precipitation?.[0] || 0;
            const currentHourRain = weatherJson.hourly?.rain?.[0] || 0;
            const currentHourShowers = weatherJson.hourly?.showers?.[0] || 0;
            const currentHourSnowfall = weatherJson.hourly?.snowfall?.[0] || 0;

            const finalWeatherData = {
                temperature: weatherJson.current?.temperature_2m,
                windSpeed: weatherJson.current?.wind_speed_10m,
                condition: getWeatherCondition(weatherJson.current?.weather_code || 0),
                location: locationName,
                precipitation: currentHourPrecipitation,
                rain: currentHourRain + currentHourShowers, // Сумма дождя и ливней
                snowfall: currentHourSnowfall,
                humidity: weatherJson.current?.relative_humidity_2m,
                isLoading: false
            };

            // Финальные данные для виджета успешно сформированы

            setWeatherData(finalWeatherData);

        } catch (error) {
            console.error('❌ Ошибка получения погодных данных для виджета:', error);
            
            // Используем моковые данные как fallback
            const fallbackData = {
                temperature: 20 + Math.random() * 15, // 20-35°C
                windSpeed: Math.random() * 12, // 0-12 м/с
                condition: ['ясно', 'облачно', 'ветрено', 'переменная'][Math.floor(Math.random() * 4)],
                location: 'Ваша локация',
                precipitation: 0,
                rain: 0,
                snowfall: 0,
                humidity: 50 + Math.random() * 40, // 50-90%
                isLoading: false,
                error: undefined
            };
            
            setWeatherData(fallbackData);
        }
    };

    // Обработчики для тултипа
    const handleWeatherClick = () => {

        // Генерируем рекомендации на основе погоды
        const generateRecommendations = () => {
            const recommendations = [];
            
            if (weatherData.temperature && weatherData.temperature > 30) {
                recommendations.push({
                    title: 'Жаркая погода',
                    description: 'Рекомендуем SUP с креслами, зонты от солнца и больше воды',
                    icon: '🌡️',
                    type: 'temperature' as const
                });
            } else if (weatherData.temperature && weatherData.temperature < 15) {
                recommendations.push({
                    title: 'Прохладно',
                    description: 'Предложите теплую одежду, возможны скидки',
                    icon: '🧥',
                    type: 'temperature' as const
                });
            }
            
            if (weatherData.windSpeed && weatherData.windSpeed > 10) {
                recommendations.push({
                    title: 'Сильный ветер',
                    description: 'Лучше предложить плоты вместо SUP, акцент на безопасность',
                    icon: '💨',
                    type: 'wind' as const
                });
            } else if (weatherData.windSpeed && weatherData.windSpeed < 3) {
                recommendations.push({
                    title: 'Тихая погода',
                    description: 'Идеальные условия для всех уровней подготовки',
                    icon: '🌊',
                    type: 'wind' as const
                });
            }
            
            if (weatherData.condition?.includes('дождь') || weatherData.condition?.includes('гроза')) {
                recommendations.push({
                    title: 'Неблагоприятная погода',
                    description: 'Возможны отмены, подготовьте план переноса бронирований',
                    icon: '⛈️',
                    type: 'condition' as const
                });
            }
            
            return recommendations;
        };

        // Формируем данные для Redux
        const tooltipData = {
            temperature: weatherData.temperature || 0,
            windSpeed: weatherData.windSpeed || 0,
            condition: weatherData.condition || 'неизвестно',
            location: weatherData.location || 'Текущая локация',
            icon: getWeatherIcon(weatherData.condition),
            precipitation: weatherData.precipitation || 0,
            rain: weatherData.rain || 0,
            snowfall: weatherData.snowfall || 0,
            humidity: weatherData.humidity,
            recommendations: generateRecommendations()
        };

        // Открываем глобальный тултип через Redux
        dispatch(openWeatherTooltip({ data: tooltipData }));
    };

    // Получение данных о погоде при загрузке
    useEffect(() => {
        fetchWeatherData();
        
        // Обновляем погоду каждые 30 минут
        const interval = setInterval(fetchWeatherData, 30 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, []);

    // Определение иконки погоды
    const getWeatherIcon = (condition?: string): string => {
        if (!condition) return '🌤️';
        
        if (condition.includes('ясно')) return '☀️';
        if (condition.includes('облачно')) return '☁️';
        if (condition.includes('туман')) return '🌫️';
        if (condition.includes('дождь') || condition.includes('ливень')) return '🌧️';
        if (condition.includes('снег') || condition.includes('снегопад')) return '❄️';
        if (condition.includes('гроза')) return '⛈️';
        if (condition.includes('ветрено')) return '💨';
        
        return '🌤️';
    };

    if (weatherData.isLoading) {
        return (
            <WeatherContainer data-weather-widget>
                <WeatherIcon>🌤️</WeatherIcon>
                <LoadingText>Загрузка...</LoadingText>
            </WeatherContainer>
        );
    }

    return (
        <>
            <WeatherContainer 
                data-weather-widget
                onClick={handleWeatherClick} 
                title="Нажмите для просмотра подробной информации о погоде"
            >
                <WeatherIcon>{getWeatherIcon(weatherData.condition)}</WeatherIcon>
                <WeatherInfo>
                    <Temperature>
                        {weatherData.temperature ? `${weatherData.temperature.toFixed(1)}°C` : '--°C'}
                    </Temperature>
                    <Details>
                        {/* Сокращаем текст для мобильных */}
                        {isMobile 
                            ? `${(weatherData.windSpeed?.toFixed(1) || '--')} м/с`
                            : `${weatherData.condition || '--'} • ${weatherData.windSpeed ? `${weatherData.windSpeed.toFixed(1)} м/с` : '--'}`
                        }
                    </Details>
                </WeatherInfo>
            </WeatherContainer>
        </>
    );
}; 