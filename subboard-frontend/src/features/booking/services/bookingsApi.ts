import api from '@/shared/services/api';
import type { Booking } from '@/types/booking';
 
export const bookingsApi = {
  getBookings: (allBookings: boolean = true) => api.get<Booking[]>(`/v1/bookings/list?all_bookings=${allBookings}`),
  addBooking: (booking: Partial<Booking>) => api.post<Booking>('/v1/bookings/create', booking),
  updateBooking: (id: number, booking: Partial<Booking>) => api.patch<Booking>(`/v1/bookings/${id}`, booking),
  getFullyBookedDays: (from: string, to: string) => api.get<string[]>(`/v1/bookings/fully-booked-days?from_date=${from}&to_date=${to}`),
  getDayAvailability: (date: string) => api.get<{date: string, is_fully_booked: boolean, free_boards: number}>(`/v1/bookings/availability?date=${date}`),
  getDaysAvailability: (from: string, to: string) => api.get<{fully_booked_days: string[], partially_booked_days: {date: string, available_after: string}[]}>(`/v1/bookings/days-availability?from_date=${from}&to_date=${to}`),
}; 