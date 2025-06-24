import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartSuggestion {
    id: string;
    title: string;
    description: string;
    boardCount: number;
    boardWithSeatCount: number;
    raftCount: number;
    reason: string;
    confidence: number; // 0-100
    icon: string;
    priority: 'high' | 'medium' | 'low';
}

interface SmartSuggestionsProps {
    currentTime: Date;
    currentCounts: {
        boardCount: number;
        boardWithSeatCount: number;
        raftCount: number;
    };
    available: {
        board: number;
        board_with_seat: number;
        raft: number;
    };
    onSuggestionSelect: (suggestion: SmartSuggestion) => void;
    isMobile?: boolean;
    clientHistory?: {
        totalBookings: number;
        preferredEquipment?: string[];
        lastBookingDate?: string;
        isVIP?: boolean;
    };
}

interface WeatherData {
    temperature?: number;
    windSpeed?: number;
    condition?: string;
    location?: string;
    isLoading?: boolean;
    error?: string;
}

const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
    currentTime,
    currentCounts,
    available,
    onSuggestionSelect,
    isMobile = false,
    clientHistory
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [weatherData, setWeatherData] = useState<WeatherData>({
        isLoading: true
    });
    const [liveTime, setLiveTime] = useState(new Date());

    // Кэш для геокодирования (чтобы не делать повторные запросы)
    const geocodeCache = useRef<Map<string, string>>(new Map());
    
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
        
        // Если расстояние больше 100 км от ожидаемой локации бизнеса, 
        // возможно геолокация неточная (особенно для десктопа)
        const MAX_REASONABLE_DISTANCE = 100; // км
        
        if (distanceFromBusiness > MAX_REASONABLE_DISTANCE) {
            console.log(`🔍 Расстояние от ожидаемой локации бизнеса: ${distanceFromBusiness.toFixed(1)} км`);
            console.log('⚠️ Возможно, геолокация неточная (расстояние > 100 км)');
            return true;
        }
        
        return false;
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
                                errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера';
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
                        maximumAge: 300000 // Кэшируем на 5 минут
                    }
                );
            });

            const { latitude, longitude } = position.coords;
            console.log('🌍 Получены реальные координаты пользователя:', { latitude, longitude });
            
            // Проверяем точность геолокации
            let finalLatitude = latitude;
            let finalLongitude = longitude;
            let locationCorrected = false;
            
            // Проверяем, не слишком ли далеко от ожидаемой локации бизнеса
            if (shouldCorrectLocation(latitude, longitude)) {
                finalLatitude = BUSINESS_LOCATION.latitude;
                finalLongitude = BUSINESS_LOCATION.longitude;
                locationCorrected = true;
                console.log('🔧 Корректируем неточную геолокацию');
                console.log('📍 Используем координаты бизнеса (ул. Вильского 34):', { 
                    latitude: finalLatitude, 
                    longitude: finalLongitude 
                });
            } else {
                console.log('✅ Координаты пользователя достаточно точные, используем их без коррекции');
            }
            
            // Запрос к Open-Meteo API (бесплатный, без ключей)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${finalLatitude}&longitude=${finalLongitude}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`;
            console.log('🌤️ Запрос погоды:', weatherUrl);
            
            const weatherResponse = await fetch(weatherUrl);
            
            if (!weatherResponse.ok) {
                throw new Error(`Ошибка API погоды: ${weatherResponse.status} ${weatherResponse.statusText}`);
            }
            
            const weatherJson = await weatherResponse.json();
            console.log('🌤️ Данные погоды получены:', weatherJson);
            
            // Получаем название локации через Yandex Geocoder API
            let locationName = 'Текущая локация';
            
            // Проверяем кэш сначала
            const cacheKey = `${finalLatitude.toFixed(3)},${finalLongitude.toFixed(3)}`;
            const cachedLocation = geocodeCache.current.get(cacheKey);
            
            if (cachedLocation) {
                locationName = cachedLocation;
                console.log('📦 Используется кэшированная локация:', locationName);
            } else {
                // Всегда получаем название локации через Yandex Geocoder API
                try {
                    const yandexApiKey = '611aec33-5f96-495f-8440-fb86f0922a83';
                    const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=${yandexApiKey}&geocode=${finalLongitude},${finalLatitude}&format=json&lang=ru_RU&results=1`;
                    
                    console.log('📍 Запрос к Yandex Geocoder API:', geocodeUrl);
                    
                    const geocodeResponse = await fetch(geocodeUrl, {
                        headers: {
                            'User-Agent': 'SUPBoard/1.0',
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(10000) // Таймаут 10 секунд
                    });
                    
                    if (geocodeResponse.ok) {
                        const geocodeData = await geocodeResponse.json();
                        console.log('📍 Yandex Geocoder вернул данные:', geocodeData);
                        
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
                            console.log('✅ Yandex Geocoder успешно определил локацию:', locationName);
                            
                            // Дополнительный лог о том, были ли координаты скорректированы
                            if (locationCorrected) {
                                console.log('🔧 Локация получена через Yandex API для скорректированных координат бизнеса');
                            } else {
                                console.log('🎯 Локация получена через Yandex API для реальных координат пользователя');
                            }
                        } else {
                            console.warn('📍 Yandex Geocoder не вернул данные о местоположении');
                            locationName = `${finalLatitude.toFixed(2)}°, ${finalLongitude.toFixed(2)}°`;
                        }
                    } else {
                        console.warn(`📍 Yandex Geocoder API вернул статус ${geocodeResponse.status}:`, geocodeResponse.statusText);
                        locationName = `${finalLatitude.toFixed(2)}°, ${finalLongitude.toFixed(2)}°`;
                    }
                } catch (geocodeError) {
                    console.warn('📍 Ошибка Yandex Geocoder API:', geocodeError);
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

            const finalWeatherData = {
                temperature: weatherJson.current?.temperature_2m,
                windSpeed: weatherJson.current?.wind_speed_10m,
                condition: getWeatherCondition(weatherJson.current?.weather_code || 0),
                location: locationName,
                isLoading: false
            };

            console.log('✅ Финальные данные погоды:', finalWeatherData);
            setWeatherData(finalWeatherData);

        } catch (error) {
            console.error('❌ Ошибка получения погодных данных:', error);
            
            // Определяем тип ошибки для более точного сообщения
            let errorMessage = 'Неизвестная ошибка';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            // Используем моковые данные как fallback
            const fallbackData = {
                temperature: 20 + Math.random() * 15, // 20-35°C
                windSpeed: Math.random() * 12, // 0-12 м/с
                condition: ['ясно', 'облачно', 'ветрено', 'переменная'][Math.floor(Math.random() * 4)],
                location: 'Ваша локация',
                isLoading: false,
                error: undefined // Не показываем ошибку пользователю, система работает с fallback данными
            };
            
            console.log('🔄 Используются примерные данные погоды (fallback):', fallbackData);
            console.log('📝 Оригинальная ошибка (скрыта от пользователя):', errorMessage);
            setWeatherData(fallbackData);
        }
    };

    // Получение реальных данных о погоде при загрузке
    useEffect(() => {
        fetchWeatherData();
    }, []);

    // Обновление времени каждую секунду
    useEffect(() => {
        const timer = setInterval(() => {
            setLiveTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Генерация умных предложений
    const suggestions = useMemo((): SmartSuggestion[] => {
        const suggestions: SmartSuggestion[] = [];
        const hour = currentTime.getHours();
        const isWeekend = currentTime.getDay() === 0 || currentTime.getDay() === 6;
        const season = getSeason(currentTime);

        // Предложения на основе времени дня
        if (hour >= 6 && hour <= 9) {
            suggestions.push({
                id: 'morning-solo',
                title: 'Утренняя медитация',
                description: 'Спокойное утро на воде',
                boardCount: 1,
                boardWithSeatCount: 0,
                raftCount: 0,
                reason: 'Утренние часы идеальны для спокойного катания',
                confidence: 85,
                icon: '🌅',
                priority: 'high'
            });
        }

        if (hour >= 10 && hour <= 14 && isWeekend) {
            suggestions.push({
                id: 'family-weekend',
                title: 'Семейный отдых',
                description: 'Родители + дети с креслами',
                boardCount: 2,
                boardWithSeatCount: 2,
                raftCount: 0,
                reason: 'Выходные - популярное время для семейного отдыха',
                confidence: 90,
                icon: '👨‍👩‍👧‍👦',
                priority: 'high'
            });
        }

        if (hour >= 15 && hour <= 18) {
            suggestions.push({
                id: 'afternoon-group',
                title: 'Дневная компания',
                description: 'Группа друзей на плоту',
                boardCount: 0,
                boardWithSeatCount: 0,
                raftCount: 1,
                reason: 'Послеобеденное время популярно для групповых активностей',
                confidence: 75,
                icon: '🏄‍♂️',
                priority: 'medium'
            });
        }

        // Предложения на основе погоды
        if (weatherData.windSpeed && weatherData.windSpeed > 10) {
            suggestions.push({
                id: 'windy-stable',
                title: 'Устойчивый вариант',
                description: 'Плот для ветреной погоды',
                boardCount: 0,
                boardWithSeatCount: 0,
                raftCount: 1,
                reason: `Сильный ветер ${weatherData.windSpeed.toFixed(1)} м/с - плот более устойчив`,
                confidence: 80,
                icon: '💨',
                priority: 'high'
            });
        }

        if (weatherData.temperature && weatherData.temperature > 28) {
            suggestions.push({
                id: 'hot-comfort',
                title: 'Комфорт в жару',
                description: 'С креслами для удобства',
                boardCount: 0,
                boardWithSeatCount: 2,
                raftCount: 0,
                reason: `Жаркая погода ${weatherData.temperature.toFixed(1)}°C - кресла обеспечат комфорт`,
                confidence: 70,
                icon: '🌡️',
                priority: 'medium'
            });
        }

        // Предложения на основе сезона
        if (season === 'summer') {
            suggestions.push({
                id: 'summer-active',
                title: 'Летняя активность',
                description: 'Максимум движения',
                boardCount: 3,
                boardWithSeatCount: 0,
                raftCount: 0,
                reason: 'Лето - время для активного катания',
                confidence: 65,
                icon: '☀️',
                priority: 'low'
            });
        }

        // Предложения на основе истории клиента
        if (clientHistory) {
            if (clientHistory.isVIP) {
                suggestions.push({
                    id: 'vip-premium',
                    title: 'VIP комплект',
                    description: 'Премиум набор для VIP клиента',
                    boardCount: 2,
                    boardWithSeatCount: 2,
                    raftCount: 1,
                    reason: 'Специальное предложение для VIP клиента',
                    confidence: 95,
                    icon: '⭐',
                    priority: 'high'
                });
            }

            if (clientHistory.totalBookings > 5) {
                suggestions.push({
                    id: 'regular-favorite',
                    title: 'Проверенный выбор',
                    description: 'Популярный у постоянных клиентов',
                    boardCount: 2,
                    boardWithSeatCount: 1,
                    raftCount: 0,
                    reason: `На основе ${clientHistory.totalBookings} предыдущих визитов`,
                    confidence: 80,
                    icon: '🎯',
                    priority: 'medium'
                });
            }
        }

        // Предложения на основе доступности
        if (available.board < 3) {
            suggestions.push({
                id: 'limited-optimal',
                title: 'Оптимальный остаток',
                description: 'Лучшее из доступного',
                boardCount: Math.min(available.board, 2),
                boardWithSeatCount: 0,
                raftCount: 0,
                reason: `Ограниченная доступность - осталось ${available.board} досок`,
                confidence: 60,
                icon: '⚡',
                priority: 'medium'
            });
        }

        // Фильтруем предложения по доступности и убираем дубликаты
        return suggestions
            .filter(s => {
                const totalNeeded = s.boardCount + s.boardWithSeatCount + (s.raftCount * 2);
                return s.boardCount <= available.board && 
                       s.boardWithSeatCount <= available.board_with_seat && 
                       s.raftCount <= available.raft &&
                       totalNeeded <= Math.min(available.board, available.board_with_seat, available.raft * 2);
            })
            .filter((s, index, arr) => {
                // Убираем дубликаты по комбинации инвентаря
                return arr.findIndex(other => 
                    other.boardCount === s.boardCount &&
                    other.boardWithSeatCount === s.boardWithSeatCount &&
                    other.raftCount === s.raftCount
                ) === index;
            })
            .sort((a, b) => {
                // Сортируем по приоритету и уверенности
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                return b.confidence - a.confidence;
            })
            .slice(0, 3); // Показываем максимум 3 предложения
    }, [currentTime, available, weatherData, clientHistory]);

    // Определение сезона
    function getSeason(date: Date): 'spring' | 'summer' | 'autumn' | 'winter' {
        const month = date.getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    // Проверка является ли предложение текущим выбором
    const isCurrentSelection = (suggestion: SmartSuggestion) => {
        return currentCounts.boardCount === suggestion.boardCount &&
               currentCounts.boardWithSeatCount === suggestion.boardWithSeatCount &&
               currentCounts.raftCount === suggestion.raftCount;
    };

    // Форматирование времени
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    };

    if (suggestions.length === 0) return null;

    return (
        <div style={{
            marginTop: isMobile ? 12 : 16,
            padding: isMobile ? 10 : 12,
            backgroundColor: '#1C1C1E',
            borderRadius: isMobile ? 6 : 8,
            border: '1px solid #3C3C3E',
            position: 'relative'
        }}>
            <motion.div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: isExpanded ? (isMobile ? 8 : 10) : 0
                }}
                whileHover={{ backgroundColor: '#2C2C2E' }}
                transition={{ duration: 0.2 }}
            >
                <div style={{
                    color: '#86868B',
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                }}>
                    🤖 Умные предложения
                    {suggestions.length > 0 && (
                        <span style={{
                            backgroundColor: '#007AFF',
                            color: '#fff',
                            borderRadius: '50%',
                            width: 16,
                            height: 16,
                            fontSize: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {suggestions.length}
                        </span>
                    )}
                </div>
                
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        color: '#86868B',
                        fontSize: 12
                    }}
                >
                    ▼
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobile ? 8 : 10
                        }}>
                            {suggestions.map((suggestion, index) => {
                                const isCurrent = isCurrentSelection(suggestion);
                                
                                return (
                                    <motion.div
                                        key={suggestion.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1, duration: 0.3 }}
                                        whileHover={{ 
                                            scale: 1.02,
                                            backgroundColor: isCurrent ? '#007AFF20' : '#2C2C2E'
                                        }}
                                        onClick={() => onSuggestionSelect(suggestion)}
                                        style={{
                                            padding: isMobile ? 8 : 10,
                                            backgroundColor: isCurrent ? '#007AFF20' : '#23232a',
                                            borderRadius: 6,
                                            border: isCurrent ? '1px solid #007AFF' : '1px solid #3C3C3E',
                                            cursor: 'pointer',
                                            position: 'relative'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: isMobile ? 16 : 18,
                                                lineHeight: 1
                                            }}>
                                                {suggestion.icon}
                                            </div>
                                            
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    marginBottom: 2
                                                }}>
                                                    <span style={{
                                                        color: '#fff',
                                                        fontSize: isMobile ? 12 : 13,
                                                        fontWeight: 600
                                                    }}>
                                                        {suggestion.title}
                                                    </span>
                                                    
                                                    <div style={{
                                                        backgroundColor: suggestion.priority === 'high' ? '#4CAF50' : 
                                                                        suggestion.priority === 'medium' ? '#FF9500' : '#86868B',
                                                        color: '#fff',
                                                        fontSize: 8,
                                                        padding: '1px 4px',
                                                        borderRadius: 2,
                                                        fontWeight: 600
                                                    }}>
                                                        {suggestion.confidence}%
                                                    </div>
                                                </div>
                                                
                                                <div style={{
                                                    color: '#86868B',
                                                    fontSize: isMobile ? 10 : 11,
                                                    marginBottom: 4
                                                }}>
                                                    {suggestion.description}
                                                </div>
                                                
                                                <div style={{
                                                    color: '#86868B',
                                                    fontSize: isMobile ? 9 : 10,
                                                    fontStyle: 'italic'
                                                }}>
                                                    {suggestion.reason}
                                                </div>
                                                
                                                <div style={{
                                                    marginTop: 4,
                                                    fontSize: isMobile ? 9 : 10,
                                                    color: '#007AFF'
                                                }}>
                                                    {suggestion.boardCount > 0 && `${suggestion.boardCount} сапборд `}
                                                    {suggestion.boardWithSeatCount > 0 && `${suggestion.boardWithSeatCount} с креслом `}
                                                    {suggestion.raftCount > 0 && `${suggestion.raftCount} плот`}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                        
                        {/* Информация о факторах */}
                        <div style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: '1px solid #3C3C3E',
                            fontSize: 9,
                            color: '#86868B',
                            lineHeight: 1.3
                        }}>
                            <div style={{ marginBottom: 4 }}>
                                🕐 Сейчас: {formatTime(liveTime)}
                            </div>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span>Учитываются:</span>
                                <span>время дня</span>
                                
                                {weatherData.isLoading ? (
                                    <span>⏳ загрузка погоды...</span>
                                ) : weatherData.error ? (
                                    <span 
                                        title={`Ошибка: ${weatherData.error}. Нажмите для повторной попытки`}
                                        style={{ 
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                            color: '#FF9500'
                                        }}
                                        onClick={() => fetchWeatherData()}
                                    >
                                        ⚠️ примерная погода
                                    </span>
                                ) : (
                                    <>
                                        {weatherData.temperature && (
                                            <span>🌡️ {weatherData.temperature.toFixed(1)}°C</span>
                                        )}
                                        {weatherData.windSpeed && (
                                            <span>💨 {weatherData.windSpeed.toFixed(1)} м/с</span>
                                        )}
                                        {weatherData.condition && (
                                            <span>☁️ {weatherData.condition}</span>
                                        )}
                                    </>
                                )}
                                
                                {clientHistory && <span>👤 история клиента</span>}
                            </div>
                            
                            {weatherData.location && !weatherData.isLoading && (
                                <div style={{ marginTop: 4, fontSize: 8, opacity: 0.7 }}>
                                    📍 {weatherData.location}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SmartSuggestions;