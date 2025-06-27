import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
    BookingsState,
    Booking,
    CreateBookingPayload,
    UpdateBookingPayload,
    DeleteBookingPayload
} from '@/types/booking';
import { fetchBookings, addBooking, updateBookingAsync } from './bookingsThunk';
import { fetchFullyBookedDays } from './bookingsThunk';
import { fetchDaysAvailability } from './bookingsThunk';

const initialState: BookingsState & { selectedBooking: Booking | null, fullyBookedDays?: string[], partiallyBookedDays?: {date: string, available_after: string}[] } = {
    bookings: {},
    selectedDate: null,
    isLoading: false,
    error: null,
    selectedBooking: null,
    fullyBookedDays: [],
    partiallyBookedDays: [],
};

const bookingsSlice = createSlice({
    name: 'bookings',
    initialState,
    reducers: {
        setSelectedDate: (state, action: PayloadAction<string | null>) => {
            state.selectedDate = action.payload;
        },
        setFullyBookedDays: (state, action: PayloadAction<string[]>) => {
            state.fullyBookedDays = action.payload;
        },
        setPartiallyBookedDays: (state, action: PayloadAction<{date: string, available_after: string}[]>) => {
            state.partiallyBookedDays = action.payload;
        },
        createBooking: (state, action: PayloadAction<CreateBookingPayload>) => {
            const { booking } = action.payload;
            const dateKey = booking.plannedStartTime.slice(0, 10);
            if (!state.bookings[dateKey]) {
                state.bookings[dateKey] = [];
            }
            state.bookings[dateKey].push({
                ...booking,
                id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                status: 'booked',
            } as Booking);
        },
        updateBooking: (state, action: PayloadAction<UpdateBookingPayload>) => {
            const { booking } = action.payload;
            let dateKey = '';
            if ('plannedStartTime' in booking && booking.plannedStartTime) {
                dateKey = booking.plannedStartTime.slice(0, 10);
            } else {
                for (const key in state.bookings) {
                    if (state.bookings[key].some((b: Booking) => b.id === booking.id)) {
                        dateKey = key;
                        break;
                    }
                }
            }
            if (!dateKey || !state.bookings[dateKey]) {
                return;
            }
            const index = state.bookings[dateKey].findIndex((b: Booking) => b.id === booking.id);
            if (index !== -1) {
                state.bookings[dateKey][index] = {
                    ...state.bookings[dateKey][index],
                    ...booking
                };
            }
        },
        deleteBooking: (state, action: PayloadAction<DeleteBookingPayload>) => {
            const { bookingId, date } = action.payload;
            if (!state.bookings[date]) {
                return;
            }
            state.bookings[date] = state.bookings[date].filter(
                (booking: Booking) => booking.id !== bookingId
            );
            if (state.bookings[date].length === 0) {
                delete state.bookings[date];
            }
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchBookings.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchBookings.fulfilled, (state, action) => {
                // Преобразуем массив в bookings по датам
                const bookingsByDate: Record<string, Booking[]> = {};
                action.payload.forEach((booking: Booking) => {
                    if (!booking.plannedStartTime) {
                        console.warn('Booking без plannedStartTime:', booking);
                        return;
                    }
                    const dateKey = booking.plannedStartTime.slice(0, 10);
                    if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
                    bookingsByDate[dateKey].push(booking);
                });
                state.bookings = bookingsByDate;
                state.isLoading = false;
            })
            .addCase(fetchBookings.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchFullyBookedDays.fulfilled, (state, action) => {
                state.fullyBookedDays = action.payload;
            })
            .addCase(fetchDaysAvailability.fulfilled, (state, action) => {
                state.fullyBookedDays = action.payload.fully_booked_days;
                state.partiallyBookedDays = action.payload.partially_booked_days;
            })
            // Обработчики для создания бронирования
            .addCase(addBooking.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(addBooking.fulfilled, (state, action) => {
                state.isLoading = false;
                // Добавляем новое бронирование в store
                const booking = action.payload as any; // API возвращает snake_case
                if (booking.planned_start_time) {
                    const dateKey = booking.planned_start_time.slice(0, 10);
                    if (!state.bookings[dateKey]) {
                        state.bookings[dateKey] = [];
                    }
                    // Преобразуем snake_case в camelCase
                    const normalizedBooking: Booking = {
                        ...booking,
                        plannedStartTime: booking.planned_start_time,
                        actualStartTime: booking.actual_start_time,
                        timeReturnedByClient: booking.time_returned_by_client,
                        clientName: booking.client_name,
                        serviceType: booking.service_type === 'rent' ? 'аренда' : booking.service_type,
                        boardCount: booking.board_count,
                        boardWithSeatCount: booking.board_with_seat_count,
                        raftCount: booking.raft_count,
                        selectedItems: booking.selected_items, // Добавляем маппинг для новой системы инвентаря
                        durationInHours: booking.duration_in_hours,
                        createdAt: booking.created_at,
                        updatedAt: booking.updated_at,
                    };
                    state.bookings[dateKey].push(normalizedBooking);
                }
            })
            .addCase(addBooking.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            // Обработчики для обновления бронирования
            .addCase(updateBookingAsync.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(updateBookingAsync.fulfilled, (state, action) => {
                console.log('[bookingsSlice] updateBookingAsync.fulfilled:', action.payload);
                state.isLoading = false;
                // Обновляем бронирование в store
                const updatedBooking = action.payload as any; // API возвращает snake_case
                console.log('[bookingsSlice] Обновленное бронирование:', updatedBooking);
                if (updatedBooking.planned_start_time) {
                    const dateKey = updatedBooking.planned_start_time.slice(0, 10);
                    console.log('[bookingsSlice] Ключ даты:', dateKey);
                    if (state.bookings[dateKey]) {
                        const index = state.bookings[dateKey].findIndex(
                            (booking) => booking.id === updatedBooking.id
                        );
                        console.log('[bookingsSlice] Найден индекс:', index);
                        if (index !== -1) {
                            // Преобразуем snake_case в camelCase
                            const normalizedBooking: Booking = {
                                ...updatedBooking,
                                plannedStartTime: updatedBooking.planned_start_time,
                                actualStartTime: updatedBooking.actual_start_time,
                                timeReturnedByClient: updatedBooking.time_returned_by_client,
                                clientName: updatedBooking.client_name,
                                serviceType: updatedBooking.service_type === 'rent' ? 'аренда' : updatedBooking.service_type,
                                boardCount: updatedBooking.board_count,
                                boardWithSeatCount: updatedBooking.board_with_seat_count,
                                raftCount: updatedBooking.raft_count,
                                selectedItems: updatedBooking.selected_items, // Добавляем маппинг для новой системы инвентаря
                                durationInHours: updatedBooking.duration_in_hours,
                                createdAt: updatedBooking.created_at,
                                updatedAt: updatedBooking.updated_at,
                            };
                            console.log('[bookingsSlice] Нормализованное бронирование:', normalizedBooking);
                            state.bookings[dateKey][index] = normalizedBooking;
                            console.log('[bookingsSlice] Бронирование обновлено в store');
                        } else {
                            console.warn('[bookingsSlice] Не найдено бронирование с ID:', updatedBooking.id);
                        }
                    } else {
                        console.warn('[bookingsSlice] Не найден день:', dateKey);
                    }
                } else {
                    console.warn('[bookingsSlice] Нет planned_start_time в обновленном бронировании');
                }
            })
            .addCase(updateBookingAsync.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    }
});

export const {
    setSelectedDate,
    setFullyBookedDays,
    setPartiallyBookedDays,
    createBooking,
    updateBooking,
    deleteBooking,
    setLoading,
    setError
} = bookingsSlice.actions;

export default bookingsSlice.reducer; 