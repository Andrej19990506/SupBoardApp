import { useState, useMemo, useEffect } from 'react';
import type { FC, MouseEvent } from 'react';
import { format as formatDateFns, parseISO, addHours, formatDistanceStrict, isAfter, add, isBefore, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AnimatePresence, useMotionValue } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAppDispatch, useAppSelector } from '@features/booking/store/hooks';
import { completeOrCancelBooking, updateBookingAsync, fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBoards } from '@features/booking/store/slices/board-slice/boardThunk';
import type { Booking, BookingStatus as BookingStatusEnum, ReminderSettings, ReminderHistory, ReminderTemplate } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import {
    ModalOverlay,
    ModalContainer,
    Header,
    Title,
    StyledList,
    BookingCardContainer,
    BookingCardContent,
    BookingTime,
    BookingInfo,
    ButtonGroup,
    PrimaryButton,
    SecondaryButton,
    DeleteBackground,
    DeleteIconWrapper,
    DeleteText,
    ConfirmContainer,
    ConfirmText,
    ConfirmButtonWrapper,
    ConfirmButton,
} from './styles';
import styled from 'styled-components';
import CustomSelect from '@shared/components/CustomSelect/CustomSelect';
import canoeIcon from '@/assets/canoe.png';
import seatIcon from '@/assets/seat.png';
import skiIcon from '@/assets/ski.png';
import { getAvailableBoardsCount} from '@features/booking/utils/bookingUtils';
import InventorySelector from '@features/booking/components/BookingForm/InventorySelector';
import { inventoryApi, type InventoryType } from '@features/booking/services/inventoryApi';
import QuickActions from './QuickActions';
import DesktopBookingsList from './DesktopBookingsList';
import ReminderSettingsComponent from './ReminderSettings';
import ReminderStatusComponent from './ReminderStatus';
import QuickStatusActions from './QuickStatusActions';
import { useDevice } from '@shared/hooks/useDevice';


const TimeInfo = styled.div`
  font-size: 0.8rem;
  color: #a0a0a0;
  margin-top: 4px;
`;

// Новые компоненты для улучшений
const SearchBar = styled.div`
    display: flex;
    align-items: center;
    background: #2C2C2E;
    border-radius: 12px;
    padding: 8px 12px;
    margin-bottom: 16px;
    gap: 8px;
`;

const SearchInput = styled.input`
    background: none;
    border: none;
    color: #fff;
    font-size: 14px;
    flex: 1;
    outline: none;
    
    &::placeholder {
        color: #86868B;
    }
`;

const QuickFilters = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    overflow-x: auto;
    padding-bottom: 4px;
    
    &::-webkit-scrollbar {
        height: 2px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
        background: #86868B;
        border-radius: 1px;
    }
`;

const FilterChip = styled.button<{ $active?: boolean }>`
    background: ${({ $active }) => $active ? '#007AFF' : '#3A3A3C'};
    color: #fff;
    border: none;
    border-radius: 16px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
    
    &:hover {
        opacity: 0.8;
    }
`;


const ActionBar = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
`;

const ActionButton = styled.button`
    background: #3A3A3C;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
    
    &:hover {
        background: #4A4A4C;
    }
    
    svg {
        font-size: 16px;
    }
`;

const SortSelect = styled.select`
    background: #3A3A3C;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    outline: none;
    
    option {
        background: #3A3A3C;
        color: #fff;
    }
`;

// Типы для сортировки и фильтрации
type SortOption = 'time' | 'name' | 'status' | 'inventory';
type QuickFilter = 'all' | 'today' | 'overdue' | 'vip' | 'large' | 'upcoming';

interface BookingsListProps {
    date: Date;
    bookings: Booking[];
    onAddBooking: () => void;
    onEditBooking: (booking: Booking) => void;
    onDeleteBooking: (booking: Booking) => void;
    onClose: () => void;
    isClosing: boolean;
}

const getStatusText = (status: BookingStatusEnum): string => {
    switch (status) {
        case BookingStatus.BOOKED:
            return 'Забронировано';
        case BookingStatus.PENDING_CONFIRMATION:
            return 'Ожидает подтверждения';
        case BookingStatus.CONFIRMED:
            return 'Подтверждено';
        case BookingStatus.IN_USE:
            return 'Используется';
        case BookingStatus.COMPLETED:
            return 'Завершено';
        case BookingStatus.CANCELLED:
            return 'Отменено';
        case BookingStatus.NO_SHOW:
            return 'Не явился';
        case BookingStatus.RESCHEDULED:
            return 'Перенесено';
        default:
            const exhaustiveCheck: never = status;
            return exhaustiveCheck;
    }
};

