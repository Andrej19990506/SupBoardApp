import { useState, useMemo, useEffect } from 'react';
import type { FC, MouseEvent } from 'react';
import { format as formatDateFns, parseISO, addHours, formatDistanceStrict, isAfter, isBefore, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import styled from 'styled-components';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ShareIcon from '@mui/icons-material/Share';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useAppDispatch } from '@features/booking/store/hooks';
import { completeOrCancelBooking, updateBookingAsync, fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBoards } from '@features/booking/store/slices/board-slice/boardThunk';
import { fetchBoardBookings } from '@features/booking/store/slices/board-bookings/boardBookingsThunks';
import type { Booking, BookingStatus as BookingStatusEnum, ReminderSettings, ReminderHistory, ReminderTemplate } from '@/types/booking';
import { BookingStatus, ServiceType } from '@/types/booking';
import canoeIcon from '@/assets/canoe.png';
import seatIcon from '@/assets/seat.png';
import skiIcon from '@/assets/ski.png';
import { getAvailableBoardsCount, getAvailableSeatsCount } from '@features/booking/utils/bookingUtils';
import InventorySelector from '@features/booking/components/BookingForm/InventorySelector';
import ReminderSettingsComponent from './ReminderSettings';
import ReminderStatusComponent from './ReminderStatus';
import QuickStatusActions from './QuickStatusActions';
import { useAppSelector } from '@features/booking/store/hooks';
import { inventoryApi, type InventoryType } from '@features/booking/services/inventoryApi';

// Стили для десктопной версии
const DesktopContainer = styled.div`
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
`;

const DesktopModal = styled.div`
    background: #1C1C1E;
    border-radius: 16px;
    width: 95vw;
    max-width: 1400px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const Header = styled.div`
    padding: 24px 32px;
    border-bottom: 1px solid #2C2C2E;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1C1C1E;
    position: sticky;
    top: 0;
    z-index: 10;
`;

const Title = styled.h2`
    font-size: 1.75rem;
    color: #fff;
    margin: 0;
    font-weight: 600;
`;

const HeaderActions = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
    background: ${({ $variant }) => {
        switch ($variant) {
            case 'primary': return '#007AFF';
            case 'danger': return '#FF4D4F';
            default: return '#3A3A3C';
        }
    }};
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    
    &:hover {
        opacity: 0.8;
    }
    
    svg {
        font-size: 18px;
    }
`;

const ToolbarContainer = styled.div`
    padding: 16px 32px;
    background: #1C1C1E;
    border-bottom: 1px solid #2C2C2E;
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
`;

const SearchContainer = styled.div`
    display: flex;
    align-items: center;
    background: #2C2C2E;
    border-radius: 8px;
    padding: 8px 12px;
    min-width: 300px;
    flex: 1;
    max-width: 400px;
`;

const SearchInput = styled.input`
    background: none;
    border: none;
    color: #fff;
    font-size: 14px;
    flex: 1;
    outline: none;
    margin-left: 8px;
    
    &::placeholder {
        color: #86868B;
    }
`;

const FilterSelect = styled.select`
    background: #2C2C2E;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    outline: none;
    min-width: 150px;
    
    option {
        background: #2C2C2E;
        color: #fff;
    }
`;

const StatsContainer = styled.div`
    display: flex;
    gap: 24px;
    margin-left: auto;
`;

const StatItem = styled.div`
    text-align: center;
    
    .value {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        display: block;
    }
    
    .label {
        font-size: 11px;
        color: #86868B;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
`;

const TableContainer = styled.div`
    flex: 1;
    overflow: auto;
    background: #1C1C1E;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
`;

const TableHeader = styled.thead`
    background: #2C2C2E;
    position: sticky;
    top: 0;
    z-index: 5;
`;

