import { configureStore } from '@reduxjs/toolkit';
import type { RootState } from '@features/booking/store/types';
import bookingsReducer from '@features/booking/store/slices/bookings-slice/bookingsSlice';
import boardReducer from '@features/booking/store/slices/board-slice/boardSlice';
import seatReducer from '@features/booking/store/slices/seat-slice/seatSlice';
import boardBookingsReducer from '@features/booking/store/slices/board-bookings/boardBookingsSlice';
import notificationsReducer from '@features/booking/store/slices/notifications-slice/notificationsSlice';
import authReducer from '../../auth/store/authSlice';

export const store = configureStore({
    reducer: {
        bookings: bookingsReducer,
        boards: boardReducer,
        seats: seatReducer,
        boardBookings: boardBookingsReducer,
        notifications: notificationsReducer,
        auth: authReducer,
    }
});

export type AppDispatch = typeof store.dispatch;
export type { RootState }; 