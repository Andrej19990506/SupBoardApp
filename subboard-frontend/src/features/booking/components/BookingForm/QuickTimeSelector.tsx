import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { QuickTimeSlot } from './types';
import type { Booking } from '@/types/booking';
import { calculateDayStatistics } from '@features/booking/utils/calendarUtils';
import { getBookingInventoryUsage } from '@features/booking/utils/bookingUtils';

interface QuickTimeSelectorProps {
    selectedTime: string;
    onTimeSelect: (time: string) => void;
    availableSlots?: QuickTimeSlot[];
    disabled?: boolean;
    // Новые пропсы для расчета реальной доступности
    selectedDate?: Date;
    allBookings?: Booking[];
    totalInventory?: number; // Новый параметр для общего количества инвентаря
}

// Предустановленные популярные временные слоты
const DEFAULT_TIME_SLOTS: QuickTimeSlot[] = [
    { time: '09:00', label: 'Утро', isAvailable: true, availableInventory: 10 },
    { time: '12:00', label: 'День', isAvailable: true, availableInventory: 8 },
    { time: '15:00', label: 'Полдень', isAvailable: true, availableInventory: 6 },
    { time: '18:00', label: 'Вечер', isAvailable: true, availableInventory: 4 },
    { time: '21:00', label: 'Поздний', isAvailable: true, availableInventory: 2 }
];

const STORAGE_KEY = 'quickTimeSlots';

