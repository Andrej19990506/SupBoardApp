import React from 'react';
import styled from 'styled-components';
import { format as formatDateFns } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ReminderHistory, ReminderStatus } from '@/types/booking';

const StatusOverlay = styled.div`
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

const StatusModal = styled.div`
    background: #1C1C1E;
    border-radius: 16px;
    width: 100%;
    max-width: 700px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
`;

const StatusHeader = styled.div`
    padding: 24px 32px;
    border-bottom: 1px solid #2C2C2E;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const StatusTitle = styled.h2`
    font-size: 1.5rem;
    color: #fff;
    margin: 0;
    font-weight: 600;
`;

const StatusContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
`;

const StatCard = styled.div`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
`;

const StatValue = styled.div`
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 4px;
`;

const StatLabel = styled.div`
    font-size: 12px;
    color: #86868B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const ReminderList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const ReminderItem = styled.div<{ $success: boolean }>`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    border-left: 4px solid ${({ $success }) => $success ? '#34C759' : '#FF4D4F'};
`;

const ReminderHeader = styled.div`
    display: flex;
    justify-content: between;
    align-items: flex-start;
    margin-bottom: 8px;
`;

const ClientName = styled.div`
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    flex: 1;
`;

const ReminderTime = styled.div`
    font-size: 12px;
    color: #86868B;
`;

const ReminderTemplate = styled.div`
    font-size: 14px;
    color: #86868B;
    margin-bottom: 8px;
    font-style: italic;
`;

const ReminderMessage = styled.div`
    font-size: 14px;
    color: #fff;
    background: #1C1C1E;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
`;

const ErrorMessage = styled.div`
    font-size: 12px;
    color: #FF4D4F;
    background: rgba(255, 77, 79, 0.1);
    border-radius: 6px;
    padding: 8px;
`;

const EmptyState = styled.div`
    text-align: center;
    color: #86868B;
    padding: 40px 20px;
`;

const Button = styled.button`
    background: #3A3A3C;
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

interface ReminderStatusProps {
    history: ReminderHistory[];
    onClose: () => void;
}

const ReminderStatusComponent: React.FC<ReminderStatusProps> = ({
    history,
    onClose
}) => {
    // Собираем статистику
    const stats = React.useMemo(() => {
        const allReminders = history.flatMap(h => h.sent);
        const total = allReminders.length;
        const successful = allReminders.filter(r => r.success).length;
        const failed = allReminders.filter(r => !r.success).length;
        const today = formatDateFns(new Date(), 'yyyy-MM-dd');
        const todayReminders = history.find(h => h.date === today)?.sent || [];
        
        return {
            total,
            successful,
            failed,
            todayCount: todayReminders.length,
            todaySuccessful: todayReminders.filter(r => r.success).length
        };
    }, [history]);

    // Получаем последние напоминания (последние 3 дня)
    const recentHistory = React.useMemo(() => {
        return history
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 3);
    }, [history]);

    const formatMessage = (reminder: ReminderStatus, bookingId: string): string => {
        // Здесь должна быть логика форматирования сообщения на основе шаблона
        // Пока возвращаем базовое сообщение
        return `Напоминание отправлено (ID: ${bookingId})`;
    };

    return (
        <StatusOverlay onClick={onClose}>
            <StatusModal onClick={e => e.stopPropagation()}>
                <StatusHeader>
                    <StatusTitle>📊 Статус напоминаний</StatusTitle>
                    <Button onClick={onClose}>✕</Button>
                </StatusHeader>

                <StatusContent>
                    {/* Статистика */}
                    <StatsGrid>
                        <StatCard>
                            <StatValue>{stats.total}</StatValue>
                            <StatLabel>Всего отправлено</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue style={{ color: '#34C759' }}>{stats.successful}</StatValue>
                            <StatLabel>Успешно</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue style={{ color: '#FF4D4F' }}>{stats.failed}</StatValue>
                            <StatLabel>Ошибки</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{stats.todayCount}</StatValue>
                            <StatLabel>Сегодня</StatLabel>
                        </StatCard>
                    </StatsGrid>

                    {/* История напоминаний */}
                    {recentHistory.length > 0 ? (
                        recentHistory.map(dayHistory => (
                            <div key={dayHistory.date} style={{ marginBottom: 32 }}>
                                <h3 style={{ 
                                    color: '#fff', 
                                    fontSize: 18, 
                                    fontWeight: 600, 
                                    marginBottom: 16,
                                    borderBottom: '1px solid #2C2C2E',
                                    paddingBottom: 8
                                }}>
                                    {formatDateFns(new Date(dayHistory.date), 'd MMMM yyyy', { locale: ru })}
                                    <span style={{ 
                                        fontSize: 14, 
                                        color: '#86868B', 
                                        fontWeight: 400,
                                        marginLeft: 12
                                    }}>
                                        ({dayHistory.sent.length} напоминаний)
                                    </span>
                                </h3>
                                
                                <ReminderList>
                                    {dayHistory.sent.map((reminder, index) => (
                                        <ReminderItem key={index} $success={reminder.success}>
                                            <ReminderHeader>
                                                <ClientName>
                                                    Бронирование #{reminder.bookingId}
                                                </ClientName>
                                                <ReminderTime>
                                                    {formatDateFns(reminder.sentAt, 'HH:mm')}
                                                </ReminderTime>
                                            </ReminderHeader>
                                            
                                            <ReminderTemplate>
                                                Шаблон: {reminder.template}
                                            </ReminderTemplate>
                                            
                                            <ReminderMessage>
                                                {formatMessage(reminder, reminder.bookingId)}
                                            </ReminderMessage>
                                            
                                            {!reminder.success && reminder.error && (
                                                <ErrorMessage>
                                                    ❌ Ошибка: {reminder.error}
                                                </ErrorMessage>
                                            )}
                                            
                                            {reminder.success && (
                                                <div style={{ 
                                                    fontSize: 12, 
                                                    color: '#34C759',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    ✅ Отправлено успешно
                                                </div>
                                            )}
                                        </ReminderItem>
                                    ))}
                                </ReminderList>
                            </div>
                        ))
                    ) : (
                        <EmptyState>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                            <div style={{ fontSize: 18, marginBottom: 8 }}>Напоминания еще не отправлялись</div>
                            <div style={{ fontSize: 14 }}>
                                Настройте автоматические напоминания и они появятся здесь
                            </div>
                        </EmptyState>
                    )}
                </StatusContent>
            </StatusModal>
        </StatusOverlay>
    );
};

export default ReminderStatusComponent; 