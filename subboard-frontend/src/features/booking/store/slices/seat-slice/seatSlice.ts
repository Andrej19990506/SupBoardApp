import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Seat, SeatStatus } from '@/features/booking/store/types';
import { fetchSeats, updateSeatStatus, addSeat as addSeatThunk } from '@/features/booking/store/slices/seat-slice/seatThunk';

interface SeatState {
  seats: Seat[];
  loading: boolean;
  error: string | null;
}

const initialState: SeatState = {
  seats: [],
  loading: false,
  error: null,
};

const seatSlice = createSlice({
  name: 'seats',
  initialState,
  reducers: {
    setSeatStatus(
      state,
      action: PayloadAction<{ id: number; status: SeatStatus; bookingId?: string }>
    ) {
      const seat = state.seats.find(s => s.id === action.payload.id);
      if (seat) {
        seat.status = action.payload.status;
        seat.currentBookingId = action.payload.bookingId;
      }
    },
    addSeat(state) {
      const maxId = state.seats.reduce((max, s) => Math.max(max, s.id), 0);
      state.seats.push({ id: maxId + 1, status: 'available' });
    },
    finishService(state, action: PayloadAction<{ id: number }>) {
      const seat = state.seats.find(s => s.id === action.payload.id);
      if (seat && seat.status === 'servicing') {
        seat.status = 'available';
        seat.lastServiceEnd = new Date().toISOString();
      }
    },
    sendToRepair(state, action: PayloadAction<{ id: number }>) {
      const seat = state.seats.find(s => s.id === action.payload.id);
      if (seat) {
        seat.status = 'repair';
      }
    },
    returnFromRepair(state, action: PayloadAction<{ id: number }>) {
      const seat = state.seats.find(s => s.id === action.payload.id);
      if (seat && seat.status === 'repair') {
        seat.status = 'available';
      }
    },
    setSeatServiceEnd(state, action: PayloadAction<{ id: number; lastServiceEnd: string }>) {
      const seat = state.seats.find(s => s.id === action.payload.id);
      if (seat) {
        seat.lastServiceEnd = action.payload.lastServiceEnd;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchSeats.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSeats.fulfilled, (state, action) => {
        state.loading = false;
        state.seats = action.payload;
      })
      .addCase(fetchSeats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateSeatStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.seats.findIndex(s => s.id === updated.id);
        if (idx !== -1) state.seats[idx] = updated;
      })
      .addCase(addSeatThunk.fulfilled, (state, action) => {
        state.seats.push(action.payload);
      });
  }
});

export const {
  setSeatStatus,
  addSeat,
  finishService,
  sendToRepair,
  returnFromRepair,
  setSeatServiceEnd,
} = seatSlice.actions;

export default seatSlice.reducer; 