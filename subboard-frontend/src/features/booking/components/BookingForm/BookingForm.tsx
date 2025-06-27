import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { formatISO, parseISO, format as formatDateFns, isValid as isValidDate} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Booking, ServiceType as ServiceTypeEnum } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import { SERVICE_TYPES } from '@features/booking/constants/constants';
import { useAppSelector, useAppDispatch } from '@features/booking/store/hooks';
import { getAvailableBoardsForInterval, getDetailedAvailabilityInfo, generateInventoryWarningMessage } from '@features/booking/utils/bookingUtils';
import type { RootState } from '@features/booking/store';
import {
    Form,
    FormGroup,
    Label,
    Input,
    Select,
    TextArea,
    ButtonGroup,
    SecondaryButton,
    SaveButton,
    ModalOverlay,
    ModalContainer,
    SuccessOverlay,
    SuccessIcon,
    SuccessMessage,
    OkButton,
    FormTitle
} from './styles';
import React from 'react';
import canoeIcon from '@/assets/canoe.png';
import seatIcon from '@/assets/seat.png';
import skiIcon from '@/assets/ski.png';
import InventorySelector from '@features/booking/components/BookingForm/InventorySelector';
import { inventoryApi, type InventoryType } from '@/features/booking/services/inventoryApi';
import Notification from '@shared/components/Layout/Notification';
import { addBooking, fetchBookings, fetchFullyBookedDays } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { selectBoardBookings } from '@features/booking/store/slices/board-bookings/boardBookingsSelectors';

// Новые компоненты для улучшения UX сотрудников
import ClientAutocomplete from './ClientAutocomplete';
import PricingDisplay from './PricingDisplay';
import QuickTimeSelector from './QuickTimeSelector';
import QuickComments from './QuickComments';
import SmartSuggestions from './SmartSuggestions';
import type { ClientSearchResult } from './types';

// Импорт десктопной версии и хука для определения устройства
import DesktopBookingForm from './DesktopBookingForm';
import { useDevice } from '@shared/hooks/useDevice';
import { useInventoryTotal } from './hooks/useInventoryTotal';

interface BookingFormProps {
    initial?: Partial<Booking> & { date?: string };
    onSave: (bookingData: Omit<Booking, 'id' | 'status' | 'actualStartTime' | 'timeReturnedByClient'> & Partial<Pick<Booking, 'id' | 'comment'>>) => void;
    onCancel: () => void;
    isClosing: boolean;
    onShowBookings?: (date: string) => void;
    onOpenInventory?: () => void;
}

const getInitialFormState = (initial: BookingFormProps['initial']) => {
    const isRent = (initial?.serviceType ?? SERVICE_TYPES.RENT) === SERVICE_TYPES.RENT;
    let initialDurationInHours = 24;
    if (initial?.durationInHours) {
        initialDurationInHours = initial.durationInHours;
    } else if (initial?.serviceType === SERVICE_TYPES.RAFTING) {
        initialDurationInHours = 4;
    }

    let initialPlannedTime = '';
    if (initial?.plannedStartTime) {
        try {
            initialPlannedTime = formatDateFns(parseISO(initial.plannedStartTime), 'HH:mm');
        } catch (e) {
            console.error("Error parsing initial.plannedStartTime: ", e);
        }
    } else {
        // Ставим текущее время (часы и минуты)
        const now = new Date();
        initialPlannedTime = formatDateFns(now, 'HH:mm');
    }
    
    return {
        id: initial?.id ?? '',
        clientName: initial?.clientName ?? '',
        phone: initial?.phone ?? '',
        plannedDate: initial?.date ?? formatDateFns(new Date(), 'yyyy-MM-dd'),
        plannedTime: initialPlannedTime,
        serviceType: initial?.serviceType ?? SERVICE_TYPES.RENT,
        // Новый формат инвентаря
        selectedItems: (initial as any)?.selectedItems || {} as Record<number, number>,
        boardCount: initial?.boardCount ?? 0,
        boardWithSeatCount: initial?.boardWithSeatCount ?? 0,
        raftCount: initial?.raftCount ?? 0,
        durationRentDays: isRent ? initialDurationInHours / 24 : 1,
        durationInHours: initialDurationInHours,
        comment: initial?.comment ?? '',
    };
};

