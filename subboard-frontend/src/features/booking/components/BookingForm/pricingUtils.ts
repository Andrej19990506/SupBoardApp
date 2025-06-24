import type { PricingConfig } from './types';
import { SERVICE_TYPES } from '@features/booking/constants/constants';

// Утилиты для нового гибкого ценообразования
export const calculateFlexiblePricing = (
    serviceType: string,
    boardCount: number,
    boardWithSeatCount: number,
    raftCount: number,
    durationInHours: number,
    config: PricingConfig
) => {
    const hours = serviceType === SERVICE_TYPES.RENT ? durationInHours : 4;
    let boardCost = 0;
    let boardWithSeatCost = 0;
    let raftCost = 0;
    let calculationDetails: string[] = [];

    if (serviceType === SERVICE_TYPES.RAFTING) {
        // Для сплава
        if (config.pricingMode === 'hourly') {
            // Почасовой расчет для сплава
            boardCost = boardCount * config.hourlyRates.boardHourPrice * hours;
            boardWithSeatCost = (boardWithSeatCount || 0) * config.hourlyRates.boardWithSeatHourPrice * hours;
            raftCost = (raftCount || 0) * config.hourlyRates.raftHourPrice * hours;
            
            if (boardCount > 0) calculationDetails.push(`🏄‍♂️ Доски (${boardCount} × ${hours}ч × ${config.hourlyRates.boardHourPrice}₽)`);
            if (boardWithSeatCount > 0) calculationDetails.push(`🪑 Доски с креслом (${boardWithSeatCount} × ${hours}ч × ${config.hourlyRates.boardWithSeatHourPrice}₽)`);
            if (raftCount > 0) calculationDetails.push(`🚣‍♂️ Плоты (${raftCount} × ${hours}ч × ${config.hourlyRates.raftHourPrice}₽)`);
        } else {
            // Фиксированные цены для сплава
            boardCost = boardCount * config.fixedPrices.rafting.board;
            boardWithSeatCost = (boardWithSeatCount || 0) * config.fixedPrices.rafting.boardWithSeat;
            raftCost = (raftCount || 0) * config.fixedPrices.rafting.raft;
            
            if (boardCount > 0) calculationDetails.push(`🏄‍♂️ Доски (${boardCount} × ${config.fixedPrices.rafting.board}₽ за сплав)`);
            if (boardWithSeatCount > 0) calculationDetails.push(`🪑 Доски с креслом (${boardWithSeatCount} × ${config.fixedPrices.rafting.boardWithSeat}₽ за сплав)`);
            if (raftCount > 0) calculationDetails.push(`🚣‍♂️ Плоты (${raftCount} × ${config.fixedPrices.rafting.raft}₽ за сплав)`);
        }
    } else {
        // Для аренды
        if (config.pricingMode === 'hourly') {
            // Почасовой расчет
            boardCost = boardCount * config.hourlyRates.boardHourPrice * hours;
            boardWithSeatCost = (boardWithSeatCount || 0) * config.hourlyRates.boardWithSeatHourPrice * hours;
            raftCost = (raftCount || 0) * config.hourlyRates.raftHourPrice * hours;
            
            if (boardCount > 0) calculationDetails.push(`🏄‍♂️ Доски (${boardCount} × ${hours}ч × ${config.hourlyRates.boardHourPrice}₽)`);
            if (boardWithSeatCount > 0) calculationDetails.push(`🪑 Доски с креслом (${boardWithSeatCount} × ${hours}ч × ${config.hourlyRates.boardWithSeatHourPrice}₽)`);
            if (raftCount > 0) calculationDetails.push(`🚣‍♂️ Плоты (${raftCount} × ${hours}ч × ${config.hourlyRates.raftHourPrice}₽)`);
        } else {
            // Фиксированные цены по длительности
            const durationKey = getDurationKey(hours);
            const durationLabel = getDurationLabel(durationKey);
            
            boardCost = boardCount * config.fixedPrices.rent.board[durationKey];
            boardWithSeatCost = (boardWithSeatCount || 0) * config.fixedPrices.rent.boardWithSeat[durationKey];
            raftCost = (raftCount || 0) * config.fixedPrices.rent.raft[durationKey];
            
            if (boardCount > 0) calculationDetails.push(`🏄‍♂️ Доски (${boardCount} × ${config.fixedPrices.rent.board[durationKey]}₽ за ${durationLabel})`);
            if (boardWithSeatCount > 0) calculationDetails.push(`🪑 Доски с креслом (${boardWithSeatCount} × ${config.fixedPrices.rent.boardWithSeat[durationKey]}₽ за ${durationLabel})`);
            if (raftCount > 0) calculationDetails.push(`🚣‍♂️ Плоты (${raftCount} × ${config.fixedPrices.rent.raft[durationKey]}₽ за ${durationLabel})`);
        }
    }

    return {
        boardCost,
        boardWithSeatCost,
        raftCost,
        subtotal: boardCost + boardWithSeatCost + raftCost,
        hours,
        calculationDetails,
        calculationMethod: serviceType === SERVICE_TYPES.RAFTING 
            ? (config.pricingMode === 'hourly' ? 'hourly' : 'fixed-rafting')
            : (config.pricingMode === 'hourly' ? 'hourly' : 'fixed-rent')
    };
};

