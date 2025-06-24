import { createAsyncThunk } from '@reduxjs/toolkit';
import { seatsApi } from '@/features/booking/services/seatsApi';
import type { Seat, SeatStatus } from '@/features/booking/store/types';

export const fetchSeats = createAsyncThunk(
  'seats/fetchSeats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await seatsApi.getSeats();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка загрузки кресел');
    }
  }
);

export const updateSeatStatus = createAsyncThunk(
  'seats/updateSeatStatus',
  async (
    { id, status, bookingId }: { id: number; status: SeatStatus; bookingId?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await seatsApi.updateSeatStatus(id, status, bookingId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка обновления статуса');
    }
  }
);

export const addSeat = createAsyncThunk(
  'seats/addSeat',
  async (_, { rejectWithValue }) => {
    try {
      const response = await seatsApi.addSeat();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка добавления кресла');
    }
  }
); 