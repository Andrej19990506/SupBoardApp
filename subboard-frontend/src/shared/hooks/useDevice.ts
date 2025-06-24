import { useState, useEffect } from 'react';

// Константы для брейкпоинтов
const BREAKPOINTS = {
    mobile: 480,
    tablet: 768,
    laptop: 1024,
    desktop: 1200
} as const;

type DeviceType = 'mobile' | 'tablet' | 'laptop' | 'desktop';

interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    isLaptop: boolean;
    isDesktop: boolean;
    deviceType: DeviceType;
}

// Функция для расчета типа устройства
const calculateDeviceInfo = (width: number): DeviceInfo => {
    const isMobile = width <= BREAKPOINTS.mobile;
    const isTablet = width > BREAKPOINTS.mobile && width <= BREAKPOINTS.tablet;
    const isLaptop = width > BREAKPOINTS.tablet && width <= BREAKPOINTS.laptop;
    const isDesktop = width > BREAKPOINTS.laptop;
    
    let deviceType: DeviceType = 'desktop';
    if (isMobile) deviceType = 'mobile';
    else if (isTablet) deviceType = 'tablet';
    else if (isLaptop) deviceType = 'laptop';
    
    return { isMobile, isTablet, isLaptop, isDesktop, deviceType };
};

export const useDevice = (): DeviceInfo => {
    // Инициализируем с правильными значениями сразу
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
        // Проверяем, доступен ли window (SSR защита)
        if (typeof window !== 'undefined') {
            return calculateDeviceInfo(window.innerWidth);
        }
        // Fallback для SSR
        return {
            isMobile: false,
            isTablet: false,
            isLaptop: false,
            isDesktop: true,
            deviceType: 'desktop'
        };
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const newDeviceInfo = calculateDeviceInfo(width);
            setDeviceInfo(newDeviceInfo);
        };

        // Инициализация при монтировании
        handleResize();

        // Подписка на изменение размера окна
        window.addEventListener('resize', handleResize);

        // Очистка при размонтировании
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return deviceInfo;
}; 