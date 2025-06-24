import { RootState } from '../../booking/store';

export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth?.user;
export const selectIsAuthenticated = (state: RootState) => state.auth?.isAuthenticated || false;
export const selectIsLoading = (state: RootState) => state.auth?.isLoading || false;
export const selectAuthError = (state: RootState) => state.auth?.error;
export const selectUserRole = (state: RootState) => state.auth?.user?.role;
export const selectUserName = (state: RootState) => state.auth?.user?.name;
export const selectUserEmail = (state: RootState) => state.auth?.user?.email;
export const selectUserAvatar = (state: RootState) => state.auth?.user?.avatar; 