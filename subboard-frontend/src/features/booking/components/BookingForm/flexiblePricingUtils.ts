import type { ServiceType } from '@/types/booking';
import type { PricingConfig } from './types';
import type { InventoryType } from '@/features/booking/services/inventoryApi';

// Интерфейсы для результатов расчетов
export interface FlexiblePricingResult {
    subtotal: number;
    itemCosts: Array<{
        inventoryTypeId: number;
        inventoryTypeName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        icon: string;
    }>;
    calculationDetails: string[];
}

export interface FlexibleDepositResult {
    total: number;
    itemDeposits: Array<{
        inventoryTypeId: number;
        inventoryTypeName: string;
        quantity: number;
        unitDeposit: number;
        totalDeposit: number;
        icon: string;
    }>;
}

export interface FlexibleDiscountResult {
    percentage: number;
    amount: number;
    reasons: string[];
}

// Функция расчета стоимости для гибкой системы инвентаря
export function calculateFlexiblePricing(
    serviceType: ServiceType,
    selectedItems: Record<number, number>, // inventoryTypeId -> quantity
    inventoryTypes: InventoryType[],
    durationInHours: number,
    config: PricingConfig
): FlexiblePricingResult {
    let subtotal = 0;
    const itemCosts: FlexiblePricingResult['itemCosts'] = [];
    const calculationDetails: string[] = [];

    // Проходим по всем выбранным типам инвентаря
    Object.entries(selectedItems).forEach(([typeIdStr, quantity]) => {
        if (quantity <= 0) return;

        const typeId = parseInt(typeIdStr, 10);
        const inventoryType = inventoryTypes.find(t => t.id === typeId);
        if (!inventoryType) return;

        const pricing = config.inventoryPricing[typeId];
        if (!pricing) return;

        let unitPrice = 0;

        // Определяем цену в зависимости от режима и типа услуги
        if (serviceType === 'аренда') {
            if (config.pricingMode === 'hourly') {
                unitPrice = pricing.hourlyRate * durationInHours;
            } else if (config.pricingMode === 'fixed') {
                // Определяем длительность аренды
                if (durationInHours <= 24) {
                    unitPrice = pricing.fixedPrices.rent['24h'];
                } else if (durationInHours <= 48) {
                    unitPrice = pricing.fixedPrices.rent['48h'];
                } else if (durationInHours <= 72) {
                    unitPrice = pricing.fixedPrices.rent['72h'];
                } else {
                    unitPrice = pricing.fixedPrices.rent['week'];
                }
            } else { // hybrid
                // В гибридном режиме выбираем более выгодную цену
                const hourlyPrice = pricing.hourlyRate * durationInHours;
                let fixedPrice = pricing.fixedPrices.rent['24h'];
                if (durationInHours <= 24) {
                    fixedPrice = pricing.fixedPrices.rent['24h'];
                } else if (durationInHours <= 48) {
                    fixedPrice = pricing.fixedPrices.rent['48h'];
                } else if (durationInHours <= 72) {
                    fixedPrice = pricing.fixedPrices.rent['72h'];
                } else {
                    fixedPrice = pricing.fixedPrices.rent['week'];
                }
                unitPrice = Math.min(hourlyPrice, fixedPrice);
            }
        } else { // сплав
            unitPrice = pricing.fixedPrices.rafting;
        }

        const totalPrice = unitPrice * quantity;
        subtotal += totalPrice;

        itemCosts.push({
            inventoryTypeId: typeId,
            inventoryTypeName: inventoryType.display_name,
            quantity,
            unitPrice,
            totalPrice,
            icon: inventoryType.icon_name || '📦'
        });

        // Формируем детали расчета
        if (serviceType === 'аренда') {
            calculationDetails.push(
                `${quantity} ${inventoryType.display_name} × ${durationInHours} ч × ${pricing.hourlyRate}₽`
            );
        } else {
            calculationDetails.push(
                `${quantity} ${inventoryType.display_name} × ${unitPrice}₽`
            );
        }
    });

    return {
        subtotal,
        itemCosts,
        calculationDetails
    };
}

// Функция расчета залогов для гибкой системы
export function calculateFlexibleDeposits(
    selectedItems: Record<number, number>,
    inventoryTypes: InventoryType[],
    config: PricingConfig
): FlexibleDepositResult {
    let total = 0;
    const itemDeposits: FlexibleDepositResult['itemDeposits'] = [];

    Object.entries(selectedItems).forEach(([typeIdStr, quantity]) => {
        if (quantity <= 0) return;

        const typeId = parseInt(typeIdStr, 10);
        const inventoryType = inventoryTypes.find(t => t.id === typeId);
        if (!inventoryType) return;

        const pricing = config.inventoryPricing[typeId];
        if (!pricing || !pricing.requireDeposit) return;

        const totalDeposit = pricing.deposit * quantity;
        total += totalDeposit;

        itemDeposits.push({
            inventoryTypeId: typeId,
            inventoryTypeName: inventoryType.display_name,
            quantity,
            unitDeposit: pricing.deposit,
            totalDeposit,
            icon: inventoryType.icon_name || '📦'
        });
    });

    return {
        total,
        itemDeposits
    };
}

