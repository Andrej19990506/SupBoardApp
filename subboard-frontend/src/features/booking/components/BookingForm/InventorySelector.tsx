import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryApi, type InventoryType } from '@/features/booking/services/inventoryApi';
import PresetManager, { InventoryPreset } from './PresetManager';
import { useAppSelector } from '@features/booking/store/hooks';
import type { RootState } from '@features/booking/store';
import { getDetailedAvailabilityInfo } from '@features/booking/utils/bookingUtils';
import { parseISO, isValid as isValidDate } from 'date-fns';
import type { Booking } from '@/types/booking';
import { useInventoryTotal } from './hooks/useInventoryTotal';
import DesktopInventoryModal from '../InventoryModal/DesktopInventoryModal';
import MobileInventoryModal from '../InventoryModal/MobileInventoryModal';
import MobileInventorySelector from './MobileInventorySelector';
import { useDevice } from '@/shared/hooks/useDevice';

// Интерфейс для новой системы инвентаря
interface InventorySelectorProps {
    selectedItems: Record<number, number>; // typeId -> quantity
    onChange: (selectedItems: Record<number, number>) => void;
    error?: string | null;
    plannedDate?: string;
    plannedTime?: string;
    durationInHours?: number;
    bookingId?: string; // для исключения текущего бронирования при редактировании
    onClose?: () => void; // для закрытия модального окна
}



