import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryApi, type InventoryType, type InventoryItem, type InventoryStats } from '@/features/booking/services/inventoryApi';
import { useDevice } from '@/shared/hooks/useDevice';

interface MobileInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileInventoryModal: React.FC<MobileInventoryModalProps> = ({
    isOpen,
    onClose
}) => {
    const { isMobile, deviceType } = useDevice();
    const [activeTab, setActiveTab] = useState<'overview' | 'types' | 'items'>('overview');
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Состояния для форм
    const [showCreateTypeForm, setShowCreateTypeForm] = useState(false);
    const [showCreateItemsForm, setShowCreateItemsForm] = useState(false);
    const [selectedTypeForItems, setSelectedTypeForItems] = useState<number | null>(null);
    
    // Состояние формы создания типа
    const [newTypeForm, setNewTypeForm] = useState({
        name: '',
        display_name: '',
        description: '',
        icon_name: '',
        color: '#007AFF',
        affects_availability: false,
        board_equivalent: 0.0,
        initial_quantity: 1
    });
    
    // Состояние формы создания единиц
    const [newItemsForm, setNewItemsForm] = useState({
        quantity: 1,
        name_prefix: ''
    });
    
    // Популярные иконки для инвентаря
    const inventoryIcons = [
        '🛶', '🚣', '⛵', '🏄‍♂️', '🏄‍♀️', '🤿', '🦺', '⛑️',
        '🎯', '🏹', '🎪', '⛰️', '🏔️', '🌊', '🏖️', '🌅',
        '🔥', '⭐', '💎', '🎨', '🎭', '🎪', '🎡', '🎢',
        '🚁', '✈️', '🚀', '⚓', '🧭', '🗺️', '📍', '🎒'
    ];

    // Адаптивные размеры
    const isSmallMobile = deviceType === 'mobile';
    const padding = isSmallMobile ? 16 : 20;
    const titleSize = isSmallMobile ? 20 : 24;
    const cardPadding = isSmallMobile ? 16 : 20;
    const buttonHeight = isSmallMobile ? 48 : 52;
    const fontSize = isSmallMobile ? 14 : 16;

    // Загрузка данных
    useEffect(() => {
        if (isOpen) {
            loadInventoryData();
        }
    }, [isOpen]);

    const loadInventoryData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [typesResponse, itemsResponse, statsResponse] = await Promise.all([
                inventoryApi.getInventoryTypes(),
                inventoryApi.getInventoryItems(),
                inventoryApi.getInventoryStats()
            ]);
            
            setInventoryTypes(typesResponse.data);
            setInventoryItems(itemsResponse.data);
            setInventoryStats(statsResponse.data);
        } catch (err) {
            console.error('Ошибка загрузки данных инвентаря:', err);
            setError('Не удалось загрузить данные инвентаря');
        } finally {
            setLoading(false);
        }
    };

    // Кэш переводов
    const translationCache = useRef<Map<string, string>>(new Map());
    const [isTranslating, setIsTranslating] = useState(false);
    const translationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Словарь переводов
    const inventoryTranslations: {[key: string]: string} = {
        'каяк': 'kayak', 'байдарка': 'kayak', 'лодка': 'boat', 'плот': 'raft',
        'доска': 'board', 'сап': 'sup', 'sup': 'sup', 'серф': 'surf',
        'жилет': 'jacket', 'спасжилет': 'life_jacket', 'шлем': 'helmet',
        'весло': 'paddle', 'весла': 'paddles', 'гидрокостюм': 'wetsuit'
    };

    // Функция перевода
    const translateToEnglish = async (text: string): Promise<string> => {
        const cacheKey = text.toLowerCase().trim();
        if (translationCache.current.has(cacheKey)) {
            return translationCache.current.get(cacheKey)!;
        }

        if (!/[а-яё]/i.test(text)) {
            const result = text.toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            translationCache.current.set(cacheKey, result);
            return result;
        }

        // Умный перевод через словарь
        const words = text.toLowerCase().split(/[\s\-_.,!?()]+/).filter(w => w.length > 0);
        const translatedWords = words.map(word => {
            if (inventoryTranslations[word]) {
                return inventoryTranslations[word];
            }
            for (const [ru, en] of Object.entries(inventoryTranslations)) {
                if (word.includes(ru)) {
                    return en;
                }
            }
            return null;
        });

        if (translatedWords.every(w => w !== null)) {
            const result = translatedWords.join('_');
            translationCache.current.set(cacheKey, result);
            return result;
        }

        // Fallback - транслитерация
        const fallback = text
            .toLowerCase()
            .replace(/[а-яё]/g, (char) => {
                const map: {[key: string]: string} = {
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
                    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
                    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
                };
                return map[char] || char;
            })
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        translationCache.current.set(cacheKey, fallback);
        return fallback;
    };

    // Автозаполнение системного имени
    const handleDisplayNameChange = async (value: string) => {
        setNewTypeForm(prev => ({ ...prev, display_name: value }));

        if (value.trim() && /[а-яё]/i.test(value)) {
            if (translationTimeoutRef.current) {
                clearTimeout(translationTimeoutRef.current);
            }
            
            setIsTranslating(true);
            
            translationTimeoutRef.current = setTimeout(async () => {
                try {
                    const translatedName = await translateToEnglish(value);
                    setNewTypeForm(prev => ({ ...prev, name: translatedName }));
                } catch (error) {
                    console.error('Ошибка перевода:', error);
                } finally {
                    setIsTranslating(false);
                }
            }, 500);
        } else if (value.trim() === '') {
            if (translationTimeoutRef.current) {
                clearTimeout(translationTimeoutRef.current);
            }
            setIsTranslating(false);
            setNewTypeForm(prev => ({ ...prev, name: '' }));
        }
    };

    // Функции для создания инвентаря
    const handleCreateType = async () => {
        try {
            setLoading(true);
            await inventoryApi.createInventoryTypeQuick(newTypeForm);
            setShowCreateTypeForm(false);
            setNewTypeForm({
                name: '',
                display_name: '',
                description: '',
                icon_name: '',
                color: '#007AFF',
                affects_availability: false,
                board_equivalent: 0.0,
                initial_quantity: 1
            });
            await loadInventoryData();
        } catch (err) {
            console.error('Ошибка создания типа инвентаря:', err);
            setError('Не удалось создать тип инвентаря');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateItems = async () => {
        if (!selectedTypeForItems) return;
        
        try {
            setLoading(true);
            await inventoryApi.createInventoryItemsBulk(selectedTypeForItems, newItemsForm.quantity, newItemsForm.name_prefix);
            setShowCreateItemsForm(false);
            setSelectedTypeForItems(null);
            setNewItemsForm({ quantity: 1, name_prefix: '' });
            await loadInventoryData();
        } catch (err) {
            console.error('Ошибка создания единиц инвентаря:', err);
            setError('Не удалось создать единицы инвентаря');
        } finally {
            setLoading(false);
        }
    };

    // Функции для статусов
    const getStatusIcon = (status: string): string => {
        switch (status) {
            case 'available': return '✅';
            case 'in_use': return '🔵';
            case 'servicing': return '🔧';
            case 'repair': return '🔴';
            default: return '❓';
        }
    };

    const getStatusName = (status: string): string => {
        switch (status) {
            case 'available': return 'Доступно';
            case 'in_use': return 'Используется';
            case 'servicing': return 'Обслуживание';
            case 'repair': return 'В ремонте';
            default: return 'Неизвестно';
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.98) 0%, rgba(25, 25, 35, 0.95) 30%, rgba(20, 20, 30, 0.97) 70%, rgba(10, 10, 15, 0.98) 100%)',
                    backdropFilter: 'blur(20px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 30,
                        duration: 0.5 
                    }}
                    style={{
                        background: 'linear-gradient(135deg, rgba(28, 28, 30, 0.95) 0%, rgba(44, 44, 46, 0.9) 50%, rgba(28, 28, 30, 0.95) 100%)',
                        backdropFilter: 'blur(30px)',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Заголовок */}
                    <div style={{
                        padding: `${padding}px ${padding}px ${padding - 4}px`,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%)',
                        backdropFilter: 'blur(20px)',
                        position: 'relative',
                        flexShrink: 0
                    }}>
                        {/* Индикатор для закрытия */}
                        <div style={{
                            position: 'absolute',
                            top: 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 36,
                            height: 4,
                            backgroundColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 2
                        }} />
                        
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <span style={{ fontSize: isSmallMobile ? 20 : 24 }}>📦</span>
                            <h2 style={{
                                margin: 0,
                                color: '#fff',
                                fontSize: titleSize,
                                fontWeight: 700,
                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                            }}>
                                Управление инвентарем
                            </h2>
                        </div>
                        
                        <motion.button
                            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: 12,
                                width: 36,
                                height: 36,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: 18,
                                cursor: 'pointer',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            ✕
                        </motion.button>
                    </div>

                    {/* Вкладки */}
                    <div style={{
                        display: 'flex',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: `0 ${padding}px`,
                        background: 'rgba(28, 28, 30, 0.6)',
                        backdropFilter: 'blur(15px)',
                        flexShrink: 0
                    }}>
                        {[
                            { key: 'overview', label: '📊 Обзор', icon: '📊' },
                            { key: 'types', label: '📦 Типы', icon: '📦' },
                            { key: 'items', label: '📋 Единицы', icon: '📋' }
                        ].map(tab => (
                            <motion.button
                                key={tab.key}
                                whileHover={{ backgroundColor: 'rgba(0, 122, 255, 0.1)' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab(tab.key as any)}
                                style={{
                                    background: activeTab === tab.key ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                                    border: 'none',
                                    color: activeTab === tab.key ? '#007AFF' : 'rgba(255, 255, 255, 0.7)',
                                    padding: `${isSmallMobile ? 12 : 16}px ${isSmallMobile ? 8 : 12}px`,
                                    fontSize: isSmallMobile ? 12 : 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    borderRadius: '12px 12px 0 0',
                                    position: 'relative',
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: isSmallMobile ? 4 : 6,
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <span style={{ fontSize: isSmallMobile ? 14 : 16 }}>{tab.icon}</span>
                                <span style={{ 
                                    display: isSmallMobile ? 'none' : 'inline',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {tab.label.split(' ')[1]}
                                </span>
                                {activeTab === tab.key && (
                                    <motion.div
                                        layoutId="activeTab"
                                        style={{
                                            position: 'absolute',
                                            bottom: -1,
                                            left: 0,
                                            right: 0,
                                            height: 2,
                                            background: '#007AFF',
                                            borderRadius: '1px 1px 0 0'
                                        }}
                                    />
                                )}
                            </motion.button>
                        ))}
                    </div>

                    {/* Контент */}
                    <div style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: `${padding}px`,
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {loading ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '60px 20px',
                                color: 'rgba(255, 255, 255, 0.7)'
                            }}>
                                <div style={{
                                    width: isSmallMobile ? 32 : 40,
                                    height: isSmallMobile ? 32 : 40,
                                    border: '3px solid rgba(255, 255, 255, 0.1)',
                                    borderTop: '3px solid #007AFF',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: 16
                                }} />
                                <div style={{ fontSize, textAlign: 'center' }}>
                                    Загрузка данных инвентаря...
                                </div>
                                <style>{`
                                    @keyframes spin {
                                        0% { transform: rotate(0deg); }
                                        100% { transform: rotate(360deg); }
                                    }
                                `}</style>
                            </div>
                        ) : error ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '60px 20px',
                                color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                                <div style={{ fontSize: isSmallMobile ? 48 : 64, marginBottom: 16 }}>❌</div>
                                <h3 style={{
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    fontSize: isSmallMobile ? 16 : 20,
                                    fontWeight: 600,
                                    margin: '0 0 8px 0'
                                }}>
                                    Ошибка загрузки
                                </h3>
                                <p style={{ fontSize, margin: 0, lineHeight: 1.5 }}>{error}</p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'overview' && renderOverview()}
                                {activeTab === 'types' && renderTypes()}
                                {activeTab === 'items' && renderItems()}
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );

    // Рендер вкладки "Обзор"
    function renderOverview() {
        if (!inventoryStats) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Статистические карточки */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 12
                }}>
                    {[
                        { value: inventoryStats.total_types, label: 'Типов', color: '#52C41A', icon: '📦' },
                        { value: inventoryStats.total_items, label: 'Единиц', color: '#007AFF', icon: '📋' },
                        { value: inventoryStats.available_items, label: 'Доступно', color: '#52C41A', icon: '✅' },
                        { value: inventoryStats.in_use_items, label: 'Используется', color: '#007AFF', icon: '🔵' }
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%)',
                                backdropFilter: 'blur(15px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: 16,
                                padding: cardPadding,
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                fontSize: isSmallMobile ? 24 : 28,
                                fontWeight: 800,
                                color: stat.color,
                                marginBottom: 4,
                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: isSmallMobile ? 11 : 12,
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                                {stat.label}
                            </div>
                            <div style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                fontSize: isSmallMobile ? 16 : 18,
                                opacity: 0.3
                            }}>
                                {stat.icon}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Детальная статистика по типам */}
                {Object.keys(inventoryStats.by_type).length > 0 && (
                    <div>
                        <h3 style={{
                            color: '#fff',
                            fontSize: isSmallMobile ? 16 : 18,
                            fontWeight: 600,
                            margin: '0 0 12px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            📊 Статистика по типам
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {Object.entries(inventoryStats.by_type).map(([typeName, typeStats]) => {
                                const type = inventoryTypes.find(t => t.name === typeName);
                                return (
                                    <motion.div
                                        key={typeName}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%)',
                                            backdropFilter: 'blur(15px)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: 14,
                                            padding: cardPadding,
                                            borderLeft: `4px solid ${type?.color || '#007AFF'}`
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            marginBottom: 12
                                        }}>
                                            <div style={{
                                                fontSize: isSmallMobile ? 20 : 24,
                                                width: isSmallMobile ? 32 : 36,
                                                height: isSmallMobile ? 32 : 36,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: 10,
                                                background: 'rgba(255, 255, 255, 0.1)'
                                            }}>
                                                {type?.icon_name || '📦'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    color: '#fff',
                                                    fontSize: isSmallMobile ? 14 : 16,
                                                    fontWeight: 600
                                                }}>
                                                    {type?.display_name || typeName}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(4, 1fr)',
                                            gap: 8
                                        }}>
                                            {[
                                                { value: typeStats.available, label: 'Доступно', color: '#52C41A' },
                                                { value: typeStats.in_use, label: 'Используется', color: '#007AFF' },
                                                { value: typeStats.servicing, label: 'Обслуживание', color: '#FFD600' },
                                                { value: typeStats.repair, label: 'Ремонт', color: '#FF4D4F' }
                                            ].map((stat, idx) => (
                                                <div key={idx} style={{ textAlign: 'center' }}>
                                                    <div style={{
                                                        fontSize: isSmallMobile ? 16 : 18,
                                                        fontWeight: 700,
                                                        color: stat.color
                                                    }}>
                                                        {stat.value}
                                                    </div>
                                                    <div style={{
                                                        fontSize: isSmallMobile ? 9 : 10,
                                                        color: 'rgba(255, 255, 255, 0.6)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: 0.3
                                                    }}>
                                                        {stat.label}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Рендер вкладки "Типы инвентаря"
    function renderTypes() {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Кнопки действий */}
                <div style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap'
                }}>
                    <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: '#0056CC' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreateTypeForm(true)}
                        style={{
                            background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                            border: 'none',
                            borderRadius: 12,
                            padding: `${isSmallMobile ? 12 : 14}px ${isSmallMobile ? 16 : 20}px`,
                            color: '#fff',
                            fontSize: isSmallMobile ? 13 : 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)',
                            flex: 1,
                            justifyContent: 'center',
                            minHeight: buttonHeight
                        }}
                    >
                        <span style={{ fontSize: isSmallMobile ? 14 : 16 }}>➕</span>
                        Создать тип
                    </motion.button>
                    {inventoryTypes.length > 0 && (
                        <motion.button
                            whileHover={{ scale: 1.02, backgroundColor: '#28A745' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowCreateItemsForm(true)}
                            style={{
                                background: 'linear-gradient(135deg, #30D158 0%, #28A745 100%)',
                                border: 'none',
                                borderRadius: 12,
                                padding: `${isSmallMobile ? 12 : 14}px ${isSmallMobile ? 16 : 20}px`,
                                color: '#fff',
                                fontSize: isSmallMobile ? 13 : 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                boxShadow: '0 4px 16px rgba(52, 199, 89, 0.3)',
                                flex: 1,
                                justifyContent: 'center',
                                minHeight: buttonHeight
                            }}
                        >
                            <span style={{ fontSize: isSmallMobile ? 14 : 16 }}>📦</span>
                            Добавить единицы
                        </motion.button>
                    )}
                </div>

                {/* Форма создания типа */}
                <AnimatePresence>
                    {showCreateTypeForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                background: 'rgba(28, 28, 30, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 16,
                                padding: cardPadding,
                                backdropFilter: 'blur(16px)'
                            }}
                        >
                            <h3 style={{
                                margin: '0 0 16px 0',
                                fontSize: isSmallMobile ? 16 : 18,
                                fontWeight: 600,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                ➕ Создание нового типа
                            </h3>
                            
                            {/* Поля формы */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Отображаемое название *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Каяк, Спасательный жилет, Весло..."
                                        value={newTypeForm.display_name}
                                        onChange={(e) => handleDisplayNameChange(e.target.value)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                                
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Системное имя *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isTranslating ? "Переводим..." : "kayak, life_jacket, paddle..."}
                                        value={newTypeForm.name}
                                        onChange={(e) => setNewTypeForm({...newTypeForm, name: e.target.value})}
                                        disabled={isTranslating}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            opacity: isTranslating ? 0.6 : 1
                                        }}
                                    />
                                </div>

                                {/* Выбор иконки */}
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Иконка
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${isSmallMobile ? 6 : 8}, 1fr)`,
                                        gap: 6,
                                        maxHeight: 120,
                                        overflow: 'auto',
                                        padding: 8,
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        borderRadius: 8,
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        {inventoryIcons.map((icon, index) => (
                                            <motion.button
                                                key={index}
                                                type="button"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setNewTypeForm({...newTypeForm, icon_name: icon})}
                                                style={{
                                                    width: isSmallMobile ? 32 : 36,
                                                    height: isSmallMobile ? 32 : 36,
                                                    border: `2px solid ${newTypeForm.icon_name === icon ? '#007AFF' : 'rgba(255, 255, 255, 0.1)'}`,
                                                    borderRadius: 8,
                                                    background: newTypeForm.icon_name === icon ? 'rgba(0, 122, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: isSmallMobile ? 16 : 18,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {icon}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                {/* Кнопки формы */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    justifyContent: 'flex-end',
                                    marginTop: 8
                                }}>
                                    <button
                                        onClick={() => setShowCreateTypeForm(false)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: 8,
                                            padding: '10px 16px',
                                            fontSize: isSmallMobile ? 13 : 14,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleCreateType}
                                        disabled={!newTypeForm.name || !newTypeForm.display_name}
                                        style={{
                                            background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            padding: '10px 20px',
                                            fontSize: isSmallMobile ? 13 : 14,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            opacity: (!newTypeForm.name || !newTypeForm.display_name) ? 0.5 : 1
                                        }}
                                    >
                                        ✅ Создать
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Форма создания единиц */}
                <AnimatePresence>
                    {showCreateItemsForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                background: 'rgba(28, 28, 30, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 16,
                                padding: cardPadding,
                                backdropFilter: 'blur(16px)'
                            }}
                        >
                            <h3 style={{
                                margin: '0 0 16px 0',
                                fontSize: isSmallMobile ? 16 : 18,
                                fontWeight: 600,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                📦 Добавление единиц инвентаря
                            </h3>
                            
                            {/* Поля формы */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Выберите тип инвентаря *
                                    </label>
                                    <select
                                        value={selectedTypeForItems || ''}
                                        onChange={(e) => setSelectedTypeForItems(Number(e.target.value) || null)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <option value="" style={{ background: '#1C1C1E', color: '#ffffff' }}>
                                            Выберите тип...
                                        </option>
                                        {inventoryTypes.map(type => (
                                            <option 
                                                key={type.id} 
                                                value={type.id}
                                                style={{ background: '#1C1C1E', color: '#ffffff' }}
                                            >
                                                {type.icon_name} {type.display_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Количество единиц *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        placeholder="1"
                                        value={newItemsForm.quantity}
                                        onChange={(e) => setNewItemsForm({...newItemsForm, quantity: parseInt(e.target.value) || 1})}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Префикс названия (необязательно)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Например: SUP-01, Жилет-А..."
                                        value={newItemsForm.name_prefix}
                                        onChange={(e) => setNewItemsForm({...newItemsForm, name_prefix: e.target.value})}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <div style={{
                                        fontSize: isSmallMobile ? 11 : 12,
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        marginTop: 4,
                                        lineHeight: 1.3
                                    }}>
                                        Если не указан, будет использован автоматический префикс
                                    </div>
                                </div>

                                {/* Кнопки формы */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    justifyContent: 'flex-end',
                                    marginTop: 8
                                }}>
                                    <button
                                        onClick={() => {
                                            setShowCreateItemsForm(false);
                                            setSelectedTypeForItems(null);
                                            setNewItemsForm({ quantity: 1, name_prefix: '' });
                                        }}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: 8,
                                            padding: '10px 16px',
                                            fontSize: isSmallMobile ? 13 : 14,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleCreateItems}
                                        disabled={!selectedTypeForItems || newItemsForm.quantity < 1}
                                        style={{
                                            background: 'linear-gradient(135deg, #30D158 0%, #28A745 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            padding: '10px 20px',
                                            fontSize: isSmallMobile ? 13 : 14,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            opacity: (!selectedTypeForItems || newItemsForm.quantity < 1) ? 0.5 : 1
                                        }}
                                    >
                                        📦 Создать единицы
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Список типов */}
                {inventoryTypes.length === 0 && !showCreateTypeForm ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                        <div style={{ fontSize: isSmallMobile ? 48 : 64, marginBottom: 16 }}>📦</div>
                        <h3 style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: isSmallMobile ? 16 : 20,
                            fontWeight: 600,
                            margin: '0 0 8px 0'
                        }}>
                            Нет типов инвентаря
                        </h3>
                        <p style={{ fontSize, margin: 0, lineHeight: 1.5 }}>
                            Создайте первый тип инвентаря для управления оборудованием
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {inventoryTypes.map(type => (
                            <motion.div
                                key={type.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%)',
                                    backdropFilter: 'blur(15px)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: 14,
                                    padding: cardPadding,
                                    borderLeft: `4px solid ${type.color || '#007AFF'}`
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    marginBottom: type.description ? 8 : 0
                                }}>
                                    <div style={{
                                        fontSize: isSmallMobile ? 20 : 24,
                                        width: isSmallMobile ? 36 : 40,
                                        height: isSmallMobile ? 36 : 40,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 12,
                                        background: 'rgba(255, 255, 255, 0.1)'
                                    }}>
                                        {type.icon_name || '📦'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            color: '#fff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            fontWeight: 600
                                        }}>
                                            {type.display_name}
                                        </div>
                                        {type.name !== type.display_name && (
                                            <div style={{
                                                fontSize: isSmallMobile ? 11 : 12,
                                                color: 'rgba(255,255,255,0.5)'
                                            }}>
                                                ({type.name})
                                            </div>
                                        )}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                fontSize: isSmallMobile ? 16 : 18,
                                                fontWeight: 700,
                                                color: '#007AFF'
                                            }}>
                                                {type.items_count || 0}
                                            </div>
                                            <div style={{
                                                fontSize: isSmallMobile ? 9 : 10,
                                                color: 'rgba(255, 255, 255, 0.6)',
                                                textTransform: 'uppercase'
                                            }}>
                                                Всего
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                fontSize: isSmallMobile ? 16 : 18,
                                                fontWeight: 700,
                                                color: '#52C41A'
                                            }}>
                                                {type.available_count || 0}
                                            </div>
                                            <div style={{
                                                fontSize: isSmallMobile ? 9 : 10,
                                                color: 'rgba(255, 255, 255, 0.6)',
                                                textTransform: 'uppercase'
                                            }}>
                                                Доступно
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {type.description && (
                                    <p style={{
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        fontSize: isSmallMobile ? 12 : 13,
                                        margin: 0,
                                        lineHeight: 1.4
                                    }}>
                                        {type.description}
                                    </p>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Рендер вкладки "Единицы инвентаря"
    function renderItems() {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {inventoryTypes.length > 0 && (
                    <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: '#28A745' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreateItemsForm(true)}
                        style={{
                            background: 'linear-gradient(135deg, #30D158 0%, #28A745 100%)',
                            border: 'none',
                            borderRadius: 12,
                            padding: `${isSmallMobile ? 12 : 14}px ${isSmallMobile ? 16 : 20}px`,
                            color: '#fff',
                            fontSize: isSmallMobile ? 13 : 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 16px rgba(52, 199, 89, 0.3)',
                            justifyContent: 'center',
                            minHeight: buttonHeight
                        }}
                    >
                        <span style={{ fontSize: isSmallMobile ? 14 : 16 }}>➕</span>
                        Добавить единицы
                    </motion.button>
                )}

                {/* Форма создания единиц */}
                <AnimatePresence>
                    {showCreateItemsForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                background: 'rgba(28, 28, 30, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 16,
                                padding: cardPadding,
                                backdropFilter: 'blur(16px)'
                            }}
                        >
                            <h3 style={{
                                margin: '0 0 16px 0',
                                fontSize: isSmallMobile ? 16 : 18,
                                fontWeight: 600,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                📦 Добавление единиц инвентаря
                            </h3>
                            
                            {/* Поля формы */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Выберите тип инвентаря *
                                    </label>
                                    <select
                                        value={selectedTypeForItems || ''}
                                        onChange={(e) => setSelectedTypeForItems(Number(e.target.value) || null)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <option value="" style={{ background: '#1C1C1E', color: '#ffffff' }}>
                                            Выберите тип...
                                        </option>
                                        {inventoryTypes.map(type => (
                                            <option 
                                                key={type.id} 
                                                value={type.id}
                                                style={{ background: '#1C1C1E', color: '#ffffff' }}
                                            >
                                                {type.icon_name} {type.display_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Количество единиц *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        placeholder="1"
                                        value={newItemsForm.quantity}
                                        onChange={(e) => setNewItemsForm({...newItemsForm, quantity: parseInt(e.target.value) || 1})}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        fontSize: isSmallMobile ? 12 : 14,
                                        fontWeight: 500,
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        marginBottom: 6,
                                        display: 'block'
                                    }}>
                                        Префикс названия (необязательно)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Например: SUP-01, Жилет-А..."
                                        value={newItemsForm.name_prefix}
                                        onChange={(e) => setNewItemsForm({...newItemsForm, name_prefix: e.target.value})}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: 8,
                                            padding: 12,
                                            color: '#ffffff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <div style={{
                                        fontSize: isSmallMobile ? 11 : 12,
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        marginTop: 4,
                                        lineHeight: 1.3
                                    }}>
                                        Если не указан, будет использован автоматический префикс
                                    </div>
                                </div>

                                {/* Кнопки формы */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    justifyContent: 'flex-end',
                                    marginTop: 8
                                }}>
                                    <button
                                        onClick={() => {
                                            setShowCreateItemsForm(false);
                                            setSelectedTypeForItems(null);
                                            setNewItemsForm({ quantity: 1, name_prefix: '' });
                                        }}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: 8,
                                            padding: '10px 16px',
                                            fontSize: isSmallMobile ? 13 : 14,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleCreateItems}
                                        disabled={!selectedTypeForItems || newItemsForm.quantity < 1}
                                        style={{
                                            background: 'linear-gradient(135deg, #30D158 0%, #28A745 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            padding: '10px 20px',
                                            fontSize: isSmallMobile ? 13 : 14,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            opacity: (!selectedTypeForItems || newItemsForm.quantity < 1) ? 0.5 : 1
                                        }}
                                    >
                                        📦 Создать единицы
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {inventoryItems.length === 0 && !showCreateItemsForm ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                        <div style={{ fontSize: isSmallMobile ? 48 : 64, marginBottom: 16 }}>📋</div>
                        <h3 style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: isSmallMobile ? 16 : 20,
                            fontWeight: 600,
                            margin: '0 0 8px 0'
                        }}>
                            Нет единиц инвентаря
                        </h3>
                        <p style={{ fontSize, margin: 0, lineHeight: 1.5 }}>
                            {inventoryTypes.length === 0 
                                ? 'Сначала создайте типы инвентаря во вкладке "Типы"'
                                : 'Добавьте единицы инвентаря для отслеживания оборудования'
                            }
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {inventoryItems.map(item => {
                            const type = inventoryTypes.find(t => t.id === item.inventory_type_id);
                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%)',
                                        backdropFilter: 'blur(15px)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: 12,
                                        padding: cardPadding,
                                        borderLeft: `4px solid ${
                                            item.status === 'available' ? '#52C41A' :
                                            item.status === 'in_use' ? '#007AFF' :
                                            item.status === 'servicing' ? '#FFD600' :
                                            item.status === 'repair' ? '#FF4D4F' : '#86868B'
                                        }`
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: 8
                                    }}>
                                        <div style={{
                                            color: '#fff',
                                            fontSize: isSmallMobile ? 14 : 16,
                                            fontWeight: 600
                                        }}>
                                            {type?.icon_name || '📦'} {item.name || `${type?.display_name} #${item.id}`}
                                        </div>
                                        <div style={{
                                            padding: '4px 8px',
                                            borderRadius: 6,
                                            fontSize: isSmallMobile ? 10 : 12,
                                            fontWeight: 500,
                                            textTransform: 'uppercase',
                                            background: item.status === 'available' ? 'rgba(82, 196, 26, 0.2)' :
                                                       item.status === 'in_use' ? 'rgba(0, 122, 255, 0.2)' :
                                                       item.status === 'servicing' ? 'rgba(255, 212, 0, 0.2)' :
                                                       item.status === 'repair' ? 'rgba(255, 77, 79, 0.2)' : 'rgba(134, 134, 139, 0.2)',
                                            color: item.status === 'available' ? '#52C41A' :
                                                  item.status === 'in_use' ? '#007AFF' :
                                                  item.status === 'servicing' ? '#FFD600' :
                                                  item.status === 'repair' ? '#FF4D4F' : '#86868B'
                                        }}>
                                            {getStatusIcon(item.status)} {getStatusName(item.status)}
                                        </div>
                                    </div>
                                    <div style={{
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        fontSize: isSmallMobile ? 12 : 13,
                                        lineHeight: 1.4
                                    }}>
                                        <div><strong>Тип:</strong> {type?.display_name || 'Неизвестно'}</div>
                                        {item.serial_number && (
                                            <div><strong>Серийный номер:</strong> {item.serial_number}</div>
                                        )}
                                        {item.current_booking_id && (
                                            <div><strong>Бронирование:</strong> {item.current_booking_id}</div>
                                        )}
                                        <div><strong>Создано:</strong> {new Date(item.created_at).toLocaleDateString()}</div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
};

export default MobileInventoryModal; 