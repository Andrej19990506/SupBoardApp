import React from 'react';
import styled from 'styled-components';
import type { Booking } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import { parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

const QuickActionsContainer = styled.div`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const QuickActionRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const QuickActionLabel = styled.span`
    color: #86868B;
    font-size: 14px;
    font-weight: 500;
`;

const QuickActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'warning' | 'danger' }>`
    background: ${({ $variant }) => {
        switch ($variant) {
            case 'primary': return '#007AFF';
            case 'secondary': return '#3A3A3C';
            case 'warning': return '#FFD600';
            case 'danger': return '#FF4D4F';
            default: return '#3A3A3C';
        }
    }};
    color: ${({ $variant }) => $variant === 'warning' ? '#000' : '#fff'};
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        opacity: 0.8;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const QuickActionCount = styled.span`
    background: #007AFF;
    color: #fff;
    border-radius: 12px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 600;
    min-width: 24px;
    text-align: center;
`;

interface QuickActionsProps {
    bookings: Booking[];
    onBulkAction: (action: string, bookings: Booking[]) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ bookings, onBulkAction }) => {
    // Фильтруем записи по статусам
    const bookedBookings = bookings.filter(b => b.status === BookingStatus.BOOKED);
    const inUseBookings = bookings.filter(b => b.status === BookingStatus.IN_USE);
    const overdueBookings = bookings.filter(b => {
        if (b.status !== BookingStatus.BOOKED) return false;
        return parseISO(b.plannedStartTime) < new Date();
    });

    // Подсчет общего инвентаря
    const totalInventory = bookings.reduce((sum, b) => {
        return sum + (b.boardCount || 0) + (b.boardWithSeatCount || 0) + (b.raftCount || 0);
    }, 0);

    // Подсчет дохода за день
    const totalRevenue = bookings
        .filter(b => b.status === BookingStatus.COMPLETED)
        .reduce((sum, b) => {
            const boardPrice = 1000;
            const seatPrice = 500;
            const raftPrice = 2000;
            return sum + 
                (b.boardCount || 0) * boardPrice +
                (b.boardWithSeatCount || 0) * (boardPrice + seatPrice) +
                (b.raftCount || 0) * raftPrice;
        }, 0);

    const handleBulkSetInUse = () => {
        if (bookedBookings.length > 0) {
            onBulkAction('setInUse', bookedBookings);
        }
    };

    const handleBulkComplete = () => {
        if (inUseBookings.length > 0) {
            onBulkAction('complete', inUseBookings);
        }
    };

    const handleCancelOverdue = () => {
        if (overdueBookings.length > 0) {
            onBulkAction('cancelOverdue', overdueBookings);
        }
    };

    const handleSendReminders = () => {
        onBulkAction('openReminderSettings', []);
    };

    return (
        <QuickActionsContainer>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 8
            }}>
                <h4 style={{ 
                    margin: 0, 
                    color: '#fff', 
                    fontSize: 16, 
                    fontWeight: 600 
                }}>
                    Быстрые действия
                </h4>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ 
                        fontSize: 12, 
                        color: '#86868B' 
                    }}>
                        Инвентарь: {totalInventory}
                    </span>
                    {totalRevenue > 0 && (
                        <span style={{ 
                            fontSize: 12, 
                            color: '#34C759',
                            fontWeight: 600
                        }}>
                            Доход: {totalRevenue.toLocaleString('ru-RU')} ₽
                        </span>
                    )}
                </div>
            </div>

            {bookedBookings.length > 0 && (
                <QuickActionRow>
                    <QuickActionLabel>
                        Выдать все забронированные
                    </QuickActionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <QuickActionCount>{bookedBookings.length}</QuickActionCount>
                        <QuickActionButton 
                            $variant="primary" 
                            onClick={handleBulkSetInUse}
                        >
                            Выдать все
                        </QuickActionButton>
                    </div>
                </QuickActionRow>
            )}

            {inUseBookings.length > 0 && (
                <QuickActionRow>
                    <QuickActionLabel>
                        Завершить все активные
                    </QuickActionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <QuickActionCount>{inUseBookings.length}</QuickActionCount>
                        <QuickActionButton 
                            $variant="primary" 
                            onClick={handleBulkComplete}
                        >
                            Завершить все
                        </QuickActionButton>
                    </div>
                </QuickActionRow>
            )}

            {overdueBookings.length > 0 && (
                <QuickActionRow>
                    <QuickActionLabel>
                        Отменить просроченные
                    </QuickActionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <QuickActionCount style={{ background: '#FF4D4F' }}>
                            {overdueBookings.length}
                        </QuickActionCount>
                        <QuickActionButton 
                            $variant="danger" 
                            onClick={handleCancelOverdue}
                        >
                            Отменить
                        </QuickActionButton>
                    </div>
                </QuickActionRow>
            )}

            <QuickActionRow>
                <QuickActionLabel>
                    Отправить напоминания
                </QuickActionLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                    <QuickActionButton 
                        $variant="warning" 
                        onClick={handleSendReminders}
                    >
                        ⚙️ Настройки
                    </QuickActionButton>
                    <QuickActionButton 
                        $variant="secondary" 
                        onClick={() => onBulkAction('showReminderStatus', [])}
                    >
                        📊 Статус
                    </QuickActionButton>
                </div>
            </QuickActionRow>
        </QuickActionsContainer>
    );
};

export default QuickActions; 