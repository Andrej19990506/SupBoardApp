import React, { useState } from 'react';
import type { QuickComment } from './types';

interface QuickCommentsProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

// Предустановленные быстрые комментарии для сотрудников
const INITIAL_QUICK_COMMENTS: QuickComment[] = [
    { id: '1', text: 'Первый раз', category: 'client_type' },
    { id: '2', text: 'Постоянный клиент', category: 'client_type' },
    { id: '3', text: 'VIP клиент', category: 'client_type' },
    { id: '4', text: 'Группа', category: 'client_type' },
    { id: '5', text: 'Требует инструктаж', category: 'special_needs' },
    { id: '6', text: 'Опытный пользователь', category: 'special_needs' },
    { id: '7', text: 'Есть ограничения по здоровью', category: 'special_needs' },
    { id: '8', text: 'Нужны весла увеличенного размера', category: 'equipment' },
    { id: '9', text: 'Предпочитает жесткие доски', category: 'equipment' },
    { id: '10', text: 'Особые пожелания', category: 'other' }
];

const QuickComments: React.FC<QuickCommentsProps> = ({
    value,
    onChange,
    disabled = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [quickComments, setQuickComments] = useState<QuickComment[]>(INITIAL_QUICK_COMMENTS);
    const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

    const handleCommentClick = (commentText: string) => {
        if (disabled) return;
        
        // Если комментарий уже есть, убираем его (toggle функционал)
        if (value.includes(commentText)) {
            handleRemoveTag(commentText);
            return;
        }
        
        // Добавляем комментарий через запятую если уже есть текст
        const newValue = value.trim() 
            ? `${value.trim()}, ${commentText}`
            : commentText;
            
        onChange(newValue);
    };

    const handleRemoveTag = (tagToRemove: string) => {
        if (disabled) return;
        
        // Разбиваем на части по запятой, удаляем нужный тег и собираем обратно
        const parts = value.split(',').map(part => part.trim()).filter(part => part !== tagToRemove);
        onChange(parts.join(', '));
    };

    const handleRemoveQuickComment = (commentId: string) => {
        if (disabled) return;
        
        // Удаляем комментарий из списка быстрых комментариев
        setQuickComments(prev => prev.filter(comment => comment.id !== commentId));
        
        // Также удаляем его из активного текста, если он там есть
        const commentToRemove = quickComments.find(c => c.id === commentId);
        if (commentToRemove && value.includes(commentToRemove.text)) {
            handleRemoveTag(commentToRemove.text);
        }
    };

    const handleAddNewTag = (category: string) => {
        const newTagText = newTagInputs[category]?.trim();
        if (!newTagText || disabled) return;
        
        // Проверяем, что такой тег еще не существует
        const exists = quickComments.some(comment => 
            comment.text.toLowerCase() === newTagText.toLowerCase() && 
            comment.category === category
        );
        
        if (exists) {
            // Очищаем поле ввода
            setNewTagInputs(prev => ({ ...prev, [category]: '' }));
            return;
        }
        
        // Создаем новый комментарий
        const newComment: QuickComment = {
            id: `custom_${Date.now()}_${Math.random()}`,
            text: newTagText,
            category: category as any
        };
        
        // Добавляем в список быстрых комментариев
        setQuickComments(prev => [...prev, newComment]);
        
        // Очищаем поле ввода
        setNewTagInputs(prev => ({ ...prev, [category]: '' }));
    };

    const handleNewTagInputChange = (category: string, value: string) => {
        setNewTagInputs(prev => ({ ...prev, [category]: value }));
    };

    const handleNewTagKeyPress = (e: React.KeyboardEvent, category: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNewTag(category);
        }
    };

    const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    const getCommentsByCategory = (category: string) => {
        return quickComments.filter(comment => comment.category === category);
    };

    // Получаем активные теги из текущего значения
    const getActiveTags = () => {
        if (!value.trim()) return [];
        return value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    };

    const categoryIcons = {
        client_type: '👤',
        special_needs: '⚠️',
        equipment: '🏄‍♂️',
        other: '💬'
    };

    const categoryNames = {
        client_type: 'Тип клиента',
        special_needs: 'Особые потребности',
        equipment: 'Инвентарь',
        other: 'Прочее'
    };

    const activeTags = getActiveTags();

    return (
        <div>
            {/* Текстовое поле */}
            <textarea
                value={value}
                onChange={handleTextAreaChange}
                placeholder="Комментарий (опционально)"
                disabled={disabled}
                rows={3}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#23232a',
                    border: '1px solid #3C3C3E',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '1rem',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = '#007AFF';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = '#3C3C3E';
                }}
            />

            {/* Активные теги */}
            {activeTags.length > 0 && (
                <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                }}>
                    {activeTags.map((tag, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: '#007AFF',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 500,
                                userSelect: 'none'
                            }}
                        >
                            <span style={{ marginRight: '6px' }}>{tag}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                disabled={disabled}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    padding: '0',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    transition: 'background-color 0.2s ease',
                                    userSelect: 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (!disabled) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!disabled) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Кнопка показать/скрыть быстрые комментарии */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                disabled={disabled}
                style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    backgroundColor: '#3C3C3E',
                    color: '#007AFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    opacity: disabled ? 0.5 : 1,
                    userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                    if (!disabled) {
                        (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF20';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!disabled) {
                        (e.target as HTMLButtonElement).style.backgroundColor = '#3C3C3E';
                    }
                }}
            >
                <span>{isExpanded ? '▼' : '▶'}</span>
                <span>Быстрые комментарии</span>
            </button>

            {/* Быстрые комментарии */}
            {isExpanded && (
                <div style={{
                    marginTop: '12px',
                    padding: '16px',
                    backgroundColor: '#2C2C2E',
                    borderRadius: '12px',
                    border: '1px solid #3C3C3E'
                }}>
                    {Object.entries(categoryNames).map(([category, name]) => {
                        const comments = getCommentsByCategory(category);

                        return (
                            <div key={category} style={{ marginBottom: '16px' }}>
                                {/* Заголовок категории */}
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#fff',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent'
                                }}>
                                    <span>{categoryIcons[category as keyof typeof categoryIcons]}</span>
                                    <span>{name}</span>
                                </div>

                                {/* Кнопки комментариев */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '6px',
                                    marginBottom: '8px'
                                }}>
                                    {comments.map((comment) => {
                                        const isAlreadyAdded = value.includes(comment.text);
                                        
                                        return (
                                            <div
                                                key={comment.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    backgroundColor: isAlreadyAdded ? '#4CAF50' : '#3C3C3E',
                                                    borderRadius: '6px',
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
                                                    onClick={() => handleCommentClick(comment.text)}
                                                    disabled={disabled}
                                                    style={{
                                                        padding: '6px 10px',
                                                        border: 'none',
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                                        backgroundColor: 'transparent',
                                                        color: '#fff',
                                                        transition: 'all 0.2s ease',
                                                        opacity: disabled ? 0.5 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        userSelect: 'none',
                                                        WebkitUserSelect: 'none',
                                                        MozUserSelect: 'none',
                                                        msUserSelect: 'none',
                                                        WebkitTouchCallout: 'none',
                                                        WebkitTapHighlightColor: 'transparent'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!disabled) {
                                                            if (isAlreadyAdded) {
                                                                (e.target as HTMLButtonElement).style.backgroundColor = '#FF4D4F';
                                                            } else {
                                                                (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF';
                                                            }
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!disabled) {
                                                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                                                        }
                                                    }}
                                                >
                                                    {isAlreadyAdded && <span>✓</span>}
                                                    <span>{comment.text}</span>
                                                </button>
                                                
                                                {/* Кнопка удаления тега */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveQuickComment(comment.id)}
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
                                                    title="Удалить тег"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Кнопка добавления нового тега в категорию */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <input
                                            type="text"
                                            value={newTagInputs[category] || ''}
                                            onChange={(e) => handleNewTagInputChange(category, e.target.value)}
                                            onKeyPress={(e) => handleNewTagKeyPress(e, category)}
                                            placeholder="Новый тег..."
                                            disabled={disabled}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#1C1C1E',
                                                border: '1px solid #3C3C3E',
                                                borderRadius: '4px',
                                                color: '#fff',
                                                fontSize: '12px',
                                                outline: 'none',
                                                width: '100px',
                                                transition: 'border-color 0.2s ease',
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#007AFF';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#3C3C3E';
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddNewTag(category)}
                                            disabled={disabled || !newTagInputs[category]?.trim()}
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                border: 'none',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: (disabled || !newTagInputs[category]?.trim()) ? 'not-allowed' : 'pointer',
                                                backgroundColor: '#007AFF',
                                                color: '#fff',
                                                transition: 'all 0.2s ease',
                                                opacity: (disabled || !newTagInputs[category]?.trim()) ? 0.5 : 1,
                                                userSelect: 'none',
                                                WebkitUserSelect: 'none',
                                                MozUserSelect: 'none',
                                                msUserSelect: 'none',
                                                WebkitTouchCallout: 'none',
                                                WebkitTapHighlightColor: 'transparent'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!disabled && newTagInputs[category]?.trim()) {
                                                    (e.target as HTMLButtonElement).style.backgroundColor = '#0056CC';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!disabled && newTagInputs[category]?.trim()) {
                                                    (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF';
                                                }
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Подсказка */}
                    <div style={{
                        fontSize: '12px',
                        color: '#86868B',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        marginTop: '8px',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent'
                    }}>
                        💡 Нажмите на комментарий чтобы добавить его к тексту
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuickComments; 