import api from '@/shared/services/api';
import type { Board, BoardStatus } from '@/features/booking/store/types';

export const boardsApi = {
  getBoards: () => api.get<Board[]>('/v1/inventory/boards'),
  addBoard: () => api.post<Board>('/v1/inventory/boards', { status: 'available' }),
  updateBoardStatus: (id: number, status: BoardStatus, bookingId?: string) =>
    api.patch<Board>(`/v1/inventory/boards/${id}`, { status, current_booking_id: bookingId }),
};