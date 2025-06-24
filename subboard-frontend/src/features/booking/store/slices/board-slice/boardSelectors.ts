import { RootState } from '@/features/booking/store/index';

export const selectBoards = (state: RootState) => state.boards.boards;
export const selectBoardsLoading = (state: RootState) => state.boards.loading;
export const selectBoardsError = (state: RootState) => state.boards.error; 