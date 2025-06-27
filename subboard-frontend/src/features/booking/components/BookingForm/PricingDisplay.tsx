import React, { useState, useEffect } from 'react';
import type { PricingDisplayProps, PricingConfig } from './types';
import { SERVICE_TYPES } from '@features/booking/constants/constants';
import { 
    calculateFlexiblePricing, 
    calculateFlexibleDeposits, 
    calculateFlexibleDiscounts, 
    createDefaultPricingForInventoryTypes 
} from './flexiblePricingUtils';
import type { InventoryType } from '@/features/booking/services/inventoryApi';

// Дефолтные тарифы для новой гибкой системы инвентаря
export const DEFAULT_PRICING: PricingConfig = {
    pricingMode: 'hybrid',      // гибридный режим (почасовые + фиксированные)
    
    // Цены по типам инвентаря (будут загружены динамически)
    inventoryPricing: {
        // Базовые настройки для основных типов инвентаря
        // ID 1: SUP доска (по умолчанию)
        1: {
            hourlyRate: 300,
            fixedPrices: {
                rent: {
                    '24h': 2000,
                    '48h': 3500,
                    '72h': 5000,
                    'week': 12000,
                },
                rafting: 1500,
            },
            deposit: 3000,
            requireDeposit: true,
        },
        // ID 2: Каяк (по умолчанию)
        2: {
            hourlyRate: 400,
            fixedPrices: {
                rent: {
                    '24h': 2500,
                    '48h': 4500,
                    '72h': 6500,
                    'week': 15000,
                },
                rafting: 1800,
            },
            deposit: 3000,
            requireDeposit: true,
        },
        // ID 3: Плот (по умолчанию)
        3: {
            hourlyRate: 600,
            fixedPrices: {
                rent: {
                    '24h': 4000,
                    '48h': 7000,
                    '72h': 10000,
                    'week': 24000,
                },
                rafting: 2500,
            },
            deposit: 5000,
            requireDeposit: true,
        },
    },
    
    // Скидки
    discounts: {
        enableDiscounts: true,      // включить скидки
        rates: {
            vip: 10,                // % скидка для VIP
            group: 15,              // % скидка для групп (5+ единиц)
            repeat: 5,              // % скидка для постоянных клиентов
        }
    }
};

