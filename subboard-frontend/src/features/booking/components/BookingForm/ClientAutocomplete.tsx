import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ClientAutocompleteProps, ClientSearchResult } from './types';
import { clientsApi } from '@features/booking/services/clientsApi';

const ClientAutocomplete: React.FC<ClientAutocompleteProps> = ({
    value,
    onChange,
    onClientSelect,
    placeholder = "Начните вводить имя или телефон...",
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Функция для поиска клиентов через API
    const searchClients = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await clientsApi.searchClients(query, 10);
            const results = response.data;
            
            // Логируем что именно пришло от API
            console.log('[ClientAutocomplete] API Response:', response);
            console.log('[ClientAutocomplete] Results:', results);
            results.forEach((client, index) => {
                console.log(`[ClientAutocomplete] Client ${index}:`, {
                    name: client.name,
                    totalBookings: client.totalBookings,
                    isVIP: client.isVIP,
                    phone: client.phone
                });
            });
            
            // API уже возвращает данные в правильном формате (camelCase)
            setSearchResults(results);
            setIsOpen(results.length > 0);
            setHighlightedIndex(-1);
        } catch (err) {
            console.error('Ошибка поиска клиентов:', err);
            setError('Ошибка поиска клиентов');
            setSearchResults([]);
            setIsOpen(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Поиск клиентов с дебаунсом
    useEffect(() => {
        // Очищаем предыдущий таймер
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Если запрос пустой или слишком короткий, очищаем результаты
        if (value.length < 2) {
            setSearchResults([]);
            setIsOpen(false);
            setError(null);
            return;
        }

        // Устанавливаем новый таймер для дебаунса (300мс)
        searchTimeoutRef.current = setTimeout(() => {
            searchClients(value);
        }, 300);

        // Очистка при размонтировании
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [value, searchClients]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleClientClick = (client: ClientSearchResult) => {
        onChange(client.name);
        onClientSelect(client);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => 
                    prev < searchResults.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => 
                    prev > 0 ? prev - 1 : searchResults.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0) {
                    handleClientClick(searchResults[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    const handleInputFocus = () => {
        if (searchResults.length > 0) {
            setIsOpen(true);
        }
    };

    const handleInputBlur = () => {
        // Задержка чтобы клик по элементу списка успел сработать
        setTimeout(() => {
            setIsOpen(false);
        }, 200);
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={placeholder}
                disabled={disabled}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#23232a',
                    border: '1px solid #3C3C3E',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                }}
                onFocusCapture={(e) => {
                    e.target.style.borderColor = '#007AFF';
                }}
                onBlurCapture={(e) => {
                    e.target.style.borderColor = '#3C3C3E';
                }}
            />

            {(isOpen || isLoading || error) && (
                <div
                    ref={listRef}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#2C2C2E',
                        border: '1px solid #3C3C3E',
                        borderRadius: '12px',
                        marginTop: '4px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                    }}
                >
                    {isLoading && (
                        <div style={{
                            padding: '12px 16px',
                            color: '#86868B',
                            textAlign: 'center',
                            fontSize: '14px'
                        }}>
                            🔍 Поиск клиентов...
                        </div>
                    )}
                    
                    {error && (
                        <div style={{
                            padding: '12px 16px',
                            color: '#FF6B6B',
                            textAlign: 'center',
                            fontSize: '14px'
                        }}>
                            ❌ {error}
                        </div>
                    )}
                    
                    {!isLoading && !error && searchResults.length === 0 && value.length >= 2 && (
                        <div style={{
                            padding: '12px 16px',
                            color: '#86868B',
                            textAlign: 'center',
                            fontSize: '14px'
                        }}>
                            Клиенты не найдены
                        </div>
                    )}
                    
                    {!isLoading && !error && searchResults.map((client, index) => (
                        <div
                            key={client.id}
                            onClick={() => handleClientClick(client)}
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                backgroundColor: index === highlightedIndex ? 'rgba(0, 122, 255, 0.125)' : 'rgba(0, 122, 255, 0)',
                                borderBottom: index < searchResults.length - 1 ? '1px solid #3C3C3E' : 'none',
                                transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontWeight: 600, 
                                        color: '#fff',
                                        marginBottom: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {client.name}
                                        {client.isVIP && (
                                            <span style={{
                                                fontSize: '12px',
                                                backgroundColor: '#FFD600',
                                                color: '#000',
                                                padding: '2px 6px',
                                                borderRadius: '6px',
                                                fontWeight: 600
                                            }}>
                                                VIP
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '14px', color: '#86868B', marginBottom: '2px' }}>
                                        📞 {client.phone}
                                    </div>
                                    {client.lastBookingDate && (
                                        <div style={{ fontSize: '12px', color: '#86868B' }}>
                                            Последний визит: {new Date(client.lastBookingDate).toLocaleDateString('ru-RU')}
                                        </div>
                                    )}
                                    {client.comments && (
                                        <div style={{ 
                                            fontSize: '12px', 
                                            color: '#86868B',
                                            fontStyle: 'italic',
                                            marginTop: '4px'
                                        }}>
                                            💬 {client.comments}
                                        </div>
                                    )}
                                </div>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#007AFF',
                                    fontWeight: 600,
                                    marginLeft: '12px'
                                }}>
                                    {client.totalBookings} визитов
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientAutocomplete; 