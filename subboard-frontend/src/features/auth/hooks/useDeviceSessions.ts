import { useState, useEffect, useCallback } from 'react';
import api from '@/shared/services/api';

export interface DeviceSession {
  id: number;
  device_fingerprint: string;
  ip_address: string;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  country: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  is_current?: boolean; // Добавляем поле для определения текущей сессии
}

interface UseDeviceSessionsReturn {
  sessions: DeviceSession[];
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  terminateSession: (sessionId: number) => Promise<void>;
  terminateAllOthers: () => Promise<void>;
  refreshSessions: () => void;
}

export const useDeviceSessions = (): UseDeviceSessionsReturn => {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Загружаем device sessions...');
      
      // Получаем текущий refresh token для определения текущей сессии
      const refreshToken = localStorage.getItem('refresh_token');
      console.log('🔍 Current refresh token:', refreshToken ? 'присутствует' : 'отсутствует');
      
      const response = await api.get('/v1/auth/device-sessions');
      console.log('🔍 Device sessions response:', response.data);
      
      // API возвращает { sessions: [...], current_session_id?: number }
      const sessionsData = response.data.sessions || [];
      const currentSessionId = response.data.current_session_id;
      
      console.log('🔍 Sessions data:', sessionsData);
      console.log('🔍 Current session ID from server:', currentSessionId);
      
      if (sessionsData.length === 0) {
        console.log('⚠️ Получен пустой список сеансов');
        setSessions([]);
        return;
      }
      
      // Сортируем сессии по времени создания (новые сверху)
      const sortedSessions = sessionsData.sort((a: DeviceSession, b: DeviceSession) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Помечаем текущую сессию на основе данных с сервера
      const sessionsWithCurrent = sortedSessions.map((session: DeviceSession) => ({
        ...session,
        is_current: currentSessionId ? session.id === currentSessionId : false
      }));
      
      console.log('✅ Processed sessions with current marking:', sessionsWithCurrent);
      setSessions(sessionsWithCurrent);
    } catch (err: any) {
      console.error('❌ Ошибка загрузки сеансов:', err);
      console.error('❌ Error response:', err.response);
      console.error('❌ Error status:', err.response?.status);
      console.error('❌ Error data:', err.response?.data);
      setError(err.response?.data?.detail || 'Ошибка загрузки сеансов');
    } finally {
      setLoading(false);
    }
  }, []);

  const terminateSession = useCallback(async (sessionId: number) => {
    try {
      console.log('🗑️ Завершаем сеанс:', sessionId);
      const response = await api.delete(`/v1/auth/device-sessions/${sessionId}`);
      console.log('✅ Сеанс завершен:', sessionId, 'Response:', response.data);
      
      // Обновляем список сеансов
      console.log('🔄 Обновляем список сеансов после завершения...');
      await fetchSessions();
    } catch (err: any) {
      console.error('❌ Ошибка завершения сеанса:', err);
      console.error('❌ Error response:', err.response?.data);
      setError(err.response?.data?.detail || 'Ошибка завершения сеанса');
    }
  }, [fetchSessions]);

  const terminateAllOthers = useCallback(async () => {
    try {
      const response = await api.post('/v1/auth/device-sessions/close-others');
      console.log('✅ Завершены все другие сеансы:', response.data);
      
      // Обновляем список сеансов
      await fetchSessions();
    } catch (err: any) {
      console.error('❌ Ошибка завершения сеансов:', err);
      setError(err.response?.data?.detail || 'Ошибка завершения сеансов');
    }
  }, [fetchSessions]);

  const refreshSessions = useCallback(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Загружаем сеансы при монтировании хука
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    terminateSession,
    terminateAllOthers,
    refreshSessions
  };
}; 