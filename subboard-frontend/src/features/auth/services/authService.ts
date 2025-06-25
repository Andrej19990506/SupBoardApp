import api from '../../../shared/services/api';
import { 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse, 
  VKAuthData, 
  TelegramAuthData,
  GoogleAuthData,
  User
} from '../types';

class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';

  // Получаем правильный API URL из конфигурации
  private getApiUrl(): string {
    if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_URL) {
      return (window as any).APP_CONFIG.API_URL;
    }
    return '/api'; // fallback
  }

  // Токены
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Refresh token теперь в HttpOnly cookie, недоступен для JS
  getRefreshToken(): string | null {
    // Метод оставляем для совместимости, но refresh token теперь в secure cookie
    console.warn('⚠️ Refresh token теперь хранится в secure HttpOnly cookie');
    return null;
  }

  setTokens(token: string, refreshToken?: string): void {
    // Сохраняем только access token в localStorage
    localStorage.setItem(this.TOKEN_KEY, token);
    
    // Refresh token автоматически устанавливается сервером в HttpOnly cookie
    // Поэтому не сохраняем его в localStorage для безопасности
    if (refreshToken) {
      console.info('✅ Refresh token сохранен сервером в secure cookie');
    }
  }

  removeTokens(): void {
    // Удаляем только access token и user data из localStorage
    localStorage.removeItem(this.TOKEN_KEY);
          localStorage.removeItem(this.USER_KEY);
      
      // HttpOnly cookie остается для Device Trust (soft logout)
      console.info('🔒 Access token removed from localStorage, HttpOnly cookie preserved for Device Trust');
  }

  // Пользователь
  getStoredUser(): User | null {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  setStoredUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  // Проверка авторизации
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Регистрация
  async register(credentials: RegisterCredentials & { email: string }): Promise<any> {
    try {
        const response = await api.post('/v1/auth/register', {
        phone: credentials.phone,
        password: credentials.password,
        name: credentials.name,
        email: credentials.email
      });
      
      const data = response.data;
      
      // 🎉 ИСПРАВЛЕНО: Теперь сохраняем токены после регистрации для автоматической авторизации
      if (data.access_token) {
        this.setTokens(data.access_token, undefined); // refresh token из API пока не приходит
      }
      if (data.user) {
        this.setStoredUser(data.user);
      }
      
      return data;
    } catch (error: any) {
      console.error('Ошибка регистрации:', error);
      throw error;
    }
  }

  // Вход
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/v1/auth/login', credentials);
    const authData = response.data;
    
    this.setTokens(authData.token, authData.refreshToken);
    this.setStoredUser(authData.user);
    
    return authData;
  }

  // Вход через пароль (новый метод)
  async loginWithPassword(phone: string, password: string): Promise<AuthResponse> {
    const response = await api.post('/v1/auth/login', {
      phone: phone,
      password: password
    });
    const authData = response.data;
    
    this.setTokens(authData.token, authData.refreshToken);
    this.setStoredUser(authData.user);
    
    return authData;
  }

  // Выход
  async logout(): Promise<void> {
    try {
      // 🛡️ ИСПОЛЬЗУЕМ МЯГКИЙ LOGOUT для сохранения Device Trust
      const response = await fetch(`${this.getApiUrl()}/v1/auth/soft-logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Важно для обработки HttpOnly cookie
      });
      
      if (!response.ok) {
        console.warn('⚠️ Ошибка при вызове soft-logout на сервере, но очищаем локальные данные');
      } else {
        console.log('✅ Успешный мягкий logout на сервере - устройство остается доверенным');
      }
    } catch (error) {
      console.error('❌ Ошибка при выходе:', error);
    } finally {
      // В любом случае очищаем локальные данные
      this.removeTokens();
      console.log('🔒 Локальные токены удалены, HttpOnly cookie сохранен для Device Trust');
    }
  }

  // Обновление токена через secure cookie
  async refreshToken(): Promise<string> {
    console.log('🔄 Обновляем токен через secure cookie...');
    
    // Используем fetch вместо api для полного контроля над credentials
    const response = await fetch(`${this.getApiUrl()}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Важно! Включаем cookies в запрос
      body: JSON.stringify({}), // Пустое тело, refresh token в cookie
    });

    if (!response.ok) {
      console.error('❌ Ошибка обновления токена:', response.status);
      
      // Если refresh token недействителен, удаляем все токены
      if (response.status === 401) {
        console.warn('🚪 Refresh token недействителен, выходим из системы');
        this.removeTokens();
        // Вызываем logout для очистки данных
        await this.logout();
      }
      
      throw new Error('Не удалось обновить токен');
    }

    const data = await response.json();
    
    if (data.token) {
      console.log('✅ Токен успешно обновлен через secure cookie');
      // Сохраняем только access token, refresh token уже в secure cookie
      this.setTokens(data.token);
      
      // Обновляем данные пользователя, если они есть
      if (data.user) {
        this.setStoredUser(data.user);
      }
      
      return data.token;
    }

    throw new Error('Нет токена в ответе');
  }

  // Получение текущего пользователя
  async getCurrentUser(): Promise<User> {
    const response = await api.get('/v1/auth/me');
    const user = response.data;
    this.setStoredUser(user);
    return user;
  }

  // OAuth ВКонтакте
  getVKAuthUrl(): string {
    const clientId = (window as any).APP_CONFIG?.VK_CLIENT_ID || import.meta.env.VITE_VK_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('VK Client ID не настроен');
    }
    
    const redirectUri = `${window.location.origin}/auth/vk/callback`;
    const state = Math.random().toString(36).substring(2, 15);
    
    localStorage.setItem('vk_auth_state', state);
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email',
      state,
      v: '5.131'
    });

    return `https://oauth.vk.com/authorize?${params.toString()}`;
  }

  async authenticateWithVK(authData: VKAuthData): Promise<AuthResponse> {
    const response = await api.post('/v1/auth/vk', authData);
    const authResponse = response.data;
    
    this.setTokens(authResponse.token, authResponse.refreshToken);
    this.setStoredUser(authResponse.user);
    
    return authResponse;
  }

  // OAuth Telegram
  async authenticateWithTelegram(authData: TelegramAuthData): Promise<AuthResponse> {
    const response = await api.post('/v1/auth/telegram', authData);
    const authResponse = response.data;
    
    this.setTokens(authResponse.token, authResponse.refreshToken);
    this.setStoredUser(authResponse.user);
    
    return authResponse;
  }

  // OAuth Google
  getGoogleAuthUrl(): string {
    const clientId = '304108310275-v2l8pmj06os1f5nt8r18bajthdb2p38n.apps.googleusercontent.com';
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const state = Math.random().toString(36).substring(2, 15);
    
    localStorage.setItem('google_auth_state', state);
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async authenticateWithGoogle(authData: GoogleAuthData): Promise<AuthResponse> {
    // Добавляем redirect_uri к данным для бэкенда
    const dataWithRedirectUri = {
      ...authData,
      redirect_uri: `${window.location.origin}/auth/google/callback`
    };
    
    const response = await api.post('/v1/auth/google', dataWithRedirectUri);
    const authResponse = response.data;
    
    this.setTokens(authResponse.token, authResponse.refreshToken);
    this.setStoredUser(authResponse.user);
    
    return authResponse;
  }

  // SMS авторизация
  async checkPhoneExists(phone: string): Promise<{ success: boolean; message: string; user_exists: boolean; user_name?: string; user_avatar?: string }> {
    const response = await api.post('/v1/auth/check-phone', { phone });
    return response.data;
  }

  async sendSMSCode(phone: string): Promise<{ success: boolean; message: string; expires_in: number }> {
    const response = await api.post('/v1/auth/send-sms-code', { phone });
    return response.data;
  }

  async sendRegistrationSMSCode(phone: string): Promise<{ success: boolean; message: string; expires_in: number }> {
    const response = await api.post('/v1/auth/send-registration-sms-code', { phone });
    return response.data;
  }

  async verifySMSCode(phone: string, code: string): Promise<AuthResponse> {
    // Используем fetch для поддержки credentials
    const response = await fetch(`${this.getApiUrl()}/v1/auth/verify-sms-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Важно для получения secure cookie
      body: JSON.stringify({ phone, code }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка сети' }));
      throw new Error(errorData.detail || 'Ошибка верификации SMS кода');
    }

    const authResponse = await response.json();
    
    console.log('🔍 verifySMSCode - полный ответ сервера:', authResponse);
    console.log('🔍 verifySMSCode - данные пользователя:', authResponse.user);
    
    // Проверяем, это авторизация или подтверждение регистрации
    if (authResponse.token) {
      // Это авторизация - сохраняем только access token
      // Refresh token автоматически сохранен в secure cookie
      this.setTokens(authResponse.token, authResponse.refreshToken);
      this.setStoredUser(authResponse.user);
      console.log('💾 Пользователь сохранен, refresh token в secure cookie');
    }
    
    return authResponse;
  }

  async verifyRegistrationSMSCode(phone: string, code: string): Promise<{ success: boolean; message: string; phone: string; registration_token?: string }> {
    const response = await api.post('/v1/auth/verify-sms-code', { phone, code });
    
    // Сохраняем токен регистрации если он есть
    if (response.data.registration_token) {
      localStorage.setItem('registration_token', response.data.registration_token);
      console.log('✅ Токен регистрации сохранен в localStorage');
    }
    
    return response.data;
  }

  // Восстановление пароля - отправка SMS кода
  async forgotPassword(phone: string): Promise<{ success: boolean; message: string; expires_in: number }> {
    const response = await api.post('/v1/auth/forgot-password', { phone });
    return response.data;
  }

  // Проверка SMS кода для восстановления пароля
  async verifyResetCode(phone: string, code: string): Promise<{ success: boolean; message: string; reset_token?: string }> {
    const response = await api.post('/v1/auth/verify-reset-code', { phone, code });
    return response.data;
  }

  // Установка нового пароля
  async resetPassword(phone: string, resetToken: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/v1/auth/reset-password', { 
      phone, 
      reset_token: resetToken, 
      new_password: newPassword 
    });
    return response.data;
  }

  // Альтернативное восстановление через email + номер при регистрации
  async emailFallbackRecovery(email: string, phone: string): Promise<{ success: boolean; message: string; method?: string }> {
    const response = await api.post('/v1/auth/email-fallback', { email, phone });
    return response.data;
  }

  // Управление аватарами
  async uploadAvatar(clientId: number, file: File): Promise<{ message: string; avatar_url: string; client: any }> {
    console.log('📤 uploadAvatar вызван с:', { clientId, fileName: file.name, fileSize: file.size, fileType: file.type });
    
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('📤 FormData создан:', formData);
    console.log('📤 Файл в FormData:', formData.get('file'));
    
    console.log('📤 Отправляем запрос...');
    
    // Создаем новый экземпляр axios без базового Content-Type
    const response = await api.post(`/v1/clients/${clientId}/avatar`, formData, {
      headers: {
        'Content-Type': undefined, // Позволяем браузеру установить правильный заголовок с boundary
      },
      transformRequest: [(data) => data], // Не трансформируем FormData
    });
    
    console.log('✅ Ответ от сервера:', response.data);
    return response.data;
  }

  async deleteAvatar(clientId: number): Promise<{ message: string; client: any }> {
    console.log('🗑️ deleteAvatar вызван с clientId:', clientId);
    const response = await api.delete(`/v1/clients/${clientId}/avatar`);
    console.log('✅ Аватар удален, ответ:', response.data);
    return response.data;
  }

  // 🛡️ DEVICE TRUST - Проверка доверенного устройства
  async checkDeviceTrust(phone: string): Promise<{
    trusted: boolean;
    reason: string;
    message: string;
    session_id?: number;
    device_info?: any;
  }> {
    try {
      console.log('🔍 Проверяем является ли устройство доверенным для:', phone);
      
      // Используем fetch для передачи HttpOnly cookie
      const response = await fetch(`${this.getApiUrl()}/v1/auth/check-device-trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Важно! Включаем cookies в запрос
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        console.error('❌ Ошибка проверки Device Trust:', response.status);
        return {
          trusted: false,
          reason: 'api_error',
          message: `Ошибка API: ${response.status}`
        };
      }

      const result = await response.json();
      console.log('🔍 Результат проверки Device Trust:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Исключение при проверке Device Trust:', error);
      return {
        trusted: false,
        reason: 'network_error',
        message: 'Ошибка сети'
      };
    }
  }

  // 🚀 AUTO LOGIN - Автоматический вход для доверенного устройства
  async autoLogin(phone: string): Promise<AuthResponse> {
    try {
      console.log('🚀 Автоматический вход для доверенного устройства:', phone);
      
      // Используем fetch для передачи HttpOnly cookie
      const response = await fetch(`${this.getApiUrl()}/v1/auth/auto-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Важно! Включаем cookies в запрос
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Ошибка автоматического входа:', response.status, errorData);
        throw new Error(errorData.detail || `Ошибка автоматического входа: ${response.status}`);
      }

      const authData = await response.json();
      console.log('✅ Успешный автоматический вход:', authData);
      
      // Сохраняем токены и данные пользователя
      this.setTokens(authData.token, authData.refreshToken);
      this.setStoredUser(authData.user);
      
      return authData;
    } catch (error) {
      console.error('❌ Исключение при автоматическом входе:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();

export const registerUser = async (userData: RegisterCredentials & { email: string }) => {
  try {
    // Получаем токен регистрации из localStorage
    const registrationToken = localStorage.getItem('registration_token');
    
    if (!registrationToken) {
      throw new Error('Токен регистрации не найден. Пожалуйста, подтвердите номер телефона заново.');
    }
    
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://supboardapp.ru/api' 
      : 'http://localhost/api';
    
    const response = await fetch(`${apiUrl}/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Важно для установки HttpOnly cookie
      body: JSON.stringify({
        phone: userData.phone,
        password: userData.password,
        name: userData.name,
        email: userData.email,
        registration_token: registrationToken
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка сети' }));
      throw new Error(errorData.detail || 'Ошибка регистрации');
    }

    const authData = await response.json();
    console.log('✅ Успешная регистрация:', authData);
    
    // Удаляем токен регистрации после успешной регистрации
    localStorage.removeItem('registration_token');
    
    // Сохраняем токены авторизации
    const authService = new AuthService();
    authService.setTokens(authData.access_token, authData.refreshToken);
    authService.setStoredUser(authData.user);
    
    return authData;
  } catch (error: any) {
    console.error('Ошибка регистрации:', error);
    throw error;
  }
}; 