// Основной компонент InventorySelector
const InventorySelector: React.FC<InventorySelectorProps> = ({ 
    selectedItems, 
    onChange, 
    error,
    plannedDate,
    plannedTime,
    durationInHours,
    bookingId,
    onClose
}) => {
    // Функция для определения контекста использования
    const isInModal = onClose !== undefined; // Если есть onClose, значит мы в модальном окне
    
    // Если selectedItems не валидные, используем безопасную версию
    const currentSelectedItems = React.useMemo(() => {
        if (!selectedItems || typeof selectedItems !== 'object' || Array.isArray(selectedItems)) {
            return {};
        }
        return selectedItems;
    }, [selectedItems]);

    // Компонент счетчика с адаптивным дизайном
    const CounterComponent = ({ 
        count, 
        onDecrease, 
        onIncrease, 
        canDecrease, 
        canIncrease 
    }: {
        count: number;
        onDecrease: () => void;
        onIncrease: () => void;
        canDecrease: boolean;
        canIncrease: boolean;
    }) => {
        // Адаптивные размеры
        const buttonSize = isSmallMobile ? 38 : isMobile ? 44 : 36;
        const fontSize = isSmallMobile ? 18 : isMobile ? 20 : 18;
        const gap = isSmallMobile ? 12 : isMobile ? 16 : 12;
        const padding = isSmallMobile ? '6px 10px' : isMobile ? '8px 12px' : '6px 8px';
        
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap,
                backgroundColor: '#1C1C1E',
                borderRadius: 12,
                padding
            }}>
                <motion.button 
                    type="button" 
                    onClick={onDecrease}
                    disabled={!canDecrease}
                    whileHover={canDecrease ? { 
                        scale: 1.1, 
                        backgroundColor: '#0056CC',
                        boxShadow: '0 0 15px rgba(0, 122, 255, 0.4)'
                    } : {}}
                    whileTap={canDecrease ? { 
                        scale: 0.95,
                        backgroundColor: '#004499'
                    } : {}}
                    style={{
                        width: buttonSize,
                        height: buttonSize,
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: !canDecrease ? '#3C3C3E' : '#007AFF',
                        color: '#fff',
                        fontSize,
                        fontWeight: 600,
                        cursor: !canDecrease ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                    }}
                >
                    −
                </motion.button>
                
                <div style={{
                    minWidth: isSmallMobile ? 28 : isMobile ? 32 : 28,
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    height: buttonSize
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
                                damping: 25,
                                duration: 0.3
                            }}
                            style={{
                                color: '#fff',
                                fontSize,
                                fontWeight: 600,
                                position: 'absolute',
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            {count}
                        </motion.span>
                    </AnimatePresence>
                </div>
                
                <motion.button 
                    type="button" 
                    onClick={onIncrease}
                    disabled={!canIncrease}
                    whileHover={canIncrease ? { 
                        scale: 1.1, 
                        backgroundColor: '#0056CC',
                        boxShadow: '0 0 15px rgba(0, 122, 255, 0.4)'
                    } : {}}
                    whileTap={canIncrease ? { 
                        scale: 0.95,
                        backgroundColor: '#004499'
                    } : {}}
                    animate={!canIncrease ? { 
                        opacity: 0.5,
                        scale: 1
                    } : { 
                        opacity: 1,
                        scale: 1
                    }}
                    transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 25 
                    }}
                    style={{
                        width: buttonSize,
                        height: buttonSize,
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: !canIncrease ? '#3C3C3E' : '#007AFF',
                        color: '#fff',
                        fontSize,
                        fontWeight: 600,
                        cursor: !canIncrease ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation'
                    }}
                >
                    +
                </motion.button>
            </div>
        );
    };
    // Хук для определения типа устройства
    const { isMobile, deviceType } = useDevice();
    const isSmallMobile = deviceType === 'mobile';
    const [shakeCard, setShakeCard] = useState<number | null>(null);
    
    // Состояния для загрузки инвентаря
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    const [loading, setLoading] = useState(true);
    const [availability, setAvailability] = useState<Record<number, number>>({});
    
    // Состояние для управления модалом инвентаря
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [isMobileInventoryModalOpen, setIsMobileInventoryModalOpen] = useState(false);
    
    // Данные из Redux для расчета реальной доступности
    const bookingsMap = useAppSelector((state: RootState) => state.bookings.bookings);
    const boards = useAppSelector((state: RootState) => state.boards.boards);
    const seats = useAppSelector((state: RootState) => state.seats.seats);
    const { totalInventory } = useInventoryTotal();
    
    // Преобразуем бронирования в плоский массив
    const flatAllBookings = React.useMemo(() => 
        Object.values(bookingsMap || {}).flat() as Booking[], 
        [bookingsMap]
    );
    
    // Состояние для пресетов (адаптируем под новую структуру)
    const [presets, setPresets] = useState<InventoryPreset[]>(() => {
        // Загружаем пресеты из localStorage или используем дефолтные
        const savedPresets = localStorage.getItem('inventoryPresets');
        if (savedPresets) {
            try {
                return JSON.parse(savedPresets);
            } catch (e) {
                console.error('Ошибка загрузки пресетов:', e);
            }
        }
        
        // Дефолтные пресеты (пока пустые, обновятся после загрузки типов)
        return [];
    });



    // Загрузка типов инвентаря при монтировании
    useEffect(() => {
        const loadInventoryTypes = async () => {
            try {
                setLoading(true);
                const response = await inventoryApi.getInventoryTypes();
                const types = response.data.filter(type => type.is_active);
                setInventoryTypes(types);
                
                // Создаем дефолтные пресеты после загрузки типов
                if (types.length > 0 && presets.length === 0) {
                    const defaultPresets = createDefaultPresets(types);
                    setPresets(defaultPresets);
                    localStorage.setItem('inventoryPresets', JSON.stringify(defaultPresets));
                }
            } catch (err) {
                console.error('Ошибка загрузки типов инвентаря:', err);
            } finally {
                setLoading(false);
            }
        };

        loadInventoryTypes();
    }, []);

    // Расчет доступности инвентаря с учетом реальных бронирований
    useEffect(() => {
        const calculateAvailability = () => {
            console.log('[InventorySelector] calculateAvailability called with:', {
                plannedDate,
                plannedTime,
                durationInHours,
                inventoryTypesLength: inventoryTypes.length
            });

            if (!plannedDate || !plannedTime || !durationInHours || inventoryTypes.length === 0) {
                // Если нет всех данных, используем общее количество доступного
                const generalAvailability: Record<number, number> = {};
                inventoryTypes.forEach(type => {
                    generalAvailability[type.id] = type.available_count || 0;
                });
                console.log('[InventorySelector] Using general availability (no time data):', generalAvailability);
                setAvailability(generalAvailability);
                return;
            }

            try {
                // Парсим дату и время
                const [hoursStr, minutesStr] = plannedTime.split(':');
                const hours = parseInt(hoursStr, 10);
                const minutes = parseInt(minutesStr, 10);

                if (isNaN(hours) || isNaN(minutes)) {
                    console.error('Неверный формат времени:', plannedTime);
                    return;
                }

                let requestedDate = parseISO(plannedDate);
                if (!isValidDate(requestedDate)) {
                    console.error('Неверная дата:', plannedDate);
                    return;
                }
                
                requestedDate = new Date(
                    requestedDate.getFullYear(), 
                    requestedDate.getMonth(), 
                    requestedDate.getDate(), 
                    hours, 
                    minutes
                );
                
                if (!isValidDate(requestedDate)) {
                    console.error('Неверная дата/время:', plannedDate, plannedTime);
                    return;
                }

                // Используем ту же логику, что и в DesktopBookingForm
                const effectiveInventory = totalInventory > 0 ? totalInventory : Math.max(boards.length, 12);
                
                const availabilityInfo = getDetailedAvailabilityInfo(
                    requestedDate,
                    durationInHours,
                    flatAllBookings,
                    effectiveInventory, // Используем общий инвентарь как лимит досок
                    effectiveInventory, // И как лимит кресел (для совместимости со старой логикой)
                    bookingId // Исключаем текущее бронирование при редактировании
                );

                // Рассчитываем доступность для каждого типа инвентаря
                const calculatedAvailability: Record<number, number> = {};
                
                        // Сначала считаем сколько уже выбрано "влияющих" типов (SUP досок)
        const selectedAffectingTypes = Object.entries(currentSelectedItems)
            .filter(([typeIdStr]) => {
                const typeId = parseInt(typeIdStr);
                const type = inventoryTypes.find(t => t.id === typeId);
                return type?.affects_availability || false;
            })
            .reduce((sum, [, count]) => (sum as number) + (Number(count) || 0), 0);
                
                inventoryTypes.forEach(type => {
                    if (type.affects_availability) {
                        // Для типов, влияющих на доступность (SUP доски):
                        // Ограничиваем лимитом временного слота
                        const maxByTimeSlot = Math.max(0, availabilityInfo.availableBoards);
                        
                        // Учитываем уже выбранные единицы других влияющих типов
                        const selectedOtherAffectingTypes = Object.entries(currentSelectedItems)
                            .filter(([typeIdStr]) => {
                                const otherTypeId = parseInt(typeIdStr);
                                if (otherTypeId === type.id) return false;
                                const otherType = inventoryTypes.find(t => t.id === otherTypeId);
                                return otherType?.affects_availability || false;
                            })
                            .reduce((sum, [, count]) => (sum as number) + (Number(count) || 0), 0);
                        
                        const availableByTimeSlot = Math.max(0, maxByTimeSlot - selectedOtherAffectingTypes);
                        
                        // Берем минимум из реальной доступности и лимита временного слота
                        const availableForType = Math.min(type.available_count || 0, availableByTimeSlot);
                        calculatedAvailability[type.id] = availableForType;
                    } else {
                        // Для аксессуаров (жилеты, весла и т.д.):
                        // Используем только реальную доступность из базы данных
                        calculatedAvailability[type.id] = type.available_count || 0;
                    }
                });

                console.log('[InventorySelector] Calculated availability:', {
                    requestedDate: requestedDate.toISOString(),
                    durationInHours,
                    effectiveInventory,
                    availabilityInfo,
                    calculatedAvailability,
                    currentSelectedItems,
                    inventoryTypesWithCounts: inventoryTypes.map(t => ({
                        id: t.id,
                        name: t.display_name,
                        available_count: t.available_count,
                        affects_availability: t.affects_availability
                    }))
                });

                setAvailability(calculatedAvailability);
                
            } catch (err) {
                console.error('Ошибка расчета доступности:', err);
                // Fallback на реальную доступность из базы данных
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

    // Создание дефолтных пресетов на основе типов инвентаря
    const createDefaultPresets = (types: InventoryType[]): InventoryPreset[] => {
        const presets: InventoryPreset[] = [];
        
        // Ищем популярные типы
        const supBoard = types.find(t => t.name.toLowerCase().includes('sup') || t.name.toLowerCase().includes('board'));
        const kayak = types.find(t => t.name.toLowerCase().includes('kayak') || t.name.toLowerCase().includes('каяк'));
        
        if (supBoard) {
            presets.push({
                id: 'default-1',
                name: '1 сапборд',
                boardCount: 0, // устаревшие поля для совместимости
                boardWithSeatCount: 0,
                raftCount: 0,
                selectedItems: { [supBoard.id]: 1 },
                isDefault: true,
                description: 'Один сапборд для индивидуального катания',
                emoji: supBoard.icon_name || '🏄‍♂️'
            });
            
            presets.push({
                id: 'default-2',
                name: '2 сапборда',
                boardCount: 0,
                boardWithSeatCount: 0, 
                raftCount: 0,
                selectedItems: { [supBoard.id]: 2 },
                isDefault: true,
                description: 'Два сапборда для пары или друзей',
                emoji: '👫'
            });
        }
        
        if (kayak) {
            presets.push({
                id: 'default-3',
                name: '1 каяк',
                boardCount: 0,
                boardWithSeatCount: 0,
                raftCount: 0,
                selectedItems: { [kayak.id]: 1 },
                isDefault: true,
                description: 'Один каяк для спокойного сплава',
                emoji: kayak.icon_name || '🛶'
            });
        }

        return presets;
    };

    // Сохранение пресетов в localStorage при изменении
    useEffect(() => {
        if (presets.length > 0) {
            localStorage.setItem('inventoryPresets', JSON.stringify(presets));
        }
    }, [presets]);

    // Обработчик изменения пресетов
    const handlePresetsChange = (newPresets: InventoryPreset[]) => {
        setPresets(newPresets);
    };

    // Обработчик выбора пресета
    const handlePresetSelect = (preset: InventoryPreset) => {
        if (preset.selectedItems) {
            // Новый формат с selectedItems
            onChange(preset.selectedItems);
        } else {
            // Старый формат для совместимости - конвертируем в новый
            const legacyItems: Record<number, number> = {};
            // Здесь можно добавить конвертацию старых пресетов, если нужно
            onChange(legacyItems);
        }
    };

    // Обработчик изменения количества конкретного типа инвентаря
    const handleChange = (typeId: number, delta: number) => {
        const currentCount = currentSelectedItems[typeId] || 0;
        const newCount = Math.max(0, currentCount + delta);
        
        // Проверяем лимиты при увеличении
        if (delta > 0) {
            const type = inventoryTypes.find(t => t.id === typeId);
            if (!type) return;
            
            // Получаем текущую доступность для этого типа
            const availableForType = availability[typeId] || 0;
            
            // Проверяем лимит доступности для данного типа
            if (newCount > availableForType) {
                // Вызываем эффект встряхивания
                setShakeCard(typeId);
                setTimeout(() => setShakeCard(null), 600);
                return; // Превышен лимит доступности
            }
            
            // Дополнительная проверка для типов, влияющих на доступность
            if (type.affects_availability && plannedDate && plannedTime && durationInHours) {
                // Считаем общее количество выбранных "влияющих" типов после изменения
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
                
                // Проверяем общий лимит временного слота для влияющих типов
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
                                    // Превышен общий лимит временного слота
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
            delete newSelectedItems[typeId]; // Удаляем из объекта если 0
        } else {
            newSelectedItems[typeId] = newCount;
        }
        
        onChange(newSelectedItems);
    };

    const handleClearAll = () => {
        onChange({});
    };

    const getTotalSelected = () => {
        return Object.values(currentSelectedItems).reduce((sum, count) => (sum as number) + (count as number), 0);
    };

    // Обработчик перехода к управлению инвентарем
    const handleManageInventory = () => {
        if (isMobile) {
            setIsMobileInventoryModalOpen(true);
        } else {
            setIsInventoryModalOpen(true);
        }
    };

    const handleInventoryModalClose = () => {
        setIsInventoryModalOpen(false);
        setIsMobileInventoryModalOpen(false);
        // Перезагружаем типы инвентаря после закрытия модала
        // чтобы отобразить новые типы, если они были созданы
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

    // Если мобильное устройство и есть onClose (модальное окно), используем мобильную версию
    if (isMobile && isInModal) {
        return (
            <AnimatePresence>
                <MobileInventorySelector
                    selectedItems={selectedItems}
                    onChange={onChange}
                    error={error}
                    plannedDate={plannedDate}
                    plannedTime={plannedTime}
                    durationInHours={durationInHours}
                    bookingId={bookingId}
                    onClose={onClose}
                />
            </AnimatePresence>
        );
    }

    if (loading) {
        return (
            <div style={{ 
                background: '#23232a', 
                borderRadius: isMobile ? 0 : 16, 
                padding: 0,
                margin: 0,
                width: '100%',
                height: isMobile ? '100vh' : 'auto',
                maxHeight: isMobile ? '100vh' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                minHeight: isMobile ? '100vh' : 200,
                boxSizing: 'border-box'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: isSmallMobile ? 12 : 16,
                    color: '#86868B'
                }}>
                    <div style={{
                        width: isSmallMobile ? 28 : isMobile ? 32 : 24,
                        height: isSmallMobile ? 28 : isMobile ? 32 : 24,
                        border: '3px solid #3C3C3E',
                        borderTop: '3px solid #007AFF',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <div style={{
                        fontSize: isSmallMobile ? 16 : isMobile ? 18 : 16,
                        fontWeight: 500,
                        textAlign: 'center'
                    }}>
                        Загрузка инвентаря...
                    </div>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // Адаптивные размеры и отступы
    const containerPadding = isSmallMobile ? '16px 12px' : isMobile ? '20px 16px' : '20px';
    const titleFontSize = isSmallMobile ? 16 : isMobile ? 18 : (inventoryTypes.length === 1 ? 18 : 16);
    const clearButtonPadding = isSmallMobile ? '8px 12px' : isMobile ? '10px 16px' : '6px 12px';
    const clearButtonFontSize = isSmallMobile ? 12 : isMobile ? 14 : 12;
    const marginBottom = isSmallMobile ? 16 : isMobile ? 20 : 16;

    if (inventoryTypes.length === 0) {
        return (
            <div style={{ 
                background: '#23232a', 
                borderRadius: isMobile ? 0 : 16, 
                padding: isSmallMobile ? '16px 12px' : isMobile ? '20px 16px' : '24px',
                margin: 0,
                width: '100%',
                height: isMobile ? '100vh' : 'auto',
                maxHeight: isMobile ? '100vh' : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: isMobile ? '100vh' : 300,
                boxSizing: 'border-box'
            }}>
                <div style={{ 
                    fontSize: isSmallMobile ? 48 : isMobile ? 64 : 48,
                    marginBottom: isSmallMobile ? 16 : isMobile ? 24 : 16
                }}>
                    📦
                </div>
                <div style={{ 
                    color: '#fff',
                    fontSize: isSmallMobile ? 18 : isMobile ? 20 : 18,
                    fontWeight: 600,
                    marginBottom: isSmallMobile ? 8 : isMobile ? 12 : 8,
                    lineHeight: 1.2
                }}>
                    Инвентарь не настроен
                </div>
                <div style={{ 
                    color: '#86868B',
                    fontSize: isSmallMobile ? 14 : isMobile ? 16 : 15,
                    marginBottom: isSmallMobile ? 24 : isMobile ? 32 : 20,
                    lineHeight: 1.4,
                    maxWidth: isSmallMobile ? '90%' : isMobile ? '80%' : 'none',
                    textAlign: 'center'
                }}>
                    Для создания бронирований необходимо<br />
                    сначала добавить типы инвентаря в систему
                </div>
                
                <motion.button
                    whileHover={{ 
                        scale: 1.02,
                        backgroundColor: '#0056CC',
                        boxShadow: '0 8px 25px rgba(0, 122, 255, 0.3)'
                    }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={handleManageInventory}
                    style={{
                        background: 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)',
                        border: 'none',
                        borderRadius: 12,
                        padding: isSmallMobile ? '14px 20px' : isMobile ? '16px 24px' : '14px 24px',
                        color: '#fff',
                        fontSize: isSmallMobile ? 15 : isMobile ? 16 : 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: isSmallMobile ? 8 : isMobile ? 12 : 8,
                        margin: '0 auto',
                        boxShadow: '0 4px 15px rgba(0, 122, 255, 0.2)',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        minHeight: isSmallMobile ? 48 : isMobile ? 52 : 'auto',
                        touchAction: 'manipulation',
                        alignSelf: 'stretch'
                    }}
                >
                    <span style={{ fontSize: isSmallMobile ? 16 : isMobile ? 20 : 16 }}>⚙️</span>
                    Управление инвентарем
                </motion.button>
                
                <div style={{ 
                    color: '#5A5A5E',
                    fontSize: isSmallMobile ? 12 : isMobile ? 14 : 13,
                    marginTop: isSmallMobile ? 16 : isMobile ? 20 : 12,
                    fontStyle: 'italic'
                }}>
                    Или обратитесь к администратору
                </div>
            </div>
        );
    }

    return (
        <div style={{ 
            background: '#23232a', 
            borderRadius: isMobile ? 0 : 16, 
            padding: containerPadding,
            margin: 0,
            height: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : 'none',
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Заголовок с кнопками */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom,
                flexShrink: 0,
                gap: 12
            }}>
                <h3 style={{
                    margin: 0,
                    color: '#fff',
                    fontSize: titleFontSize,
                    fontWeight: 600,
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                    flex: 1,
                    minWidth: 0,
                    lineHeight: 1.2
                }}>
                    {inventoryTypes.length === 1 ? 
                        `🎯 ${inventoryTypes[0].display_name}` : 
                        '🛻 Выберите инвентарь'
                    }
                </h3>
                
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0
                }}>
                    <AnimatePresence>
                        {getTotalSelected() > 0 && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ 
                                    scale: 1.05,
                                    backgroundColor: '#FF4D4F20'
                                }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                type="button"
                                onClick={handleClearAll}
                                style={{
                                    background: 'none',
                                    border: '1px solid #FF4D4F',
                                    borderRadius: 8,
                                    padding: clearButtonPadding,
                                    color: '#FF4D4F',
                                    fontSize: clearButtonFontSize,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                    touchAction: 'manipulation',
                                    minHeight: isSmallMobile ? 36 : isMobile ? 40 : 'auto',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap'
                                }}
                                title="Очистить весь выбор"
                            >
                                Очистить
                            </motion.button>
                        )}
                    </AnimatePresence>
                    
                    {/* Кнопка закрытия только для десктопного модального окна */}
                    {isInModal && !isMobile && (
                        <motion.button
                            whileHover={{ 
                                scale: 1.1,
                                backgroundColor: '#3C3C3E'
                            }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderRadius: '50%',
                                width: 36,
                                height: 36,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#86868B',
                                fontSize: 20,
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                touchAction: 'manipulation',
                                flexShrink: 0
                            }}
                            title="Закрыть"
                        >
                            ✕
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Прокручиваемый контейнер с контентом */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                WebkitOverflowScrolling: 'touch'
            }}>
                {/* Контейнер с инвентарем */}
                <div style={{ 
                    display: 'flex', 
                    gap: isSmallMobile ? 12 : 16, 
                    alignItems: 'stretch',
                    justifyContent: 'stretch',
                    flexWrap: 'wrap',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0
                }}>
                    {inventoryTypes.map((type, index) => {
                        const count = currentSelectedItems[type.id] || 0;
                        const maxAvailable = availability[type.id] || 0;
                        const remainingAvailable = Math.max(0, maxAvailable - count);
                        const isSingleItem = inventoryTypes.length === 1;
                        
                        // Адаптивные размеры для карточки - более компактные для мобильных
                        const cardPadding = isSmallMobile ? '12px' : isMobile ? '14px' : '20px';
                        const cardMinHeight = isSmallMobile ? 70 : isMobile ? 75 : 80;
                        const iconSize = isSmallMobile ? 28 : isMobile ? 32 : 40;
                        const titleFontSize = isSmallMobile ? 14 : isMobile ? 15 : 16;
                        const descriptionFontSize = isSmallMobile ? 11 : isMobile ? 12 : 12;
                        const badgePadding = isSmallMobile ? '3px 6px' : isMobile ? '4px 8px' : '4px 8px';
                        const badgeFontSize = isSmallMobile ? 9 : isMobile ? 11 : 11;
                        
                        return (
                            <motion.div 
                                key={type.id}
                                initial={{ 
                                    opacity: 0, 
                                    y: 20,
                                    scale: 0.95
                                }}
                                animate={shakeCard === type.id ? {
                                    x: [-10, 10, -10, 10, 0],
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
                                        ? `0 8px 25px ${type.color || '#007AFF'}33` 
                                        : `0 8px 25px rgba(255, 255, 255, 0.1)`
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#2C2C2E',
                                    borderRadius: 16,
                                    padding: cardPadding,
                                    width: '100%',
                                    minHeight: cardMinHeight,
                                    position: 'relative',
                                    border: count > 0 ? `2px solid ${type.color || '#007AFF'}` : `2px solid transparent`,
                                    justifyContent: 'space-between',
                                    background: `linear-gradient(135deg, #2C2C2E 0%, #2A2A2C 50%, #262628 100%)`,
                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                    flex: isSingleItem ? 1 : 'none',
                                    marginBottom: index < inventoryTypes.length - 1 ? (isSmallMobile ? 12 : 16) : 0,
                                    boxSizing: 'border-box'
                                }}>
                                    
                                    {/* Индикатор доступности */}
                                    <motion.div 
                                        animate={(remainingAvailable === 0 && type.affects_availability) ? {
                                            scale: [1, 1.1, 1],
                                            backgroundColor: [type.color || '#007AFF', '#FF4D4F', type.color || '#007AFF']
                                        } : {}}
                                        transition={{ 
                                            duration: 1.5, 
                                            repeat: (remainingAvailable === 0 && type.affects_availability) ? Infinity : 0,
                                            ease: "easeInOut"
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: isSmallMobile ? 8 : 12,
                                            right: isSmallMobile ? 8 : 12,
                                            backgroundColor: (remainingAvailable === 0 && type.affects_availability) ? '#FF4D4F' : 
                                                           (remainingAvailable === 0 && !type.affects_availability) ? '#FF9500' : 
                                                           (type.color || '#007AFF'),
                                            color: '#fff',
                                            borderRadius: isSmallMobile ? 8 : 10,
                                            padding: badgePadding,
                                            fontSize: badgeFontSize,
                                            fontWeight: 600,
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                            background: `linear-gradient(135deg, ${remainingAvailable === 0 ? '#FF4D4F' : (type.color || '#007AFF')}, ${remainingAvailable === 0 ? '#FF4D4F' : (type.color || '#007AFF')}CC)`,
                                            zIndex: 1
                                        }}
                                    >
                                        {`${remainingAvailable} шт`}
                                    </motion.div>

                                    {/* Левая часть - иконка и название */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: isSmallMobile ? 8 : isMobile ? 12 : 16,
                                        flex: 1,
                                        minWidth: 0,
                                        paddingRight: isSmallMobile ? '50px' : '70px' // Отступ для бейджа
                                    }}>
                                        {/* Иконка */}
                                        <div style={{
                                            fontSize: iconSize,
                                            filter: remainingAvailable === 0 ? 'grayscale(100%) opacity(0.5)' : 'none',
                                            textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                            flexShrink: 0,
                                            lineHeight: 1
                                        }}>
                                            {type.icon_name || '📦'}
                                        </div>
                                        
                                        {/* Название и описание */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            flex: 1,
                                            minWidth: 0,
                                            gap: type.description ? 4 : 0
                                        }}>
                                            <div style={{
                                                color: remainingAvailable === 0 ? '#86868B' : '#fff',
                                                fontSize: titleFontSize,
                                                fontWeight: 600,
                                                textAlign: 'left',
                                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                                wordBreak: 'break-word',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                width: '100%',
                                                lineHeight: 1.2
                                            }}>
                                                {type.display_name}
                                            </div>
                                            
                                            {/* Дополнительное описание */}
                                            {type.description && (
                                                <div style={{
                                                    color: '#86868B',
                                                    fontSize: descriptionFontSize,
                                                    fontWeight: 400,
                                                    textAlign: 'left',
                                                    wordBreak: 'break-word',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: isSmallMobile ? 1 : 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    lineHeight: 1.3,
                                                    width: '100%'
                                                }}>
                                                    {type.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Правая часть - счетчик */}
                                    <div style={{
                                        flexShrink: 0
                                    }}>
                                        <CounterComponent
                                            count={count}
                                            onDecrease={() => handleChange(type.id, -1)}
                                            onIncrease={() => handleChange(type.id, 1)}
                                            canDecrease={count > 0}
                                            canIncrease={remainingAvailable > 0}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Компактная информация о добавлении нового инвентаря только для десктопа */}
                    {!isMobile && (
                        <div style={{
                            marginTop: 20,
                            padding: '16px',
                            backgroundColor: '#1C1C1E',
                            borderRadius: 16,
                            border: '1px solid #3C3C3E',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 16,
                            flexShrink: 0
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                flex: 1,
                                minWidth: 0
                            }}>
                                <div style={{ 
                                    fontSize: 20,
                                    flexShrink: 0
                                }}>💡</div>
                                <div style={{
                                    flex: 1,
                                    minWidth: 0
                                }}>
                                    <div style={{
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 500,
                                        marginBottom: 4,
                                        wordBreak: 'break-word',
                                        lineHeight: 1.2
                                    }}>
                                        Нужен другой тип инвентаря?
                                    </div>
                                    <div style={{
                                        color: '#86868B',
                                        fontSize: 12,
                                        wordBreak: 'break-word',
                                        lineHeight: 1.3
                                    }}>
                                        Добавьте новые типы инвентаря в систему
                                    </div>
                                </div>
                            </div>
                            
                            <motion.button
                                whileHover={{ 
                                    scale: 1.05,
                                    backgroundColor: '#34C759',
                                    boxShadow: '0 4px 15px rgba(52, 199, 89, 0.3)'
                                }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                onClick={handleManageInventory}
                                style={{
                                    background: 'linear-gradient(135deg, #30D158 0%, #28A745 100%)',
                                    border: 'none',
                                    borderRadius: 12,
                                    padding: '12px 16px',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    boxShadow: '0 2px 8px rgba(52, 199, 89, 0.2)',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                    touchAction: 'manipulation',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                <span style={{ fontSize: 14 }}>➕</span>
                                Добавить новый
                            </motion.button>
                        </div>
                    )}
                {/* Закрываем прокручиваемый контейнер */}
                </div>
                

            
            {/* Модал управления инвентарем */}
            {isInventoryModalOpen && (
                <DesktopInventoryModal
                    isOpen={isInventoryModalOpen}
                    onClose={handleInventoryModalClose}
                />
            )}
            
            {/* Мобильный модал управления инвентарем */}
            {isMobileInventoryModalOpen && (
                <MobileInventoryModal
                    isOpen={isMobileInventoryModalOpen}
                    onClose={handleInventoryModalClose}
                />
            )}
        </div>
    );
};

export default InventorySelector; 