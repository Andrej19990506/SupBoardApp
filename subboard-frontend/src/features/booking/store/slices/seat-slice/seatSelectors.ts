import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/features/booking/store/types';

export const selectSeats = (state: RootState) => state.seats.seats;
export const selectSeatsLoading = (state: RootState) => state.seats.loading;
export const selectSeatsError = (state: RootState) => state.seats.error;

export const selectAvailableSeats = createSelector(
  [selectSeats],
  (seats) => seats.filter(seat => seat.status === 'available')
);

export const selectSeatsByStatus = createSelector(
  [selectSeats],
  (seats) => {
    return {
      available: seats.filter(seat => seat.status === 'available'),
      booked: seats.filter(seat => seat.status === 'booked'),
      in_use: seats.filter(seat => seat.status === 'in_use'),
      servicing: seats.filter(seat => seat.status === 'servicing'),
      repair: seats.filter(seat => seat.status === 'repair'),
    };
  }
);

export const selectTotalSeats = createSelector(
  [selectSeats],
  (seats) => seats.length
); 