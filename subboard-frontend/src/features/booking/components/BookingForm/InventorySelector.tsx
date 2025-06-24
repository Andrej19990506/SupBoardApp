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

// Новый интерфейс для системы инвентаря
interface NewInventorySelectorProps {
    selectedItems: Record<number, number>; // typeId -> quantity
    onChange: (selectedItems: Record<number, number>) => void;
    error?: string | null;
    plannedDate?: string;
    plannedTime?: string;
    durationInHours?: number;
    bookingId?: string; // для исключения текущего бронирования при редактировании
    onClose?: () => void; // для закрытия модального окна
}

// Legacy интерфейс для старых форм
interface LegacyInventorySelectorProps {
    counts: {
        boardCount: number;
        boardWithSeatCount: number;
        raftCount: number;
    };
    available: {
        board: number;
        board_with_seat: number;
        raft: number;
    };
    onChange: (counts: { boardCount: number; boardWithSeatCount: number; raftCount: number }) => void;
    error?: string | null;
    extraSeatButton?: boolean;
}

// Объединенный тип
type InventorySelectorProps = NewInventorySelectorProps | LegacyInventorySelectorProps;

// Функция для проверки типа пропсов
const isLegacyProps = (props: InventorySelectorProps): props is LegacyInventorySelectorProps => {
    return 'counts' in props && 'available' in props;
};

