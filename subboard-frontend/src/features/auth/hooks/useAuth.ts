import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { AppDispatch } from '../../booking/store';
import {
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  selectUserRole,
  selectUserName,
  selectUserEmail
} from '../store/authSelectors';
import {
  loginUser,
  registerUser,
  logoutUser,
  getCurrentUser,
  clearError,
  clearAuth
} from '../store/authSlice';
import { LoginCredentials, RegisterCredentials } from '../types';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Селекторы
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectAuthError);
  const userRole = useSelector(selectUserRole);
  const userName = useSelector(selectUserName);
  const userEmail = useSelector(selectUserEmail);

  // Действия
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      return dispatch(loginUser(credentials)).unwrap();
    },
    [dispatch]
  );

  const register = useCallback(
    async (credentials: RegisterCredentials) => {
      return dispatch(registerUser(credentials)).unwrap();
    },
    [dispatch]
  );

  const logout = useCallback(
    async () => {
      return dispatch(logoutUser()).unwrap();
    },
    [dispatch]
  );

  const refreshUser = useCallback(
    async () => {
      return dispatch(getCurrentUser()).unwrap();
    },
    [dispatch]
  );

  const clearAuthError = useCallback(
    () => {
      dispatch(clearError());
    },
    [dispatch]
  );

  const clearAuthData = useCallback(
    () => {
      dispatch(clearAuth());
    },
    [dispatch]
  );

  // Проверки ролей
  const isAdmin = userRole === 'admin';
  const isUser = userRole === 'user';

  return {
    // Данные
    user,
    isAuthenticated,
    isLoading,
    error,
    userRole,
    userName,
    userEmail,
    
    // Проверки
    isAdmin,
    isUser,
    
    // Действия
    login,
    register,
    logout,
    refreshUser,
    clearAuthError,
    clearAuthData,
  };
}; 