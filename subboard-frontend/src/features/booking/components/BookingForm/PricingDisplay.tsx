import React, { useState } from 'react';
import type { PricingDisplayProps, PricingConfig } from './types';
import { SERVICE_TYPES } from '@features/booking/constants/constants';
import { calculateFlexiblePricing, calculateDeposits, calculateDiscounts } from './pricingUtils';

// Дефолтные тарифы
export const DEFAULT_PRICING: PricingConfig = {
    pricingMode: 'hybrid',      // гибридный режим (почасовые + фиксированные)
    
    // Почасовые тарифы
    hourlyRates: {
        boardHourPrice: 300,        // руб/час за доску
        boardWithSeatHourPrice: 400, // руб/час за доску с креслом
        raftHourPrice: 600,         // руб/час за плот
    },
    
    // Фиксированные цены за услуги
    fixedPrices: {
        // Аренда (по длительности)
        rent: {
            board: {
                '24h': 2000,    // сутки
                '48h': 3500,    // 2 суток
                '72h': 5000,    // 3 суток
                'week': 12000,  // неделя
            },
            boardWithSeat: {
                '24h': 2500,
                '48h': 4500,
                '72h': 6500,
                'week': 15000,
            },
            raft: {
                '24h': 4000,
                '48h': 7000,
                '72h': 10000,
                'week': 24000,
            },
        },
        // Сплав (фиксированная цена)
        rafting: {
            board: 1500,        // за сплав на доске
            boardWithSeat: 1800, // за сплав на доске с креслом
            raft: 2500,         // за сплав на плоту
        },
    },
    
    // Залоги
    deposits: {
        depositBoard: 3000,         // залог за доску
        depositRaft: 5000,          // залог за плот
        requireDeposit: true,       // требовать залог
    },
    
    // Скидки
    discounts: {
        enableDiscounts: true,      // включить скидки
        rates: {
            vip: 10,                // % скидка для VIP
            group: 15,              // % скидка для групп (5+ досок)
            repeat: 5,              // % скидка для постоянных клиентов
        }
    }
};