const QuickTimeSelector: React.FC<QuickTimeSelectorProps> = ({
    selectedTime,
    onTimeSelect,
    availableSlots,
    disabled = false,
    selectedDate,
    allBookings = [],
    totalInventory // Новый параметр
}) => {
    // Определяем общее количество инвентаря
    const effectiveTotalInventory = totalInventory || 15;

    console.log('[QuickTimeSelector] Inventory calculation:', {
        totalInventory,
        effectiveTotalInventory,
        selectedDate: selectedDate?.toISOString()
    });
    const [customTimeSlots, setCustomTimeSlots] = useState<QuickTimeSlot[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTimeInput, setNewTimeInput] = useState('');
    const [newLabelInput, setNewLabelInput] = useState('');

    // Загружаем сохраненные слоты при инициализации
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setCustomTimeSlots(JSON.parse(saved));
            } catch (e) {
                console.error('Error loading saved time slots:', e);
                setCustomTimeSlots(DEFAULT_TIME_SLOTS);
            }
        } else {
            setCustomTimeSlots(DEFAULT_TIME_SLOTS);
        }
    }, []);

    // Сохраняем слоты при изменении
    useEffect(() => {
        if (customTimeSlots.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customTimeSlots));
        }
    }, [customTimeSlots]);

    // Рассчитываем реальную доступность на основе данных
    const calculatedSlots = useMemo(() => {
        console.log('[QuickTimeSelector] Calculating slots:', {
            availableSlots: !!availableSlots,
            selectedDate,
            allBookingsCount: allBookings.length,
            totalInventory,
            effectiveTotalInventory,
            customTimeSlotsCount: customTimeSlots.length
        });
        
        if (availableSlots) {
            // Если слоты переданы извне, используем их
            console.log('[QuickTimeSelector] Using provided availableSlots');
            return availableSlots;
        }
        
        if (!selectedDate) {
            // Если нет выбранной даты, используем кастомные слоты со всеми досками доступными
            console.log('[QuickTimeSelector] No selectedDate, using custom slots with full availability');
            return customTimeSlots.map(slot => ({
                ...slot,
                isAvailable: true,
                availableInventory: effectiveTotalInventory
            }));
        }
        
        // Рассчитываем статистику дня (даже если нет бронирований)
        const dayStats = calculateDayStatistics(selectedDate, allBookings, effectiveTotalInventory);
        
        console.log('[QuickTimeSelector] Day stats:', {
            selectedDate: format(selectedDate, 'yyyy-MM-dd'),
            allBookingsCount: allBookings.length,
            effectiveTotalInventory,
            timeSlots: dayStats.timeSlots.map(ts => ({
                hour: ts.hour,
                available: ts.available,
                booked: ts.booked,
                bookingsInSlot: ts.bookings.length
            })),
            relevantBookings: allBookings.filter(b => {
                const bookingDate = format(parseISO(b.plannedStartTime), 'yyyy-MM-dd');
                const targetDate = format(selectedDate, 'yyyy-MM-dd');
                return bookingDate === targetDate || 
                       (parseISO(b.plannedStartTime) < selectedDate && 
                        new Date(parseISO(b.plannedStartTime).getTime() + (b.durationInHours || 24) * 60 * 60 * 1000) > selectedDate);
            }).map(b => ({
                id: b.id,
                startTime: b.plannedStartTime,
                duration: b.durationInHours,
                boards: getBookingInventoryUsage(b).boards
            }))
        });
        
        // Обновляем кастомные слоты с реальными данными о доступности
        const result = customTimeSlots.map(slot => {
            const [hours] = slot.time.split(':').map(Number);
            const timeSlotInfo = dayStats.timeSlots.find(ts => ts.hour === hours);
            
            if (timeSlotInfo) {
                const updatedSlot = {
                    ...slot,
                    isAvailable: timeSlotInfo.available > 0,
                    availableInventory: timeSlotInfo.available
                };
                console.log(`[QuickTimeSelector] Slot ${slot.time}:`, {
                    original: slot,
                    timeSlotInfo,
                    updated: updatedSlot
                });
                return updatedSlot;
            }
            
            // Если нет данных для этого часа, считаем доступным
            console.log(`[QuickTimeSelector] No data for ${slot.time}, using full availability`);
            return {
                ...slot,
                isAvailable: true,
                availableInventory: effectiveTotalInventory
            };
        });
        
        console.log('[QuickTimeSelector] Final calculated slots:', result);
        return result;
    }, [availableSlots, customTimeSlots, selectedDate, allBookings, effectiveTotalInventory]);
    
    // Используем рассчитанные слоты
    const timeSlots = calculatedSlots;

    const handleTimeClick = (time: string, isAvailable: boolean) => {
        if (!disabled && isAvailable) {
            onTimeSelect(time);
        }
    };

    const handleRemoveTimeSlot = (timeToRemove: string) => {
        setCustomTimeSlots(prev => prev.filter(slot => slot.time !== timeToRemove));
    };

    const handleAddTimeSlot = () => {
        if (!newTimeInput.trim() || !newLabelInput.trim()) return;
        
        // Проверяем, что такое время еще не существует
        if (customTimeSlots.some(slot => slot.time === newTimeInput)) {
            return;
        }

        const newSlot: QuickTimeSlot = {
            time: newTimeInput,
            label: newLabelInput.trim(),
            isAvailable: true,
            availableInventory: 10
        };

        setCustomTimeSlots(prev => [...prev, newSlot].sort((a, b) => a.time.localeCompare(b.time)));
        setNewTimeInput('');
        setNewLabelInput('');
        setShowAddModal(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddTimeSlot();
        }
    };

    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
            }}>
                <div style={{ 
                    fontSize: '14px', 
                    color: '#86868B', 
                    fontWeight: 500
                }}>
                    Быстрый выбор времени:
                </div>
                
                {/* Кнопка настройки */}
                <button
                    type="button"
                    onClick={() => setShowEditor(!showEditor)}
                    disabled={disabled}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#007AFF',
                        fontSize: '16px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s ease',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                        if (!disabled) {
                            (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF20';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!disabled) {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }
                    }}
                    title="Настроить быстрые времена"
                >
                    ⚙️
                </button>
            </div>
            
            <div style={{ 
                display: 'flex', 
                gap: '8px', 
                flexWrap: 'wrap' 
            }}>
                {timeSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    const isClickable = !disabled && slot.isAvailable;
                    
                    return (
                        <div
                            key={slot.time}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: isSelected 
                                    ? '#007AFF' 
                                    : slot.isAvailable 
                                        ? '#3C3C3E' 
                                        : '#2C2C2E',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitTapHighlightColor: 'transparent'
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => handleTimeClick(slot.time, slot.isAvailable)}
                                disabled={!isClickable}
                                style={{
                                    padding: '8px 12px',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: isClickable ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                    minWidth: '60px',
                                    transition: 'all 0.2s ease',
                                    backgroundColor: 'transparent',
                                    color: isSelected 
                                        ? '#fff' 
                                        : slot.isAvailable 
                                            ? '#fff' 
                                            : '#666',
                                    opacity: disabled ? 0.5 : 1,
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    if (isClickable && !isSelected) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF40';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (isClickable && !isSelected) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                {/* Время */}
                                <span style={{ 
                                    fontSize: '14px',
                                    fontWeight: 600 
                                }}>
                                    {slot.time}
                                </span>
                                
                                {/* Подпись */}
                                <span style={{ 
                                    fontSize: '10px',
                                    color: isSelected ? '#fff' : '#86868B',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {slot.label}
                                </span>
                                
                                {/* Индикатор доступности инвентаря */}
                                {slot.isAvailable && slot.availableInventory > 0 && (
                                    <div style={{
                                        fontSize: '9px',
                                        color: slot.availableInventory > 5 
                                            ? '#4CAF50' 
                                            : slot.availableInventory > 2 
                                                ? '#FFD600' 
                                                : '#FF4D4F',
                                        fontWeight: 600
                                    }}>
                                        {slot.availableInventory}
                                    </div>
                                )}
                                
                                {/* Индикатор "недоступно" */}
                                {!slot.isAvailable && (
                                    <div style={{
                                        fontSize: '9px',
                                        color: '#FF4D4F',
                                        fontWeight: 600
                                    }}>
                                        ✕
                                    </div>
                                )}
                            </button>
                            
                            {/* Кнопка удаления (только в режиме редактирования и для кастомных слотов) */}
                            {showEditor && !availableSlots && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTimeSlot(slot.time)}
                                    disabled={disabled}
                                    style={{
                                        padding: '6px 8px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: '#FF4D4F',
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        transition: 'background-color 0.2s ease',
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        MozUserSelect: 'none',
                                        msUserSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                        WebkitTapHighlightColor: 'transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!disabled) {
                                            (e.target as HTMLButtonElement).style.backgroundColor = '#FF4D4F20';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!disabled) {
                                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                                        }
                                    }}
                                    title="Удалить время"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
                
                {/* Кнопка добавления нового времени (только в режиме редактирования) */}
                {showEditor && !availableSlots && (
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        disabled={disabled}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px dashed #007AFF',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            backgroundColor: 'transparent',
                            color: '#007AFF',
                            minWidth: '60px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            transition: 'all 0.2s ease',
                            opacity: disabled ? 0.5 : 1,
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                            WebkitTouchCallout: 'none',
                            WebkitTapHighlightColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                            if (!disabled) {
                                (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF20';
                                (e.target as HTMLButtonElement).style.borderColor = '#007AFF';
                                (e.target as HTMLButtonElement).style.borderStyle = 'solid';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!disabled) {
                                (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                                (e.target as HTMLButtonElement).style.borderColor = '#007AFF';
                                (e.target as HTMLButtonElement).style.borderStyle = 'dashed';
                            }
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>+</span>
                        <span style={{ 
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Добавить
                        </span>
                    </button>
                )}
                
                {/* Кнопка "Другое время" */}
                <button
                    type="button"
                    onClick={() => {
                        // Фокусируемся на input времени
                        const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
                        if (timeInput) {
                            timeInput.focus();
                        }
                    }}
                    disabled={disabled}
                    style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px dashed #007AFF',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        backgroundColor: 'transparent',
                        color: '#007AFF',
                        minWidth: '60px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.2s ease',
                        opacity: disabled ? 0.5 : 1,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                        if (!disabled) {
                            (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF20';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!disabled) {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }
                    }}
                >
                    <span style={{ fontSize: '14px' }}>⏰</span>
                    <span style={{ 
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Другое
                    </span>
                </button>
            </div>
            
            {/* Подсказка */}
            <div style={{ 
                fontSize: '12px', 
                color: '#86868B', 
                marginTop: '8px',
                fontStyle: 'italic',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitTapHighlightColor: 'transparent'
            }}>
                💡 {showEditor ? 'Нажмите ⚙️ чтобы скрыть редактор' : selectedDate && allBookings.length > 0 ? 'Цифры показывают реальную доступность инвентаря' : 'Цифры показывают количество доступного инвентаря'}
            </div>

            {/* Модальное окно добавления времени */}
            {showAddModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }} onClick={() => setShowAddModal(false)}>
                    <div style={{
                        background: '#23232a',
                        borderRadius: 16,
                        padding: 24,
                        minWidth: 280,
                        maxWidth: 320,
                        boxShadow: '0 4px 32px #0008',
                        position: 'relative',
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{
                            margin: '0 0 16px 0',
                            color: '#fff',
                            fontSize: '18px',
                            fontWeight: 600,
                            textAlign: 'center'
                        }}>
                            Добавить время
                        </h3>
                        
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{
                                display: 'block',
                                color: '#86868B',
                                fontSize: '14px',
                                marginBottom: '6px'
                            }}>
                                ⏰ Время
                            </label>
                            <input
                                type="time"
                                value={newTimeInput}
                                onChange={(e) => setNewTimeInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={disabled}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    backgroundColor: '#1C1C1E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '16px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                color: '#86868B',
                                fontSize: '14px',
                                marginBottom: '6px'
                            }}>
                                🏷️ Название
                            </label>
                            <input
                                type="text"
                                value={newLabelInput}
                                onChange={(e) => setNewLabelInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Например: Обед"
                                disabled={disabled}
                                maxLength={10}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    backgroundColor: '#1C1C1E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '16px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{
                                fontSize: '12px',
                                color: '#86868B',
                                marginTop: '4px'
                            }}>
                                {newLabelInput.length}/10 символов
                            </div>
                        </div>
                        
                        {/* Предупреждение о дублировании */}
                        {newTimeInput && customTimeSlots.some(slot => slot.time === newTimeInput) && (
                            <div style={{
                                padding: '8px 12px',
                                backgroundColor: '#FF4D4F20',
                                border: '1px solid #FF4D4F',
                                borderRadius: '6px',
                                color: '#FF4D4F',
                                fontSize: '14px',
                                marginBottom: '16px',
                                textAlign: 'center'
                            }}>
                                ⚠️ Это время уже существует
                            </div>
                        )}
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'flex-end', 
                            gap: 12 
                        }}>
                            <button 
                                type="button" 
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewTimeInput('');
                                    setNewLabelInput('');
                                }} 
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#86868B',
                                    fontSize: 16,
                                    cursor: 'pointer',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    transition: 'background-color 0.2s ease',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    (e.target as HTMLButtonElement).style.backgroundColor = '#86868B20';
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                                }}
                            >
                                Отмена
                            </button>
                            <button 
                                type="button" 
                                onClick={handleAddTimeSlot}
                                disabled={disabled || !newTimeInput.trim() || !newLabelInput.trim() || customTimeSlots.some(slot => slot.time === newTimeInput)}
                                style={{
                                    background: '#007AFF',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 20px',
                                    fontSize: 16,
                                    fontWeight: 600,
                                    cursor: (disabled || !newTimeInput.trim() || !newLabelInput.trim() || customTimeSlots.some(slot => slot.time === newTimeInput)) ? 'not-allowed' : 'pointer',
                                    opacity: (disabled || !newTimeInput.trim() || !newLabelInput.trim() || customTimeSlots.some(slot => slot.time === newTimeInput)) ? 0.5 : 1,
                                    transition: 'all 0.2s ease',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    if (!disabled && newTimeInput.trim() && newLabelInput.trim() && !customTimeSlots.some(slot => slot.time === newTimeInput)) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#0056CC';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!disabled && newTimeInput.trim() && newLabelInput.trim() && !customTimeSlots.some(slot => slot.time === newTimeInput)) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF';
                                    }
                                }}
                            >
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuickTimeSelector; 