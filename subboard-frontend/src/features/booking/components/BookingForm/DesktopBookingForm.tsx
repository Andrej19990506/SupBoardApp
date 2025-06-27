import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { formatISO, parseISO, format as formatDateFns, isValid as isValidDate } from 'date-fns';
import type { Booking, ServiceType as ServiceTypeEnum } from '@/types/booking';
import { BookingStatus } from '@/types/booking';
import { SERVICE_TYPES } from '@features/booking/constants/constants';
import { useAppSelector, useAppDispatch } from '@features/booking/store/hooks';
import { getAvailableBoardsCount, getAvailableBoardsForInterval, getAvailableSeatsCount, getDetailedAvailabilityInfo, generateInventoryWarningMessage } from '@features/booking/utils/bookingUtils';
import type { RootState } from '@features/booking/store';
import { addBooking, updateBookingAsync, fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
// import { fetchBoards } from '@features/booking/store/slices/board-slice/boardThunk'; // Больше не используется
import { fetchBoardBookings } from '@features/booking/store/slices/board-bookings/boardBookingsThunks';
import { fetchFullyBookedDays } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import React from 'react';
import canoeIcon from '@/assets/canoe.png';
import seatIcon from '@/assets/seat.png';
import skiIcon from '@/assets/ski.png';
import InventorySelector from '@features/booking/components/BookingForm/InventorySelector';
import { inventoryApi, type InventoryType } from '@/features/booking/services/inventoryApi';
import Notification from '@shared/components/Layout/Notification';
import { selectBoardBookings } from '@features/booking/store/slices/board-bookings/boardBookingsSelectors';

// Новые компоненты для улучшения UX сотрудников
import ClientAutocomplete from './ClientAutocomplete';
import PricingDisplay from './PricingDisplay';
import QuickTimeSelector from './QuickTimeSelector';
import QuickComments from './QuickComments';
import SmartSuggestions from './SmartSuggestions';
import type { ClientSearchResult } from './types';
import { useDevice } from '@shared/hooks/useDevice';
import { useInventoryTotal } from './hooks/useInventoryTotal';

interface DesktopBookingFormProps {
    initial?: Partial<Booking> & { date?: string };
    onSave: (bookingData: Omit<Booking, 'id' | 'status' | 'actualStartTime' | 'timeReturnedByClient'> & Partial<Pick<Booking, 'id' | 'comment'>>) => void;
    onCancel: () => void;
    isClosing: boolean;
    onShowBookings?: (date: string) => void;
    onOpenInventory?: () => void;
}

const getInitialFormState = (initial: DesktopBookingFormProps['initial']) => {
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
        // Старые поля для совместимости (постепенно удаляем)
        boardCount: initial?.boardCount ?? 0,
        boardWithSeatCount: initial?.boardWithSeatCount ?? 0,
        raftCount: initial?.raftCount ?? 0,
        durationRentDays: isRent ? initialDurationInHours / 24 : 1,
        durationInHours: initialDurationInHours,
        comment: initial?.comment ?? '',
    };
};

