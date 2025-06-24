import React, { useState } from 'react';
import styled from 'styled-components';
import type { ReminderSettings, ReminderTemplate } from '@/types/booking';

const SettingsOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
`;

const SettingsModal = styled.div`
    background: #1C1C1E;
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const SettingsHeader = styled.div`
    padding: 24px 32px;
    border-bottom: 1px solid #2C2C2E;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const SettingsTitle = styled.h2`
    font-size: 1.5rem;
    color: #fff;
    margin: 0;
    font-weight: 600;
`;

const SettingsContent = styled.div`
    padding: 24px 32px;
`;

const SettingGroup = styled.div`
    margin-bottom: 32px;
`;

const SettingLabel = styled.label`
    display: block;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
`;

const SettingDescription = styled.p`
    color: #86868B;
    font-size: 14px;
    margin: 0 0 16px 0;
`;

const ToggleSwitch = styled.div<{ $enabled: boolean }>`
    width: 60px;
    height: 32px;
    background: ${({ $enabled }) => $enabled ? '#007AFF' : '#3A3A3C'};
    border-radius: 16px;
    position: relative;
    cursor: pointer;
    transition: background 0.2s ease;
    
    &::after {
        content: '';
        position: absolute;
        width: 28px;
        height: 28px;
        background: #fff;
        border-radius: 50%;
        top: 2px;
        left: ${({ $enabled }) => $enabled ? '30px' : '2px'};
        transition: left 0.2s ease;
    }
`;

const TimeInput = styled.input`
    background: #2C2C2E;
    border: 1px solid #3A3A3C;
    border-radius: 8px;
    padding: 12px 16px;
    color: #fff;
    font-size: 16px;
    width: 120px;
    
    &:focus {
        outline: none;
        border-color: #007AFF;
    }
`;

const TemplateTextarea = styled.textarea`
    background: #2C2C2E;
    border: 1px solid #3A3A3C;
    border-radius: 8px;
    padding: 12px 16px;
    color: #fff;
    font-size: 14px;
    width: 100%;
    min-height: 80px;
    resize: vertical;
    font-family: inherit;
    
    &:focus {
        outline: none;
        border-color: #007AFF;
    }
    
    &::placeholder {
        color: #86868B;
    }
`;

const VariableChips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
`;

const VariableChip = styled.button`
    background: #007AFF;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: #0056CC;
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 24px 32px;
    border-top: 1px solid #2C2C2E;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
    background: ${({ $variant }) => $variant === 'primary' ? '#007AFF' : '#3A3A3C'};
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s ease;
    
    &:hover {
        opacity: 0.8;
    }
`;

interface ReminderSettingsProps {
    settings: ReminderSettings;
    onSave: (settings: ReminderSettings) => void;
    onClose: () => void;
}

const defaultTemplates: ReminderTemplate[] = [
    {
        id: 'default',
        name: 'Обычные клиенты',
        content: 'Здравствуйте, {clientName}! Напоминаем, что ваша запись на {time} сегодня. Ждем вас! 🏄‍♂️',
        isDefault: true
    },
    {
        id: 'vip',
        name: 'VIP клиенты',
        content: 'Здравствуйте, {clientName}! Напоминаем о вашем VIP-бронировании на {time}. Все готово для вашего приезда! ⭐'
    },
    {
        id: 'group',
        name: 'Групповые заказы',
        content: 'Здравствуйте, {clientName}! Напоминаем о групповом бронировании на {time}. Инвентарь: {inventory}. До встречи! 👥'
    }
];

