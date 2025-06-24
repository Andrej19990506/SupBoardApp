import { createAsyncThunk } from '@reduxjs/toolkit';
import { boardBookingsApi } from '@/features/booking/services/boardBookingsApi';
import type { BoardBooking } from './boardBookingsSlice';

export const fetchBoardBookings = createAsyncThunk<BoardBooking[], void, { rejectValue: string }>(
  'boardBookings/fetchBoardBookings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await boardBookingsApi.getBoardBookings();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка загрузки связей board_bookings');
    }
  }
);