const DesktopBookingForm: FC<DesktopBookingFormProps> = ({ 
    initial = {}, 
    onSave,
    onCancel, 
    isClosing,
    onShowBookings,
}) => {
    const [form, setForm] = useState(() => getInitialFormState(initial));
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
    const { isDesktop } = useDevice();
    
    // Новая система инвентаря
    const { totalInventory, loading: inventoryLoading } = useInventoryTotal();
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    
    console.log('[DesktopBookingForm] Inventory state:', {
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
    
    console.log('[DESKTOP DEBUG] Component loaded, isDesktop:', isDesktop);

    const flatAllBookings = useMemo(() => Object.values(bookingsMap || {}).flat() as Booking[], [bookingsMap]);
    
    // Временно используем старую логику для отображения
    const hasSelectedInventory = () => {
        return form.boardCount + form.boardWithSeatCount + form.raftCount > 0 || 
               Object.keys(form.selectedItems || {}).length > 0;
    };

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

    // Определяем частично занятый день
    const partialDay = partiallyBookedDays.find(d => d.date === form.plannedDate);
    const availableAfter = partialDay ? partialDay.available_after : null;

    // Автоматическая подстановка времени для частично занятого дня
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

    // Проверка доступности и конфликтов
    useEffect(() => {
        const calculateAvailability = () => {
            console.log('[DESKTOP DEBUG] calculateAvailability called', {
                plannedDate: form.plannedDate,
                plannedTime: form.plannedTime,
                durationInHours: form.durationInHours,
                raftCount: form.raftCount,
                serviceType: form.serviceType
            });

            if (!form.plannedDate || !form.plannedTime || !form.durationInHours) {
                console.log('[DESKTOP DEBUG] Early return - missing data');
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
                    setBoardCountError('Неверная дата или время'); 
                    return;
                }

                // Получаем детальную информацию о доступности
                // В новой системе инвентаря нет разделения на "доски" и "кресла"
                // Все единицы инвентаря равнозначны и лимитируют доступность
                const effectiveInventory = totalInventory > 0 ? totalInventory : Math.max(totalBoards, 12);
                
                const availabilityInfo = getDetailedAvailabilityInfo(
                    requestedDate,
                    form.durationInHours,
                    flatAllBookings,
                    effectiveInventory, // Используем общий инвентарь как лимит досок
                    effectiveInventory, // И как лимит кресел (для совместимости со старой логикой)
                    form.id
                );

                // В новой системе мы не считаем "кресла" отдельно
                // Общее количество выбранного инвентаря определяет лимит
                const totalSelectedInventory = getTotalSelectedInventory();

                // Генерируем информативное предупреждение с учетом новой системы
                let warningMessage = '';
                
                if (totalSelectedInventory > 0) {
                    // Проверяем хватает ли инвентаря для выбранного количества
                    if (totalSelectedInventory > availabilityInfo.availableBoards) {
                        const available = Math.max(0, availabilityInfo.availableBoards);
                        warningMessage = `Недостаточно инвентаря. Доступно: ${available} из ${effectiveInventory} единиц`;
                        
                        if (availabilityInfo.worstPeriod) {
                            const timeStr = availabilityInfo.worstPeriod.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                            warningMessage += ` (пик загрузки в ${timeStr})`;
                        }
                    }
                } else {
                    // Показываем общую информацию о доступности
                    const available = Math.max(0, availabilityInfo.availableBoards);
                    if (available < effectiveInventory) {
                        warningMessage = `Доступно: ${available} из ${effectiveInventory} единиц инвентаря`;
                        
                        if (availabilityInfo.worstPeriod) {
                            const timeStr = availabilityInfo.worstPeriod.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                            warningMessage += ` (пик загрузки в ${timeStr})`;
                        }
                    }
                }

                console.log('[DESKTOP DEBUG]', {
                    time: form.plannedTime,
                    availableBoards: availabilityInfo.availableBoards,
                    availableSeats: availabilityInfo.availableSeats,
                    raftCount: form.raftCount,
                    serviceType: form.serviceType,
                    warningMessage,
                    worstPeriod: availabilityInfo.worstPeriod
                });

                if (warningMessage) {
                    setBoardCountError(warningMessage);
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
        const finalEffectiveInventory = totalInventory > 0 ? totalInventory : Math.max(totalBoards, 12);
        
        const finalAvailabilityInfo = getDetailedAvailabilityInfo(
            plannedDateTime,
            form.durationInHours,
            flatAllBookings,
            finalEffectiveInventory,
            finalEffectiveInventory,
            form.id
        );

        // В новой системе проверяем общее количество выбранного инвентаря
        const finalTotalSelectedInventory = getTotalSelectedInventory();

        // Проверяем доступность инвентаря с новой системой
        if (finalTotalSelectedInventory > finalAvailabilityInfo.availableBoards) {
            const available = Math.max(0, finalAvailabilityInfo.availableBoards);
            setNotification({ 
                message: `Недостаточно инвентаря. Доступно: ${available} из ${finalEffectiveInventory} единиц`, 
                type: 'error', 
                isOpen: true 
            });
            return;
        }
        
        // Дополнительная проверка: если доступно 0 единиц инвентаря, но пытаемся забронировать
        if (finalAvailabilityInfo.availableBoards <= 0 && finalTotalSelectedInventory > 0) {
            setNotification({ message: 'Нет доступного инвентаря на выбранное время', type: 'error', isOpen: true });
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
            let resultAction;
            if (form.id) {
                // Обновление существующего бронирования
                resultAction = await dispatch(updateBookingAsync({ 
                    id: Number(form.id), 
                    booking: bookingToSave 
                }) as any);
            } else {
                // Создание нового бронирования
                resultAction = await dispatch(addBooking(bookingToSave) as any);
            }
            
            if (addBooking.fulfilled.match(resultAction) || updateBookingAsync.fulfilled.match(resultAction)) {
                // Обновляем данные после успешного сохранения
                await dispatch(fetchBookings());
                // await dispatch(fetchBoards()); // Больше не используется - используем новую систему инвентаря
                // Больше не загружаем board_bookings - используем новую систему инвентаря
                // await dispatch(fetchBoardBookings());
                
                // Обновляем полностью занятые дни
                const now = new Date();
                const from = formatDateFns(now, 'yyyy-MM-dd');
                const to = formatDateFns(new Date(now.getFullYear(), now.getMonth() + 3, 0), 'yyyy-MM-dd');
                await dispatch(fetchFullyBookedDays({ from, to }));
                
                setNotification({ 
                    message: form.id ? 'Бронирование успешно обновлено!' : 'Бронирование успешно создано!', 
                    type: 'success', 
                    isOpen: true 
                });
                
                // Закрываем форму после небольшой задержки
                setTimeout(() => {
                    onCancel();
                }, 1500);
                
            } else if (
                (addBooking.rejected.match(resultAction) || updateBookingAsync.rejected.match(resultAction)) &&
                resultAction.payload &&
                typeof resultAction.payload === 'object' &&
                'status' in resultAction.payload &&
                (resultAction.payload as any).status === 409
            ) {
                setNotification({ 
                    message: 'Недостаточно инвентаря на выбранное время', 
                    type: 'error', 
                    isOpen: true 
                });
            } else {
                setNotification({ 
                    message: form.id ? 'Ошибка при обновлении бронирования' : 'Ошибка при создании бронирования', 
                    type: 'error', 
                    isOpen: true 
                });
            }
        } catch (error: any) {
            console.error('Error saving booking:', error);
            setNotification({ 
                message: form.id ? 'Ошибка при обновлении бронирования' : 'Ошибка при создании бронирования', 
                type: 'error', 
                isOpen: true 
            });
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
    


    // Десктопная версия формы
    if (isDesktop) {
        return (
            <>
                <style>
                    {`
                        .custom-scrollbar-left::-webkit-scrollbar,
                        .custom-scrollbar-right::-webkit-scrollbar {
                            width: 8px;
                        }
                        
                        .custom-scrollbar-left::-webkit-scrollbar-track {
                            background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%);
                            border-radius: 4px;
                            border-right: 1px solid #3C3C3E;
                        }
                        
                        .custom-scrollbar-right::-webkit-scrollbar-track {
                            background: linear-gradient(135deg, #2C2C2E 0%, #1C1C1E 100%);
                            border-radius: 4px;
                            border-left: 1px solid #3C3C3E;
                        }
                        
                        .custom-scrollbar-left::-webkit-scrollbar-thumb {
                            background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
                            border-radius: 4px;
                            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
                            border: 1px solid rgba(0, 122, 255, 0.3);
                        }
                        
                        .custom-scrollbar-right::-webkit-scrollbar-thumb {
                            background: linear-gradient(135deg, #52C41A 0%, #389E0D 100%);
                            border-radius: 4px;
                            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
                            border: 1px solid rgba(82, 196, 26, 0.3);
                        }
                        
                        .custom-scrollbar-left::-webkit-scrollbar-thumb:hover {
                            background: linear-gradient(135deg, #0056CC 0%, #003D99 100%);
                            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 8px rgba(0, 122, 255, 0.3);
                        }
                        
                        .custom-scrollbar-right::-webkit-scrollbar-thumb:hover {
                            background: linear-gradient(135deg, #389E0D 0%, #237804 100%);
                            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 8px rgba(82, 196, 26, 0.3);
                        }
                        
                        .custom-scrollbar-left::-webkit-scrollbar-corner,
                        .custom-scrollbar-right::-webkit-scrollbar-corner {
                            background: transparent;
                        }
                    `}
                </style>
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1000,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    opacity: isClosing ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                }}>
                <div style={{
                    background: '#1C1C1E',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '1000px',
                    height: '85vh',
                    display: 'grid',
                    gridTemplateColumns: '1fr 350px',
                    gap: '24px',
                    padding: '24px',
                    position: 'relative',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    transform: isClosing ? 'scale(0.95)' : 'scale(1)',
                    transition: 'transform 0.3s ease',
                    overflow: 'hidden'
                }}>
                    {/* Кнопка закрытия */}
                    <button
                        onClick={handleCancel}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: 'none',
                            background: '#2C2C2E',
                            color: '#86868B',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            transition: 'all 0.2s ease',
                            zIndex: 10
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.background = '#FF4D4F';
                            (e.target as HTMLButtonElement).style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.background = '#2C2C2E';
                            (e.target as HTMLButtonElement).style.color = '#86868B';
                        }}
                    >
                        ✕
                    </button>

                    {/* Левая колонка - Основная форма */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        overflowY: 'auto',
                        height: '100%',
                        paddingRight: '12px',
                        borderRight: '1px solid #2C2C2E',
                        position: 'relative'
                    }}
                    className="custom-scrollbar-left"
                    >
                        {/* Заголовок */}
                        <div style={{
                            borderBottom: '1px solid #2C2C2E',
                            paddingBottom: '12px',
                            flexShrink: 0
                        }}>
                            <h2 style={{
                                color: '#fff',
                                fontSize: '20px',
                                fontWeight: 600,
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                📝 {form.id ? 'Редактирование записи' : 'Новая запись'}
                            </h2>
                            {form.id && (
                                <p style={{
                                    color: '#86868B',
                                    fontSize: '16px',
                                    margin: '8px 0 0 0'
                                }}>
                                    {form.clientName}
                                </p>
                            )}
                        </div>

                        {/* Клиент */}
                        <div>
                            <label style={{
                                color: '#86868B',
                                fontSize: '14px',
                                fontWeight: 500,
                                marginBottom: '8px',
                                display: 'block'
                            }}>
                                👤 Клиент
                            </label>
                            <ClientAutocomplete
                                value={form.clientName}
                                onChange={(value) => setForm(prev => ({ ...prev, clientName: value }))}
                                onClientSelect={handleClientSelect}
                                placeholder="Начните вводить имя клиента..."
                            />
                            {selectedClient && (
                                <div style={{ 
                                    marginTop: '8px', 
                                    padding: '12px',
                                    backgroundColor: '#2C2C2E',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ fontSize: '14px', color: '#86868B' }}>
                                        📊 {selectedClient.totalBookings} визитов
                                        {selectedClient.lastBookingDate && 
                                            ` • Последний: ${new Date(selectedClient.lastBookingDate).toLocaleDateString('ru-RU')}`
                                        }
                                    </div>
                                    {selectedClient.isVIP && (
                                        <span style={{
                                            fontSize: '12px',
                                            backgroundColor: '#FFD600',
                                            color: '#000',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontWeight: 600
                                        }}>
                                            VIP
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Телефон */}
                        <div>
                            <label style={{
                                color: '#86868B',
                                fontSize: '14px',
                                fontWeight: 500,
                                marginBottom: '8px',
                                display: 'block'
                            }}>
                                📞 Телефон
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    backgroundColor: '#2C2C2E',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '15px',
                                    outline: 'none',
                                    transition: 'background-color 0.2s ease',
                                }}
                                onFocus={(e) => {
                                    e.target.style.backgroundColor = '#3C3C3E';
                                }}
                                onBlur={(e) => {
                                    e.target.style.backgroundColor = '#2C2C2E';
                                }}
                            />
                        </div>

                        {/* Сетка для Тип услуги и Время */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px'
                        }}>
                            {/* Тип услуги */}
                            <div>
                                <label style={{
                                    color: '#86868B',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    marginBottom: '8px',
                                    display: 'block'
                                }}>
                                    🏄‍♂️ Тип услуги
                                </label>
                                <select
                                    name="serviceType"
                                    value={form.serviceType}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        backgroundColor: '#2C2C2E',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '15px',
                                        outline: 'none',
                                        appearance: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value={SERVICE_TYPES.RENT}>Аренда</option>
                                    <option value={SERVICE_TYPES.RAFTING}>Сплав</option>
                                </select>
                            </div>

                            {/* Время */}
                            <div>
                                <label style={{
                                    color: '#86868B',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    marginBottom: '8px',
                                    display: 'block'
                                }}>
                                    ⏰ Время
                                </label>
                                <input
                                    type="time"
                                    name="plannedTime"
                                    value={form.plannedTime}
                                                                            min={availableAfter || undefined}
                                    max={'23:00'}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        backgroundColor: '#2C2C2E',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '15px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Быстрый выбор времени */}
                        <QuickTimeSelector
                            selectedTime={form.plannedTime}
                            onTimeSelect={handleTimeSelect}
                            selectedDate={form.plannedDate ? new Date(form.plannedDate + 'T00:00:00') : undefined}
                            allBookings={flatAllBookings}
                            totalInventory={totalInventory}
                        />

                        {/* Инвентарь - компактная версия */}
                        <div>
                            <label style={{
                                color: '#86868B',
                                fontSize: '14px',
                                fontWeight: 500,
                                marginBottom: '8px',
                                display: 'block'
                            }}>
                                🛻 Инвентарь
                            </label>
                            {!hasSelectedInventory() ? (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                // Инициализируем текущими значениями формы
                                setTempSelectedItems({ ...form.selectedItems });
                                setShowInventoryEditor(true);
                            }} 
                                    style={{
                                        width: '100%',
                                        background: '#2C2C2E',
                                        color: '#fff',
                                        border: '1px dashed #007AFF',
                                        borderRadius: '10px',
                                        padding: '12px',
                                        fontSize: '15px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF20';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#2C2C2E';
                                    }}
                                >
                                    <img src={canoeIcon} alt="Инвентарь" style={{ width: 32, height: 32 }} />
                                    <span>Выберите инвентарь</span>
                                </button>
                            ) : (
                                <div style={{
                                    background: '#2C2C2E',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    {renderSelectedInventory()}
                                </div>
                            )}
                            {inventoryError && (
                                <div style={{ color: '#FF4D4F', fontSize: '14px', marginTop: '8px' }}>
                                    {inventoryError}
                                </div>
                            )}
                            
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
                                isMobile={false}
                                clientHistory={selectedClient ? {
                                    totalBookings: selectedClient.totalBookings,
                                    isVIP: selectedClient.isVIP,
                                    lastBookingDate: selectedClient.lastBookingDate
                                } : undefined}
                            />
                        </div>

                        {/* Длительность */}
                        {form.serviceType === SERVICE_TYPES.RENT && (
                            <div>
                                <label style={{
                                    color: '#86868B',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    marginBottom: '8px',
                                    display: 'block'
                                }}>
                                    📅 Кол-во суток
                                </label>
                                <input
                                    type="number"
                                    name="durationRentDays"
                                    min={1}
                                    value={form.durationRentDays}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        backgroundColor: '#2C2C2E',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '15px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        )}

                        {form.serviceType === SERVICE_TYPES.RAFTING && (
                            <div>
                                <label style={{
                                    color: '#86868B',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    marginBottom: '8px',
                                    display: 'block'
                                }}>
                                    ⏱️ Длительность
                                </label>
                                <input
                                    type="text"
                                    value="4 часа"
                                    readOnly 
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        backgroundColor: '#2C2C2E',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '15px',
                                        outline: 'none',
                                        opacity: 0.7
                                    }}
                                />
                            </div>
                        )}

                        {/* Комментарий */}
                        <div>
                            <label style={{
                                color: '#86868B',
                                fontSize: '14px',
                                fontWeight: 500,
                                marginBottom: '8px',
                                display: 'block'
                            }}>
                                💬 Комментарий
                            </label>
                            <QuickComments
                                value={form.comment}
                                onChange={(value) => setForm(prev => ({ ...prev, comment: value }))}
                            />
                        </div>

                        {/* Кнопки */}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '16px',
                            flexShrink: 0
                        }}>
                            <button
                                type="button"
                                onClick={handleCancel}
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    backgroundColor: '#2C2C2E',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#86868B',
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    (e.target as HTMLButtonElement).style.backgroundColor = '#3C3C3E';
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLButtonElement).style.backgroundColor = '#2C2C2E';
                                }}
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                disabled={!!(isSaveDisabled || isTimeTooEarly)}
                                style={{
                                    flex: 2,
                                    padding: '12px 20px',
                                    backgroundColor: isSaveDisabled || isTimeTooEarly ? '#3C3C3E' : '#007AFF',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    cursor: isSaveDisabled || isTimeTooEarly ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: isSaveDisabled || isTimeTooEarly ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSaveDisabled && !isTimeTooEarly) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#0056CC';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSaveDisabled && !isTimeTooEarly) {
                                        (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF';
                                    }
                                }}
                            >
                                💾 Сохранить
                            </button>
                        </div>
                    </div>

                    {/* Правая колонка - Расчет стоимости и дополнительная информация */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        overflowY: 'auto',
                        height: '100%',
                        paddingLeft: '16px',
                        position: 'relative'
                    }}
                    className="custom-scrollbar-right"
                    >
                        {/* Расчет стоимости */}
                        <PricingDisplay
                            serviceType={form.serviceType}
                            selectedItems={form.selectedItems || {}}
                            durationInHours={form.durationInHours}
                            isVIP={selectedClient?.isVIP}
                            showSettings={true}
                            // Устаревшие поля для обратной совместимости
                            boardCount={form.boardCount}
                            boardWithSeatCount={form.boardWithSeatCount}
                            raftCount={form.raftCount}
                        />

                        {/* Предупреждения */}
                        {(boardCountError || isTimeTooEarly) && (
                            <div style={{
                                background: '#FF4D4F20',
                                borderRadius: '12px',
                                padding: '16px',
                                border: '1px solid #FF4D4F'
                            }}>
                                <div style={{ 
                                    fontSize: '16px', 
                                    fontWeight: 600, 
                                    color: '#FF4D4F',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    ⚠️ Предупреждение
                                </div>
                                {boardCountError && (
                                    <div style={{ fontSize: '14px', color: '#fff', marginBottom: '4px' }}>
                                        • {boardCountError}
                                    </div>
                                )}
                                {isTimeTooEarly && availableAfter && (
                                    <div style={{ fontSize: '14px', color: '#fff' }}>
                                        • В этот день запись возможна только после {availableAfter}
                                    </div>
                                )}
                            </div>
                        )}


                    </div>
                </div>

                {/* Модалы и уведомления */}
                {showInventoryEditor && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 2000,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }} onClick={() => setShowInventoryEditor(false)}>
                        <div style={{
                            background: '#1C1C1E',
                            borderRadius: 16,
                            padding: 32,
                            minWidth: 400,
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
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
                                    padding: '8px 16px'
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
                                        padding: '12px 24px',
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
            </div>
            </>
        );
    }

    // Если не десктоп, возвращаем null (будет использоваться обычная форма)
    return null;
};

export default DesktopBookingForm; 