const PricingDisplay: React.FC<PricingDisplayProps> = ({
    serviceType,
    selectedItems,
    durationInHours,
    discount = 0,
    isVIP = false,
    pricingConfig = DEFAULT_PRICING,
    onConfigChange,
    showSettings = false,
    // Устаревшие поля для обратной совместимости
    boardCount = 0,
    boardWithSeatCount = 0,
    raftCount = 0
}) => {
    const [showPricingSettings, setShowPricingSettings] = useState(false);
    const [localConfig, setLocalConfig] = useState<PricingConfig>(pricingConfig);
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    const [loading, setLoading] = useState(true);

    // Загружаем типы инвентаря при монтировании и создаем динамическую конфигурацию
    useEffect(() => {
        const loadInventoryTypes = async () => {
            try {
                const { inventoryApi } = await import('@/features/booking/services/inventoryApi');
                const response = await inventoryApi.getInventoryTypes();
                const activeTypes = response.data.filter(type => type.is_active);
                setInventoryTypes(activeTypes);
                
                // Создаем динамическую конфигурацию на основе загруженных типов
                const dynamicConfig = createDefaultPricingForInventoryTypes(activeTypes);
                setLocalConfig(dynamicConfig);
            } catch (error) {
                console.warn('Не удалось загрузить типы инвентаря:', error);
            } finally {
                setLoading(false);
            }
        };
        loadInventoryTypes();
    }, []);

    const handleConfigChange = (newConfig: PricingConfig) => {
        setLocalConfig(newConfig);
        onConfigChange?.(newConfig);
    };

    // Используем новые утилиты для расчета
    const costs = calculateFlexiblePricing(
        serviceType,
        selectedItems,
        inventoryTypes,
        durationInHours,
        localConfig
    );
    
    const deposit = calculateFlexibleDeposits(
        selectedItems,
        inventoryTypes,
        localConfig
    );
    
    const discountInfo = calculateFlexibleDiscounts(
        costs.subtotal,
        selectedItems,
        inventoryTypes,
        isVIP || false,
        discount || 0,
        localConfig
    );

    const finalCost = costs.subtotal - discountInfo.amount;

    // Проверяем есть ли выбранные элементы (новая система или старая)
    const hasSelectedItems = Object.values(selectedItems || {}).some(count => count > 0);
    const hasLegacyItems = boardCount > 0 || (boardWithSeatCount || 0) > 0 || (raftCount || 0) > 0;
    const hasItems = hasSelectedItems || hasLegacyItems;

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
                overflow: 'visible',
                minHeight: 'auto',
                width: '100%',
                boxSizing: 'border-box',
                zIndex: 1
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
                    lineHeight: 1.4,
                    marginBottom: showSettings ? '16px' : '0'
                }}>
                    Выберите инвентарь для расчета стоимости
                </div>
                
                {/* Кнопка настроек даже без выбранного инвентаря */}
                {showSettings && (
                    <div style={{ 
                        marginTop: '16px',
                        textAlign: 'center'
                    }}>
                        <button
                            onClick={() => setShowPricingSettings(true)}
                            style={{
                                background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '12px 20px',
                                color: '#fff',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 15px rgba(0, 122, 255, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                width: '100%'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 122, 255, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>⚙️</span>
                            Настроить цены и залоги
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{
            background: '#2C2C2E',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '16px',
            color: '#fff',
            overflow: 'visible',
            minHeight: 'auto',
            width: '100%',
            boxSizing: 'border-box'
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
                {costs.itemCosts.map((item, index) => (
                    <div key={item.inventoryTypeId} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        fontSize: '14px',
                        marginBottom: '4px'
                    }}>
                        <span>{item.icon} {item.quantity} {item.inventoryTypeName}</span>
                        <span>{item.totalPrice.toLocaleString()}₽</span>
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
            {deposit.total > 0 && (
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
                        <span>{deposit.total.toLocaleString()}₽</span>
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
                    <span>{(finalCost + deposit.total).toLocaleString()}₽</span>
                </div>
                <div style={{ 
                    fontSize: '12px', 
                    color: '#86868B',
                    marginTop: '4px'
                }}>
                    Услуга {finalCost.toLocaleString()}₽{deposit.total > 0 ? ` + залог ${deposit.total.toLocaleString()}₽` : ''}
                </div>
            </div>

            {/* Кнопка настроек цен */}
            {showSettings && (
                <div style={{ 
                    marginTop: '16px',
                    textAlign: 'center'
                }}>
                    <button
                        onClick={() => setShowPricingSettings(true)}
                        style={{
                            background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '12px 20px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 15px rgba(0, 122, 255, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 122, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>⚙️</span>
                        Настроить цены и залоги
                    </button>
                </div>
            )}

            {/* Модальное окно настроек цен под новую гибкую систему */}
            {showPricingSettings && (
                <FlexiblePricingSettingsModal
                    config={localConfig}
                    inventoryTypes={inventoryTypes}
                    onChange={handleConfigChange}
                    onClose={() => setShowPricingSettings(false)}
                />
            )}
        </div>
    );
};

// Модальное окно настроек цен под гибкую систему инвентаря
interface FlexiblePricingSettingsModalProps {
    config: PricingConfig;
    inventoryTypes: InventoryType[];
    onChange: (config: PricingConfig) => void;
    onClose: () => void;
}

const FlexiblePricingSettingsModal: React.FC<FlexiblePricingSettingsModalProps> = ({ 
    config, 
    inventoryTypes, 
    onChange, 
    onClose 
}) => {
    const [localConfig, setLocalConfig] = useState<PricingConfig>(config);

    const handleSave = () => {
        onChange(localConfig);
        onClose();
    };

    const handleReset = () => {
        const resetConfig = createDefaultPricingForInventoryTypes(inventoryTypes);
        setLocalConfig(resetConfig);
    };

    const updateInventoryPricing = (inventoryTypeId: number, path: string, value: number | boolean) => {
        setLocalConfig(prev => {
            const newConfig = { ...prev };
            
            // Убеждаемся что настройки для этого типа инвентаря существуют
            if (!newConfig.inventoryPricing[inventoryTypeId]) {
                newConfig.inventoryPricing[inventoryTypeId] = {
                    hourlyRate: 300,
                    fixedPrices: { rent: { '24h': 2000, '48h': 3500, '72h': 5000, 'week': 12000 }, rafting: 1500 },
                    deposit: 3000,
                    requireDeposit: true
                };
            }
            
            // Обновляем значение по пути
            if (path === 'hourlyRate' || path === 'deposit' || path === 'requireDeposit') {
                (newConfig.inventoryPricing[inventoryTypeId] as any)[path] = value;
            } else if (path === 'fixedPrices.rafting') {
                newConfig.inventoryPricing[inventoryTypeId].fixedPrices.rafting = value as number;
            } else if (path === 'fixedPrices.rent.24h') {
                newConfig.inventoryPricing[inventoryTypeId].fixedPrices.rent['24h'] = value as number;
            }
            
            return newConfig;
        });
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
            zIndex: 20000,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0'
        }} onClick={onClose}>
            <div style={{
                background: '#1C1C1E',
                borderRadius: '20px 20px 0 0',
                padding: '20px',
                width: '100vw',
                maxWidth: '100vw',
                height: '100vh',
                maxHeight: '100vh',
                overflowY: 'auto',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
                border: '1px solid #2C2C2E',
                borderBottom: 'none',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={(e) => e.stopPropagation()}>
                {/* Индикатор свайпа для мобильной версии */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        width: '40px',
                        height: '4px',
                        backgroundColor: '#3C3C3E',
                        borderRadius: '2px'
                    }}></div>
                </div>

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
                        fontSize: '18px',
                        fontWeight: 600 
                    }}>
                        ⚙️ Настройки цен
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#2C2C2E',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#86868B',
                            fontSize: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = '#3C3C3E';
                            (e.target as HTMLButtonElement).style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = '#2C2C2E';
                            (e.target as HTMLButtonElement).style.color = '#86868B';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Прокручиваемый контент */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    paddingRight: '4px',
                    marginRight: '-4px'
                }}>
                    {/* Режим ценообразования */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ 
                            color: '#86868B', 
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px'
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
                                        padding: '12px 16px',
                                        background: localConfig.pricingMode === mode.value ? '#007AFF' : '#2C2C2E',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: localConfig.pricingMode === mode.value ? '#fff' : '#86868B',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Настройки по типам инвентаря */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ 
                            color: '#86868B', 
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '16px'
                        }}>
                            Настройки по типам инвентаря
                        </div>

                        {inventoryTypes.map(type => {
                            const pricing = localConfig.inventoryPricing[type.id] || {
                                hourlyRate: 300,
                                fixedPrices: { rent: { '24h': 2000, '48h': 3500, '72h': 5000, 'week': 12000 }, rafting: 1500 },
                                deposit: 3000,
                                requireDeposit: true
                            };

                            return (
                                <div key={type.id} style={{
                                    background: '#2C2C2E',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '16px',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: '#fff'
                                    }}>
                                        <span style={{ fontSize: '20px' }}>{type.icon_name || '📦'}</span>
                                        {type.display_name}
                                    </div>

                                    {/* Почасовая цена */}
                                    {(localConfig.pricingMode === 'hourly' || localConfig.pricingMode === 'hybrid') && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ 
                                                color: '#86868B', 
                                                fontSize: '12px', 
                                                display: 'block', 
                                                marginBottom: '8px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}>
                                                ⏰ Цена за час (₽)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={pricing.hourlyRate}
                                                onChange={(e) => updateInventoryPricing(type.id, 'hourlyRate', Number(e.target.value))}
                                                style={{
                                                    width: '100%',
                                                    background: '#1C1C1E',
                                                    border: '1px solid #3C3C3E',
                                                    borderRadius: '8px',
                                                    padding: '14px',
                                                    color: '#fff',
                                                    fontSize: '16px',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Фиксированные цены */}
                                    {(localConfig.pricingMode === 'fixed' || localConfig.pricingMode === 'hybrid') && (
                                        <>
                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ 
                                                    color: '#86868B', 
                                                    fontSize: '12px', 
                                                    display: 'block', 
                                                    marginBottom: '8px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    🌊 Цена за сплав (₽)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={pricing.fixedPrices.rafting}
                                                    onChange={(e) => updateInventoryPricing(type.id, 'fixedPrices.rafting', Number(e.target.value))}
                                                    style={{
                                                        width: '100%',
                                                        background: '#1C1C1E',
                                                        border: '1px solid #3C3C3E',
                                                        borderRadius: '8px',
                                                        padding: '14px',
                                                        color: '#fff',
                                                        fontSize: '16px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <label style={{ 
                                                    color: '#86868B', 
                                                    fontSize: '12px', 
                                                    display: 'block', 
                                                    marginBottom: '8px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    🏠 Аренда за сутки (₽)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={pricing.fixedPrices.rent['24h']}
                                                    onChange={(e) => updateInventoryPricing(type.id, 'fixedPrices.rent.24h', Number(e.target.value))}
                                                    style={{
                                                        width: '100%',
                                                        background: '#1C1C1E',
                                                        border: '1px solid #3C3C3E',
                                                        borderRadius: '8px',
                                                        padding: '14px',
                                                        color: '#fff',
                                                        fontSize: '16px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Залог */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '8px'
                                        }}>
                                            <input
                                                type="checkbox"
                                                id={`requireDeposit-${type.id}`}
                                                checked={pricing.requireDeposit}
                                                onChange={(e) => updateInventoryPricing(type.id, 'requireDeposit', e.target.checked)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <label 
                                                htmlFor={`requireDeposit-${type.id}`} 
                                                style={{ 
                                                    color: '#fff', 
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    fontWeight: 500
                                                }}
                                            >
                                                🛡️ Требовать залог
                                            </label>
                                        </div>
                                        
                                        {pricing.requireDeposit && (
                                            <input
                                                type="number"
                                                min="0"
                                                value={pricing.deposit}
                                                onChange={(e) => updateInventoryPricing(type.id, 'deposit', Number(e.target.value))}
                                                style={{
                                                    width: '100%',
                                                    background: '#1C1C1E',
                                                    border: '1px solid #3C3C3E',
                                                    borderRadius: '8px',
                                                    padding: '14px',
                                                    color: '#fff',
                                                    fontSize: '16px',
                                                    outline: 'none'
                                                }}
                                                placeholder="Сумма залога в рублях"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Скидки */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '16px'
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
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                💰 Включить скидки
                            </label>
                        </div>
                        
                        {localConfig.discounts.enableDiscounts && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ 
                                        color: '#86868B', 
                                        fontSize: '12px', 
                                        display: 'block', 
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        💎 VIP клиенты (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={localConfig.discounts.rates.vip}
                                        onChange={(e) => updateConfig('discounts.rates.vip', Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            background: '#2C2C2E',
                                            border: '1px solid #3C3C3E',
                                            borderRadius: '8px',
                                            padding: '14px',
                                            color: '#fff',
                                            fontSize: '16px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ 
                                        color: '#86868B', 
                                        fontSize: '12px', 
                                        display: 'block', 
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        👥 Групповая скидка (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={localConfig.discounts.rates.group}
                                        onChange={(e) => updateConfig('discounts.rates.group', Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            background: '#2C2C2E',
                                            border: '1px solid #3C3C3E',
                                            borderRadius: '8px',
                                            padding: '14px',
                                            color: '#fff',
                                            fontSize: '16px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Кнопки */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'stretch',
                    marginTop: '24px',
                    paddingTop: '20px',
                    borderTop: '1px solid #2C2C2E'
                }}>
                    <button
                        onClick={handleReset}
                        style={{
                            flex: 1,
                            background: 'none',
                            border: '1px solid #3C3C3E',
                            borderRadius: '12px',
                            padding: '14px 20px',
                            color: '#86868B',
                            fontSize: '16px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.borderColor = '#FF9500';
                            (e.target as HTMLButtonElement).style.color = '#FF9500';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.borderColor = '#3C3C3E';
                            (e.target as HTMLButtonElement).style.color = '#86868B';
                        }}
                    >
                        🔄 Сброс
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            background: 'none',
                            border: '1px solid #3C3C3E',
                            borderRadius: '12px',
                            padding: '14px 20px',
                            color: '#86868B',
                            fontSize: '16px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.borderColor = '#FF4D4F';
                            (e.target as HTMLButtonElement).style.color = '#FF4D4F';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.borderColor = '#3C3C3E';
                            (e.target as HTMLButtonElement).style.color = '#86868B';
                        }}
                    >
                        ✕ Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            flex: 2,
                            background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '14px 20px',
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(0, 122, 255, 0.3)',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                            (e.target as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(0, 122, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                            (e.target as HTMLButtonElement).style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
                        }}
                    >
                        💾 Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PricingDisplay; 