const BookingForm: FC<BookingFormProps> = ({ 
    initial = {}, 
    onSave,
    onCancel, 
    isClosing,
    onShowBookings,
}) => {
    // Определяем тип устройства (хук должен вызываться всегда)
    const { isDesktop } = useDevice();
    
    // Инициализируем состояние всегда (для соблюдения правил хуков)
    const [form, setForm] = useState(() => getInitialFormState(initial));
    const [showSuccess, setShowSuccess] = useState(false);
    const [savedBookingInfo, setSavedBookingInfo] = useState<{clientName: string, plannedStartTime: string, time: string} | null>(null);
    const [boardCountError, setBoardCountError] = useState<string | null>(null);
    const [inventoryError, setInventoryError] = useState<string | null>(null);
    const [showInventoryEditor, setShowInventoryEditor] = useState(false);
    const [tempInventory, setTempInventory] = useState(() => ({
        boardCount: getInitialFormState(initial).boardCount,
        boardWithSeatCount: getInitialFormState(initial).boardWithSeatCount,
        raftCount: getInitialFormState(initial).raftCount,
    }));
    const [tempSelectedItems, setTempSelectedItems] = useState<Record<number, number>>({});

    const [notification, setNotification] = useState<{message: string, type?: 'success' | 'error' | 'info', isOpen: boolean}>({ message: '', type: 'info', isOpen: false });
    
    // Состояние для новых функций сотрудников
    const [selectedClient, setSelectedClient] = useState<ClientSearchResult | undefined>(undefined);

    const bookingsMap = useAppSelector((state: RootState) => state.bookings.bookings);
    const boards = useAppSelector((state: RootState) => state.boards.boards);
    const seats = useAppSelector((state: RootState) => state.seats.seats);
    const totalBoards = boards.length;
    const totalSeats = seats.length;
    const dispatch = useAppDispatch();
    
    // Новая система инвентаря
    const { totalInventory, loading: inventoryLoading } = useInventoryTotal();
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    
    console.log('[BookingForm] Inventory state:', {
        totalInventory,
        inventoryLoading,
        boardsLength: boards.length
    });

    // Загружаем типы инвентаря для отображения
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

    const flatAllBookings = useMemo(() => Object.values(bookingsMap || {}).flat() as Booking[], [bookingsMap]);
    
    // Временно используем старую логику для отображения
    const hasSelectedInventory = () => {
        return form.boardCount + form.boardWithSeatCount + form.raftCount > 0 || 
               Object.keys(form.selectedItems || {}).length > 0;
    };

    // Компонент для отображения выбранного инвентаря в новом формате
    const renderSelectedInventory = () => {
        const selectedItems = form.selectedItems || {};
        const hasNewItems = Object.keys(selectedItems).length > 0;
        const hasOldItems = form.boardCount + form.boardWithSeatCount + form.raftCount > 0;

        if (!hasNewItems && !hasOldItems) {
            return null;
        }

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {/* Новый формат инвентаря */}
                {Object.entries(selectedItems).map(([typeIdStr, count]) => {
                    const typeId = parseInt(typeIdStr);
                    const countNum = Number(count) || 0;
                    const type = inventoryTypes.find(t => t.id === typeId);
                    if (!type || countNum <= 0) return null;

                    return (
                        <span key={typeId} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 4,
                            background: 'rgba(0, 122, 255, 0.1)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(0, 122, 255, 0.3)'
                        }}>
                            <span style={{ fontSize: 20 }}>{type.icon_name || '📦'}</span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{countNum}</span>
                            <span style={{ color: '#86868B', fontSize: 12 }}>{type.display_name}</span>
                        </span>
                    );
                })}

                {/* Старый формат для совместимости */}
                {form.boardCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <img src={canoeIcon} alt="sup" style={{ width: 24, height: 24 }} />
                        <span style={{ color: '#fff', fontWeight: 600 }}>{form.boardCount}</span>
                    </span>
                )}
                {form.boardWithSeatCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <img src={canoeIcon} alt="sup" style={{ width: 24, height: 24 }} />
                        <img src={seatIcon} alt="seat" style={{ width: 18, height: 18, marginLeft: -8 }} />
                        <span style={{ color: '#fff', fontWeight: 600, marginLeft: 2 }}>{form.boardWithSeatCount}</span>
                    </span>
                )}
                {form.raftCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <img src={skiIcon} alt="raft" style={{ width: 28, height: 28 }} />
                        <span style={{ color: '#fff', fontWeight: 600 }}>{form.raftCount}</span>
                    </span>
                )}

                <button type="button" onClick={() => {
                    setTempInventory({
                        boardCount: form.boardCount,
                        boardWithSeatCount: form.boardWithSeatCount,
                        raftCount: form.raftCount,
                    });
                    // При редактировании инициализируем текущими значениями формы
                    setTempSelectedItems({ ...form.selectedItems });
                    setShowInventoryEditor(true);
                }} style={{
                    background: 'none',
                    border: 'none',
                    color: '#007AFF',
                    fontSize: 18,
                    marginLeft: 8,
                    cursor: 'pointer',
                }}>Изменить</button>
            </div>
        );
    };
    const boardBookings = useAppSelector(selectBoardBookings);
    const partiallyBookedDays = useAppSelector((state: RootState) => state.bookings.partiallyBookedDays || []);

    // Определяем, выбран ли частично занятый день и время, с которого доступна запись
    const partialDay = partiallyBookedDays.find(d => d.date === form.plannedDate);
    const availableAfter = partialDay ? partialDay.available_after : null;

    // Автоматическая подстановка времени, если выбран частично занятый день
    useEffect(() => {
        if (availableAfter && form.plannedTime < availableAfter) {
            setForm(prev => ({ ...prev, plannedTime: availableAfter }));
        }
    }, [form.plannedDate, availableAfter]);

    // Валидация времени для частично занятого дня
    const isTimeTooEarly = availableAfter && form.plannedTime < availableAfter;
    useEffect(() => {
        if (isTimeTooEarly) {
            setBoardCountError(`В этот день запись возможна только после ${availableAfter}`);
        } else if (boardCountError && boardCountError.startsWith('В этот день запись возможна только после')) {
            setBoardCountError(null);
        }
    }, [form.plannedTime, availableAfter]);

    useEffect(() => {
        setForm(getInitialFormState(initial));
        setBoardCountError(null);
    }, [initial]);

    useEffect(() => {
        const calculateAvailability = () => {
            if (!form.plannedDate || !form.plannedTime || !form.durationInHours) {
                return;
            }

            try {
                const [hoursStr, minutesStr] = form.plannedTime.split(':');
                const hours = parseInt(hoursStr, 10);
                const minutes = parseInt(minutesStr, 10);

                if (isNaN(hours) || isNaN(minutes)) {

                    setBoardCountError('Неверный формат времени');
                    return;
                }

                let requestedDate = parseISO(form.plannedDate);
                if (!isValidDate(requestedDate)) {

                    setBoardCountError('Неверная дата');
                    return;
                }
                requestedDate = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), hours, minutes);
                
                if (!isValidDate(requestedDate)) {

                    setBoardCountError('Неверное дата или время'); 
                    return;
                }

                // Получаем детальную информацию о доступности
                // Используем новую систему инвентаря если доступна, иначе старую
                const effectiveBoards = totalInventory > 0 ? totalInventory : totalBoards;
                const effectiveSeats = totalInventory > 0 ? totalInventory : totalSeats;
                
                const availabilityInfo = getDetailedAvailabilityInfo(
                    requestedDate,
                    form.durationInHours,
                    flatAllBookings,
                    effectiveBoards,
                    effectiveSeats,
                    form.id
                );

                // Рассчитываем необходимое количество кресел
                const neededSeats = (form.boardWithSeatCount || 0) + (form.raftCount || 0) * 2;

                // Генерируем информативное предупреждение
                const totalRequestedRafts = getTotalSelectedInventory();
                const warningMessage = generateInventoryWarningMessage(
                    availabilityInfo,
                    totalRequestedRafts,
                    form.serviceType,
                    true // Показываем информацию о доступности даже если инвентарь не выбран
                );

                if (warningMessage) {
                    setBoardCountError(warningMessage);
                } else if (neededSeats > availabilityInfo.availableSeats) {
                    setBoardCountError(`Недостаточно кресел. Доступно: ${Math.max(0, availabilityInfo.availableSeats)}`);
                } else {
                    setBoardCountError(null);
                }

            } catch (error) {
                setBoardCountError("Ошибка расчета");
            }
        };

        calculateAvailability();
    }, [form.plannedDate, form.plannedTime, form.durationInHours, form.raftCount, form.boardWithSeatCount, form.serviceType, flatAllBookings, form.id, totalBoards, totalSeats, totalInventory, form.selectedItems]);

    useEffect(() => {
        if (!hasSelectedInventory()) {
            setInventoryError('Выберите хотя бы один инвентарь');
        } else {
            setInventoryError(null);
        }
    }, [form.boardCount, form.boardWithSeatCount, form.raftCount, form.selectedItems]);

    // Хелпер для получения общего количества выбранного инвентаря
    const getTotalSelectedInventory = () => {
        // Новый формат
        let newFormatTotal = 0;
        for (const count of Object.values(form.selectedItems || {})) {
            newFormatTotal += Number(count) || 0;
        }
        
        // Старый формат
        const oldFormatTotal = form.boardCount + form.boardWithSeatCount + form.raftCount;
        
        return Math.max(newFormatTotal, oldFormatTotal);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        setForm(prev => {
            const newForm = { ...prev, [name]: name === 'boardCount' || name === 'durationRentDays' ? Number(value) : value };

            if (name === 'serviceType') {
                if (value === SERVICE_TYPES.RENT) {
                    newForm.durationInHours = newForm.durationRentDays * 24;
                } else if (value === SERVICE_TYPES.RAFTING) {
                    newForm.durationInHours = 4;
                }
            }

            if (name === 'durationRentDays' && newForm.serviceType === SERVICE_TYPES.RENT) {
                newForm.durationInHours = Number(value) * 24;
            }

            return newForm;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (boardCountError) {
            return; 
        }
        
        if (!form.clientName || !form.phone || !hasSelectedInventory()) {
            if (!form.clientName) setBoardCountError(prev => prev || 'Заполните имя клиента');
            return;
        }
        
        const [hoursStr, minutesStr] = form.plannedTime.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (isNaN(hours) || isNaN(minutes)) {
            setBoardCountError('Неверный формат времени в отправляемых данных'); 
            return;
        }

        if (hours < 9 || (hours === 23 && minutes > 0) || hours > 23) {
            setBoardCountError('Время бронирования только с 09:00 до 23:00');
            return;
        }

        let plannedDateTime = parseISO(form.plannedDate);
        if (!isValidDate(plannedDateTime)) {
            setBoardCountError('Неверная дата в отправляемых данных'); 
            return;
        }
        plannedDateTime = new Date(plannedDateTime.getFullYear(), plannedDateTime.getMonth(), plannedDateTime.getDate(), hours, minutes);
        if (!isValidDate(plannedDateTime)) {
            setBoardCountError('Неверная дата/время в отправляемых данных');
            return;
        }

        // Валидация: нельзя бронировать на прошедшее время
        const now = new Date();
        if (plannedDateTime < now) {
            setNotification({ message: 'Нельзя бронировать на прошедшее время', type: 'error', isOpen: true });
            return;
        }

        // Дополнительная проверка доступности перед отправкой
        const finalEffectiveBoards = totalInventory > 0 ? totalInventory : totalBoards;
        const finalEffectiveSeats = totalInventory > 0 ? totalInventory : totalSeats;
        
        const finalAvailabilityInfo = getDetailedAvailabilityInfo(
            plannedDateTime,
            form.durationInHours,
            flatAllBookings,
            finalEffectiveBoards,
            finalEffectiveSeats,
            form.id
        );

        const finalNeededSeats = (form.boardWithSeatCount || 0) + (form.raftCount || 0) * 2;

        // Проверяем доступность плотов с детальной информацией
        const finalTotalRequestedRafts = getTotalSelectedInventory();
        const finalWarningMessage = generateInventoryWarningMessage(
            finalAvailabilityInfo,
            finalTotalRequestedRafts,
            form.serviceType
        );

        if (finalWarningMessage) {
            setNotification({ message: `Недостаточно инвентаря. ${finalWarningMessage}`, type: 'error', isOpen: true });
            return;
        }

        // Проверка кресел для досок с креслами
        if (finalNeededSeats > finalAvailabilityInfo.availableSeats) {
            setNotification({ message: `Недостаточно кресел. Доступно: ${Math.max(0, finalAvailabilityInfo.availableSeats)}`, type: 'error', isOpen: true });
            return;
        }

        const plannedStartTimeISO = formatISO(plannedDateTime);
        const plannedDateStr = formatDateFns(plannedDateTime, 'yyyy-MM-dd');

        const bookingToSave = {
            clientName: form.clientName,
            phone: form.phone,
            plannedStartTime: plannedStartTimeISO,
            serviceType: form.serviceType as ServiceTypeEnum,
            boardCount: form.boardCount,
            boardWithSeatCount: form.boardWithSeatCount,
            raftCount: form.raftCount,
            selectedItems: form.selectedItems, // Новая система инвентаря
            durationInHours: form.durationInHours,
            comment: form.comment,
            status: BookingStatus.BOOKED,
            date: plannedDateStr,
            ...(form.id && { id: form.id }),
            boardIds: [],
        };
        
        try {
            const resultAction = await dispatch(addBooking(bookingToSave) as any);
            if (addBooking.fulfilled.match(resultAction)) {
                await dispatch(fetchBookings());
                const now = new Date();
                const from = formatDateFns(now, 'yyyy-MM-dd');
                const to = formatDateFns(new Date(now.getFullYear(), now.getMonth() + 3, 0), 'yyyy-MM-dd');
                await dispatch(fetchFullyBookedDays({ from, to }));
                setSavedBookingInfo({
                    clientName: form.clientName,
                    plannedStartTime: plannedStartTimeISO,
                    time: form.plannedTime
                });
                setShowSuccess(true);
            } else if (
                addBooking.rejected.match(resultAction) &&
                resultAction.payload &&
                typeof resultAction.payload === 'object' &&
                'status' in resultAction.payload &&
                (resultAction.payload as any).status === 409
            ) {
                setNotification({ message: 'Все доски заняты на текущее время', type: 'error', isOpen: true });
            } else {
                setNotification({ message: 'Ошибка при создании бронирования', type: 'error', isOpen: true });
            }
        } catch (error: any) {
            setNotification({ message: 'Ошибка при создании бронирования', type: 'error', isOpen: true });
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !showSuccess) {
            onCancel();
        }
    };

    const handleSuccessOk = () => {
        setShowSuccess(false);
        if (onShowBookings && form.plannedDate) {
            onShowBookings(form.plannedDate);
        } else {
            onCancel();
        }
    };

    const handleCancel = () => {
        onCancel();
    };

    // Новые обработчики для функций сотрудников
    const handleClientSelect = (client: ClientSearchResult) => {
        setForm(prev => ({
            ...prev,
            clientName: client.name,
            phone: client.phone
        }));
        setSelectedClient(client);
    };

    const handleTimeSelect = (time: string) => {
        setForm(prev => ({ ...prev, plannedTime: time }));
    };

    const handleSuggestionSelect = (suggestion: any) => {
        setForm(prev => ({
            ...prev,
            boardCount: suggestion.boardCount,
            boardWithSeatCount: suggestion.boardWithSeatCount,
            raftCount: suggestion.raftCount
        }));
    };
    
    const formatDateForDisplay = (isoDate: string) => {
        try {
            return formatDateFns(parseISO(isoDate), 'd MMMM', { locale: ru });
        } catch {
            return 'Неверная дата';
        }
    };

    const availableBoards = useMemo(() => {
        if (!form.plannedDate || !form.plannedTime || !form.durationInHours) return [];
        const [hoursStr, minutesStr] = form.plannedTime.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        let requestedDate = parseISO(form.plannedDate);
        requestedDate = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), hours, minutes);
        return getAvailableBoardsForInterval(
            requestedDate,
            form.durationInHours,
            boards,
            flatAllBookings,
            boardBookings,
            form.id
        );
    }, [form.plannedDate, form.plannedTime, form.durationInHours, flatAllBookings, form.id, boards, boardBookings]);

    const availableInventory = useMemo(() => {
        if (!form.plannedDate || !form.plannedTime || !form.durationInHours) {
            return { board: 0, board_with_seat: 0, raft: 0 };
        }
        
        const [hoursStr, minutesStr] = form.plannedTime.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        let requestedDate = parseISO(form.plannedDate);
        requestedDate = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate(), hours, minutes);
        
        // Используем детальную информацию о доступности (ту же логику что и в предупреждениях)
        const availabilityInfo = getDetailedAvailabilityInfo(
            requestedDate,
            form.durationInHours,
            flatAllBookings,
            totalBoards,
            totalSeats,
            form.id
        );
        
        return {
            board: availabilityInfo.availableBoards,
            board_with_seat: Math.min(availabilityInfo.availableBoards, availabilityInfo.availableSeats),
            raft: Math.min(Math.floor(availabilityInfo.availableBoards / 2), Math.floor(availabilityInfo.availableSeats / 2)),
        };
    }, [form.plannedDate, form.plannedTime, form.durationInHours, flatAllBookings, totalBoards, totalSeats, form.id]);

    const isSaveDisabled = !!boardCountError || !form.clientName || !form.phone || !hasSelectedInventory() || !!inventoryError;

    // Если это десктоп, используем десктопную версию
    if (isDesktop) {
        return (
            <DesktopBookingForm
                initial={initial}
                onSave={onSave}
                onCancel={onCancel}
                isClosing={isClosing}
                onShowBookings={onShowBookings}
            />
        );
    }

    return (
        <ModalOverlay $isClosing={isClosing} onClick={handleOverlayClick}>
            <ModalContainer 
                $isClosing={isClosing} 
                id="bookingFormContainer"
            >
                <Form 
                    onSubmit={handleSubmit} 
                    id="bookingFormId"
                >
                    {!showSuccess ? (
                        <>
                            <FormTitle>
                                {form.id 
                                    ? `Редактирование: ${form.clientName}`
                                    : 'Новая запись'
                                }
                            </FormTitle>
                            <FormGroup>
                                <Label>👤 Клиент</Label>
                                <ClientAutocomplete
                                    value={form.clientName}
                                    onChange={(value) => setForm(prev => ({ ...prev, clientName: value }))}
                                    onClientSelect={handleClientSelect}
                                    placeholder="Начните вводить имя клиента..."
                                />
                                {selectedClient && (
                                    <div style={{ 
                                        marginTop: '8px', 
                                        padding: '8px 12px',
                                        backgroundColor: '#2C2C2E',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        color: '#86868B'
                                    }}>
                                        📊 {selectedClient.totalBookings} визитов
                                        {selectedClient.lastBookingDate && 
                                            ` • Последний: ${new Date(selectedClient.lastBookingDate).toLocaleDateString('ru-RU')}`
                                        }
                                        {selectedClient.isVIP && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '12px',
                                                backgroundColor: '#FFD600',
                                                color: '#000',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontWeight: 600
                                            }}>
                                                VIP
                                            </span>
                                        )}
                                    </div>
                                )}
                            </FormGroup>

                            <FormGroup>
                                <Label>📞 Телефон</Label>
                                <Input
                                    type="tel"
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                />
                            </FormGroup>

                            <FormGroup>
                                <Label>🏄‍♂️ Тип услуги</Label>
                                <Select
                                    name="serviceType"
                                    value={form.serviceType}
                                    onChange={handleChange}
                                >
                                    <option value={SERVICE_TYPES.RENT}>Аренда</option>
                                    <option value={SERVICE_TYPES.RAFTING}>Сплав</option>
                                </Select>
                            </FormGroup>

                            <FormGroup>
                                <Label>🛻 Инвентарь</Label>
                                {!hasSelectedInventory() ? (
                                    <button type="button" onClick={() => {
                                        // Инициализируем текущими значениями формы
                                        setTempSelectedItems({ ...form.selectedItems });
                                        setShowInventoryEditor(true);
                                    }} style={{
                                        background: '#23232a',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 12,
                                        padding: '12px 20px',
                                        fontSize: '1rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}>
                                        <img src={canoeIcon} alt="Инвентарь" style={{ width: 28, height: 28 }} />
                                        <span>Выберите инвентарь</span>
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                        {renderSelectedInventory()}
                                    </div>
                                )}
                                {inventoryError && <div style={{ color: 'red', fontSize: 13, marginTop: 6 }}>{inventoryError}</div>}
                                
                                {/* Умные предложения */}
                                <SmartSuggestions
                                    currentTime={new Date()}
                                    currentCounts={{
                                        boardCount: form.boardCount,
                                        boardWithSeatCount: form.boardWithSeatCount,
                                        raftCount: form.raftCount
                                    }}
                                    available={availableInventory}
                                    onSuggestionSelect={handleSuggestionSelect}
                                    isMobile={true}
                                    clientHistory={selectedClient ? {
                                        totalBookings: selectedClient.totalBookings,
                                        isVIP: selectedClient.isVIP,
                                        lastBookingDate: selectedClient.lastBookingDate
                                    } : undefined}
                                />
                            </FormGroup>

                            <FormGroup>
                                <Label>⏰ Время</Label>
                                <Input
                                    type="time"
                                    name="plannedTime"
                                    value={form.plannedTime}
                                    min={availableAfter || undefined}
                                    max={'23:00'}
                                    onChange={handleChange}
                                />
                                <QuickTimeSelector
                                    selectedTime={form.plannedTime}
                                    onTimeSelect={handleTimeSelect}
                                    selectedDate={form.plannedDate ? new Date(form.plannedDate + 'T00:00:00') : undefined}
                                    allBookings={flatAllBookings}
                                    totalInventory={totalInventory}
                                />
                                {isTimeTooEarly ? (
                                    <div style={{ color: '#FF4D4F', marginTop: 4, fontSize: 14 }}>
                                        В этот день запись возможна только после {availableAfter}
                                    </div>
                                ) : availableAfter && (
                                    <div style={{ color: '#FFD600', marginTop: 4, fontSize: 14 }}>
                                        В этот день запись возможна только после {availableAfter}
                                    </div>
                                )}
                                {/* Отображение предупреждений о доступности */}
                                {boardCountError && (
                                    <div style={{ 
                                        color: '#FF4D4F', 
                                        marginTop: 8, 
                                        fontSize: 14,
                                        padding: '8px 12px',
                                        backgroundColor: 'rgba(255, 77, 79, 0.1)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 77, 79, 0.2)'
                                    }}>
                                        ⚠️ {boardCountError}
                                    </div>
                                )}
                            </FormGroup>

                            {form.serviceType === SERVICE_TYPES.RENT && (
                                <FormGroup>
                                    <Label>📅 Кол-во суток</Label>
                                    <Input
                                        type="number"
                                        name="durationRentDays"
                                        min={1}
                                        value={form.durationRentDays}
                                        onChange={handleChange}
                                    />
                                </FormGroup>
                            )}
                            {form.serviceType === SERVICE_TYPES.RAFTING && (
                                <FormGroup>
                                    <Label>⏱️ Длительность</Label>
                                    <Input
                                        type="text"
                                        name="durationInHours"
                                        value="4 часа"
                                        readOnly 
                                        style={{ opacity: 0.7 }}
                                    />
                                </FormGroup>
                            )}

                            <FormGroup>
                                <Label>💬 Комментарий</Label>
                                <QuickComments
                                    value={form.comment}
                                    onChange={(value) => setForm(prev => ({ ...prev, comment: value }))}
                                />
                            </FormGroup>

                                        {/* Отображение расчета стоимости */}
            <PricingDisplay
                serviceType={form.serviceType}
                selectedItems={form.selectedItems || {}}
                durationInHours={form.durationInHours}
                isVIP={selectedClient?.isVIP}
                showSettings={true}
                boardCount={form.boardCount}
                boardWithSeatCount={form.boardWithSeatCount}
                raftCount={form.raftCount}
            />

                            <ButtonGroup>
                                <SecondaryButton type="button" onClick={handleCancel}>
                                    Отмена
                                </SecondaryButton>
                                <SaveButton 
                                    type="submit" 
                                    disabled={!!(isSaveDisabled || isTimeTooEarly)}
                                >
                                    💾 Сохранить
                                </SaveButton>
                            </ButtonGroup>
                        </>
                    ) : null}
                </Form>
                {showSuccess && savedBookingInfo && (
                    <SuccessOverlay $isVisible={showSuccess}>
                        <SuccessIcon>✓</SuccessIcon>
                        <SuccessMessage>
                            <>
                                Клиент {savedBookingInfo.clientName}<br />
                                успешно записан на {formatDateForDisplay(savedBookingInfo.plannedStartTime)}<br />
                                в {savedBookingInfo.time}
                            </>
                        </SuccessMessage>
                        <OkButton onClick={handleSuccessOk}>OK</OkButton>
                    </SuccessOverlay>
                )}
                {showInventoryEditor && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 2000,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }} onClick={() => setShowInventoryEditor(false)}>
                        <div style={{
                            background: '#23232a',
                            borderRadius: 16,
                            padding: 32,
                            minWidth: 320,
                            boxShadow: '0 4px 32px #0008',
                            position: 'relative',
                        }} onClick={e => e.stopPropagation()}>
                            <InventorySelector
                                selectedItems={tempSelectedItems}
                                onChange={setTempSelectedItems}
                                error={null}
                                plannedDate={form.plannedDate}
                                plannedTime={form.plannedTime}
                                durationInHours={form.durationInHours}
                                onClose={() => setShowInventoryEditor(false)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                                <button type="button" onClick={() => setShowInventoryEditor(false)} style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#86868B',
                                    fontSize: 16,
                                    cursor: 'pointer',
                                }}>Отмена</button>
                                <button type="button" onClick={() => {
                                    // Применяем новый формат инвентаря
                                    setForm(prev => ({ 
                                        ...prev, 
                                        selectedItems: { ...tempSelectedItems }
                                    }));
                                    setShowInventoryEditor(false);
                                }}
                                    disabled={Object.values(tempSelectedItems).reduce((sum, count) => sum + count, 0) <= 0}
                                    style={{
                                        background: '#007AFF',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 10,
                                        padding: '10px 28px',
                                        fontSize: 16,
                                        fontWeight: 600,
                                        cursor: Object.values(tempSelectedItems).reduce((sum, count) => sum + count, 0) <= 0 ? 'not-allowed' : 'pointer',
                                        opacity: Object.values(tempSelectedItems).reduce((sum, count) => sum + count, 0) <= 0 ? 0.5 : 1,
                                    }}
                                >ОК</button>
                            </div>
                        </div>
                    </div>
                )}

                <Notification
                    message={notification.message}
                    type={notification.type}
                    isOpen={notification.isOpen}
                    onClose={() => setNotification(n => ({ ...n, isOpen: false }))}
                />
            </ModalContainer>
        </ModalOverlay>
    );
};

export default BookingForm; 