const PricingDisplay: React.FC<PricingDisplayProps> = ({
    serviceType,
    boardCount,
    boardWithSeatCount,
    raftCount,
    durationInHours,
    discount = 0,
    isVIP = false,
    pricingConfig = DEFAULT_PRICING,
    onConfigChange,
    showSettings = false
}) => {
    const [showPricingSettings, setShowPricingSettings] = useState(false);
    const [localConfig, setLocalConfig] = useState<PricingConfig>(pricingConfig);

    // Используем новые утилиты для расчета
    const costs = calculateFlexiblePricing(
        serviceType,
        boardCount,
        boardWithSeatCount || 0,
        raftCount || 0,
        durationInHours,
        localConfig
    );
    
    const deposit = calculateDeposits(
        boardCount,
        boardWithSeatCount || 0,
        raftCount || 0,
        localConfig
    );
    
    const discountInfo = calculateDiscounts(
        costs.subtotal,
        isVIP || false,
        boardCount,
        boardWithSeatCount || 0,
        raftCount || 0,
        discount || 0,
        localConfig
    );

    const handleConfigChange = (newConfig: PricingConfig) => {
        setLocalConfig(newConfig);
        onConfigChange?.(newConfig);
    };

    const finalCost = costs.subtotal - discountInfo.amount;

    const hasItems = boardCount > 0 || (boardWithSeatCount || 0) > 0 || (raftCount || 0) > 0;

    if (!hasItems) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #2C2C2E 0%, #3A3A3C 100%)',
                borderRadius: '16px',
                padding: '24px',
                marginTop: '16px',
                textAlign: 'center',
                color: '#86868B',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)'
                }}></div>
                <div style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}>
                    💰 Расчет стоимости
                </div>
                <div style={{
                    fontSize: '14px',
                    color: '#A0A0A5',
                    lineHeight: 1.4
                }}>
                    Выберите инвентарь для расчета стоимости
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#2C2C2E',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '16px',
            color: '#fff'
        }}>
            <div style={{ 
                fontSize: '18px', 
                fontWeight: 600, 
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                💰 Расчет стоимости
                <span style={{ 
                    fontSize: '14px', 
                    color: '#86868B',
                    fontWeight: 400 
                }}>
                    ({serviceType === SERVICE_TYPES.RENT ? `${durationInHours} ч` : '4 ч'})
                </span>
            </div>

            {/* Детализация по инвентарю */}
            <div style={{ marginBottom: '12px' }}>
                {costs.calculationDetails.map((detail, index) => (
                    <div key={index} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        fontSize: '14px',
                        marginBottom: '4px'
                    }}>
                        <span>{detail}</span>
                        <span>
                            {index === 0 && costs.boardCost > 0 && `${costs.boardCost.toLocaleString()}₽`}
                            {index === 1 && costs.boardWithSeatCost > 0 && `${costs.boardWithSeatCost.toLocaleString()}₽`}
                            {index === 2 && costs.raftCost > 0 && `${costs.raftCost.toLocaleString()}₽`}
                        </span>
                    </div>
                ))}
            </div>

            {/* Промежуточный итог */}
            <div style={{ 
                borderTop: '1px solid #3C3C3E',
                paddingTop: '8px',
                marginBottom: '8px'
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: '#86868B'
                }}>
                    <span>Промежуточный итог</span>
                    <span>{costs.subtotal.toLocaleString()}₽</span>
                </div>
            </div>

            {/* Скидки */}
            {discountInfo.percentage > 0 && (
                <div style={{ marginBottom: '8px' }}>
                    {discountInfo.reasons.map((reason, index) => (
                        <div key={index} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            fontSize: '14px',
                            color: '#4CAF50',
                            marginBottom: '2px'
                        }}>
                            <span>💚 {reason}</span>
                        </div>
                    ))}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        fontSize: '14px',
                        color: '#4CAF50',
                        fontWeight: 600
                    }}>
                        <span>Общая скидка ({discountInfo.percentage}%)</span>
                        <span>-{discountInfo.amount.toLocaleString()}₽</span>
                    </div>
                </div>
            )}

            {/* Итоговая стоимость */}
            <div style={{ 
                borderTop: '1px solid #3C3C3E',
                paddingTop: '12px',
                marginBottom: '12px'
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#007AFF'
                }}>
                    <span>К оплате</span>
                    <span>{finalCost.toLocaleString()}₽</span>
                </div>
            </div>

            {/* Залог */}
            {deposit > 0 && (
                <div style={{ 
                    background: '#FFD60020',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '14px'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        color: '#FFD600',
                        fontWeight: 600
                    }}>
                        <span>🛡️ Залог</span>
                        <span>{deposit.toLocaleString()}₽</span>
                    </div>
                    <div style={{ 
                        fontSize: '12px', 
                        color: '#86868B',
                        marginTop: '4px'
                    }}>
                        Возвращается при возврате инвентаря
                    </div>
                </div>
            )}

            {/* Итого к получению от клиента */}
            <div style={{ 
                marginTop: '12px',
                padding: '12px',
                background: '#007AFF20',
                borderRadius: '8px',
                borderLeft: '4px solid #007AFF'
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#007AFF'
                }}>
                    <span>💳 Итого к получению</span>
                    <span>{(finalCost + deposit).toLocaleString()}₽</span>
                </div>
                <div style={{ 
                    fontSize: '12px', 
                    color: '#86868B',
                    marginTop: '4px'
                }}>
                    Услуга {finalCost.toLocaleString()}₽{deposit > 0 ? ` + залог ${deposit.toLocaleString()}₽` : ''}
                </div>
            </div>

            {/* Кнопка настроек цен */}
            {showSettings && (
                <div style={{ 
                    marginTop: '12px',
                    textAlign: 'center'
                }}>
                    <button
                        onClick={() => setShowPricingSettings(true)}
                        style={{
                            background: 'none',
                            border: '1px solid #3C3C3E',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            color: '#86868B',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#007AFF';
                            e.currentTarget.style.color = '#007AFF';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#3C3C3E';
                            e.currentTarget.style.color = '#86868B';
                        }}
                    >
                        ⚙️ Настроить цены и залоги
                    </button>
                </div>
            )}

            {/* Модальное окно настроек цен */}
            {showPricingSettings && (
                <PricingSettingsModal
                    config={localConfig}
                    onChange={handleConfigChange}
                    onClose={() => setShowPricingSettings(false)}
                />
            )}
        </div>
    );
};

// Модальное окно настроек цен
interface PricingSettingsModalProps {
    config: PricingConfig;
    onChange: (config: PricingConfig) => void;
    onClose: () => void;
}

