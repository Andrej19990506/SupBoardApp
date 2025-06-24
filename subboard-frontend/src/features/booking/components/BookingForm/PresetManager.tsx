import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface InventoryPreset {
    id: string;
    name: string;
    boardCount: number; // для совместимости со старыми пресетами
    boardWithSeatCount: number; // для совместимости со старыми пресетами
    raftCount: number; // для совместимости со старыми пресетами
    selectedItems?: Record<number, number>; // новый формат: typeId -> quantity
    isDefault?: boolean;
    isPopular?: boolean;
    usageCount?: number;
    createdBy?: string;
    createdAt?: string;
    description?: string;
    emoji?: string;
}

interface PresetManagerProps {
    presets: InventoryPreset[];
    onPresetsChange: (presets: InventoryPreset[]) => void;
    currentCounts: {
        boardCount: number;
        boardWithSeatCount: number;
        raftCount: number;
    };
    available: {
        board: number;
        board_with_seat: number;
        raft: number;
    };
    onPresetSelect: (preset: InventoryPreset) => void;
    isMobile?: boolean;
}

const PresetManager: React.FC<PresetManagerProps> = ({
    presets,
    onPresetsChange,
    currentCounts,
    available,
    onPresetSelect,
    isMobile = false
}) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingPreset, setEditingPreset] = useState<InventoryPreset | null>(null);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetDescription, setNewPresetDescription] = useState('');

    const [selectedEmoji, setSelectedEmoji] = useState('⚡');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Закрытие панели эмодзи при клике вне её
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showEmojiPicker) {
                const target = event.target as Element;
                if (!target.closest('[data-emoji-picker]')) {
                    setShowEmojiPicker(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    // Популярные эмодзи для пресетов
    const availableEmojis = [
        '⚡', '🔥', '⭐', '💎', '🎯', '🏆', '🚀', '💫', '✨', '🌟',
        '👑', '🎪', '🎨', '🎭', '🎪', '🎊', '🎉', '🎈', '🎁', '🏅',
        '🌊', '🏄‍♂️', '🏄‍♀️', '🚤', '⛵', '🏖️', '🌅', '🌞', '☀️', '🌤️',
        '👨‍👩‍👧‍👦', '👫', '👬', '👭', '👶', '🧒', '👦', '👧', '👨', '👩',
        '💪', '🤝', '👍', '✌️', '🤟', '👌', '🤞', '🙌', '👏', '🤗'
    ];

    // Проверка доступности пресета
    const isPresetAvailable = (preset: InventoryPreset) => {
        if (!available) return true; // Если доступность не передана, считаем что доступно
        
        const totalNeededBoards = preset.boardCount + preset.boardWithSeatCount + (preset.raftCount * 2);
        return preset.boardCount <= available.board && 
               preset.boardWithSeatCount <= available.board_with_seat && 
               preset.raftCount <= available.raft &&
               totalNeededBoards <= Math.min(available.board, available.board_with_seat, available.raft * 2);
    };

    // Проверка является ли пресет текущим выбором
    const isCurrentSelection = (preset: InventoryPreset) => {
        return currentCounts.boardCount === preset.boardCount &&
               currentCounts.boardWithSeatCount === preset.boardWithSeatCount &&
               currentCounts.raftCount === preset.raftCount;
    };

    // Создание нового пресета
    const handleCreatePreset = () => {
        if (!newPresetName.trim()) return;

        const newPreset: InventoryPreset = {
            id: Date.now().toString(),
            name: newPresetName.trim(),
            description: newPresetDescription.trim() || undefined,
            boardCount: currentCounts.boardCount,
            boardWithSeatCount: currentCounts.boardWithSeatCount,
            raftCount: currentCounts.raftCount,

            createdBy: 'current_user', // В реальном приложении здесь будет ID пользователя
            createdAt: new Date().toISOString(),
            usageCount: 0,
            emoji: selectedEmoji
        };

        onPresetsChange([...presets, newPreset]);
        
        // Сброс формы
        setNewPresetName('');
        setNewPresetDescription('');
        setSelectedEmoji('⚡');
        setShowEmojiPicker(false);
        setShowCreateForm(false);
    };

    // Удаление пресета
    const handleDeletePreset = (presetId: string) => {
        onPresetsChange(presets.filter(p => p.id !== presetId));
    };

    // Обновление счетчика использования
    const handlePresetClick = (preset: InventoryPreset) => {
        if (!isPresetAvailable(preset)) return;

        // Увеличиваем счетчик использования, но ограничиваем максимумом 99
        const updatedPresets = presets.map(p => 
            p.id === preset.id 
                ? { ...p, usageCount: Math.min((p.usageCount || 0) + 1, 99) }
                : p
        );
        onPresetsChange(updatedPresets);
        onPresetSelect(preset);
    };

    // Сортировка пресетов: сначала популярные, потом по частоте использования
    const sortedPresets = [...presets].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        if (a.isPopular && !b.isPopular) return -1;
        if (!a.isPopular && b.isPopular) return 1;
        return (b.usageCount || 0) - (a.usageCount || 0);
    });

    return (
        <div style={{
            marginTop: isMobile ? 12 : 16,
            padding: isMobile ? 10 : 12,
            backgroundColor: '#1C1C1E',
            borderRadius: isMobile ? 6 : 8,
            border: '1px solid #3C3C3E'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: isMobile ? 8 : 10
            }}>
                <div style={{
                    color: '#86868B',
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 500
                }}>
                    ⚡ Быстрый выбор:
                </div>
                
                <div style={{ display: 'flex', gap: 6 }}>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        style={{
                            background: 'none',
                            border: '1px solid #007AFF',
                            borderRadius: 4,
                            padding: '2px 6px',
                            color: '#007AFF',
                            fontSize: 10,
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}
                        title="Создать пресет из текущего выбора"
                    >
                        + Создать
                    </motion.button>
                    
                    {/* Кнопка сброса счетчиков */}
                    {presets.some(p => p.usageCount && p.usageCount > 0) && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                const resetPresets = presets.map(p => ({ ...p, usageCount: 0 }));
                                onPresetsChange(resetPresets);
                            }}
                            style={{
                                background: 'none',
                                border: '1px solid #FF9500',
                                borderRadius: 4,
                                padding: '2px 6px',
                                color: '#FF9500',
                                fontSize: 10,
                                cursor: 'pointer',
                                userSelect: 'none'
                            }}
                            title="Сбросить счетчики использования"
                        >
                            🔄 Сброс
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Форма создания пресета */}
            <AnimatePresence>
                {showCreateForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            marginBottom: 12,
                            padding: 8,
                            backgroundColor: '#2C2C2E',
                            borderRadius: 6,
                            border: '1px solid #3C3C3E',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {/* Выбор эмодзи */}
                                <div style={{ position: 'relative' }} data-emoji-picker>
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            backgroundColor: '#2C2C2E',
                                            border: '1px solid #3C3C3E',
                                            borderRadius: 4,
                                            fontSize: 16,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Выбрать эмодзи"
                                    >
                                        {selectedEmoji}
                                    </motion.button>
                                    
                                    {/* Панель выбора эмодзи */}
                                    <AnimatePresence>
                                        {showEmojiPicker && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                                transition={{ duration: 0.2 }}
                                                style={{
                                                    position: 'absolute',
                                                    top: 36,
                                                    left: 0,
                                                    zIndex: 1000,
                                                    backgroundColor: '#2C2C2E',
                                                    border: '1px solid #3C3C3E',
                                                    borderRadius: 8,
                                                    padding: 8,
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(8, 1fr)',
                                                    gap: 4,
                                                    maxWidth: 240,
                                                    maxHeight: 200,
                                                    overflowY: 'auto',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                                }}
                                            >
                                                {availableEmojis.map((emoji, index) => (
                                                    <motion.button
                                                        key={emoji}
                                                        type="button"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: index * 0.02 }}
                                                        whileHover={{ scale: 1.2, backgroundColor: '#3C3C3E' }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => {
                                                            setSelectedEmoji(emoji);
                                                            setShowEmojiPicker(false);
                                                        }}
                                                        style={{
                                                            width: 24,
                                                            height: 24,
                                                            backgroundColor: selectedEmoji === emoji ? '#007AFF' : 'transparent',
                                                            border: 'none',
                                                            borderRadius: 4,
                                                            fontSize: 14,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {emoji}
                                                    </motion.button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                
                                {/* Поле названия */}
                                <input
                                    type="text"
                                    placeholder="Название пресета"
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '6px 8px',
                                        backgroundColor: '#1C1C1E',
                                        border: '1px solid #3C3C3E',
                                        borderRadius: 4,
                                        color: '#fff',
                                        fontSize: 12,
                                        outline: 'none'
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleCreatePreset()}
                                />
                            </div>
                        </div>
                        
                        <div style={{ marginBottom: 8 }}>
                            <input
                                type="text"
                                placeholder="Описание (необязательно)"
                                value={newPresetDescription}
                                onChange={(e) => setNewPresetDescription(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: '#1C1C1E',
                                    border: '1px solid #3C3C3E',
                                    borderRadius: 4,
                                    color: '#fff',
                                    fontSize: 12,
                                    outline: 'none'
                                }}
                            />
                        </div>



                        <div style={{
                            display: 'flex',
                            gap: 6,
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#86868B',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    padding: '4px 8px'
                                }}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleCreatePreset}
                                disabled={!newPresetName.trim()}
                                style={{
                                    backgroundColor: newPresetName.trim() ? '#007AFF' : '#3C3C3E',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '4px 12px',
                                    fontSize: 11,
                                    cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                                    opacity: newPresetName.trim() ? 1 : 0.5
                                }}
                            >
                                Создать
                            </button>
                        </div>

                        <div style={{
                            marginTop: 8,
                            padding: 6,
                            backgroundColor: '#1C1C1E',
                            borderRadius: 4,
                            fontSize: 10,
                            color: '#86868B'
                        }}>
                            Текущий выбор: {currentCounts.boardCount} сапборд + {currentCounts.boardWithSeatCount} с креслом + {currentCounts.raftCount} плот
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Список пресетов */}
            <div style={{
                display: 'flex',
                gap: isMobile ? 6 : 8,
                flexWrap: 'wrap'
            }}>
                {sortedPresets.map((preset, index) => {
                    const isAvailable = isPresetAvailable(preset);
                    const isCurrent = isCurrentSelection(preset);

                    return (
                        <div key={preset.id} style={{ position: 'relative' }}>
                            <motion.button
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + index * 0.1, duration: 0.3 }}
                                whileHover={isAvailable && !isCurrent ? { 
                                    scale: 1.05,
                                    backgroundColor: '#007AFF10',
                                    borderColor: '#007AFF'
                                } : {}}
                                whileTap={isAvailable ? { 
                                    scale: 0.95 
                                } : {}}
                                onClick={() => handlePresetClick(preset)}
                                disabled={!isAvailable}
                                style={{
                                    padding: isMobile ? '5px 10px' : '6px 12px',
                                    borderRadius: isMobile ? 4 : 6,
                                    border: isCurrent ? '1px solid #007AFF' : '1px solid #3C3C3E',
                                    backgroundColor: isCurrent ? 'rgba(0, 122, 255, 0.125)' : 'rgba(0, 122, 255, 0)',
                                    color: isAvailable ? '#fff' : '#666',
                                    fontSize: isMobile ? 11 : 12,
                                    fontWeight: 500,
                                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                                    opacity: isAvailable ? 1 : 0.5,
                                    userSelect: 'none',
                                    position: 'relative',
                                    paddingRight: preset.isDefault ? undefined : (isMobile ? 25 : 30)
                                }}
                                title={
                                    isAvailable 
                                        ? `${preset.name}${preset.description ? ` - ${preset.description}` : ''}${preset.usageCount ? ` (использован ${preset.usageCount} раз)` : ''}`
                                        : 'Недостаточно инвентаря'
                                }
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {/* Пользовательский эмодзи или дефолтные иконки */}
                                    {preset.emoji ? (
                                        <span style={{ fontSize: 12 }}>{preset.emoji}</span>
                                    ) : (
                                        <>
                                            {preset.isDefault && <span style={{ fontSize: 10 }}>⭐</span>}
                                            {preset.isPopular && <span style={{ fontSize: 10 }}>🔥</span>}
                                        </>
                                    )}
                                    <span>{preset.name}</span>
                                    {preset.usageCount && preset.usageCount > 0 && (
                                        <span style={{ 
                                            fontSize: 9, 
                                            opacity: 0.7,
                                            backgroundColor: '#007AFF30',
                                            padding: '1px 3px',
                                            borderRadius: 2
                                        }}>
                                            {preset.usageCount > 99 ? '99+' : preset.usageCount}
                                        </span>
                                    )}
                                </div>
                            </motion.button>

                            {/* Кнопка удаления для пользовательских пресетов */}
                            {!preset.isDefault && (
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePreset(preset.id);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        backgroundColor: '#FF4D4F',
                                        color: '#fff',
                                        border: 'none',
                                        fontSize: 10,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1
                                    }}
                                    title="Удалить пресет"
                                >
                                    ×
                                </motion.button>
                            )}
                        </div>
                    );
                })}
            </div>


        </div>
    );
};

export default PresetManager; 