const TableHeaderCell = styled.th<{ $sortable?: boolean }>`
    padding: 16px 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #86868B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #3A3A3C;
    cursor: ${({ $sortable }) => $sortable ? 'pointer' : 'default'};
    user-select: none;
    
    &:hover {
        background: ${({ $sortable }) => $sortable ? '#3A3A3C' : 'transparent'};
    }
    
    &:first-child {
        width: 40px;
        text-align: center;
    }
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ $selected?: boolean; $status?: BookingStatusEnum }>`
    background: ${({ $selected, $status }) => {
        if ($selected) return 'rgba(0, 122, 255, 0.1)';
        switch ($status) {
            case BookingStatus.IN_USE:
                return 'rgba(34, 197, 94, 0.05)';
            case BookingStatus.COMPLETED:
                return 'rgba(142, 142, 147, 0.05)';
            case BookingStatus.CANCELLED:
                return 'rgba(255, 77, 79, 0.05)';
            default:
                return 'transparent';
        }
    }};
    border-bottom: 1px solid #2C2C2E;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.02);
    }
`;

const TableCell = styled.td`
    padding: 12px;
    color: #fff;
    font-size: 14px;
    vertical-align: middle;
    
    &:first-child {
        text-align: center;
        width: 40px;
    }
`;

const StatusBadge = styled.span<{ $status: BookingStatusEnum }>`
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    
    ${({ $status }) => {
        switch ($status) {
            case BookingStatus.BOOKED:
                return `background: rgba(0, 122, 255, 0.1); color: #007AFF;`;
            case BookingStatus.IN_USE:
                return `background: rgba(34, 197, 94, 0.1); color: #22C55E;`;
            case BookingStatus.COMPLETED:
                return `background: rgba(142, 142, 147, 0.1); color: #8E8E93;`;
            case BookingStatus.CANCELLED:
                return `background: rgba(255, 77, 79, 0.1); color: #FF4D4F;`;
            default:
                return `background: rgba(107, 114, 128, 0.1); color: #6B7280;`;
        }
    }}
`;

const InventoryDisplay = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const InventoryItem = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 500;
`;

const ActionMenu = styled.div`
    position: relative;
    display: inline-block;
`;

const ActionMenuButton = styled.button`
    background: none;
    border: none;
    color: #86868B;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }
`;

const ActionMenuDropdown = styled.div<{ $visible: boolean }>`
    position: absolute;
    right: 0;
    top: 100%;
    background: #2C2C2E;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    min-width: 150px;
    z-index: 20;
    display: ${({ $visible }) => $visible ? 'block' : 'none'};
    overflow: hidden;
`;

const ActionMenuItem = styled.button<{ $variant?: 'danger' }>`
    width: 100%;
    background: none;
    border: none;
    color: ${({ $variant }) => $variant === 'danger' ? '#FF4D4F' : '#fff'};
    padding: 12px 16px;
    text-align: left;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:hover {
        background: rgba(255, 255, 255, 0.1);
    }
`;

const BulkActionsBar = styled.div<{ $visible: boolean }>`
    background: #007AFF;
    padding: 12px 32px;
    display: ${({ $visible }) => $visible ? 'flex' : 'none'};
    align-items: center;
    justify-content: space-between;
    color: #fff;
    font-weight: 500;
`;

const BulkActionButton = styled.button`
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: #fff;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    margin-left: 8px;
    
    &:hover {
        background: rgba(255, 255, 255, 0.3);
    }
`;

// Стили для десктопного редактора инвентаря
const InventoryEditorOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
`;

const InventoryEditorModal = styled.div`
    background: #1C1C1E;
    border-radius: 16px;
    padding: 24px;
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    border: 1px solid #2C2C2E;
`;

const InventoryEditorHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #2C2C2E;
`;

const InventoryEditorTitle = styled.h3`
    color: #fff;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
`;

const ClientInfo = styled.div`
    color: #86868B;
    font-size: 14px;
    
    span {
        color: #fff;
        font-weight: 500;
    }
`;

const InventoryGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin: 20px 0;
`;

const InventoryCard = styled.div`
    background: #2C2C2E;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    
    &:hover {
        border-color: #007AFF;
        background: #323234;
    }
`;

const InventoryIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    height: 40px;
`;

const InventoryLabel = styled.div`
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
`;