const ReminderSettingsComponent: React.FC<ReminderSettingsProps> = ({
    settings,
    onSave,
    onClose
}) => {
    const [localSettings, setLocalSettings] = useState<ReminderSettings>(settings);

    const handleToggle = () => {
        setLocalSettings(prev => ({
            ...prev,
            enabled: !prev.enabled
        }));
    };

    const handleTimeChange = (value: number) => {
        setLocalSettings(prev => ({
            ...prev,
            timeBeforeInMinutes: Math.max(5, Math.min(180, value))
        }));
    };

    const handleTemplateChange = (templateId: string, content: string) => {
        setLocalSettings(prev => ({
            ...prev,
            templates: prev.templates.map(template => 
                template.id === templateId 
                    ? { ...template, content }
                    : template
            )
        }));
    };

    const handleTemplateNameChange = (templateId: string, name: string) => {
        setLocalSettings(prev => ({
            ...prev,
            templates: prev.templates.map(template => 
                template.id === templateId 
                    ? { ...template, name }
                    : template
            )
        }));
    };

    const insertVariable = (templateId: string, variable: string) => {
        const template = localSettings.templates.find(t => t.id === templateId);
        if (template) {
            const currentText = template.content;
            // Добавляем пробел перед переменной, если текст не пустой и не заканчивается пробелом
            const needsSpace = currentText.length > 0 && !currentText.endsWith(' ');
            const newText = currentText + (needsSpace ? ' ' : '') + variable;
            handleTemplateChange(templateId, newText);
        }
    };

    const addTemplate = () => {
        const newId = `template_${Date.now()}`;
        const newTemplate: ReminderTemplate = {
            id: newId,
            name: 'Новый шаблон',
            content: 'Здравствуйте, {clientName}! '
        };
        setLocalSettings(prev => ({
            ...prev,
            templates: [...prev.templates, newTemplate]
        }));
    };

    const deleteTemplate = (templateId: string) => {
        setLocalSettings(prev => ({
            ...prev,
            templates: prev.templates.filter(template => template.id !== templateId)
        }));
    };

    const resetToDefaults = () => {
        setLocalSettings(prev => ({
            ...prev,
            templates: [...defaultTemplates]
        }));
    };

    const variables = [
        { label: '👤 Имя клиента', value: '{clientName}' },
        { label: '🕐 Время записи', value: '{time}' },
        { label: '📅 Дата записи', value: '{date}' },
        { label: '🏄‍♂️ Инвентарь', value: '{inventory}' },
        { label: '📞 Телефон', value: '{phone}' },
        { label: '💬 Комментарий', value: '{comment}' }
    ];

    return (
        <SettingsOverlay onClick={onClose}>
            <SettingsModal onClick={e => e.stopPropagation()}>
                <SettingsHeader>
                    <SettingsTitle>⚙️ Настройки напоминаний</SettingsTitle>
                    <Button onClick={onClose}>✕</Button>
                </SettingsHeader>

                <SettingsContent>
                    {/* Включение/выключение */}
                    <SettingGroup>
                        <SettingLabel>Автоматические напоминания</SettingLabel>
                        <SettingDescription>
                            Автоматически отправлять напоминания клиентам перед началом бронирования
                        </SettingDescription>
                        <ToggleSwitch $enabled={localSettings.enabled} onClick={handleToggle} />
                    </SettingGroup>

                    {/* Время отправки */}
                    <SettingGroup>
                        <SettingLabel>Время отправки</SettingLabel>
                        <SettingDescription>
                            За сколько минут до начала бронирования отправлять напоминание
                        </SettingDescription>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <TimeInput
                                type="number"
                                min="5"
                                max="180"
                                value={localSettings.timeBeforeInMinutes}
                                onChange={(e) => handleTimeChange(Number(e.target.value))}
                                disabled={!localSettings.enabled}
                            />
                            <span style={{ color: '#86868B' }}>минут</span>
                        </div>
                    </SettingGroup>

                    {/* Шаблоны сообщений */}
                    <SettingGroup>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <SettingLabel>Шаблоны сообщений</SettingLabel>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button onClick={addTemplate}>+ Добавить</Button>
                                <Button onClick={resetToDefaults}>По умолчанию</Button>
                            </div>
                        </div>
                        
                        {/* Быстрая вставка данных */}
                        <SettingDescription>
                            💡 Используйте кнопки рядом с каждым полем для вставки данных клиента.<br/>
                            При отправке напоминания эти места автоматически заполнятся реальными данными.
                        </SettingDescription>

                        {/* Динамические шаблоны */}
                        {localSettings.templates.map((template, index) => (
                            <div key={template.id} style={{ 
                                marginTop: index === 0 ? 24 : 16,
                                padding: 16,
                                background: '#2C2C2E',
                                borderRadius: 12,
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <input
                                        type="text"
                                        value={template.name}
                                        onChange={(e) => handleTemplateNameChange(template.id, e.target.value)}
                                        disabled={!localSettings.enabled}
                                        style={{
                                            background: '#1C1C1E',
                                            border: '1px solid #3A3A3C',
                                            borderRadius: 6,
                                            padding: '6px 12px',
                                            color: '#fff',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            flex: 1
                                        }}
                                    />
                                    {!template.isDefault && (
                                        <button
                                            onClick={() => deleteTemplate(template.id)}
                                            style={{
                                                background: '#FF4D4F',
                                                border: 'none',
                                                borderRadius: 6,
                                                padding: '6px 8px',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                fontSize: 12
                                            }}
                                            title="Удалить шаблон"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                                
                                <TemplateTextarea
                                    id={`template-${template.id}`}
                                    value={template.content}
                                    onChange={(e) => handleTemplateChange(template.id, e.target.value)}
                                    placeholder="Введите текст напоминания..."
                                    disabled={!localSettings.enabled}
                                />
                                
                                <VariableChips style={{ marginTop: 8 }}>
                                    {variables.map(variable => (
                                        <VariableChip
                                            key={variable.value}
                                            onClick={() => insertVariable(template.id, variable.value)}
                                            title={`Вставить: ${variable.label}`}
                                        >
                                            {variable.label}
                                        </VariableChip>
                                    ))}
                                </VariableChips>
                            </div>
                        ))}
                    </SettingGroup>
                </SettingsContent>

                <ButtonGroup>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button $variant="primary" onClick={() => onSave(localSettings)}>
                        Сохранить
                    </Button>
                </ButtonGroup>
            </SettingsModal>
        </SettingsOverlay>
    );
};

export default ReminderSettingsComponent; 