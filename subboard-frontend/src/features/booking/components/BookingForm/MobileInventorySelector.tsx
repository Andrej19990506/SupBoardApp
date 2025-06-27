import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { inventoryApi, type InventoryType } from '@/features/booking/services/inventoryApi';
import { useAppSelector } from '@features/booking/store/hooks';
import type { RootState } from '@features/booking/store';
import { getDetailedAvailabilityInfo } from '@features/booking/utils/bookingUtils';
import { parseISO, isValid as isValidDate } from 'date-fns';
import type { Booking } from '@/types/booking';
import { useInventoryTotal } from './hooks/useInventoryTotal';
import MobileInventoryModal from '../InventoryModal/MobileInventoryModal';

interface MobileInventorySelectorProps {
    selectedItems: Record<number, number>;
    onChange: (selectedItems: Record<number, number>) => void;
    error?: string | null;
    plannedDate?: string;
    plannedTime?: string;
    durationInHours?: number;
    bookingId?: string;
    onClose: () => void;
}

const MobileInventorySelector: React.FC<MobileInventorySelectorProps> = ({
    selectedItems,
    onChange,
    error,
    plannedDate,
    plannedTime,
    durationInHours,
    bookingId,
    onClose
}) => {
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    const [loading, setLoading] = useState(true);
    const [availability, setAvailability] = useState<Record<number, number>>({});
    const [shakeCard, setShakeCard] = useState<number | null>(null);
    const [dragY, setDragY] = useState(0);
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    
    // Redux данные
    const bookingsMap = useAppSelector((state: RootState) => state.bookings.bookings);
    const boards = useAppSelector((state: RootState) => state.boards.boards);
    const { totalInventory } = useInventoryTotal();
    
    const flatAllBookings = React.useMemo(() => 
        Object.values(bookingsMap || {}).flat() as Booking[], 
        [bookingsMap]
    );
    
    const currentSelectedItems = React.useMemo(() => {
        if (!selectedItems || typeof selectedItems !== 'object' || Array.isArray(selectedItems)) {
            return {};
        }
        return selectedItems;
    }, [selectedItems]);

    // Загрузка инвентаря
    useEffect(() => {
        const loadInventoryTypes = async () => {
            try {
                setLoading(true);
                const response = await inventoryApi.getInventoryTypes();
                const types = response.data.filter(type => type.is_active);
                setInventoryTypes(types);
            } catch (err) {
                console.error('Ошибка загрузки типов инвентаря:', err);
            } finally {
                setLoading(false);
            }
        };
        loadInventoryTypes();
    }, []);

    // Расчет доступности
    useEffect(() => {
        const calculateAvailability = () => {
            if (!plannedDate || !plannedTime || !durationInHours || inventoryTypes.length === 0) {
                const generalAvailability: Record<number, number> = {};
                inventoryTypes.forEach(type => {
                    generalAvailability[type.id] = type.available_count || 0;
                });
                setAvailability(generalAvailability);
                return;
            }

            try {
                const [hoursStr, minutesStr] = plannedTime.split(':');
                const hours = parseInt(hoursStr, 10);
                const minutes = parseInt(minutesStr, 10);

                if (isNaN(hours) || isNaN(minutes)) return;

                let requestedDate = parseISO(plannedDate);
                if (!isValidDate(requestedDate)) return;

                requestedDate = new Date(
                    requestedDate.getFullYear(), 
                    requestedDate.getMonth(), 
                    requestedDate.getDate(), 
                    hours, 
                    minutes
                );

                if (!isValidDate(requestedDate)) return;

                const effectiveInventory = totalInventory > 0 ? totalInventory : Math.max(boards.length, 12);
                
                const availabilityInfo = getDetailedAvailabilityInfo(
                    requestedDate,
                    durationInHours,
                    flatAllBookings,
                    effectiveInventory,
                    effectiveInventory,
                    bookingId
                );

                const calculatedAvailability: Record<number, number> = {};
                
                inventoryTypes.forEach(type => {
                    if (type.affects_availability) {
                        const selectedOtherAffectingTypes = Object.entries(currentSelectedItems)
                            .filter(([typeIdStr]) => {
                                const otherTypeId = parseInt(typeIdStr);
                                if (otherTypeId === type.id) return false;
                                const otherType = inventoryTypes.find(t => t.id === otherTypeId);
                                return otherType?.affects_availability || false;
                            })
                            .reduce((sum, [, count]) => (sum as number) + (Number(count) || 0), 0);
                        
                        const availableByTimeSlot = Math.max(0, availabilityInfo.availableBoards - selectedOtherAffectingTypes);
                        const availableForType = Math.min(type.available_count || 0, availableByTimeSlot);
                        calculatedAvailability[type.id] = availableForType;
                    } else {
                        calculatedAvailability[type.id] = type.available_count || 0;
                    }
                });

                setAvailability(calculatedAvailability);
                
            } catch (err) {
                console.error('Ошибка расчета доступности:', err);
                const fallbackAvailability: Record<number, number> = {};
                inventoryTypes.forEach(type => {
                    fallbackAvailability[type.id] = type.available_count || 0;
                });
                setAvailability(fallbackAvailability);
            }
        };

        calculateAvailability();
    }, [
        plannedDate, 
        plannedTime, 
        durationInHours, 
        inventoryTypes, 
        bookingId, 
        flatAllBookings, 
        totalInventory, 
        boards.length, 
        currentSelectedItems
    ]);

    const handleChange = (typeId: number, delta: number) => {
        const currentCount = currentSelectedItems[typeId] || 0;
        const newCount = Math.max(0, currentCount + delta);
        
        if (delta > 0) {
            const type = inventoryTypes.find(t => t.id === typeId);
            if (!type) return;
            
            const availableForType = availability[typeId] || 0;
            
            if (newCount > availableForType) {
                setShakeCard(typeId);
                setTimeout(() => setShakeCard(null), 600);
                return;
            }
            
            if (type.affects_availability && plannedDate && plannedTime && durationInHours) {
                const totalAffectingAfterChange = Object.entries(currentSelectedItems)
                    .filter(([typeIdStr]) => {
                        const otherTypeId = parseInt(typeIdStr);
                        const otherType = inventoryTypes.find(t => t.id === otherTypeId);
                        return otherType?.affects_availability || false;
                    })
                    .reduce((sum, [typeIdStr, count]) => {
                        const otherTypeId = parseInt(typeIdStr);
                        const countToUse = otherTypeId === typeId ? newCount : (Number(count) || 0);
                        return (sum as number) + countToUse;
                    }, 0);
                
                try {
                    const [hoursStr, minutesStr] = plannedTime.split(':');
                    const hours = parseInt(hoursStr, 10);
                    const minutes = parseInt(minutesStr, 10);
                    
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        let requestedDate = parseISO(plannedDate);
                        if (isValidDate(requestedDate)) {
                            requestedDate = new Date(
                                requestedDate.getFullYear(), 
                                requestedDate.getMonth(), 
                                requestedDate.getDate(), 
                                hours, 
                                minutes
                            );
                            
                            if (isValidDate(requestedDate)) {
                                const effectiveInventory = totalInventory > 0 ? totalInventory : Math.max(boards.length, 12);
                                const availabilityInfo = getDetailedAvailabilityInfo(
                                    requestedDate,
                                    durationInHours,
                                    flatAllBookings,
                                    effectiveInventory,
                                    effectiveInventory,
                                    bookingId
                                );
                                
                                if (totalAffectingAfterChange > availabilityInfo.availableBoards) {
                                    setShakeCard(typeId);
                                    setTimeout(() => setShakeCard(null), 600);
                                    return;
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Ошибка при проверке общего лимита:', err);
                }
            }
        }
        
        const newSelectedItems = { ...currentSelectedItems };
        if (newCount === 0) {
            delete newSelectedItems[typeId];
        } else {
            newSelectedItems[typeId] = newCount;
        }
        
        onChange(newSelectedItems);
    };

    const handleDragEnd = (info: PanInfo) => {
        if (info.offset.y > 100 || info.velocity.y > 500) {
            onClose();
        }
    };

    const getTotalSelected = () => {
        return Object.values(currentSelectedItems).reduce((sum, count) => (sum as number) + (count as number), 0);
    };

    const handleClearAll = () => {
        onChange({});
    };

    const handleManageInventory = () => {
        setIsInventoryModalOpen(true);
    };

    const handleInventoryModalClose = () => {
        setIsInventoryModalOpen(false);
        // Перезагружаем типы инвентаря после закрытия модала
        const loadInventoryTypes = async () => {
            try {
                const response = await inventoryApi.getInventoryTypes();
                const types = response.data.filter(type => type.is_active);
                setInventoryTypes(types);
            } catch (err) {
                console.error('Ошибка перезагрузки типов инвентаря:', err);
            }
        };
        loadInventoryTypes();
    };

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.98) 0%, rgba(25, 25, 35, 0.95) 30%, rgba(20, 20, 30, 0.97) 70%, rgba(10, 10, 15, 0.98) 100%)',
                    backdropFilter: 'blur(25px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: 20,
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        border: '3px solid rgba(255, 255, 255, 0.2)',
                        borderTop: '3px solid #007AFF',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <div style={{
                        color: '#fff',
                        fontSize: 18,
                        fontWeight: 600,
                        textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                        📦 Загрузка инвентаря...
                    </div>
                    <div style={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: 14,
                        maxWidth: 280,
                        lineHeight: 1.4
                    }}>
                        Подготавливаем список доступного оборудования
                    </div>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => handleDragEnd(info)}
            onDrag={(_, info) => setDragY(info.offset.y)}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                duration: 0.4
            }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.98) 0%, rgba(25, 25, 35, 0.95) 30%, rgba(20, 20, 30, 0.97) 70%, rgba(10, 10, 15, 0.98) 100%)',
                backdropFilter: 'blur(25px)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -10px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                overflow: 'hidden'
            }}
        >
            {/* Индикатор для свайпа */}
            <motion.div
                animate={{
                    opacity: dragY > 20 ? 0.8 : 0.4,
                    scale: dragY > 20 ? 1.1 : 1
                }}
                style={{
                    width: 40,
                    height: 4,
                    background: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: 2,
                    alignSelf: 'center',
                    marginTop: 12,
                    marginBottom: 8,
                    flexShrink: 0
                }}
            />

            {/* Заголовок */}
            <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                }}>
                    <h2 style={{
                        margin: 0,
                        background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        fontSize: 24,
                        fontWeight: 700,
                        textShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        letterSpacing: '-0.3px'
                    }}>
                        Выбор инвентаря
                    </h2>
                    
                    <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: 18,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(15px)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        ✕
                    </motion.button>
                </div>
                
                <p style={{
                    margin: 0,
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontSize: 15,
                    lineHeight: 1.4
                }}>
                    Выберите необходимое оборудование для аренды
                </p>
            </div>

            {/* Контент */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                WebkitOverflowScrolling: 'touch'
            }}>
                {inventoryTypes.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                        <div style={{ fontSize: 64, marginBottom: 20 }}>📦</div>
                        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#fff' }}>
                            Инвентарь не настроен
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                            Для создания бронирований необходимо добавить типы инвентаря
                        </div>
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                    }}>
                        {inventoryTypes.map((type, index) => {
                            const count = currentSelectedItems[type.id] || 0;
                            const maxAvailable = availability[type.id] || 0;
                            const remainingAvailable = Math.max(0, maxAvailable - count);
                            
                            return (
                                <motion.div
                                    key={type.id}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={shakeCard === type.id ? {
                                        x: [-8, 8, -8, 8, 0],
                                        opacity: 1,
                                        y: 0,
                                        scale: 1
                                    } : { 
                                        opacity: 1, 
                                        y: 0,
                                        x: 0,
                                        scale: 1
                                    }}
                                    transition={shakeCard === type.id ? {
                                        duration: 0.6,
                                        ease: "easeInOut"
                                    } : { 
                                        delay: index * 0.1, 
                                        duration: 0.4,
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 25
                                    }}
                                    whileHover={{ 
                                        scale: 1.02,
                                        boxShadow: count > 0 
                                            ? '0 8px 24px rgba(0, 122, 255, 0.3)' 
                                            : '0 8px 24px rgba(255, 255, 255, 0.1)'
                                    }}
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 50%, rgba(255, 255, 255, 0.08) 100%)',
                                        border: count > 0 ? '2px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.25)',
                                        borderRadius: 14,
                                        padding: 16,
                                        backdropFilter: 'blur(15px)',
                                        boxShadow: count > 0 
                                            ? '0 6px 24px rgba(0, 122, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                                            : '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                        position: 'relative'
                                    }}
                                >
                                    {/* Бейдж доступности */}
                                    <motion.div
                                        animate={remainingAvailable === 0 ? {
                                            scale: [1, 1.05, 1],
                                            backgroundColor: ['#FF3B30', '#FF6B6B', '#FF3B30']
                                        } : {}}
                                        transition={{ 
                                            duration: 1.5, 
                                            repeat: remainingAvailable === 0 ? Infinity : 0,
                                            ease: "easeInOut"
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: 12,
                                            right: 12,
                                            background: remainingAvailable === 0 
                                                ? 'linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%)'
                                                : remainingAvailable < 5 
                                                    ? 'linear-gradient(135deg, #FF9500 0%, #FFAD33 100%)'
                                                    : 'linear-gradient(135deg, #30D158 0%, #4CD964 100%)',
                                            color: '#fff',
                                            padding: '4px 8px',
                                            borderRadius: 8,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                            backdropFilter: 'blur(10px)'
                                        }}
                                    >
                                        {remainingAvailable} шт
                                    </motion.div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        marginBottom: 12
                                    }}>
                                        <div style={{
                                            fontSize: 32,
                                            textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                            filter: remainingAvailable === 0 ? 'grayscale(100%) opacity(0.5)' : 'none'
                                        }}>
                                            {type.icon_name || '📦'}
                                        </div>
                                        
                                        <div style={{ flex: 1, minWidth: 0, paddingRight: 45 }}>
                                            <h3 style={{
                                                margin: '0 0 2px 0',
                                                color: remainingAvailable === 0 ? 'rgba(255, 255, 255, 0.5)' : '#fff',
                                                fontSize: 16,
                                                fontWeight: 600,
                                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                                lineHeight: 1.2
                                            }}>
                                                {type.display_name}
                                            </h3>
                                            {type.description && (
                                                <p style={{
                                                    margin: 0,
                                                    color: 'rgba(255, 255, 255, 0.6)',
                                                    fontSize: 12,
                                                    lineHeight: 1.3,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {type.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Счетчик */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 12,
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        borderRadius: 12,
                                        padding: '10px 12px',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <motion.button
                                            whileHover={count > 0 ? { 
                                                scale: 1.1, 
                                                backgroundColor: '#FF6B6B',
                                                boxShadow: '0 0 16px rgba(255, 107, 107, 0.4)'
                                            } : {}}
                                            whileTap={count > 0 ? { scale: 0.95 } : {}}
                                            onClick={() => handleChange(type.id, -1)}
                                            disabled={count === 0}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 12,
                                                border: 'none',
                                                background: count === 0 
                                                    ? 'rgba(255, 255, 255, 0.1)' 
                                                    : 'linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%)',
                                                color: '#fff',
                                                fontSize: 20,
                                                fontWeight: 600,
                                                cursor: count === 0 ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: count === 0 ? 0.5 : 1,
                                                boxShadow: count > 0 ? '0 3px 12px rgba(255, 59, 48, 0.2)' : 'none',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            −
                                        </motion.button>

                                        <div style={{
                                            minWidth: 50,
                                            height: 44,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <AnimatePresence mode="wait">
                                                <motion.span
                                                    key={count}
                                                    initial={{ y: -30, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: 30, opacity: 0 }}
                                                    transition={{ 
                                                        type: "spring", 
                                                        stiffness: 400, 
                                                        damping: 25
                                                    }}
                                                    style={{
                                                        fontSize: 20,
                                                        fontWeight: 700,
                                                        background: 'linear-gradient(135deg, #007AFF 0%, #00D4FF 100%)',
                                                        WebkitBackgroundClip: 'text',
                                                        WebkitTextFillColor: 'transparent',
                                                        backgroundClip: 'text',
                                                        textShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
                                                        position: 'absolute',
                                                        width: '100%',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {count}
                                                </motion.span>
                                            </AnimatePresence>
                                        </div>

                                        <motion.button
                                            whileHover={remainingAvailable > 0 ? { 
                                                scale: 1.1, 
                                                backgroundColor: '#4CD964',
                                                boxShadow: '0 0 16px rgba(76, 217, 100, 0.4)'
                                            } : {}}
                                            whileTap={remainingAvailable > 0 ? { scale: 0.95 } : {}}
                                            onClick={() => handleChange(type.id, 1)}
                                            disabled={remainingAvailable === 0}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 12,
                                                border: 'none',
                                                background: remainingAvailable === 0 
                                                    ? 'rgba(255, 255, 255, 0.1)' 
                                                    : 'linear-gradient(135deg, #30D158 0%, #4CD964 100%)',
                                                color: '#fff',
                                                fontSize: 20,
                                                fontWeight: 600,
                                                cursor: remainingAvailable === 0 ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: remainingAvailable === 0 ? 0.5 : 1,
                                                boxShadow: remainingAvailable > 0 ? '0 3px 12px rgba(48, 209, 88, 0.2)' : 'none',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            +
                                        </motion.button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Информационная секция для управления инвентарем */}
                <div style={{
                    marginTop: 24,
                    padding: 20,
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 16,
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        marginBottom: 12
                    }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)'
                        }}>
                            ⚙️
                        </div>
                        
                        <div style={{ flex: 1 }}>
                            <h3 style={{
                                margin: '0 0 4px 0',
                                color: '#fff',
                                fontSize: 16,
                                fontWeight: 600,
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                            }}>
                                Управление инвентарем
                            </h3>
                            <p style={{
                                margin: 0,
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontSize: 13,
                                lineHeight: 1.4
                            }}>
                                Создавайте новые типы оборудования и управляйте наличием
                            </p>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: 8
                    }}>
                        <motion.button
                            whileHover={{ 
                                scale: 1.02,
                                backgroundColor: '#0056CC',
                                boxShadow: '0 6px 20px rgba(0, 122, 255, 0.4)'
                            }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleManageInventory}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                boxShadow: '0 4px 16px rgba(0, 122, 255, 0.2)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <span style={{ fontSize: 16 }}>➕</span>
                            Добавить новый
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Нижняя панель с кнопками */}
            {getTotalSelected() > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '20px 24px',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)',
                        backdropFilter: 'blur(20px)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        gap: 12,
                        flexShrink: 0
                    }}
                >
                    <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 59, 48, 0.2)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleClearAll}
                        style={{
                            flex: 1,
                            padding: '16px 20px',
                            borderRadius: 16,
                            border: '1px solid rgba(255, 59, 48, 0.3)',
                            background: 'rgba(255, 59, 48, 0.1)',
                            color: '#FF6B6B',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                            backdropFilter: 'blur(15px)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        Очистить всё
                    </motion.button>
                    
                    <motion.button
                        whileHover={{ 
                            scale: 1.02,
                            backgroundColor: '#0056CC',
                            boxShadow: '0 8px 32px rgba(0, 122, 255, 0.4)'
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        style={{
                            flex: 2,
                            padding: '16px 20px',
                            borderRadius: 16,
                            border: '1px solid rgba(0, 122, 255, 0.6)',
                            background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                            color: '#fff',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                            backdropFilter: 'blur(15px)',
                            boxShadow: '0 6px 25px rgba(0, 122, 255, 0.3)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        Готово ({getTotalSelected()})
                    </motion.button>
                                 </motion.div>
             )}

            {/* Модал управления инвентарем */}
            {isInventoryModalOpen && (
                <MobileInventoryModal
                    isOpen={isInventoryModalOpen}
                    onClose={handleInventoryModalClose}
                />
            )}
        </motion.div>
    );
};

export default MobileInventorySelector; 