const InventoryCounter = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 8px;
`;

const CounterButton = styled.button<{ $disabled?: boolean }>`
    background: ${({ $disabled }) => $disabled ? '#3A3A3C' : '#007AFF'};
    border: none;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};
    
    &:hover:not(:disabled) {
        background: #0056CC;
        transform: scale(1.05);
    }
`;

const CounterValue = styled.div`
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    min-width: 32px;
`;

const AvailabilityInfo = styled.div`
    color: #86868B;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const EditorActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #2C2C2E;
`;

const QuickPresets = styled.div`
    margin: 16px 0;
`;

const PresetsLabel = styled.div`
    color: #86868B;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
`;

const PresetButton = styled.button`
    background: #3A3A3C;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    margin-right: 8px;
    margin-bottom: 4px;
    transition: all 0.2s ease;
    
    &:hover {
        background: #007AFF;
    }
`;

// Типы
type SortField = 'time' | 'client' | 'status' | 'inventory' | 'service';
type SortDirection = 'asc' | 'desc';

interface DesktopBookingsListProps {
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
            return status;
    }
};

const DesktopBookingsList: FC<DesktopBookingsListProps> = ({
    date,
    bookings,
    onAddBooking,
    onEditBooking,
    onDeleteBooking,
    onClose,
    isClosing
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<BookingStatusEnum | 'all'>('all');
    const [sortField, setSortField] = useState<SortField>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editInventoryBookingId, setEditInventoryBookingId] = useState<string | null>(null);
    const [tempInventory, setTempInventory] = useState({
        boardCount: 0,
        boardWithSeatCount: 0,
        raftCount: 0,
    });
    const [tempSelectedItems, setTempSelectedItems] = useState<Record<number, number>>({});
    
    // Состояния для напоминаний
    const [showReminderSettings, setShowReminderSettings] = useState(false);
    const [showReminderStatus, setShowReminderStatus] = useState(false);
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
    const boards = useAppSelector(state => state.boards.boards);
    const bookingsMap = useAppSelector(state => state.bookings.bookings);
    const flatAllBookings = useMemo(() => {
        if (!bookingsMap || typeof bookingsMap !== 'object') {
            return [];
        }
        try {
            return Object.values(bookingsMap).flat().filter(booking => booking && booking.id) as Booking[];
        } catch (error) {
            console.error('Ошибка при обработке списка бронирований:', error);
            return [];
        }
    }, [bookingsMap]);

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

    const handleOverlayClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Функции для определения статусов
    const isVIPClient = (booking: Booking): boolean => {
        const totalInventory = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0);
        return totalInventory >= 5 || booking.comment?.toLowerCase().includes('vip') || false;
    };

    const isOverdue = (booking: Booking, currentTime?: Date): boolean => {
        if (booking.status !== BookingStatus.BOOKED) return false;
        const now = currentTime || new Date();
        return isBefore(parseISO(booking.plannedStartTime), now);
    };

    const isUpcoming = (booking: Booking, currentTime?: Date): boolean => {
        if (booking.status !== BookingStatus.BOOKED) return false;
        const now = currentTime || new Date();
        const plannedTime = parseISO(booking.plannedStartTime);
        const oneHourLater = addHours(now, 1);
        return isAfter(plannedTime, now) && isBefore(plannedTime, oneHourLater);
    };

    // Обработка сортировки
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Фильтрация и сортировка данных
    const processedBookings = useMemo(() => {
        if (!bookings || !Array.isArray(bookings)) {
            return [];
        }
        
        let filtered = bookings.filter(b => b && b.id && b.clientName && b.plannedStartTime);

        // Фильтр по статусу
        if (statusFilter !== 'all') {
            filtered = filtered.filter(b => b.status === statusFilter);
        }

        // Поиск
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(b => 
                (b.clientName && b.clientName.toLowerCase().includes(query)) ||
                (b.phone && b.phone.includes(query)) ||
                (b.comment && b.comment.toLowerCase().includes(query))
            );
        }

        // Сортировка
        filtered.sort((a, b) => {
            let comparison = 0;
            
            try {
                switch (sortField) {
                    case 'time':
                        comparison = (a.plannedStartTime || '').localeCompare(b.plannedStartTime || '');
                        break;
                    case 'client':
                        comparison = (a.clientName || '').localeCompare(b.clientName || '');
                        break;
                    case 'status':
                        comparison = (a.status || '').localeCompare(b.status || '');
                        break;
                    case 'inventory':
                        const aTotal = (a.boardCount || 0) + (a.boardWithSeatCount || 0) + (a.raftCount || 0);
                        const bTotal = (b.boardCount || 0) + (b.boardWithSeatCount || 0) + (b.raftCount || 0);
                        comparison = aTotal - bTotal;
                        break;
                    case 'service':
                        comparison = (a.serviceType || '').localeCompare(b.serviceType || '');
                        break;
                }
            } catch (error) {
                console.error('Ошибка при сортировке:', error);
                comparison = 0;
            }
            
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [bookings, statusFilter, searchQuery, sortField, sortDirection]);

    // Статистика
    const stats = useMemo(() => {
        const now = new Date(); // Фиксируем время один раз
        const oneHourLater = addHours(now, 1);
        
        const total = bookings.length;
        const booked = bookings.filter(b => b.status === BookingStatus.BOOKED).length;
        const pendingConfirmation = bookings.filter(b => b.status === BookingStatus.PENDING_CONFIRMATION).length;
        const confirmed = bookings.filter(b => b.status === BookingStatus.CONFIRMED).length;
        const inUse = bookings.filter(b => b.status === BookingStatus.IN_USE).length;
        const completed = bookings.filter(b => b.status === BookingStatus.COMPLETED).length;
        const cancelled = bookings.filter(b => b.status === BookingStatus.CANCELLED).length;
        const noShow = bookings.filter(b => b.status === BookingStatus.NO_SHOW).length;
        const rescheduled = bookings.filter(b => b.status === BookingStatus.RESCHEDULED).length;
        
        const overdue = bookings.filter(b => {
            if (b.status !== BookingStatus.BOOKED) return false;
            return isBefore(parseISO(b.plannedStartTime), now);
        }).length;
        
        const upcoming = bookings.filter(b => {
            if (b.status !== BookingStatus.BOOKED) return false;
            const plannedTime = parseISO(b.plannedStartTime);
            return isAfter(plannedTime, now) && isBefore(plannedTime, oneHourLater);
        }).length;

        return { total, booked, pendingConfirmation, confirmed, inUse, completed, cancelled, noShow, rescheduled, overdue, upcoming };
    }, [bookings]);

    // Обработка выбора записей
    const handleSelectBooking = (bookingId: string, selected: boolean) => {
        const newSelected = new Set(selectedBookings);
        if (selected) {
            newSelected.add(bookingId);
        } else {
            newSelected.delete(bookingId);
        }
        setSelectedBookings(newSelected);
    };

    const handleSelectAll = (selected: boolean) => {
        if (selected) {
            setSelectedBookings(new Set(processedBookings.map(b => b.id)));
        } else {
            setSelectedBookings(new Set());
        }
    };

    // Массовые действия
    const handleBulkAction = async (action: string) => {
        const selectedBookingObjects = processedBookings.filter(b => selectedBookings.has(b.id));
        
        try {
            switch (action) {
                case 'setInUse':
                    for (const booking of selectedBookingObjects) {
                        await dispatch(updateBookingAsync({
                            id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
                            booking: {
                                status: BookingStatus.IN_USE,
                                actualStartTime: new Date().toISOString(),
                            }
                        }));
                    }
                    break;
                    
                case 'complete':
                    for (const booking of selectedBookingObjects) {
                        await dispatch(completeOrCancelBooking({ 
                            booking, 
                            status: 'completed', 
                            boardStatus: 'servicing' 
                        }));
                    }
                    break;
                    
                case 'cancel':
                    for (const booking of selectedBookingObjects) {
                        await dispatch(completeOrCancelBooking({ 
                            booking, 
                            status: 'cancelled', 
                            boardStatus: 'available' 
                        }));
                    }
                    break;
            }
            
            // Redux уже обновил бронирования через updateBookingAsync.fulfilled или completeOrCancelBooking
            // Нет необходимости в дополнительном fetchBookings()
            await dispatch(fetchBoards());
            // await dispatch(fetchBoardBookings());
            
            // Очищаем выбор
            setSelectedBookings(new Set());
            
        } catch (error) {
            console.error('Ошибка при выполнении массового действия:', error);
        }
    };

    // Обработчики для редактирования инвентаря
    const handleEditInventory = (booking: Booking) => {
        // Инициализируем с текущим инвентарем (новая система)
        setTempSelectedItems(booking.selectedItems || {});
        // Старая система для совместимости (на случай если новой нет)
        setTempInventory({
            boardCount: booking.boardCount || 0,
            boardWithSeatCount: booking.boardWithSeatCount || 0,
            raftCount: booking.raftCount || 0,
        });
        setEditInventoryBookingId(booking.id);
        setOpenMenuId(null);
    };

    const handleSaveInventory = async () => {
        if (editInventoryBookingId) {
            const booking = processedBookings.find(b => b.id === editInventoryBookingId);
            if (booking) {
                try {
                    // Используем новую систему инвентаря (selectedItems)
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
                    console.log('Desktop inventory updated successfully');
                } catch (error) {
                    console.error('Ошибка при сохранении инвентаря (десктопная версия):', error);
                }
            }
        }
        setEditInventoryBookingId(null);
    };

    const handleCancelEditInventory = () => {
        setEditInventoryBookingId(null);
    };

    // Функции для старой системы инвентаря (больше не используются)
    // Оставлены для совместимости, могут быть удалены позже

    // Экспорт данных
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

    // Обработчик сохранения настроек напоминаний
    const handleReminderSettingsSave = (newSettings: ReminderSettings) => {
        setReminderSettings(newSettings);
        setShowReminderSettings(false);
        // Здесь можно добавить сохранение в localStorage или отправку на сервер
        localStorage.setItem('reminderSettings', JSON.stringify(newSettings));
    };

    // Функция для отображения инвентаря (поддерживает новый и старый формат)
    const renderBookingInventory = (booking: Booking) => {
        const selectedItems = booking.selectedItems || {};
        const hasNewItems = Object.keys(selectedItems).length > 0;
        const hasOldItems = (booking.boardCount || 0) + (booking.boardWithSeatCount || 0) + (booking.raftCount || 0) > 0;

        // Debug logs (временно отключены)
        // console.log('renderBookingInventory (desktop) debug:', {
        //     bookingId: booking.id,
        //     clientName: booking.clientName,
        //     selectedItems,
        //     hasNewItems,
        //     hasOldItems,
        //     inventoryTypesLoaded: inventoryTypes.length
        // });

        if (!hasNewItems && !hasOldItems) {
            return <span style={{ color: '#86868B' }}>—</span>;
        }

        return (
            <InventoryDisplay>
                {/* Новый формат инвентаря */}
                {hasNewItems && Object.entries(selectedItems).map(([typeIdStr, count]) => {
                    const typeId = parseInt(typeIdStr);
                    const countNum = Number(count) || 0;
                    const type = inventoryTypes.find(t => t.id === typeId);
                    if (!type || countNum <= 0) return null;

                    return (
                        <InventoryItem key={typeId}>
                            <span style={{ fontSize: 16 }}>{type.icon_name || '📦'}</span>
                            <span>{countNum}</span>
                        </InventoryItem>
                    );
                })}

                {/* Старый формат для совместимости */}
                {!hasNewItems && (
                    <>
                        {(booking.boardCount || 0) > 0 && (
                            <InventoryItem>
                                <img src={canoeIcon} alt="sup" style={{ width: 16, height: 16 }} />
                                {booking.boardCount}
                            </InventoryItem>
                        )}
                        {(booking.boardWithSeatCount || 0) > 0 && (
                            <InventoryItem>
                                <img src={canoeIcon} alt="sup" style={{ width: 16, height: 16 }} />
                                <img src={seatIcon} alt="seat" style={{ width: 12, height: 12, marginLeft: -4 }} />
                                {booking.boardWithSeatCount}
                            </InventoryItem>
                        )}
                        {(booking.raftCount || 0) > 0 && (
                            <InventoryItem>
                                <img src={skiIcon} alt="raft" style={{ width: 18, height: 18 }} />
                                {booking.raftCount}
                            </InventoryItem>
                        )}
                    </>
                )}
            </InventoryDisplay>
        );
    };

    return (
        <DesktopContainer onClick={handleOverlayClick}>
            <DesktopModal onClick={(e) => e.stopPropagation()}>
                {/* Заголовок */}
                <Header>
                    <Title>
                        📅 {formatDateFns(date, 'd MMMM yyyy', { locale: ru })}
                    </Title>
                    <HeaderActions>
                        <ActionButton onClick={handleExport}>
                            <ShareIcon />
                            Экспорт
                        </ActionButton>
                        <ActionButton onClick={() => setShowReminderSettings(true)}>
                            ⚙️ Напоминания
                        </ActionButton>
                        <ActionButton onClick={() => setShowReminderStatus(true)}>
                            📊 Статус
                        </ActionButton>
                        <ActionButton $variant="primary" onClick={onAddBooking}>
                            Добавить запись
                        </ActionButton>
                        <ActionButton onClick={onClose}>
                            Закрыть
                        </ActionButton>
                    </HeaderActions>
                </Header>

                {/* Панель инструментов */}
                <ToolbarContainer>
                    <SearchContainer>
                        <SearchIcon style={{ color: '#86868B' }} />
                        <SearchInput
                            type="text"
                            placeholder="Поиск по имени, телефону или комментарию..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </SearchContainer>
                    
                    <FilterSelect 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value as BookingStatusEnum | 'all')}
                    >
                        <option value="all">Все статусы</option>
                        <option value={BookingStatus.BOOKED}>Забронировано</option>
                        <option value={BookingStatus.PENDING_CONFIRMATION}>Ожидает подтверждения</option>
                        <option value={BookingStatus.IN_USE}>Используется</option>
                        <option value={BookingStatus.COMPLETED}>Завершено</option>
                        <option value={BookingStatus.CANCELLED}>Отменено</option>
                        <option value={BookingStatus.NO_SHOW}>Не явился</option>
                        <option value={BookingStatus.RESCHEDULED}>Перенесено</option>
                    </FilterSelect>

                    <StatsContainer>
                        <StatItem>
                            <span className="value">{stats.total}</span>
                            <span className="label">Всего</span>
                        </StatItem>
                        <StatItem>
                            <span className="value">{stats.booked}</span>
                            <span className="label">Забронировано</span>
                        </StatItem>
                        {stats.pendingConfirmation > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#FF9500' }}>{stats.pendingConfirmation}</span>
                                <span className="label">Ожидают подтверждения</span>
                            </StatItem>
                        )}
                        {stats.confirmed > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#34C759' }}>{stats.confirmed}</span>
                                <span className="label">Подтверждено</span>
                            </StatItem>
                        )}
                        <StatItem>
                            <span className="value">{stats.inUse}</span>
                            <span className="label">В использовании</span>
                        </StatItem>
                        {stats.cancelled > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#FF4D4F' }}>{stats.cancelled}</span>
                                <span className="label">Отменено</span>
                            </StatItem>
                        )}
                        {stats.noShow > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#FF9500' }}>{stats.noShow}</span>
                                <span className="label">Не явились</span>
                            </StatItem>
                        )}
                        {stats.rescheduled > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#AF52DE' }}>{stats.rescheduled}</span>
                                <span className="label">Перенесено</span>
                            </StatItem>
                        )}
                        {stats.overdue > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#FF4D4F' }}>{stats.overdue}</span>
                                <span className="label">Просрочено</span>
                            </StatItem>
                        )}
                        {stats.upcoming > 0 && (
                            <StatItem>
                                <span className="value" style={{ color: '#FFD600' }}>{stats.upcoming}</span>
                                <span className="label">В ближайший час</span>
                            </StatItem>
                        )}
                    </StatsContainer>
                </ToolbarContainer>

                {/* Панель массовых действий */}
                <BulkActionsBar $visible={selectedBookings.size > 0}>
                    <span>Выбрано записей: {selectedBookings.size}</span>
                    <div>
                        <BulkActionButton onClick={() => handleBulkAction('setInUse')}>
                            Выдать
                        </BulkActionButton>
                        <BulkActionButton onClick={() => handleBulkAction('complete')}>
                            Завершить
                        </BulkActionButton>
                        <BulkActionButton onClick={() => handleBulkAction('cancel')}>
                            Отменить
                        </BulkActionButton>
                        <BulkActionButton onClick={() => setSelectedBookings(new Set())}>
                            Очистить выбор
                        </BulkActionButton>
                    </div>
                </BulkActionsBar>

                {/* Таблица */}
                <TableContainer>
                    <Table>
                        <TableHeader>
                            <tr>
                                <TableHeaderCell>
                                    <input
                                        type="checkbox"
                                        checked={selectedBookings.size === processedBookings.length && processedBookings.length > 0}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </TableHeaderCell>
                                <TableHeaderCell $sortable onClick={() => handleSort('time')}>
                                    Время {sortField === 'time' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </TableHeaderCell>
                                <TableHeaderCell $sortable onClick={() => handleSort('client')}>
                                    Клиент {sortField === 'client' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </TableHeaderCell>
                                <TableHeaderCell>Телефон</TableHeaderCell>
                                <TableHeaderCell $sortable onClick={() => handleSort('service')}>
                                    Услуга {sortField === 'service' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </TableHeaderCell>
                                <TableHeaderCell $sortable onClick={() => handleSort('inventory')}>
                                    Инвентарь {sortField === 'inventory' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </TableHeaderCell>
                                <TableHeaderCell $sortable onClick={() => handleSort('status')}>
                                    Статус {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </TableHeaderCell>
                                <TableHeaderCell>Комментарий</TableHeaderCell>
                                <TableHeaderCell>Действия</TableHeaderCell>
                            </tr>
                        </TableHeader>
                        <TableBody>
                            {processedBookings.map((booking) => (
                                <TableRow 
                                    key={booking.id} 
                                    $selected={selectedBookings.has(booking.id)}
                                    $status={booking.status}
                                >
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedBookings.has(booking.id)}
                                            onChange={(e) => handleSelectBooking(booking.id, e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            {formatDateFns(parseISO(booking.plannedStartTime), 'HH:mm')}
                                            {isOverdue(booking) && (
                                                <div style={{ fontSize: 11, color: '#FF4D4F', marginTop: 2 }}>
                                                    Просрочено
                                                </div>
                                            )}
                                            {isUpcoming(booking) && (
                                                <div style={{ fontSize: 11, color: '#FFD600', marginTop: 2 }}>
                                                    {formatDistanceStrict(parseISO(booking.plannedStartTime), new Date(), { 
                                                        locale: ru, 
                                                        addSuffix: true 
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            {booking.clientName}
                                            {isVIPClient(booking) && (
                                                <span style={{
                                                    marginLeft: 8,
                                                    fontSize: 10,
                                                    backgroundColor: '#FFD600',
                                                    color: '#000',
                                                    padding: '2px 4px',
                                                    borderRadius: '4px',
                                                    fontWeight: 600
                                                }}>
                                                    VIP
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{booking.phone}</TableCell>
                                    <TableCell>
                                        {booking.serviceType === 'аренда' ? 'Аренда' : 'Сплав'}
                                    </TableCell>
                                    <TableCell>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {renderBookingInventory(booking)}
                                            {(booking.status === BookingStatus.BOOKED || booking.status === BookingStatus.IN_USE) && (
                                                <button
                                                    onClick={() => handleEditInventory(booking)}
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        background: 'none',
                                                        border: '1px solid #007AFF',
                                                        borderRadius: 4,
                                                        color: '#007AFF',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                    }}
                                                    title="Изменить инвентарь"
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#007AFF';
                                                        e.currentTarget.style.color = '#fff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                        e.currentTarget.style.color = '#007AFF';
                                                    }}
                                                >
                                                    +
                                                </button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <QuickStatusActions 
                                            booking={booking}
                                            onUpdate={() => {
                                                // Redux уже обновил состояние, перезагрузка не нужна
                                                console.log('Статус обновлен через QuickStatusActions');
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div style={{ 
                                            maxWidth: 150, 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            fontSize: 13,
                                            color: '#86868B'
                                        }}>
                                            {booking.comment || '—'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <ActionMenu>
                                            <ActionMenuButton 
                                                onClick={() => setOpenMenuId(openMenuId === booking.id ? null : booking.id)}
                                            >
                                                <MoreVertIcon />
                                            </ActionMenuButton>
                                            <ActionMenuDropdown $visible={openMenuId === booking.id}>
                                                <ActionMenuItem onClick={() => onEditBooking(booking)}>
                                                    <EditOutlinedIcon />
                                                    Редактировать
                                                </ActionMenuItem>
                                                {(booking.status === BookingStatus.BOOKED || booking.status === BookingStatus.IN_USE) && (
                                                    <ActionMenuItem onClick={() => handleEditInventory(booking)}>
                                                        📦 Изменить инвентарь
                                                    </ActionMenuItem>
                                                )}
                                                {booking.status === BookingStatus.BOOKED && (
                                                    <ActionMenuItem onClick={async () => {
                                                        try {
                                                                                                        await dispatch(updateBookingAsync({
                                                id: typeof booking.id === 'string' ? parseInt(booking.id, 10) : booking.id,
                                                booking: {
                                                    status: BookingStatus.IN_USE,
                                                    actualStartTime: new Date().toISOString(),
                                                }
                                            }));
                                                            // Redux уже обновил бронирования через updateBookingAsync.fulfilled
                                                            await dispatch(fetchBoards());
                                                            // await dispatch(fetchBoardBookings());
                                                        } catch (error) {
                                                            console.error('Ошибка при выдаче инвентаря:', error);
                                                        }
                                                        setOpenMenuId(null);
                                                    }}>
                                                        <PlayArrowIcon />
                                                        Выдать
                                                    </ActionMenuItem>
                                                )}
                                                <ActionMenuItem 
                                                    $variant="danger" 
                                                    onClick={() => {
                                                        onDeleteBooking(booking);
                                                        setOpenMenuId(null);
                                                    }}
                                                >
                                                    🗑️ Удалить
                                                </ActionMenuItem>
                                            </ActionMenuDropdown>
                                        </ActionMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    
                    {processedBookings.length === 0 && (
                        <div style={{ 
                            textAlign: 'center', 
                            color: '#86868B', 
                            padding: '40px 20px',
                            fontSize: 16
                        }}>
                            {searchQuery ? 
                                `Нет записей по запросу "${searchQuery}"` : 
                                'Нет записей для отображения'
                            }
                        </div>
                    )}
                </TableContainer>

                {/* Десктопный редактор инвентаря (новая система) */}
                {editInventoryBookingId && (() => {
                    const booking = processedBookings.find(b => b.id === editInventoryBookingId);
                    if (!booking) return null;
                    
                    return (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 2000,
                            background: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 20
                        }} onClick={handleCancelEditInventory}>
                            <div style={{
                                width: 'min(90vw, 600px)',
                                height: 'min(90vh, 800px)',
                                maxWidth: '600px',
                                maxHeight: '800px',
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
                                    onClose={handleSaveInventory}
                                />
                            </div>
                        </div>
                    );
                })()}

                {/* Модальные окна напоминаний */}
                {showReminderSettings && (
                    <ReminderSettingsComponent
                        settings={reminderSettings}
                        onClose={() => setShowReminderSettings(false)}
                        onSave={handleReminderSettingsSave}
                    />
                )}
                
                {showReminderStatus && (
                    <ReminderStatusComponent
                        history={reminderHistory}
                        onClose={() => setShowReminderStatus(false)}
                    />
                )}
            </DesktopModal>
        </DesktopContainer>
    );
};

export default DesktopBookingsList; 