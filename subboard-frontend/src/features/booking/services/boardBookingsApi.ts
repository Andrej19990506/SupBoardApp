import api from '@/shared/services/api';
import type { BoardBooking } from '../store/slices/board-bookings/boardBookingsSlice';
 
export const boardBookingsApi = {
  getBoardBookings: () => api.get<BoardBooking[]>('/v1/board_bookings'),
}; 