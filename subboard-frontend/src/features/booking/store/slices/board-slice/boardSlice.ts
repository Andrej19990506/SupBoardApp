import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Board, BoardStatus } from '@/features/booking/store/types';
import { fetchBoards, updateBoardStatus, addBoard as addBoardThunk } from '@/features/booking/store/slices/board-slice/boardThunk';



interface BoardState {
  boards: Board[];
  loading: boolean;
  error: string | null;
}

const initialState: BoardState = {
  boards: [],
  loading: false,
  error: null,
};

const boardSlice = createSlice({
  name: 'boards',
  initialState,
  reducers: {
    setBoardStatus(
      state,
      action: PayloadAction<{ id: number; status: BoardStatus; bookingId?: string }>
    ) {
      const board = state.boards.find(b => b.id === action.payload.id);
      if (board) {
        board.status = action.payload.status;
        board.currentBookingId = action.payload.bookingId;
      }
    },
    addBoard(state) {
      const maxId = state.boards.reduce((max, b) => Math.max(max, b.id), 0);
      state.boards.push({ id: maxId + 1, status: 'available' });
    },
    finishService(state, action: PayloadAction<{ id: number }>) {
      const board = state.boards.find(b => b.id === action.payload.id);
      if (board && board.status === 'servicing') {
        board.status = 'available';
        board.lastServiceEnd = new Date().toISOString();
      }
    },
    sendToRepair(state, action: PayloadAction<{ id: number }>) {
      const board = state.boards.find(b => b.id === action.payload.id);
      if (board) {
        board.status = 'repair';
      }
    },
    returnFromRepair(state, action: PayloadAction<{ id: number }>) {
      const board = state.boards.find(b => b.id === action.payload.id);
      if (board && board.status === 'repair') {
        board.status = 'available';
      }
    },
    setBoardServiceEnd(state, action: PayloadAction<{ id: number; lastServiceEnd: string }>) {
      const board = state.boards.find(b => b.id === action.payload.id);
      if (board) {
        board.lastServiceEnd = action.payload.lastServiceEnd;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchBoards.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBoards.fulfilled, (state, action) => {
        state.loading = false;
        state.boards = action.payload;
      })
      .addCase(fetchBoards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateBoardStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.boards.findIndex(b => b.id === updated.id);
        if (idx !== -1) state.boards[idx] = updated;
      })
      .addCase(addBoardThunk.fulfilled, (state, action) => {
        state.boards.push(action.payload);
      });
  }
});

export const {
  setBoardStatus,
  addBoard,
  finishService,
  sendToRepair,
  returnFromRepair,
  setBoardServiceEnd,
} = boardSlice.actions;

export default boardSlice.reducer; 