import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, LoginCredentials, RegisterCredentials, User, VKAuthData, TelegramAuthData, GoogleAuthData } from '../types';
import { authService } from '../services/authService';

// Начальное состояние
const initialState: AuthState = {
  user: authService.getStoredUser(),
  isAuthenticated: !!authService.getToken(), // Проверяем наличие токена
  isLoading: false,
  error: null,
};

// Async thunks
export const registerUser = createAsyncThunk(
  'auth/register',
  async (credentials: RegisterCredentials & { email: string }, { rejectWithValue }) => {
    try {
      const response = await authService.register(credentials);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка регистрации');
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка входа');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка выхода');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка получения пользователя');
    }
  }
);

export const authenticateWithVK = createAsyncThunk(
  'auth/vk',
  async (authData: VKAuthData, { rejectWithValue }) => {
    try {
      const response = await authService.authenticateWithVK(authData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка авторизации через ВК');
    }
  }
);

export const authenticateWithTelegram = createAsyncThunk(
  'auth/telegram',
  async (authData: TelegramAuthData, { rejectWithValue }) => {
    try {
      const response = await authService.authenticateWithTelegram(authData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка авторизации через Telegram');
    }
  }
);

export const authenticateWithGoogle = createAsyncThunk(
  'auth/google',
  async (authData: GoogleAuthData, { rejectWithValue }) => {
    try {
      const response = await authService.authenticateWithGoogle(authData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка авторизации через Google');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const token = await authService.refreshToken();
      return token;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Ошибка обновления токена');
    }
  }
);

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Logout
    builder
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Get current user
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // При ошибке получения пользователя - очищаем авторизацию
        state.user = null;
        state.isAuthenticated = false;
        authService.removeTokens();
      });

    // VK Auth
    builder
      .addCase(authenticateWithVK.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateWithVK.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(authenticateWithVK.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Telegram Auth
    builder
      .addCase(authenticateWithTelegram.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateWithTelegram.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(authenticateWithTelegram.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Google Auth
    builder
      .addCase(authenticateWithGoogle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateWithGoogle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(authenticateWithGoogle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Refresh token
    builder
      .addCase(refreshToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshToken.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // При ошибке обновления токена - очищаем авторизацию
        state.user = null;
        state.isAuthenticated = false;
        authService.removeTokens();
      });
  },
});

export const { clearError, setUser, clearAuth, setCredentials } = authSlice.actions;
export default authSlice.reducer; 