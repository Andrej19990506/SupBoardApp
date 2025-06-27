import { useState, useCallback, useEffect } from 'react';
import type { FC } from 'react';
import { format, parseISO} from 'date-fns';
import { Provider } from 'react-redux';
import BookingCalendar from '@features/booking/components/BookingCalendar';
import BookingForm from '@features/booking/components/BookingForm/BookingForm';
import BookingsList from '@features/booking/components/BookingsList';
import MobileInventoryModal from '@features/booking/components/InventoryModal/MobileInventoryModal';
import DesktopInventoryModal from '@features/booking/components/InventoryModal/DesktopInventoryModal';
import { useAppDispatch, useAppSelector } from '@features/booking/store/hooks';
import {
    setSelectedDate,
    deleteBooking,
} from '@features/booking/store/slices/bookings-slice/bookingsSlice';
import { addBooking, updateBookingAsync } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchBookings } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import { fetchDaysAvailability } from '@features/booking/store/slices/bookings-slice/bookingsThunk';
import type { Booking } from '@/types/booking';
import type { RootState } from '@features/booking/store/types';
import '@/App.css';
import { ThemeProvider } from 'styled-components';
import { theme } from '@shared/styles/theme';
import { store } from '@features/booking/store';
import Loader from '@shared/components/Layout/Loader';
import Notification from '@shared/components/Layout/Notification';
import BookingStatusManager from '@features/booking/components/BookingsList/BookingStatusManager';
import NotificationSound from '@features/booking/components/BookingsList/NotificationSound';
import AutoStatusTransition from '@features/booking/components/BookingsList/AutoStatusTransition';
import AutoConfirmationChecker from '@features/booking/components/BookingsList/AutoConfirmationChecker';
import { NotificationTooltipGlobal } from '@features/booking/components/NotificationBell/NotificationBell';
import { WeatherTooltipGlobal } from '@features/booking/components/BookingCalendar/components/WeatherWidget';
import AuthGuard from '@features/auth/components/AuthGuard';
import { ProfileDropdownProvider } from '@features/auth/contexts/ProfileDropdownContext';
import ProfileDropdownGlobal from '@features/auth/components/ProfileDropdownGlobal';
import pushNotificationService from '@features/booking/services/pushNotificationService';
import { useSessionWatcher } from '@features/auth/hooks/useSessionWatcher';
import { useDevice } from '@shared/hooks/useDevice';

// Helper для извлечения даты из ISO строки
const extractDateFromISO = (isoString?: string): string => {
    if (!isoString) return format(new Date(), 'yyyy-MM-dd');
    try {
        return format(parseISO(isoString), 'yyyy-MM-dd');
    } catch {
        return format(new Date(), 'yyyy-MM-dd');
    }
};