const PricingSettingsModal: React.FC<PricingSettingsModalProps> = ({ config, onChange, onClose }) => {
    const [localConfig, setLocalConfig] = useState<PricingConfig>(config);

    const handleSave = () => {
        onChange(localConfig);
        onClose();
    };

    const handleReset = () => {
        setLocalConfig(DEFAULT_PRICING);
    };

    const updateConfig = (path: string, value: number | boolean | string) => {
        setLocalConfig(prev => {
            const pathParts = path.split('.');
            if (pathParts.length === 1) {
                return { ...prev, [pathParts[0]]: value };
            } else if (pathParts.length === 2) {
                return {
                    ...prev,
                    [pathParts[0]]: {
                        ...(prev as any)[pathParts[0]],
                        [pathParts[1]]: value
                    }
                };
            } else if (pathParts.length === 3) {
                return {
                    ...prev,
                    [pathParts[0]]: {
                        ...(prev as any)[pathParts[0]],
                        [pathParts[1]]: {
                            ...((prev as any)[pathParts[0]] as any)[pathParts[1]],
                            [pathParts[2]]: value
                        }
                    }
                };
            }
            return prev;
        });
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }} onClick={onClose}>
            <div style={{
                background: '#1C1C1E',
                borderRadius: '16px',
                padding: '24px',
                width: '90vw',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                border: '1px solid #2C2C2E'
            }} onClick={(e) => e.stopPropagation()}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #2C2C2E'
                }}>
                    <h3 style={{ 
                        color: '#fff', 
                        margin: 0,
                        fontSize: '20px',
                        fontWeight: 600 
                    }}>
                        ⚙️ Настройки цен и залогов
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#86868B',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.color = '#86868B';
                        }}
                    >
                        ✕
                    </button>
                </div>

            {/* Режим ценообразования */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                    color: '#86868B', 
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px'
                }}>
                    Режим ценообразования
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {[
                        { value: 'hourly', label: '⏰ Почасовой' },
                        { value: 'fixed', label: '💰 Фиксированный' },
                        { value: 'hybrid', label: '🔄 Гибридный' }
                    ].map(mode => (
                        <button
                            key={mode.value}
                            onClick={() => updateConfig('pricingMode', mode.value)}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                background: localConfig.pricingMode === mode.value ? '#007AFF' : '#2C2C2E',
                                border: 'none',
                                borderRadius: '6px',
                                color: localConfig.pricingMode === mode.value ? '#fff' : '#86868B',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600
                            }}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Почасовые тарифы */}
            {(localConfig.pricingMode === 'hourly' || localConfig.pricingMode === 'hybrid') && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ 
                        color: '#86868B', 
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '8px'
                    }}>
                        Цены за час (₽)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                🏄‍♂️ Доска
                            </label>
                            <input
                                type="number"
                                value={localConfig.hourlyRates.boardHourPrice}
                                onChange={(e) => updateConfig('hourlyRates.boardHourPrice', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: '#2C2C2E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '4px',
                                    padding: '6px',
                                    color: '#fff',
                                    fontSize: '12px'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                🪑 С креслом
                            </label>
                            <input
                                type="number"
                                value={localConfig.hourlyRates.boardWithSeatHourPrice}
                                onChange={(e) => updateConfig('hourlyRates.boardWithSeatHourPrice', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: '#2C2C2E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '4px',
                                    padding: '6px',
                                    color: '#fff',
                                    fontSize: '12px'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                🚣‍♂️ Плот
                            </label>
                            <input
                                type="number"
                                value={localConfig.hourlyRates.raftHourPrice}
                                onChange={(e) => updateConfig('hourlyRates.raftHourPrice', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: '#2C2C2E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '4px',
                                    padding: '6px',
                                    color: '#fff',
                                    fontSize: '12px'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Фиксированные цены */}
            {(localConfig.pricingMode === 'fixed' || localConfig.pricingMode === 'hybrid') && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ 
                        color: '#86868B', 
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '8px'
                    }}>
                        Фиксированные цены (₽)
                    </div>
                    
                    {/* Сплав */}
                    <div style={{ marginBottom: '12px' }}>
                        <h5 style={{ color: '#fff', fontSize: '14px', margin: '0 0 6px 0' }}>🌊 Сплав (за услугу)</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                                    🏄‍♂️ Доска за сплав
                                </label>
                                <input
                                    type="number"
                                    placeholder="1500"
                                    value={localConfig.fixedPrices.rafting.board}
                                    onChange={(e) => updateConfig('fixedPrices.rafting.board', Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                                    🪑 С креслом за сплав
                                </label>
                                <input
                                    type="number"
                                    placeholder="1800"
                                    value={localConfig.fixedPrices.rafting.boardWithSeat}
                                    onChange={(e) => updateConfig('fixedPrices.rafting.boardWithSeat', Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                                    🚣‍♂️ Плот за сплав
                                </label>
                                <input
                                    type="number"
                                    placeholder="2500"
                                    value={localConfig.fixedPrices.rafting.raft}
                                    onChange={(e) => updateConfig('fixedPrices.rafting.raft', Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Аренда */}
                    <div>
                        <h5 style={{ color: '#fff', fontSize: '14px', margin: '0 0 6px 0' }}>🏠 Аренда (сутки)</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                                    🏄‍♂️ Доска за 24ч
                                </label>
                                <input
                                    type="number"
                                    placeholder="2000"
                                    value={localConfig.fixedPrices.rent.board['24h']}
                                    onChange={(e) => updateConfig('fixedPrices.rent.board.24h', Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                                    🪑 С креслом за 24ч
                                </label>
                                <input
                                    type="number"
                                    placeholder="2500"
                                    value={localConfig.fixedPrices.rent.boardWithSeat['24h']}
                                    onChange={(e) => updateConfig('fixedPrices.rent.boardWithSeat.24h', Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                                    🚣‍♂️ Плот за 24ч
                                </label>
                                <input
                                    type="number"
                                    placeholder="4000"
                                    value={localConfig.fixedPrices.rent.raft['24h']}
                                    onChange={(e) => updateConfig('fixedPrices.rent.raft.24h', Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Залоги */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                }}>
                    <input
                        type="checkbox"
                        id="requireDeposit"
                        checked={localConfig.deposits.requireDeposit}
                        onChange={(e) => updateConfig('deposits.requireDeposit', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <label 
                        htmlFor="requireDeposit" 
                        style={{ 
                            color: '#fff', 
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        🛡️ Требовать залог
                    </label>
                </div>
                
                {localConfig.deposits.requireDeposit && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                                Залог за доску (₽)
                            </label>
                            <input
                                type="number"
                                value={localConfig.deposits.depositBoard}
                                onChange={(e) => updateConfig('deposits.depositBoard', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: '#2C2C2E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    color: '#fff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ color: '#fff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                                Залог за плот (₽)
                            </label>
                            <input
                                type="number"
                                value={localConfig.deposits.depositRaft}
                                onChange={(e) => updateConfig('deposits.depositRaft', Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: '#2C2C2E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    color: '#fff',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Скидки */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                }}>
                    <input
                        type="checkbox"
                        id="enableDiscounts"
                        checked={localConfig.discounts.enableDiscounts}
                        onChange={(e) => updateConfig('discounts.enableDiscounts', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <label 
                        htmlFor="enableDiscounts" 
                        style={{ 
                            color: '#fff', 
                            fontSize: '14px',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        💰 Включить скидки
                    </label>
                </div>
                
                {localConfig.discounts.enableDiscounts && (
                    <>
                        <div style={{ 
                            color: '#86868B', 
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '8px'
                        }}>
                            Размеры скидок (%)
                        </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                        <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                            💎 VIP клиенты
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="30"
                            placeholder="10"
                            value={localConfig.discounts.rates.vip}
                            onChange={(e) => updateConfig('discounts.rates.vip', Number(e.target.value))}
                            style={{
                                width: '100%',
                                background: '#2C2C2E',
                                border: '1px solid #3C3C3E',
                                borderRadius: '4px',
                                padding: '6px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                            👥 Группы (5+ предметов)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="30"
                            placeholder="15"
                            value={localConfig.discounts.rates.group}
                            onChange={(e) => updateConfig('discounts.rates.group', Number(e.target.value))}
                            style={{
                                width: '100%',
                                background: '#2C2C2E',
                                border: '1px solid #3C3C3E',
                                borderRadius: '4px',
                                padding: '6px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ color: '#86868B', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                            🔄 Постоянные клиенты
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="30"
                            placeholder="5"
                            value={localConfig.discounts.rates.repeat}
                            onChange={(e) => updateConfig('discounts.rates.repeat', Number(e.target.value))}
                            style={{
                                width: '100%',
                                background: '#2C2C2E',
                                border: '1px solid #3C3C3E',
                                borderRadius: '4px',
                                padding: '6px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                        />
                    </div>
                </div>
                    </>
                )}
            </div>

            {/* Кнопки */}
            <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end'
            }}>
                <button
                    onClick={handleReset}
                    style={{
                        background: 'none',
                        border: '1px solid #3C3C3E',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: '#86868B',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    По умолчанию
                </button>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: '1px solid #3C3C3E',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: '#86868B',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Отмена
                </button>
                <button
                    onClick={handleSave}
                    style={{
                        background: '#007AFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Сохранить
                </button>
            </div>
            </div>
        </div>
    );
};

export default PricingDisplay; 