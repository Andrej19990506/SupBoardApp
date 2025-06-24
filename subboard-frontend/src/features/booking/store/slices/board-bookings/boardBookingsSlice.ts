import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { fetchBoardBookings } from './boardBookingsThunks';

export interface BoardBooking {
  id: number;
  board_id: string | number;
  booking_id: string;
}

interface BoardBookingsState {
  boardBookings: BoardBooking[];
  loading: boolean;
  error: string | null;
}

const initialState: BoardBookingsState = {
  boardBookings: [],
  loading: false,
  error: null,
};

const boardBookingsSlice = createSlice({
  name: 'boardBookings',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchBoardBookings.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBoardBookings.fulfilled, (state, action: PayloadAction<BoardBooking[]>) => {
        console.log('FETCHED BOARD BOOKINGS:', action.payload);
        state.loading = false;
        state.boardBookings = action.payload;
      })
      .addCase(fetchBoardBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default boardBookingsSlice.reducer;