const statusOptions: { value: BookingStatusEnum; label: string; color: string }[] = [
    { value: BookingStatus.BOOKED, label: 'Забронировано', color: '#3B82F6' },
    { value: BookingStatus.PENDING_CONFIRMATION, label: 'Ожидает подтверждения', color: '#FF9500' },
    { value: BookingStatus.CONFIRMED, label: 'Подтверждено', color: '#34C759' },
    { value: BookingStatus.IN_USE, label: 'Используется', color: '#22C55E' },
    { value: BookingStatus.COMPLETED, label: 'Завершено', color: '#8E8E93' },
    { value: BookingStatus.CANCELLED, label: 'Отменено', color: '#FF4D4F' },
    { value: BookingStatus.NO_SHOW, label: 'Не явился', color: '#FF9500' },
    { value: BookingStatus.RESCHEDULED, label: 'Перенесено', color: '#AF52DE' },
];



const BookingsList: FC<BookingsListProps> = ({
    date,
    bookings,
    onAddBooking,
    onEditBooking,
    onDeleteBooking,
    onClose,
    isClosing
}) => {
    // Определяем тип устройства (хук должен вызываться всегда)
    const { isDesktop } = useDevice();
    
    // Состояние для мобильной версии (хуки должны вызываться всегда)
    const [statusFilter, setStatusFilter] = useState<BookingStatusEnum>(BookingStatus.BOOKED);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('time');
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
    
    // Состояния для напоминаний
    const [showReminderSettings, setShowReminderSettings] = useState(false);
    const [showReminderStatus, setShowReminderStatus] = useState(false);
    
    // Типы инвентаря для отображения
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);

    // Загружаем типы инвентаря
    useEffect(() => {
        const loadInventoryTypes = async () => {
            try {
                const response = await inventoryApi.getInventoryTypes();
                setInventoryTypes(response.data.filter(type => type.is_active));
            } catch (err) {
                console.error('Ошибка загрузки типов инвентаря:', err);
            }
        };
        loadInventoryTypes();
    }, []);
    
    const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
        enabled: true,
        timeBeforeInMinutes: 60,
        templates: [
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
        ]
    });
    const [reminderHistory, setReminderHistory] = useState<ReminderHistory[]>([]);
    
    const dispatch = useAppDispatch();

    // Функции для определения статусов (определяем всегда)
    const isVIPClient = (booking: Booking): boolean => {
        const totalInventory = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
        return totalInventory >= 5 || booking.comment?.toLowerCase().includes('vip') || false;
    };

    const isLargeOrder = (booking: Booking): boolean => {
        const totalInventory = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
        return totalInventory >= 3;
    };

    const isOverdue = (booking: Booking): boolean => {
        if (booking.status !== BookingStatus.BOOKED) return false;
        const plannedTime = parseISO(booking.plannedStartTime);
        return isBefore(plannedTime, new Date());
    };

    const isUpcoming = (booking: Booking): boolean => {
        if (booking.status !== BookingStatus.BOOKED) return false;
        const plannedTime = parseISO(booking.plannedStartTime);
        const now = new Date();
        const oneHourLater = addHours(now, 1);
        return isAfter(plannedTime, now) && isBefore(plannedTime, oneHourLater);
    };

    // Статистика (useMemo хук должен вызываться всегда)
    const stats = useMemo(() => {
        const total = bookings.length;
        const booked = bookings.filter(b => b.status === BookingStatus.BOOKED).length;
        const pendingConfirmation = bookings.filter(b => b.status === BookingStatus.PENDING_CONFIRMATION).length;
        const confirmed = bookings.filter(b => b.status === BookingStatus.CONFIRMED).length;
        const inUse = bookings.filter(b => b.status === BookingStatus.IN_USE).length;
        const completed = bookings.filter(b => b.status === BookingStatus.COMPLETED).length;
        const cancelled = bookings.filter(b => b.status === BookingStatus.CANCELLED).length;
        const noShow = bookings.filter(b => b.status === BookingStatus.NO_SHOW).length;
        const rescheduled = bookings.filter(b => b.status === BookingStatus.RESCHEDULED).length;
        const overdue = bookings.filter(isOverdue).length;
        const upcoming = bookings.filter(isUpcoming).length;
        const vip = bookings.filter(isVIPClient).length;
        
        const totalRevenue = bookings
            .filter(b => b.status === BookingStatus.COMPLETED)
            .reduce((sum, b) => {
                // Примерный расчет дохода (можно настроить)
                const boardPrice = 1000;
                const seatPrice = 500;
                const raftPrice = 2000;
                return sum + 
                    (b.boardCount || 0) * boardPrice +
                    (b.boardWithSeatCount || 0) * (boardPrice + seatPrice) +
                    (b.raftCount || 0) * raftPrice;
            }, 0);

        return {
            total,
            booked,
            pendingConfirmation,
            confirmed,
            inUse,
            completed,
            cancelled,
            noShow,
            rescheduled,
            overdue,
            upcoming,
            vip,
            totalRevenue
        };
    }, [bookings, isOverdue, isUpcoming, isVIPClient]);

    // Считаем количество записей в каждом статусе (useMemo хук должен вызываться всегда)
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        bookings.forEach(b => {
            counts[b.status] = (counts[b.status] || 0) + 1;
        });
        return counts;
    }, [bookings]);

    // Фильтрация и сортировка (useMemo хук должен вызываться всегда)
    const processedBookings = useMemo(() => {
        let filtered = bookings.filter(b => b.status === statusFilter);

        // Поиск
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(b => 
                b.clientName.toLowerCase().includes(query) ||
                b.phone.includes(query) ||
                (b.comment && b.comment.toLowerCase().includes(query))
            );
        }

        // Быстрые фильтры
        switch (quickFilter) {
            case 'today':
                filtered = filtered.filter(b => isToday(parseISO(b.plannedStartTime)));
                break;
            case 'overdue':
                filtered = filtered.filter(isOverdue);
                break;
            case 'vip':
                filtered = filtered.filter(isVIPClient);
                break;
            case 'large':
                filtered = filtered.filter(isLargeOrder);
                break;
            case 'upcoming':
                filtered = filtered.filter(isUpcoming);
                break;
        }

        // Сортировка
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'time':
                    return a.plannedStartTime.localeCompare(b.plannedStartTime);
                case 'name':
                    return a.clientName.localeCompare(b.clientName);
                case 'status':
                    return a.status.localeCompare(b.status);
                case 'inventory':
                    const aTotal = (a.boardCount || 0) + (a.boardWithSeatCount || 0) + (a.raftCount || 0);
                    const bTotal = (b.boardCount || 0) + (b.boardWithSeatCount || 0) + (b.raftCount || 0);
                    return bTotal - aTotal; // По убыванию
                default:
                    return 0;
            }
        });

        return filtered;
    }, [bookings, statusFilter, searchQuery, quickFilter, sortBy, isOverdue, isVIPClient, isLargeOrder, isUpcoming]);

    // Если это десктоп, используем десктопную версию
    if (isDesktop) {
        return (
            <DesktopBookingsList
                date={date}
                bookings={bookings}
                onAddBooking={onAddBooking}
                onEditBooking={onEditBooking}
                onDeleteBooking={onDeleteBooking}
                onClose={onClose}
                isClosing={isClosing}
            />
        );
    }

    const handleOverlayClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Формируем опции с бейджем справа
    const statusOptionsWithCount = statusOptions.map(opt => ({
        ...opt,
        label: (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>{opt.label}</span>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: opt.color,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    marginLeft: 8,
                    minWidth: 22,
                }}>{statusCounts[opt.value] || 0}</span>
            </span>
        )
    }));

    // Функция экспорта данных
    const handleExport = () => {
                 const exportData = processedBookings.map(b => ({
             Время: formatDateFns(parseISO(b.plannedStartTime), 'HH:mm'),
             Клиент: b.clientName,
             Телефон: b.phone,
                           Услуга: b.serviceType === 'аренда' ? 'Аренда' : 'Сплав',
             Инвентарь: `Доски: ${b.boardCount || 0}, С креслом: ${b.boardWithSeatCount || 0}, Плоты: ${b.raftCount || 0}`,
             Статус: getStatusText(b.status),
             Комментарий: b.comment || ''
         }));

        const csvContent = [
            Object.keys(exportData[0] || {}).join(','),
            ...exportData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bookings_${formatDateFns(date, 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    // Функция для уведомлений
    const handleNotifications = () => {
        const upcomingBookings = bookings.filter(isUpcoming);
        const overdueBookings = bookings.filter(isOverdue);
        
        let message = '';
        if (upcomingBookings.length > 0) {
            message += `🔔 ${upcomingBookings.length} записей в ближайший час\n`;
        }
        if (overdueBookings.length > 0) {
            message += `⚠️ ${overdueBookings.length} просроченных записей\n`;
        }
        
        if (message) {
            alert(message.trim());
        } else {
            alert('📋 Все записи в порядке!');
        }
    };

    // Функция отправки напоминаний
    const handleSendReminders = async (targetBookings: Booking[]) => {
        if (!reminderSettings.enabled) {
            alert('❌ Напоминания отключены в настройках');
            return;
        }

        const upcomingBookings = targetBookings.length > 0 
            ? targetBookings 
            : bookings.filter(b => {
                if (b.status !== BookingStatus.BOOKED) return false;
                const plannedTime = parseISO(b.plannedStartTime);
                const now = new Date();
                const reminderTime = new Date(now.getTime() + reminderSettings.timeBeforeInMinutes * 60 * 1000);
                return plannedTime > now && plannedTime <= reminderTime;
            });

        if (upcomingBookings.length === 0) {
            alert('ℹ️ Нет записей для отправки напоминаний');
            return;
        }

        try {
            const today = formatDateFns(new Date(), 'yyyy-MM-dd');
            const newReminders: ReminderHistory = {
                date: today,
                sent: []
            };

            for (const booking of upcomingBookings) {
                const isVIP = isVIPClient(booking);
                const isGroup = isLargeOrder(booking);
                
                // Находим подходящий шаблон
                let selectedTemplate = reminderSettings.templates.find(t => t.id === 'default');
                if (isVIP) {
                    selectedTemplate = reminderSettings.templates.find(t => t.id === 'vip') || selectedTemplate;
                } else if (isGroup) {
                    selectedTemplate = reminderSettings.templates.find(t => t.id === 'group') || selectedTemplate;
                }

                if (!selectedTemplate) {
                    // Fallback на первый доступный шаблон
                    selectedTemplate = reminderSettings.templates[0];
                }

                // Форматируем сообщение
                const inventory = [
                    booking.boardCount && `${booking.boardCount} сапбордов`,
                    booking.boardWithSeatCount && `${booking.boardWithSeatCount} с креслом`,
                    booking.raftCount && `${booking.raftCount} плотов`
                ].filter(Boolean).join(', ');

                const message = selectedTemplate.content
                    .replace('{clientName}', booking.clientName)
                    .replace('{time}', formatDateFns(parseISO(booking.plannedStartTime), 'HH:mm'))
                    .replace('{date}', formatDateFns(parseISO(booking.plannedStartTime), 'd MMMM', { locale: ru }))
                    .replace('{inventory}', inventory)
                    .replace('{phone}', booking.phone || '')
                    .replace('{comment}', booking.comment || '');

                // Симуляция отправки (в реальности здесь будет API вызов)
                const success = Math.random() > 0.1; // 90% успеха
                
                newReminders.sent.push({
                    bookingId: booking.id,
                    sentAt: new Date(),
                    template: selectedTemplate.id,
                    success,
                    error: success ? undefined : 'Ошибка сети'
                });
            }

            // Обновляем историю
            setReminderHistory(prev => {
                const existingDayIndex = prev.findIndex(h => h.date === today);
                if (existingDayIndex >= 0) {
                    const updated = [...prev];
                    updated[existingDayIndex].sent.push(...newReminders.sent);
                    return updated;
                } else {
                    return [newReminders, ...prev];
                }
            });

            const successful = newReminders.sent.filter(r => r.success).length;
            const failed = newReminders.sent.filter(r => !r.success).length;
            
            alert(`📱 Напоминания отправлены!\n✅ Успешно: ${successful}\n❌ Ошибки: ${failed}`);

        } catch (error) {
            console.error('Ошибка при отправке напоминаний:', error);
            alert('❌ Произошла ошибка при отправке напоминаний');
        }
    };

    // Обработчик массовых действий
    const handleBulkAction = async (action: string, targetBookings: Booking[]) => {
        try {
            switch (action) {
                case 'setInUse':
                    for (const booking of targetBookings) {
                        await dispatch(updateBookingAsync({
                            id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
                            booking: {
                                status: BookingStatus.IN_USE,
                                actualStartTime: new Date().toISOString(),
                            }
                        }));
                    }
                    setStatusFilter(BookingStatus.IN_USE);
                    break;
                    
                case 'complete':
                    for (const booking of targetBookings) {
                        await dispatch(completeOrCancelBooking({ 
                            booking, 
                            status: 'completed', 
                            boardStatus: 'servicing' 
                        }));
                    }
                    setStatusFilter(BookingStatus.COMPLETED);
                    break;
                    
                case 'cancelOverdue':
                    for (const booking of targetBookings) {
                        await dispatch(completeOrCancelBooking({ 
                            booking, 
                            status: 'cancelled', 
                            boardStatus: 'available' 
                        }));
                    }
                    setStatusFilter(BookingStatus.CANCELLED);
                    break;
                    
                case 'sendReminders':
                    // Улучшенная логика отправки напоминаний
                    await handleSendReminders(targetBookings);
                    break;
                    
                case 'openReminderSettings':
                    setShowReminderSettings(true);
                    break;
                    
                case 'showReminderStatus':
                    setShowReminderStatus(true);
                    break;
                    
                default:
                    console.warn('Неизвестное действие:', action);
            }
            
            // Обновляем данные после массовых операций
            await dispatch(fetchBookings());
            await dispatch(fetchBoards());
            // await dispatch(fetchBoardBookings());
            
        } catch (error) {
            console.error('Ошибка при выполнении массового действия:', error);
            alert('Произошла ошибка при выполнении операции');
        }
    };

    // Функция для отображения инвентаря (поддерживает новый и старый формат)
    const renderMobileInventory = (booking: Booking) => {
        const selectedItems = booking.selectedItems || {};
        const hasNewItems = Object.keys(selectedItems).length > 0;
        const hasOldItems = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0) > 0;

        // Debug logs
        console.log('renderMobileInventory debug:', {
            bookingId: booking.id,
            clientName: booking.clientName,
            selectedItems,
            hasNewItems,
            hasOldItems,
            inventoryTypesLoaded: inventoryTypes.length
        });

        if (!hasNewItems && !hasOldItems) {
            return <span style={{ color: '#86868B' }}>Нет инвентаря</span>;
        }

        return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Новый формат инвентаря */}
                {hasNewItems && Object.entries(selectedItems).map(([typeIdStr, count]) => {
                    const typeId = parseInt(typeIdStr);
                    const countNum = Number(count) || 0;
                    const type = inventoryTypes.find(t => t.id === typeId);
                    if (!type || countNum <= 0) return null;

                    return (
                        <span key={typeId} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, marginRight: 4 }}>
                            <span style={{ fontSize: 20 }}>{type.icon_name || '📦'}</span>
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginLeft: 2 }}>{countNum}</span>
                        </span>
                    );
                })}

                {/* Старый формат для совместимости */}
                {!hasNewItems && (
                    <>
                        {(booking.boardCount || 0) > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, marginRight: 4 }}>
                                <img src={canoeIcon} alt="sup" style={{ width: 24, height: 24, filter: 'drop-shadow(0 1px 2px #007aff44)' }} />
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginLeft: 2 }}>{booking.boardCount}</span>
                            </span>
                        )}
                        {(booking.boardWithSeatCount || 0) > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, marginRight: 4 }}>
                                <img src={canoeIcon} alt="sup" style={{ width: 24, height: 24, filter: 'drop-shadow(0 1px 2px #007aff44)' }} />
                                <img src={seatIcon} alt="seat" style={{ width: 18, height: 18, marginLeft: -8, filter: 'drop-shadow(0 1px 2px #007aff44)' }} />
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginLeft: 2 }}>{booking.boardWithSeatCount}</span>
                            </span>
                        )}
                        {(booking.raftCount || 0) > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, marginRight: 4 }}>
                                <img src={skiIcon} alt="raft" style={{ width: 28, height: 28, filter: 'drop-shadow(0 1px 2px #007aff44)' }} />
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginLeft: 2 }}>{booking.raftCount}</span>
                            </span>
                        )}
                    </>
                )}
            </span>
        );
    };

    return (
        <ModalOverlay $isClosing={isClosing} onClick={handleOverlayClick}>
            <ModalContainer $isClosing={isClosing}>
                <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <Title style={{ margin: 0 }}>
                        {formatDateFns(date, 'd MMMM yyyy', { locale: ru })}
                    </Title>
                    <CustomSelect
                        value={statusFilter}
                        options={statusOptionsWithCount}
                        onChange={value => setStatusFilter(value as BookingStatusEnum)}
                        style={{ minWidth: 170 }}
                    />
                </Header>

                {/* Панель действий */}
                <ActionBar>
                    <SortSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                        <option value="time">По времени</option>
                        <option value="name">По имени</option>
                        <option value="status">По статусу</option>
                        <option value="inventory">По инвентарю</option>
                    </SortSelect>
                    <ActionButton onClick={handleExport}>
                        <ShareIcon />
                        Экспорт
                    </ActionButton>
                    <ActionButton onClick={handleNotifications}>
                        <NotificationsIcon />
                        Уведомления
                    </ActionButton>
                </ActionBar>

                {/* Поиск */}
                <SearchBar>
                    <SearchIcon style={{ color: '#86868B', fontSize: 18 }} />
                    <SearchInput
                        type="text"
                        placeholder="Поиск по имени, телефону или комментарию..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#86868B',
                                cursor: 'pointer',
                                fontSize: 16
                            }}
                        >
                            ✕
                        </button>
                    )}
                </SearchBar>

                {/* Быстрые фильтры */}
                <QuickFilters>
                    <FilterChip 
                        $active={quickFilter === 'all'} 
                        onClick={() => setQuickFilter('all')}
                    >
                        Все
                    </FilterChip>
                    <FilterChip 
                        $active={quickFilter === 'today'} 
                        onClick={() => setQuickFilter('today')}
                    >
                        Сегодня
                    </FilterChip>
                    {stats.overdue > 0 && (
                        <FilterChip 
                            $active={quickFilter === 'overdue'} 
                            onClick={() => setQuickFilter('overdue')}
                            style={{ backgroundColor: quickFilter === 'overdue' ? '#FF4D4F' : '#3A3A3C' }}
                        >
                            Просроченные ({stats.overdue})
                        </FilterChip>
                    )}
                    {stats.upcoming > 0 && (
                        <FilterChip 
                            $active={quickFilter === 'upcoming'} 
                            onClick={() => setQuickFilter('upcoming')}
                            style={{ backgroundColor: quickFilter === 'upcoming' ? '#FFD600' : '#3A3A3C', color: quickFilter === 'upcoming' ? '#000' : '#fff' }}
                        >
                            В ближайший час ({stats.upcoming})
                        </FilterChip>
                    )}
                    {stats.vip > 0 && (
                        <FilterChip 
                            $active={quickFilter === 'vip'} 
                            onClick={() => setQuickFilter('vip')}
                            style={{ backgroundColor: quickFilter === 'vip' ? '#FFD600' : '#3A3A3C', color: quickFilter === 'vip' ? '#000' : '#fff' }}
                        >
                            VIP ({stats.vip})
                        </FilterChip>
                    )}
                    <FilterChip 
                        $active={quickFilter === 'large'} 
                        onClick={() => setQuickFilter('large')}
                    >
                        Крупные заказы
                    </FilterChip>
                </QuickFilters>

                {/* Быстрые действия */}
                <QuickActions 
                    bookings={bookings}
                    onBulkAction={handleBulkAction}
                />

                <StyledList>
                    {processedBookings.length > 0 ? (
                        processedBookings.map((booking) => (
                            <BookingCard
                                key={booking.id}
                                booking={booking}
                                onEdit={onEditBooking}
                                onDelete={onDeleteBooking}
                                setStatusFilter={setStatusFilter}
                                isVIP={isVIPClient(booking)}
                                isOverdue={isOverdue(booking)}
                                isUpcoming={isUpcoming(booking)}
                                isLarge={isLargeOrder(booking)}
                                renderInventory={renderMobileInventory}
                            />
                        ))
                    ) : (
                        <div style={{ 
                            textAlign: 'center', 
                            color: '#86868B', 
                            padding: '20px 0' 
                        }}>
                            {searchQuery ? 
                                `Нет записей по запросу "${searchQuery}"` : 
                                'Нет записей с выбранным статусом'
                            }
                        </div>
                    )}
                </StyledList>

                <ButtonGroup>
                    <SecondaryButton onClick={onClose}>
                        Закрыть
                    </SecondaryButton>
                    <PrimaryButton onClick={onAddBooking}>
                        Добавить запись
                    </PrimaryButton>
                </ButtonGroup>
            </ModalContainer>
            
            {/* Модальные окна напоминаний */}
            {showReminderSettings && (
                <ReminderSettingsComponent
                    settings={reminderSettings}
                    onSave={(newSettings) => {
                        setReminderSettings(newSettings);
                        setShowReminderSettings(false);
                        // Здесь можно добавить сохранение в localStorage или API
                        localStorage.setItem('reminderSettings', JSON.stringify(newSettings));
                    }}
                    onClose={() => setShowReminderSettings(false)}
                />
            )}
            
            {showReminderStatus && (
                <ReminderStatusComponent
                    history={reminderHistory}
                    onClose={() => setShowReminderStatus(false)}
                />
            )}
        </ModalOverlay>
    );
};

