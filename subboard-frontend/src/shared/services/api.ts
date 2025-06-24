import axios from 'axios';

// Функция для получения базового URL API
const getApiBaseURL = (): string => {
  // Пытаемся получить URL из динамического конфига
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_URL) {
    return (window as any).APP_CONFIG.API_URL;
  }
  
  // Фолбек на переменную окружения при сборке
  return import.meta.env.VITE_APP_API_URL || '/api';
};

const api = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Обновляем baseURL динамически, если конфиг еще не загружен
const updateBaseURL = () => {
  const newBaseURL = getApiBaseURL();
  if (api.defaults.baseURL !== newBaseURL) {
    api.defaults.baseURL = newBaseURL;
    console.log('[API] ✅ BaseURL обновлен:', newBaseURL);
  }
};

// Проверяем обновление baseURL перед каждым запросом
api.interceptors.request.use(
  (config) => {
    // Обновляем baseURL если конфиг загружен
    updateBaseURL();
    
    // Получаем токены из localStorage
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Refresh token теперь передается через HttpOnly cookie автоматически
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Логируем только ошибки, не все успешные ответы
    return response;
  },
  async (error) => {
    console.error('[API] Response error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      data: error.response?.data
    });
    
    // 🛡️ АВТОМАТИЧЕСКАЯ ОБРАБОТКА НЕВАЛИДНОЙ СЕССИИ
    if (error.response?.status === 401) {
      console.log('[API] 🚨 401 Unauthorized получен');
      
      // Проверяем что это не запрос авторизации (чтобы избежать бесконечного цикла)
      const isAuthRequest = error.config?.url?.includes('/send-sms-code') ||
                           error.config?.url?.includes('/verify-sms-code') ||
                           error.config?.url?.includes('/check-phone') ||
                           error.config?.url?.includes('/register') ||
                           error.config?.url?.includes('/login') ||
                           error.config?.url?.includes('/google') ||
                           error.config?.url?.includes('/telegram') ||
                           error.config?.url?.includes('/vk') ||
                           error.config?.url?.includes('/refresh');
      
      if (!isAuthRequest && !error.config._isRetry) {
        console.log('[API] 🔄 Пытаемся обновить токен через refresh token...');
        
        try {
          // Импортируем authService динамически чтобы избежать circular imports
          const { authService } = await import('../../features/auth/services/authService');
          
          // Попытка обновить токен через refresh token в HttpOnly cookie
          const newToken = await authService.refreshToken();
          
          if (newToken) {
            console.log('[API] ✅ Токен успешно обновлен, повторяем запрос');
            
            // Обновляем токен в localStorage
            localStorage.setItem('auth_token', newToken);
            
            // Обновляем заголовок в оригинальном запросе
            error.config.headers.Authorization = `Bearer ${newToken}`;
            error.config._isRetry = true; // Флаг чтобы избежать бесконечного цикла
            
            // Повторяем оригинальный запрос с новым токеном
            return api.request(error.config);
          }
        } catch (refreshError) {
          console.log('[API] ❌ Не удалось обновить токен:', refreshError);
          // Продолжаем обработку как session error
        }
        
        // Если refresh не удался, проверяем нужно ли разлогиниваться  
        const errorDetail = error.response?.data?.detail || '';
        
        // Разлогиниваем только при серьезных проблемах с сессией, НЕ при истечении токена
        const shouldLogout = errorDetail.includes('сессия недействительна') || 
                            errorDetail.includes('сессия завершена') ||
                            errorDetail.includes('session invalid') ||
                            errorDetail.includes('session expired') ||
                            errorDetail.includes('недействительна') ||
                            errorDetail.includes('завершена') ||
                            (errorDetail.includes('токен') && !errorDetail.includes('истек')) ||  // Токен проблемы кроме истечения
                            error.response?.data?.message?.includes('session');
        
        if (shouldLogout) {
          console.log('[API] 🚪 Автоматический разлогин - проблема с сессией/токеном:', errorDetail);
          
          // Очищаем локальные данные
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_data');
          
          // 🧹 ОЧИЩАЕМ СОХРАНЕННЫЕ АККАУНТЫ
          const { clearAllSavedAccounts } = await import('../../features/auth/utils/savedAccountsUtils');
          clearAllSavedAccounts();
          console.log('[API] 🗑️ Очищены сохраненные аккаунты');
          
          // Уведомляем Redux о разлогине
          const { store } = await import('../../features/booking/store');
          const { clearAuth } = await import('../../features/auth/store/authSlice');
          store.dispatch(clearAuth());
          
          // Показываем уведомление пользователю
          console.log('📢 Сессия была завершена');
          
          // Перезагружаем страницу чтобы показать экран авторизации
          window.location.reload();
        } else {
          console.log('[API] ⚠️ 401 ошибка, но refresh не помог - игнорируем:', errorDetail);
        }
      } else {
        console.log('[API] ⚠️ 401 ошибка в auth endpoint или retry - пропускаем обработку');
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 