// Legacy компонент-адаптер для старых форм
const LegacyInventorySelectorAdapter: React.FC<LegacyInventorySelectorProps> = ({ 
    counts, 
    available, 
    onChange, 
    error 
}) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    const handleChange = (type: 'boardCount' | 'boardWithSeatCount' | 'raftCount', delta: number) => {
        const newCounts = { ...counts };
        const currentCount = newCounts[type] || 0;
        const newCount = Math.max(0, currentCount + delta);
        
        // Проверка доступности
        let maxAvailable = 0;
        if (type === 'boardCount') {
            maxAvailable = available.board;
        } else if (type === 'boardWithSeatCount') {
            maxAvailable = available.board_with_seat;
        } else if (type === 'raftCount') {
            maxAvailable = available.raft;
        }
        
        if (newCount <= maxAvailable) {
            newCounts[type] = newCount;
            onChange(newCounts);
        }
    };

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
    }) => (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 12,
            backgroundColor: '#1C1C1E',
            borderRadius: isMobile ? 6 : 8,
            padding: isMobile ? '4px 6px' : '6px 8px'
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
                    width: isMobile ? 32 : 28,
                    height: isMobile ? 32 : 28,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: !canDecrease ? '#3C3C3E' : '#007AFF',
                    color: '#fff',
                    fontSize: isMobile ? 18 : 16,
                    fontWeight: 600,
                    cursor: !canDecrease ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                −
            </motion.button>
            
            <div style={{
                minWidth: isMobile ? 16 : 20,
                textAlign: 'center',
                color: '#fff',
                fontSize: isMobile ? 16 : 18,
                fontWeight: 600,
            }}>
                {count}
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
                style={{
                    width: isMobile ? 32 : 28,
                    height: isMobile ? 32 : 28,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: !canIncrease ? '#3C3C3E' : '#007AFF',
                    color: '#fff',
                    fontSize: isMobile ? 18 : 16,
                    fontWeight: 600,
                    cursor: !canIncrease ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                +
            </motion.button>
        </div>
    );

    return (
        <div style={{ 
            background: '#23232a', 
            borderRadius: isMobile ? 12 : 16, 
            padding: isMobile ? 16 : 20, 
            margin: '8px 0' 
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid #3C3C3E'
            }}>
                <h3 style={{
                    margin: 0,
                    color: '#fff',
                    fontSize: isMobile ? 14 : 16,
                    fontWeight: 600
                }}>
                    🛻 Выберите инвентарь
                </h3>
            </div>

            <div style={{ 
                display: 'flex', 
                gap: isMobile ? 12 : 16, 
                alignItems: 'flex-start', 
                justifyContent: isMobile ? 'stretch' : 'flex-start',
                flexWrap: 'wrap',
                flexDirection: isMobile ? 'column' : 'row'
            }}>
                {/* Сапборды */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: 'center',
                    backgroundColor: '#2C2C2E',
                    borderRadius: isMobile ? 8 : 12,
                    padding: isMobile ? 16 : 16,
                    minWidth: isMobile ? 'auto' : 120,
                    flex: isMobile ? 'none' : '0 0 auto',
                    width: isMobile ? '100%' : 'auto',
                    position: 'relative',
                    border: counts.boardCount > 0 ? '2px solid #007AFF' : '2px solid transparent',
                    justifyContent: isMobile ? 'space-between' : 'center'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: isMobile ? 6 : 8,
                        right: isMobile ? 6 : 8,
                        backgroundColor: available.board === 0 ? '#FF4D4F' : '#007AFF',
                        color: '#fff',
                        borderRadius: isMobile ? 6 : 8,
                        padding: isMobile ? '1px 4px' : '2px 6px',
                        fontSize: isMobile ? 10 : 11,
                        fontWeight: 600
                    }}>
                        {available.board}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? 12 : 0,
                        flexDirection: isMobile ? 'row' : 'column'
                    }}>
                        <div style={{
                            fontSize: isMobile ? 32 : 40,
                            marginBottom: isMobile ? 0 : 8,
                        }}>
                            🏄‍♂️
                        </div>
                        <div style={{
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 500,
                            marginBottom: isMobile ? 0 : 12,
                            textAlign: isMobile ? 'left' : 'center'
                        }}>
                            Сапборды
                        </div>
                    </div>

                    <CounterComponent
                        count={counts.boardCount}
                        onDecrease={() => handleChange('boardCount', -1)}
                        onIncrease={() => handleChange('boardCount', 1)}
                        canDecrease={counts.boardCount > 0}
                        canIncrease={available.board > counts.boardCount}
                    />
                </div>

                {/* Сапборды с креслом */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: 'center',
                    backgroundColor: '#2C2C2E',
                    borderRadius: isMobile ? 8 : 12,
                    padding: isMobile ? 16 : 16,
                    minWidth: isMobile ? 'auto' : 120,
                    flex: isMobile ? 'none' : '0 0 auto',
                    width: isMobile ? '100%' : 'auto',
                    position: 'relative',
                    border: counts.boardWithSeatCount > 0 ? '2px solid #007AFF' : '2px solid transparent',
                    justifyContent: isMobile ? 'space-between' : 'center'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: isMobile ? 6 : 8,
                        right: isMobile ? 6 : 8,
                        backgroundColor: available.board_with_seat === 0 ? '#FF4D4F' : '#007AFF',
                        color: '#fff',
                        borderRadius: isMobile ? 6 : 8,
                        padding: isMobile ? '1px 4px' : '2px 6px',
                        fontSize: isMobile ? 10 : 11,
                        fontWeight: 600
                    }}>
                        {available.board_with_seat}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? 12 : 0,
                        flexDirection: isMobile ? 'row' : 'column'
                    }}>
                        <div style={{
                            fontSize: isMobile ? 32 : 40,
                            marginBottom: isMobile ? 0 : 8,
                        }}>
                            🪑
                        </div>
                        <div style={{
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 500,
                            marginBottom: isMobile ? 0 : 12,
                            textAlign: isMobile ? 'left' : 'center'
                        }}>
                            С креслом
                        </div>
                    </div>

                    <CounterComponent
                        count={counts.boardWithSeatCount}
                        onDecrease={() => handleChange('boardWithSeatCount', -1)}
                        onIncrease={() => handleChange('boardWithSeatCount', 1)}
                        canDecrease={counts.boardWithSeatCount > 0}
                        canIncrease={available.board_with_seat > counts.boardWithSeatCount}
                    />
                </div>

                {/* Плоты */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: 'center',
                    backgroundColor: '#2C2C2E',
                    borderRadius: isMobile ? 8 : 12,
                    padding: isMobile ? 16 : 16,
                    minWidth: isMobile ? 'auto' : 120,
                    flex: isMobile ? 'none' : '0 0 auto',
                    width: isMobile ? '100%' : 'auto',
                    position: 'relative',
                    border: counts.raftCount > 0 ? '2px solid #007AFF' : '2px solid transparent',
                    justifyContent: isMobile ? 'space-between' : 'center'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: isMobile ? 6 : 8,
                        right: isMobile ? 6 : 8,
                        backgroundColor: available.raft === 0 ? '#FF4D4F' : '#007AFF',
                        color: '#fff',
                        borderRadius: isMobile ? 6 : 8,
                        padding: isMobile ? '1px 4px' : '2px 6px',
                        fontSize: isMobile ? 10 : 11,
                        fontWeight: 600
                    }}>
                        {available.raft}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? 12 : 0,
                        flexDirection: isMobile ? 'row' : 'column'
                    }}>
                        <div style={{
                            fontSize: isMobile ? 32 : 40,
                            marginBottom: isMobile ? 0 : 8,
                        }}>
                            🛶
                        </div>
                        <div style={{
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 500,
                            marginBottom: isMobile ? 0 : 12,
                            textAlign: isMobile ? 'left' : 'center'
                        }}>
                            Плоты
                        </div>
                    </div>

                    <CounterComponent
                        count={counts.raftCount}
                        onDecrease={() => handleChange('raftCount', -1)}
                        onIncrease={() => handleChange('raftCount', 1)}
                        canDecrease={counts.raftCount > 0}
                        canIncrease={available.raft > counts.raftCount}
                    />
                </div>
            </div>

            {error && (
                <div style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor: '#FF4D4F20',
                    border: '1px solid #FF4D4F',
                    borderRadius: 8,
                    color: '#FF4D4F',
                    fontSize: 14
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};

// Основной компонент InventorySelector
const NewInventorySelector: React.FC<NewInventorySelectorProps> = ({ 
    selectedItems, 
    onChange, 
    error,
    plannedDate,
    plannedTime,
    durationInHours,
    bookingId,
    onClose
}) => {
    // Если selectedItems не валидные, используем безопасную версию
    const currentSelectedItems = React.useMemo(() => {
        if (!selectedItems || typeof selectedItems !== 'object' || Array.isArray(selectedItems)) {
            return {};
        }
        return selectedItems;
    }, [selectedItems]);
    // Хук для отслеживания размера экрана
    const [isMobile, setIsMobile] = useState(false);
    const [shakeCard, setShakeCard] = useState<number | null>(null);
    
    // Состояния для загрузки инвентаря
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    const [loading, setLoading] = useState(true);
    const [availability, setAvailability] = useState<Record<number, number>>({});
    
    // Состояние для управления модалом инвентаря
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    
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

    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

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
                    .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
                
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
                            .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
                        
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
                        return sum + countToUse;
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
        return Object.values(currentSelectedItems).reduce((sum, count) => sum + count, 0);
    };

    // Обработчик перехода к управлению инвентарем
    const handleManageInventory = () => {
        // Открываем модал управления инвентарем
        setIsInventoryModalOpen(true);
    };

    const handleInventoryModalClose = () => {
        setIsInventoryModalOpen(false);
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

    // Компонент счетчика для переиспользования
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
    }) => (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 12,
            backgroundColor: '#1C1C1E',
            borderRadius: isMobile ? 6 : 8,
            padding: isMobile ? '4px 6px' : '6px 8px'
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
                animate={!canDecrease ? { 
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
                    width: isMobile ? 32 : 28,
                    height: isMobile ? 32 : 28,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: !canDecrease ? '#3C3C3E' : '#007AFF',
                    color: '#fff',
                    fontSize: isMobile ? 18 : 16,
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
                    WebkitTapHighlightColor: 'transparent'
                }}
            >
                −
            </motion.button>
            
            <div style={{
                minWidth: isMobile ? 16 : 20,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                height: isMobile ? 20 : 24
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
                            fontSize: isMobile ? 16 : 18,
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
                    width: isMobile ? 32 : 28,
                    height: isMobile ? 32 : 28,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: !canIncrease ? '#3C3C3E' : '#007AFF',
                    color: '#fff',
                    fontSize: isMobile ? 18 : 16,
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
                    WebkitTapHighlightColor: 'transparent'
                }}
            >
                +
            </motion.button>
        </div>
    );

    if (loading) {
        return (
            <div style={{ 
                background: '#23232a', 
                borderRadius: isMobile ? 12 : 16, 
                padding: isMobile ? 16 : 20, 
                margin: '8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    color: '#86868B'
                }}>
                    <div style={{
                        width: 20,
                        height: 20,
                        border: '2px solid #3C3C3E',
                        borderTop: '2px solid #007AFF',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    Загрузка инвентаря...
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

    if (inventoryTypes.length === 0) {
        return (
            <div style={{ 
                background: '#23232a', 
                borderRadius: isMobile ? 12 : 16, 
                padding: isMobile ? 20 : 24, 
                margin: '8px 0',
                textAlign: 'center'
            }}>
                <div style={{ 
                    fontSize: isMobile ? 40 : 48,
                    marginBottom: 16
                }}>
                    📦
                </div>
                <div style={{ 
                    color: '#fff',
                    fontSize: isMobile ? 16 : 18,
                    fontWeight: 600,
                    marginBottom: 8
                }}>
                    Инвентарь не настроен
                </div>
                <div style={{ 
                    color: '#86868B',
                    fontSize: isMobile ? 14 : 15,
                    marginBottom: 20,
                    lineHeight: 1.4
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
                        borderRadius: isMobile ? 8 : 10,
                        padding: isMobile ? '12px 20px' : '14px 24px',
                        color: '#fff',
                        fontSize: isMobile ? 14 : 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        margin: '0 auto',
                        boxShadow: '0 4px 15px rgba(0, 122, 255, 0.2)',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent'
                    }}
                >
                    <span style={{ fontSize: 16 }}>⚙️</span>
                    Управление инвентарем
                </motion.button>
                
                <div style={{ 
                    color: '#5A5A5E',
                    fontSize: isMobile ? 12 : 13,
                    marginTop: 12,
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
            borderRadius: isMobile ? 12 : 16, 
            padding: isMobile ? 16 : 20, 
            margin: '8px 0',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent'
        }}>
            {/* Заголовок с кнопкой очистки */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: isMobile ? 12 : 16
            }}>
                <h3 style={{
                    margin: 0,
                    color: '#fff',
                    fontSize: isMobile ? 14 : (inventoryTypes.length === 1 ? 18 : 16),
                    fontWeight: inventoryTypes.length === 1 ? 700 : 600,
                    textShadow: inventoryTypes.length === 1 ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none'
                }}>
                    {inventoryTypes.length === 1 ? 
                        `🎯 ${inventoryTypes[0].display_name}` : 
                        '🛻 Выберите инвентарь'
                    }
                </h3>
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
                                borderRadius: 6,
                                padding: '4px 8px',
                                color: '#FF4D4F',
                                fontSize: 12,
                                cursor: 'pointer',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitTapHighlightColor: 'transparent'
                            }}
                            title="Очистить весь выбор"
                        >
                            Очистить
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* TODO: Временно отключено до обновления PresetManager */}
            {/* {presets.length > 0 && (
                <PresetManager
                    presets={presets}
                    onPresetsChange={handlePresetsChange}
                    onPresetSelect={handlePresetSelect}
                    currentSelection={currentSelectedItems}
                />
            )} */}

            {/* Контейнер с инвентарем */}
            <div style={{ 
                display: 'flex', 
                gap: isMobile ? 12 : 16, 
                alignItems: inventoryTypes.length === 1 ? 'center' : 'flex-start', 
                justifyContent: inventoryTypes.length === 1 ? 'center' : (isMobile ? 'stretch' : 'flex-start'),
                flexWrap: 'wrap',
                flexDirection: isMobile ? 'column' : 'row',
                // Для одного элемента добавляем дополнительные отступы
                padding: inventoryTypes.length === 1 ? (isMobile ? '20px 0' : '30px 0') : '0'
            }}>
                {inventoryTypes.map((type, index) => {
                    const count = currentSelectedItems[type.id] || 0;
                    const maxAvailable = availability[type.id] || 0;
                    const remainingAvailable = Math.max(0, maxAvailable - count); // Оставшееся количество после выбора
                    const isSingleItem = inventoryTypes.length === 1;
                    
                    // Отладочная информация
                    console.log(`[InventorySelector] Type: ${type.display_name}`, {
                        typeId: type.id,
                        available_count: type.available_count,
                        maxAvailable,
                        count,
                        remainingAvailable,
                        availability: availability[type.id]
                    });
                    
                    return (
                        <motion.div 
                            key={type.id}
                            initial={{ 
                                opacity: 0, 
                                y: isSingleItem ? 30 : 20,
                                scale: isSingleItem ? 0.95 : 1
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
                                delay: isSingleItem ? 0.2 : index * 0.1, 
                                duration: isSingleItem ? 0.6 : 0.4,
                                type: isSingleItem ? "spring" : "tween",
                                stiffness: isSingleItem ? 200 : 400,
                                damping: isSingleItem ? 20 : 25
                            }}
                            whileHover={{ 
                                scale: isSingleItem ? 1.03 : 1.02,
                                boxShadow: count > 0 
                                    ? `0 ${isSingleItem ? 12 : 8}px ${isSingleItem ? 35 : 25}px ${type.color || '#007AFF'}${isSingleItem ? '40' : '33'}` 
                                    : `0 ${isSingleItem ? 12 : 8}px ${isSingleItem ? 35 : 25}px rgba(255, 255, 255, ${isSingleItem ? '0.15' : '0.1'})`
                            }}
                            style={{
                                display: 'flex',
                                flexDirection: isMobile || isSingleItem ? 'row' : 'column',
                                alignItems: 'center',
                                backgroundColor: isSingleItem ? '#2E2E30' : '#2C2C2E',
                                borderRadius: isMobile ? 8 : (isSingleItem ? 16 : 12),
                                padding: isMobile ? (isSingleItem ? 20 : 16) : (isSingleItem ? 24 : 16),
                                minWidth: isMobile ? 'auto' : (isSingleItem ? 280 : 120),
                                maxWidth: isSingleItem ? (isMobile ? '100%' : 400) : 'auto',
                                flex: isMobile ? 'none' : (isSingleItem ? '0 0 auto' : '0 0 auto'),
                                width: isMobile ? '100%' : 'auto',
                                position: 'relative',
                                border: count > 0 ? `${isSingleItem ? 3 : 2}px solid ${type.color || '#007AFF'}` : `${isSingleItem ? 3 : 2}px solid transparent`,
                                justifyContent: (isMobile || isSingleItem) ? 'space-between' : 'center',
                                // Дополнительные стили для одного элемента
                                background: isSingleItem ? 
                                    `linear-gradient(135deg, #2E2E30 0%, #2A2A2C 50%, #262628 100%)` : 
                                    '#2C2C2E',
                                boxShadow: isSingleItem ? 
                                    '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 
                                    'none'
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
                                    top: isMobile ? 6 : (isSingleItem ? 12 : 8),
                                    right: isMobile ? 6 : (isSingleItem ? 12 : 8),
                                    backgroundColor: (remainingAvailable === 0 && type.affects_availability) ? '#FF4D4F' : 
                                                   (remainingAvailable === 0 && !type.affects_availability) ? '#FF9500' : 
                                                   (type.color || '#007AFF'),
                                    color: '#fff',
                                    borderRadius: isMobile ? 6 : (isSingleItem ? 10 : 8),
                                    padding: isMobile ? '1px 4px' : (isSingleItem ? '4px 8px' : '2px 6px'),
                                    fontSize: isMobile ? 10 : (isSingleItem ? 13 : 11),
                                    fontWeight: 600,
                                    boxShadow: isSingleItem ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
                                    // Дополнительный эффект для одного элемента
                                    background: isSingleItem ? 
                                        `linear-gradient(135deg, ${remainingAvailable === 0 ? '#FF4D4F' : (type.color || '#007AFF')}, ${remainingAvailable === 0 ? '#FF4D4F' : (type.color || '#007AFF')}CC)` :
                                        (remainingAvailable === 0 ? '#FF4D4F' : (type.color || '#007AFF'))
                                }}
                            >
                                {isSingleItem ? `${remainingAvailable} шт` : remainingAvailable}
                            </motion.div>

                            {/* Дополнительный декоративный элемент для одного элемента */}
                            {isSingleItem && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 0.6, scale: 1 }}
                                    transition={{ delay: 0.4, duration: 0.5 }}
                                    style={{
                                        position: 'absolute',
                                        top: isMobile ? 6 : 12,
                                        left: isMobile ? 6 : 12,
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: `linear-gradient(45deg, ${type.color || '#007AFF'}, #fff)`,
                                        boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)'
                                    }}
                                />
                            )}

                            {/* Левая часть - иконка и название */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: isMobile ? 12 : (isSingleItem ? 20 : 0),
                                flexDirection: (isMobile || isSingleItem) ? 'row' : 'column'
                            }}>
                                {/* Иконка */}
                                <div style={{
                                    fontSize: isMobile ? 32 : (isSingleItem ? 56 : 40),
                                    marginBottom: (isMobile || isSingleItem) ? 0 : 8,
                                    filter: remainingAvailable === 0 ? 'grayscale(100%) opacity(0.5)' : 'none',
                                    // Добавляем тень для одного элемента
                                    textShadow: isSingleItem ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none'
                                }}>
                                    {type.icon_name || '📦'}
                                </div>
                                
                                {/* Название и описание */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: (isMobile || isSingleItem) ? 'flex-start' : 'center'
                                }}>
                                    <div style={{
                                        color: remainingAvailable === 0 ? '#86868B' : '#fff',
                                        fontSize: isMobile ? 14 : (isSingleItem ? 20 : 14),
                                        fontWeight: isSingleItem ? 600 : 500,
                                        marginBottom: (isMobile || !isSingleItem) ? 0 : 4,
                                        textAlign: (isMobile || isSingleItem) ? 'left' : 'center',
                                        textShadow: isSingleItem ? '0 1px 2px rgba(0, 0, 0, 0.5)' : 'none'
                                    }}>
                                        {type.display_name}
                                    </div>
                                    
                                    {/* Дополнительное описание для одного элемента */}
                                    {isSingleItem && type.description && (
                                        <div style={{
                                            color: '#86868B',
                                            fontSize: isMobile ? 12 : 14,
                                            fontWeight: 400,
                                            marginTop: 2,
                                            textAlign: 'left'
                                        }}>
                                            {type.description}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Правая часть - счетчик */}
                            <div style={{
                                // Для одного элемента делаем счетчик крупнее
                                transform: isSingleItem ? 'scale(1.2)' : 'scale(1)'
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

            {/* Информация о добавлении нового инвентаря */}
            <div style={{
                marginTop: 16,
                padding: isMobile ? 12 : 16,
                backgroundColor: '#1C1C1E',
                borderRadius: 8,
                border: '1px solid #3C3C3E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flex: 1
                }}>
                    <div style={{ fontSize: 20 }}>💡</div>
                    <div>
                        <div style={{
                            color: '#fff',
                            fontSize: isMobile ? 13 : 14,
                            fontWeight: 500,
                            marginBottom: 2
                        }}>
                            Нужен другой тип инвентаря?
                        </div>
                        <div style={{
                            color: '#86868B',
                            fontSize: isMobile ? 11 : 12
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
                        borderRadius: 6,
                        padding: isMobile ? '8px 12px' : '10px 16px',
                        color: '#fff',
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 8px rgba(52, 199, 89, 0.2)',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent'
                    }}
                >
                    <span style={{ fontSize: isMobile ? 12 : 14 }}>➕</span>
                    {isMobile ? 'Добавить' : 'Добавить новый'}
                </motion.button>
            </div>

            {/* Ошибка если есть */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                        marginTop: 12,
                        padding: 12,
                        backgroundColor: '#FF4D4F20',
                        border: '1px solid #FF4D4F',
                        borderRadius: 8,
                        color: '#FF4D4F',
                        fontSize: 14
                    }}
                >
                    {error}
                </motion.div>
            )}

            {/* Модал управления инвентарем */}
            <DesktopInventoryModal
                isOpen={isInventoryModalOpen}
                onClose={handleInventoryModalClose}
            />
        </div>
    );
};

// Универсальный компонент InventorySelector
const InventorySelector: React.FC<InventorySelectorProps> = (props) => {
    if (isLegacyProps(props)) {
        // Используем legacy адаптер для старых форм
        return <LegacyInventorySelectorAdapter {...props} />;
    } else {
        // Используем новый компонент для новой системы инвентаря
        return <NewInventorySelector {...props} />;
    }
};

export default InventorySelector; 