interface BookingCardProps {
    booking: Booking;
    onEdit: (booking: Booking) => void;
    onDelete: (booking: Booking) => void;
    setStatusFilter: (status: BookingStatusEnum) => void;
    isVIP?: boolean;
    isOverdue?: boolean;
    isUpcoming?: boolean;
    isLarge?: boolean;
    renderInventory: (booking: Booking) => React.ReactNode;
}

const BookingCard: FC<BookingCardProps> = ({ 
    booking, 
    onEdit, 
    onDelete, 
    setStatusFilter,
    isVIP = false,
    isOverdue = false,
    isUpcoming = false,
    isLarge = false,
    renderInventory
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [editInventoryOpen, setEditInventoryOpen] = useState(false);
    const [tempSelectedItems, setTempSelectedItems] = useState<Record<number, number>>({});
    const x = useMotionValue(0);
    const dispatch = useAppDispatch();
    const now = useMemo(() => new Date(), []);
    const bookingsMap = useAppSelector(state => state.bookings.bookings);
    const flatAllBookings = useMemo(() => Object.values(bookingsMap || {}).flat() as Booking[], [bookingsMap]);
    const plannedDate = booking.plannedStartTime ? parseISO(booking.plannedStartTime) : new Date();
    const duration = booking.durationInHours || 4;
    const boards = useAppSelector(state => state.boards.boards);
    const totalBoards = boards.length;
    const availableBoards = getAvailableBoardsCount(plannedDate, duration, flatAllBookings, totalBoards, booking.id);
    const boardCount = booking.boardCount || 0;
    const boardWithSeatCount = booking.boardWithSeatCount || 0;
    const raftCount = booking.raftCount || 0;

    const handleDragEnd = (
        _: unknown,
        { offset }: PanInfo
    ) => {
        if (offset.x > 100) {
            setIsConfirming(true);
        }
    };



    const handleConfirmDelete = () => {
        onDelete(booking);
    };

    const handleCancelDelete = () => {
        setIsConfirming(false);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(booking);
    };

    const handleSetInUse = async () => {
        await dispatch(updateBookingAsync({
            id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
            booking: {
                status: BookingStatus.IN_USE,
                actualStartTime: new Date().toISOString(),
            }
        }));
        // Redux уже обновил бронирования через updateBookingAsync.fulfilled
        // Обновляем только доски и связи
        await dispatch(fetchBoards());
        setStatusFilter(BookingStatus.IN_USE);
    };

    const handleCancelBooking = async () => {
        await dispatch(completeOrCancelBooking({ booking, status: 'cancelled', boardStatus: 'available' }));
        // Redux уже обновил бронирования через completeOrCancelBooking
        // Обновляем только доски и связи
        await dispatch(fetchBoards());
        // await dispatch(fetchBoardBookings());
        setStatusFilter(BookingStatus.CANCELLED);
    };

    const handleReturnBoard = async () => {
        await dispatch(completeOrCancelBooking({ booking, status: 'completed', boardStatus: 'servicing' }));
        // Redux уже обновил бронирования через completeOrCancelBooking
        // Обновляем только доски и связи
        await dispatch(fetchBoards());
        // await dispatch(fetchBoardBookings());
        setStatusFilter(BookingStatus.COMPLETED);
    };

    // Новые обработчики для Варианта 3 (упрощенные для мобильной версии)
    const handleRestoreBooking = async () => {
        await dispatch(updateBookingAsync({
            id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
            booking: {
                status: BookingStatus.BOOKED,
                actualStartTime: undefined,
            }
        }));
        // Redux уже обновил бронирования через updateBookingAsync.fulfilled
        // Обновляем только доски и связи
        await dispatch(fetchBoards());
        // await dispatch(fetchBoardBookings());
        setStatusFilter(BookingStatus.BOOKED);
    };


    
    const plannedStartTimeFormatted = useMemo(() => {
        try {
            return formatDateFns(parseISO(booking.plannedStartTime), 'HH:mm, d MMM', { locale: ru });
        } catch { return 'Неверное время'; }
    }, [booking.plannedStartTime]);

    const actualTimes = useMemo(() => {
        if (booking.actualStartTime) {
            const start = parseISO(booking.actualStartTime);
            const end = addHours(start, booking.durationInHours);
            const timeLeft = !isAfter(now, end) ? formatDistanceStrict(end, now, { locale: ru, addSuffix: true }) : 'Время вышло';
            return {
                startFormatted: formatDateFns(start, 'HH:mm, d MMM', { locale: ru }),
                endFormatted: formatDateFns(end, 'HH:mm, d MMM', { locale: ru }),
                timeLeft,
                hasEnded: isAfter(now, end)
            };
        }
        return null;
    }, [booking.actualStartTime, booking.durationInHours, now]);

    return (
        <BookingCardContainer>
            <DeleteBackground>
                <DeleteIconWrapper>
                    <DeleteText>Удалить</DeleteText>
                </DeleteIconWrapper>
            </DeleteBackground>
            <BookingCardContent
                $isPaid={booking.status === BookingStatus.IN_USE || booking.status === BookingStatus.COMPLETED}
                $isCancelled={booking.status === BookingStatus.CANCELLED}
                $status={booking.status}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={handleDragEnd}
                style={{ x }}
                animate={isConfirming ? { scale: 0.95 } : { scale: 1 }}
                whileHover={!isConfirming ? { scale: 1.02 } : {}}
                onDrag={(_, info) => {
                    const dragX = info.offset.x;
                    x.set(Math.max(0, dragX));
                }}
            >
                {/* Индикаторы статуса */}
                <div style={{ 
                    position: 'absolute', 
                    top: 8, 
                    left: 8, 
                    display: 'flex', 
                    gap: 4,
                    zIndex: 3
                }}>
                    {isVIP && (
                        <span style={{
                            fontSize: 10,
                            backgroundColor: '#FFD600',
                            color: '#000',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            VIP
                        </span>
                    )}
                    {isOverdue && (
                        <span style={{
                            fontSize: 10,
                            backgroundColor: '#FF4D4F',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            ПРОСРОЧЕНО
                        </span>
                    )}
                    {isUpcoming && (
                        <span style={{
                            fontSize: 10,
                            backgroundColor: '#FFD600',
                            color: '#000',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {formatDistanceStrict(new Date(), parseISO(booking.plannedStartTime), { 
                                locale: ru 
                            }).replace(/\s+/g, ' ').toUpperCase()}
                        </span>
                    )}
                    {isLarge && !isVIP && (
                        <span style={{
                            fontSize: 10,
                            backgroundColor: '#34C759',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            КРУПНЫЙ
                        </span>
                    )}
                </div>

                                {/* Кнопка редактирования для мобильной версии */}
                {(booking.status === BookingStatus.BOOKED || booking.status === BookingStatus.IN_USE) && (
                    <button
                        onClick={handleEdit}
                        style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: 16,
                            backdropFilter: 'blur(10px)',
                            zIndex: 3,
                        }}
                        title="Редактировать"
                    >
                        ✏️
                    </button>
                )}
                <BookingTime>
                    {booking.serviceType === 'аренда' ? 'Аренда' : 'Сплав'}: {formatDateFns(parseISO(booking.plannedStartTime), 'HH:mm')}
                    {isOverdue && (
                        <span style={{ 
                            marginLeft: 8, 
                            fontSize: 12, 
                            color: '#FF4D4F',
                            fontWeight: 400
                        }}>
                            (просрочено на {formatDistanceStrict(parseISO(booking.plannedStartTime), new Date(), { locale: ru })})
                        </span>
                    )}
                    {isUpcoming && (
                        <span style={{ 
                            marginLeft: 8, 
                            fontSize: 12, 
                            color: '#FFD600',
                            fontWeight: 400
                        }}>
                            (через {formatDistanceStrict(new Date(), parseISO(booking.plannedStartTime), { locale: ru })})
                        </span>
                    )}
                </BookingTime>
                <BookingInfo>
                    <div>{booking.clientName} ({booking.phone})</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                        {renderInventory(booking)}
                        {(booking.status === BookingStatus.BOOKED || booking.status === BookingStatus.IN_USE) && (
                            <button
                                onClick={() => {
                                    // Инициализируем с текущим инвентарем бронирования
                                    setTempSelectedItems(booking.selectedItems || {});
                                    setEditInventoryOpen(true);
                                }}
                                style={{
                                    marginLeft: 6,
                                    width: 17,
                                    height: 17,
                                    background: 'none',
                                    border: '1.5px solid #007AFF',
                                    borderRadius: 6,
                                    color: '#007AFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s, border-color 0.15s',
                                    boxShadow: 'none',
                                    padding: 0,
                                }}
                                title="Изменить инвентарь"
                            >
                                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="5" y="1" width="1" height="9" rx="0.5" fill="#007AFF"/>
                                    <rect x="1" y="5" width="9" height="1" rx="0.5" fill="#007AFF"/>
                                </svg>
                            </button>
                        )}
                    </div>
                    
                    {actualTimes && (
                        <TimeInfo>
                            Факт. начало: {actualTimes.startFormatted}<br />
                            Завершение: {actualTimes.endFormatted} ({actualTimes.timeLeft})
                        </TimeInfo>
                    )}

                    {booking.comment && (
                        <div className="comment">
                            {booking.comment}
                        </div>
                    )}
                    
                    <div style={{ marginTop: '12px' }}>
                        <QuickStatusActions 
                            booking={booking}
                            onUpdate={() => {
                                // Redux уже обновил состояние, перезагрузка не нужна
                                console.log('Статус обновлен через QuickStatusActions');
                            }}
                        />
                    </div>
                </BookingInfo>
            </BookingCardContent>
            <AnimatePresence>
                {isConfirming && (
                    <ConfirmContainer
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        <ConfirmText>Удалить запись?</ConfirmText>
                        <ConfirmButtonWrapper>
                            <ConfirmButton
                                $variant="delete"
                                onClick={handleConfirmDelete}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Удалить
                            </ConfirmButton>
                            <ConfirmButton
                                $variant="cancel"
                                onClick={handleCancelDelete}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Отмена
                            </ConfirmButton>
                        </ConfirmButtonWrapper>
                    </ConfirmContainer>
                )}
            </AnimatePresence>
            {editInventoryOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                }} onClick={() => setEditInventoryOpen(false)}>
                    <div style={{
                        width: window.innerWidth <= 768 ? '100vw' : 'min(90vw, 500px)',
                        height: window.innerWidth <= 768 ? '100vh' : 'min(90vh, 700px)',
                        maxWidth: window.innerWidth <= 768 ? 'none' : '500px',
                        maxHeight: window.innerWidth <= 768 ? 'none' : '700px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        <InventorySelector
                            selectedItems={tempSelectedItems}
                            onChange={setTempSelectedItems}
                            plannedDate={booking.plannedStartTime ? booking.plannedStartTime.split('T')[0] : undefined}
                            plannedTime={booking.plannedStartTime ? formatDateFns(parseISO(booking.plannedStartTime), 'HH:mm') : undefined}
                            durationInHours={booking.durationInHours}
                            bookingId={booking.id?.toString()}
                            onClose={async () => {
                                // Сохраняем изменения перед закрытием
                                try {
                                    await dispatch(updateBookingAsync({
                                        id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
                                        booking: {
                                            selectedItems: tempSelectedItems,
                                            // Обнуляем старые поля
                                            boardCount: 0,
                                            boardWithSeatCount: 0,
                                            raftCount: 0
                                        }
                                    }));
                                    console.log('Mobile inventory updated successfully');
                                } catch (error) {
                                    console.error('Ошибка при сохранении инвентаря (мобильная версия):', error);
                                }
                                setEditInventoryOpen(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </BookingCardContainer>
    );
};

export default BookingsList; 