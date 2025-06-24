import type { RootState } from '@/features/booking/store/types';
 
export const selectBookings = (state: RootState) => state.bookings.bookings;
export const selectBookingsLoading = (state: RootState) => state.bookings.isLoading;
export const selectBookingsError = (state: RootState) => state.bookings.error;
export const selectSelectedDate = (state: RootState) => state.bookings.selectedDate; 