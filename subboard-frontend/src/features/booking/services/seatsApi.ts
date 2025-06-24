import api from '@/shared/services/api';
import type { Seat, SeatStatus } from '@/features/booking/store/types';

export const seatsApi = {
  getSeats: () => api.get<Seat[]>('/v1/inventory/seats'),
  addSeat: () => api.post<Seat>('/v1/inventory/seats', { status: 'available' }),
  updateSeatStatus: (id: number, status: SeatStatus, bookingId?: string) =>
    api.patch<Seat>(`/v1/inventory/seats/${id}`, { status, current_booking_id: bookingId }),
}; 