// Функция расчета скидок для гибкой системы
export function calculateFlexibleDiscounts(
    subtotal: number,
    selectedItems: Record<number, number>,
    inventoryTypes: InventoryType[],
    isVIP: boolean,
    customDiscount: number,
    config: PricingConfig
): FlexibleDiscountResult {
    if (!config.discounts.enableDiscounts) {
        return { percentage: 0, amount: 0, reasons: [] };
    }

    let percentage = customDiscount || 0;
    const reasons: string[] = [];

    // VIP скидка
    if (isVIP && config.discounts.rates.vip > 0) {
        percentage = Math.max(percentage, config.discounts.rates.vip);
        reasons.push('VIP клиент');
    }

    // Групповая скидка (считаем общее количество инвентаря)
    const totalItems = Object.values(selectedItems).reduce((sum, count) => sum + count, 0);
    if (totalItems >= 5 && config.discounts.rates.group > 0) {
        percentage = Math.max(percentage, config.discounts.rates.group);
        reasons.push('Групповая скидка');
    }

    // Постоянный клиент (пока не реализовано, заглушка)
    // if (isRepeatCustomer && config.discounts.rates.repeat > 0) {
    //     percentage = Math.max(percentage, config.discounts.rates.repeat);
    //     reasons.push('Постоянный клиент');
    // }

    const amount = (subtotal * percentage) / 100;

    return {
        percentage,
        amount,
        reasons
    };
}

// Функция для создания дефолтной конфигурации под конкретные типы инвентаря
export function createDefaultPricingForInventoryTypes(inventoryTypes: InventoryType[]): PricingConfig {
    const inventoryPricing: PricingConfig['inventoryPricing'] = {};

    inventoryTypes.forEach(type => {
        // Определяем базовые цены в зависимости от типа инвентаря
        let baseHourlyRate = 300;
        let baseDeposit = 3000;
        let baseRaftingPrice = 1500;
        
        // Настройки по типам (можно расширить логику)
        if (type.name.toLowerCase().includes('каяк') || type.name.toLowerCase().includes('kayak')) {
            baseHourlyRate = 400;
            baseRaftingPrice = 1800;
        } else if (type.name.toLowerCase().includes('плот') || type.name.toLowerCase().includes('raft')) {
            baseHourlyRate = 600;
            baseDeposit = 5000;
            baseRaftingPrice = 2500;
        } else if (type.name.toLowerCase().includes('сап') || type.name.toLowerCase().includes('sup')) {
            baseHourlyRate = 300;
            baseRaftingPrice = 1500;
        }

        inventoryPricing[type.id] = {
            hourlyRate: baseHourlyRate,
            fixedPrices: {
                rent: {
                    '24h': baseHourlyRate * 7,   // ~7 часов в день
                    '48h': baseHourlyRate * 12,  // ~6 часов в день на 2 дня
                    '72h': baseHourlyRate * 17,  // ~5.5 часов в день на 3 дня
                    'week': baseHourlyRate * 40, // ~5.7 часов в день на неделю
                },
                rafting: baseRaftingPrice,
            },
            deposit: baseDeposit,
            requireDeposit: true,
        };
    });

    return {
        pricingMode: 'hybrid',
        inventoryPricing,
        discounts: {
            enableDiscounts: true,
            rates: {
                vip: 10,
                group: 15,
                repeat: 5,
            }
        }
    };
}

// Функция для мигрирования старой конфигурации в новую
export function migrateLegacyPricingConfig(
    legacyConfig: any, 
    inventoryTypes: InventoryType[]
): PricingConfig {
    // Создаем базовую конфигурацию
    const newConfig = createDefaultPricingForInventoryTypes(inventoryTypes);
    
    // Если есть старая конфигурация, пытаемся перенести данные
    if (legacyConfig) {
        // Переносим режим ценообразования
        if (legacyConfig.pricingMode) {
            newConfig.pricingMode = legacyConfig.pricingMode;
        }
        
        // Переносим скидки
        if (legacyConfig.discounts) {
            newConfig.discounts = { ...newConfig.discounts, ...legacyConfig.discounts };
        }
        
        // Пытаемся перенести старые цены на новые типы
        if (legacyConfig.hourlyRates) {
            inventoryTypes.forEach(type => {
                if (type.name.toLowerCase().includes('сап') || type.name.toLowerCase().includes('sup')) {
                    if (legacyConfig.hourlyRates.boardHourPrice) {
                        newConfig.inventoryPricing[type.id].hourlyRate = legacyConfig.hourlyRates.boardHourPrice;
                    }
                } else if (type.name.toLowerCase().includes('каяк')) {
                    if (legacyConfig.hourlyRates.boardWithSeatHourPrice) {
                        newConfig.inventoryPricing[type.id].hourlyRate = legacyConfig.hourlyRates.boardWithSeatHourPrice;
                    }
                } else if (type.name.toLowerCase().includes('плот')) {
                    if (legacyConfig.hourlyRates.raftHourPrice) {
                        newConfig.inventoryPricing[type.id].hourlyRate = legacyConfig.hourlyRates.raftHourPrice;
                    }
                }
            });
        }
    }
    
    return newConfig;
} 