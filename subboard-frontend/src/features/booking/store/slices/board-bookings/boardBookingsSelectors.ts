import { RootState } from '@/features/booking/store';

export const selectBoardBookings = (state: RootState) => state.boardBookings.boardBookings;