// Функция для определения ключа длительности
export const getDurationKey = (hours: number): '24h' | '48h' | '72h' | 'week' => {
    if (hours <= 24) return '24h';
    if (hours <= 48) return '48h';
    if (hours <= 72) return '72h';
    return 'week';
};

// Функция для получения читаемого названия длительности
export const getDurationLabel = (key: '24h' | '48h' | '72h' | 'week'): string => {
    switch (key) {
        case '24h': return 'сутки';
        case '48h': return '2 суток';
        case '72h': return '3 суток';
        case 'week': return 'неделю';
        default: return 'период';
    }
};

// Расчет залогов
export const calculateDeposits = (
    boardCount: number,
    boardWithSeatCount: number,
    raftCount: number,
    config: PricingConfig
) => {
    if (!config.deposits.requireDeposit) return 0;
    
    const totalBoards = boardCount + (boardWithSeatCount || 0);
    const totalRafts = raftCount || 0;
    
    return totalBoards * config.deposits.depositBoard + totalRafts * config.deposits.depositRaft;
};

// Расчет скидок
export const calculateDiscounts = (
    subtotal: number,
    isVIP: boolean,
    boardCount: number,
    boardWithSeatCount: number,
    raftCount: number,
    manualDiscount: number,
    config: PricingConfig
) => {
    let totalDiscount = 0;
    const discountReasons: string[] = [];

    // Проверяем, включены ли скидки
    if (!config.discounts.enableDiscounts) {
        return {
            percentage: 0,
            amount: 0,
            reasons: []
        };
    }

    // VIP скидка
    if (isVIP && config.discounts.rates.vip > 0) {
        totalDiscount += config.discounts.rates.vip;
        discountReasons.push(`VIP клиент (-${config.discounts.rates.vip}%)`);
    }

    // Групповая скидка
    const totalInventory = boardCount + (boardWithSeatCount || 0) + (raftCount || 0);
    if (totalInventory >= 5 && config.discounts.rates.group > 0) {
        totalDiscount += config.discounts.rates.group;
        discountReasons.push(`Группа ${totalInventory}+ предметов (-${config.discounts.rates.group}%)`);
    }

    // Ручная скидка
    if (manualDiscount > 0) {
        totalDiscount += manualDiscount;
        discountReasons.push(`Скидка сотрудника (-${manualDiscount}%)`);
    }

    // Максимальная скидка 30%
    totalDiscount = Math.min(totalDiscount, 30);

    const discountAmount = Math.round(subtotal * totalDiscount / 100);

    return {
        percentage: totalDiscount,
        amount: discountAmount,
        reasons: discountReasons
    };
}; 