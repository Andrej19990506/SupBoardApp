import { createAsyncThunk } from '@reduxjs/toolkit';
import { boardsApi } from '@/features/booking/services/boardsApi';
import type { Board, BoardStatus } from '@/features/booking/store/types';

export const fetchBoards = createAsyncThunk(
  'boards/fetchBoards',
  async (_, { rejectWithValue }) => {
    try {
      console.log('[boardThunk] fetchBoards started');
      const response = await boardsApi.getBoards();
      console.log('[boardThunk] fetchBoards response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[boardThunk] fetchBoards error:', error);
      return rejectWithValue(error.message || 'Ошибка загрузки досок');
    }
  }
);

export const updateBoardStatus = createAsyncThunk(
  'boards/updateBoardStatus',
  async (
    { id, status, bookingId }: { id: number; status: BoardStatus; bookingId?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await boardsApi.updateBoardStatus(id, status, bookingId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка обновления статуса');
    }
  }
);

export const addBoard = createAsyncThunk(
  'boards/addBoard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await boardsApi.addBoard();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Ошибка добавления доски');
    }
  }
); 