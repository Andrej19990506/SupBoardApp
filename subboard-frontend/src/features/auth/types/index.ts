export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
  provider: 'vk' | 'telegram' | 'google' | 'email';
  providerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface RegisterCredentials {
  phone: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface VKAuthData {
  // Данные от VK ID SDK
  id_token?: string;
  access_token?: string;
  user_id?: string;
  // Старые данные от OAuth flow (для обратной совместимости)
  code?: string;
  state?: string;
  // Дополнительные данные
  [key: string]: any;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface GoogleAuthData {
  code: string;
  state?: string;
  scope: string;
}

export interface AuthError {
  message: string;
  code?: string;
  field?: string;
} 