const AppContent: FC = () => {
    console.log('[App] AppContent rendered - NEW BUILD 2025-06-23');
    const dispatch = useAppDispatch();
    console.log('[App] dispatch created:', { dispatch, hasDispatch: !!dispatch });
    const bookings = useAppSelector((state: RootState) => state.bookings.bookings);
    const selectedDate = useAppSelector((state: RootState) => state.bookings.selectedDate);
    const { isMobile } = useDevice();

    // Автоматическое отслеживание валидности сессии
    useSessionWatcher();
    

    
    const [formOpen, setFormOpen] = useState(false);
    const [listOpen, setListOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [formInitial, setFormInitial] = useState< (Partial<Booking> & { date?: string }) | undefined >(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [notification, setNotification] = useState<{message: string, type?: 'success' | 'error' | 'info', isOpen: boolean}>({ message: '', type: 'info', isOpen: false });

    // Загружаем доски, кресла и бронирования при инициализации приложения
    useEffect(() => {
        console.log('[App] useEffect triggered - Starting API requests...');
        
        const loadInitialData = async () => {
            try {
                await Promise.all([
                    dispatch(fetchBookings()).unwrap()
                ]);
                
                // Загрузка полностью и частично занятых дней на 3 месяца вперёд
                const now = new Date();
                const from = format(now, 'yyyy-MM-dd');
                const to = format(new Date(now.getFullYear(), now.getMonth() + 3, 0), 'yyyy-MM-dd');
                await dispatch(fetchDaysAvailability({ from, to })).unwrap();
                
                console.log('[App] All initial data loaded successfully');
                
                // Инициализируем push-уведомления после загрузки основных данных
                try {
                    console.log('[App] Initializing push notifications...');
                    const pushInitialized = await pushNotificationService.initialize();
                    console.log('[App] Push notifications initialized:', pushInitialized);
                } catch (pushError) {
                    console.warn('[App] Push notifications initialization failed:', pushError);
                }
                
            } catch (error) {
                console.error('[App] Failed to load initial data:', error);
            }
        };
        
        loadInitialData();
    }, []); // Убираем dispatch из зависимостей

    // Эмуляция загрузки приложения
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Блокировка скролла при открытых модальных окнах
    useEffect(() => {
        const isModalOpen = formOpen || listOpen || inventoryOpen;
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        };
    }, [formOpen, listOpen, inventoryOpen]);

    const formatDateToString = (date: Date): string => {
        return format(date, 'yyyy-MM-dd');
    };

    const handleDayClick = (date: Date) => {
        const dateStr = formatDateToString(date);
        const dayBookings = bookings[dateStr] || [];
        
        dispatch(setSelectedDate(dateStr));
        setIsClosing(false);
        setFormOpen(false);
        setListOpen(false);

        if (dayBookings.length > 0) {
            setListOpen(true);
        } else {
            setFormOpen(true);
            setFormInitial({ date: dateStr });
        }
    };

    const handleAddBooking = () => {
        if (selectedDate) {
            setFormInitial({ date: selectedDate });
            setListOpen(false);
            setFormOpen(true);
            setIsClosing(false);
        }
    };

    const handleEditBooking = (booking: Booking) => {
        setFormInitial({ ...booking, date: extractDateFromISO(booking.plannedStartTime) });
        setListOpen(false);
        setFormOpen(true);
        setIsClosing(false);
    };

    const handleSaveBooking = async (bookingData: Omit<Booking, 'id' | 'status' | 'actualStartTime' | 'timeReturnedByClient'> & Partial<Pick<Booking, 'id' | 'comment'>>) => {
        try {
            if (bookingData.id) {
                const updatePayload: Partial<Booking> = {
                    plannedStartTime: bookingData.plannedStartTime,
                    durationInHours: bookingData.durationInHours,
                    serviceType: bookingData.serviceType,
                    boardCount: bookingData.boardCount,
                    boardWithSeatCount: bookingData.boardWithSeatCount,
                    raftCount: bookingData.raftCount,
                    clientName: bookingData.clientName,
                    phone: bookingData.phone,
                    comment: bookingData.comment,
                };
                await dispatch(updateBookingAsync({ id: Number(bookingData.id), booking: updatePayload })).unwrap();
                setNotification({ message: 'Бронирование успешно обновлено!', type: 'success', isOpen: true });
            } else {
                await dispatch(addBooking(bookingData)).unwrap();
                setNotification({ message: 'Бронирование успешно создано!', type: 'success', isOpen: true });
            }
            
            // Обновляем доступность дней после создания/обновления
            const now = new Date();
            const from = format(now, 'yyyy-MM-dd');
            const to = format(new Date(now.getFullYear(), now.getMonth() + 3, 0), 'yyyy-MM-dd');
            dispatch(fetchDaysAvailability({ from, to }));
            
            // Закрываем форму после успешного сохранения
            handleCloseForm();
        } catch (error: any) {
            console.error('Ошибка сохранения бронирования:', error);
            setNotification({ 
                message: error.message || 'Ошибка сохранения бронирования', 
                type: 'error', 
                isOpen: true 
            });
        }
    };

    const handleDeleteBooking = (booking: Booking) => {
        const dateForDelete = extractDateFromISO(booking.plannedStartTime);
        dispatch(deleteBooking({ bookingId: booking.id, date: dateForDelete }));
    };

    const handleCloseForm = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setFormOpen(false);
            setListOpen(false);
            setFormInitial(undefined);
            dispatch(setSelectedDate(null));
            setIsClosing(false);
        }, 300);
    }, [dispatch]);

    const handleShowBookings = (date: string) => {
        setFormOpen(false);
        setListOpen(true);
        dispatch(setSelectedDate(date));
    };

    const handleStatusUpdate = (bookingId: string, newStatus: string) => {
        console.log(`Статус бронирования ${bookingId} изменен на ${newStatus}`);
        setNotification({ 
            message: `Статус бронирования изменен на ${newStatus}`, 
            type: 'success', 
            isOpen: true 
        });
    };

    // Получаем все бронирования для StatusManager
    const allBookings = Object.values(bookings).flat();

    if (isLoading) {
        return <Loader isVisible={true} />;
    }

    return (
        <>
            <Notification
                message={notification.message}
                type={notification.type}
                isOpen={notification.isOpen}
                onClose={() => setNotification(n => ({ ...n, isOpen: false }))}
            />
            <Loader isVisible={isLoading} />
            <BookingStatusManager 
                bookings={allBookings} 
                onStatusUpdate={handleStatusUpdate}
            />
            <NotificationSound bookings={allBookings} enabled={true} />
            <AutoStatusTransition 
                bookings={allBookings}
                enabled={true}
                onStatusChanged={handleStatusUpdate}
            />
            <AutoConfirmationChecker 
                bookings={allBookings}
                enabled={true}
                checkIntervalMinutes={5}
                confirmationTimeMinutes={60}
            />
            {/* Глобальные тултипы - рендерятся поверх всех компонентов */}
            <NotificationTooltipGlobal />
            <WeatherTooltipGlobal />
            <ProfileDropdownGlobal />
              
              {!isLoading && (
                <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6">
                    <BookingCalendar
                        bookings={bookings}
                        onAddBooking={handleDayClick}
                        onEditBooking={handleEditBooking}
                        onInventoryClick={() => setInventoryOpen(true)}
                        onGalleryClick={() => {
                            // Можно добавить галерею позже
                            console.log('Gallery clicked');
                        }}
                    />
                    {formOpen && selectedDate && (
                        <BookingForm
                            initial={formInitial}
                            onSave={handleSaveBooking}
                            onCancel={handleCloseForm}
                            isClosing={isClosing}
                            onShowBookings={handleShowBookings}
                            onOpenInventory={() => {
                                setFormOpen(false);
                                setInventoryOpen(true);
                            }}
                        />
                    )}
                    {listOpen && selectedDate && (
                        <BookingsList
                            date={new Date(selectedDate)}
                            bookings={bookings[selectedDate] || []}
                            onAddBooking={handleAddBooking}
                            onEditBooking={handleEditBooking}
                            onDeleteBooking={handleDeleteBooking}
                            onClose={handleCloseForm}
                            isClosing={isClosing}
                        />
                    )}
                    {inventoryOpen && (
                        <>
                            {isMobile ? (
                                <MobileInventoryModal
                                    isOpen={inventoryOpen}
                                    onClose={() => setInventoryOpen(false)}
                                />
                            ) : (
                                <DesktopInventoryModal
                                    isOpen={inventoryOpen}
                                    onClose={() => setInventoryOpen(false)}
                                />
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
};

const App: FC = () => {
    return (
        <ThemeProvider theme={theme}>
            <Provider store={store}>
                <ProfileDropdownProvider>
            <AuthGuard>
                <AppContent />
            </AuthGuard>
                </ProfileDropdownProvider>
            </Provider>
        </ThemeProvider>
    );
};

export default App;
