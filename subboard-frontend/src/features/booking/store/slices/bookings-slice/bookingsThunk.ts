import { createAsyncThunk } from '@reduxjs/toolkit';
import { bookingsApi } from '@/features/booking/services/bookingsApi';
import { boardsApi } from '@/features/booking/services/boardsApi';
import type { Booking } from '@/types/booking';
import type { BoardStatus } from '@features/booking/store/types';

export const fetchBookings = createAsyncThunk(
  'bookings/fetchBookings',
  async (_, { rejectWithValue }) => {
    try {
      console.log('[bookingsThunk] fetchBookings started');
      const response = await bookingsApi.getBookings();
      console.log('[bookingsThunk] fetchBookings raw response:', response.data);
      // Маппинг snake_case -> camelCase
      const bookings = response.data.map((booking: any) => ({
        ...booking,
        plannedStartTime: booking.planned_start_time,
        actualStartTime: booking.actual_start_time,
        timeReturnedByClient: booking.time_returned_by_client,
        clientName: booking.client_name,
        serviceType: booking.service_type,
        boardCount: booking.board_count,
        boardWithSeatCount: booking.board_with_seat_count,
        raftCount: booking.raft_count,
        durationInHours: booking.duration_in_hours,
        selectedItems: booking.selected_items, // Новая система инвентаря
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
      }));
      console.log('[bookingsThunk] fetchBookings processed:', bookings);
      return bookings;
    } catch (error: any) {
      console.error('[bookingsThunk] fetchBookings error:', error);
      return rejectWithValue(error.message || 'Ошибка загрузки бронирований');
    }
  }
);

export const addBooking = createAsyncThunk(
  'bookings/addBooking',
  async (booking: Partial<Booking>, { rejectWithValue }) => {
    try {
      // Маппинг camelCase → snake_case
      const payload = {
        client_name: booking.clientName,
        phone: booking.phone,
        planned_start_time: booking.plannedStartTime,
        service_type: booking.serviceType === 'аренда' ? 'rent' : booking.serviceType,
        board_count: booking.boardCount,
        board_with_seat_count: booking.boardWithSeatCount,
        raft_count: booking.raftCount,
        duration_in_hours: booking.durationInHours,
        selected_items: booking.selectedItems, // Новая система инвентаря
        comment: booking.comment,
        status: booking.status,
      };
      const response = await bookingsApi.addBooking(payload);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        return rejectWithValue({ status: 409, message: error.response.data?.detail || 'Все доски заняты на текущее время' });
      }
      return rejectWithValue({ status: error.response?.status, message: error.message || 'Ошибка создания бронирования' });
    }
  }
);

export const updateBookingAsync = createAsyncThunk(
  'bookings/updateBooking',
  async ({ id, booking }: { id: number; booking: Partial<Booking> }, { rejectWithValue }) => {
    try {
      console.log('[updateBookingAsync] Начало обновления:', { id, booking });
      const response = await bookingsApi.updateBooking(id, booking);
      console.log('[updateBookingAsync] Успешный ответ:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[updateBookingAsync] Ошибка:', error);
      return rejectWithValue(error.message || 'Ошибка обновления бронирования');
    }
  }
);

// Универсальный thunk для завершения или отмены бронирования с обновлением статусов досок
export const completeOrCancelBooking = createAsyncThunk(
  'bookings/completeOrCancelBooking',
  async (
    { booking, status, boardStatus }: { booking: Booking; status: 'completed' | 'cancelled'; boardStatus: BoardStatus },
    { rejectWithValue }
  ) => {
    try {
      // 1. Обновляем статус бронирования
      const bookingUpdate: Partial<Booking> = { status };
      if (status === 'completed') {
        bookingUpdate.timeReturnedByClient = new Date().toISOString();
      }
      await bookingsApi.updateBooking(Number(booking.id), bookingUpdate);
      // 2. Обновляем статусы всех досок
      if (booking.boardIds && booking.boardIds.length > 0) {
        await Promise.all(
          booking.boardIds.map((id) => boardsApi.updateBoardStatus(Number(id), boardStatus))
        );
      }
      return { id: booking.id, status, boardStatus, boardIds: booking.boardIds };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка обновления статусов');
    }
  }
);

export const fetchFullyBookedDays = createAsyncThunk(
  'bookings/fetchFullyBookedDays',
  async ({ from, to }: { from: string; to: string }, { rejectWithValue }) => {
    try {
      const response = await bookingsApi.getFullyBookedDays(from, to);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка загрузки полностью занятых дней');
    }
  }
);

export const fetchDaysAvailability = createAsyncThunk(
  'bookings/fetchDaysAvailability',
  async ({ from, to }: { from: string; to: string }, { rejectWithValue }) => {
    try {
      const response = await bookingsApi.getDaysAvailability(from, to);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка загрузки доступности дней');
    }
  }
); 