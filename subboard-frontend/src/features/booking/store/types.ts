import type { Booking } from '@/types/booking';
import type { BoardBooking } from './slices/board-bookings/boardBookingsSlice';
import type { NotificationData } from './slices/notifications-slice/notificationsSlice';
import type { AuthState } from '../../auth/types';

export interface BoardState {
    boards: Board[];
    loading: boolean;
    error: string | null;
  }

export interface SeatState {
    seats: Seat[];
    loading: boolean;
    error: string | null;
  }

export interface BoardBookingsState {
    boardBookings: BoardBooking[];
    loading: boolean;
    error: string | null;
}

export interface NotificationsState {
    notifications: NotificationData[];
    unreadCount: number;
    isTooltipOpen: boolean;
    weatherTooltip: {
        isOpen: boolean;
        position: { top: number; left: number };
        data: {
            temperature: number;
            windSpeed: number;
            condition: string;
            location: string;
            icon: string;
            precipitation?: number;
            rain?: number;
            snowfall?: number;
            humidity?: number;
            recommendations: Array<{
                title: string;
                description: string;
                icon: string;
                type: 'temperature' | 'wind' | 'condition';
            }>;
        } | null;
    };
}

export interface RootState {
    bookings: BookingsState;
    boards: BoardState;
    seats: SeatState;
    boardBookings: BoardBookingsState;
    notifications: NotificationsState;
    auth: AuthState;
  }

export type BoardStatus = 'available' | 'booked' | 'in_use' | 'servicing' | 'repair';
export type SeatStatus = 'available' | 'booked' | 'in_use' | 'servicing' | 'repair';

export interface Board {
  id: number;
  status: BoardStatus;
  currentBookingId?: string;
  lastServiceEnd?: string;
}

export interface Seat {
  id: number;
  status: SeatStatus;
  currentBookingId?: string;
  lastServiceEnd?: string;
}

export interface BookingsState {
    bookings: Record<string, Booking[]>;
    selectedDate: string | null;
    isLoading: boolean;
    error: string | null;
    fullyBookedDays?: string[];
    partiallyBookedDays?: {date: string, available_after: string}[];
}

// export type AppDispatch = {
//     <T>(action: { type: string; payload: T }): void;
//     <T>(action: { type: string; payload?: T }): void;
// }; 