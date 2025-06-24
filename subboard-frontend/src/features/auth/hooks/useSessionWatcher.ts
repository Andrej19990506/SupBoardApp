import { useEffect, useRef } from 'react';

/**
 * Минимальный хук для отслеживания фокуса
 * Основная защита сессий теперь на уровне API interceptor
 */
export const useSessionWatcher = () => {
  const lastFocusCheck = useRef<number>(0);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      // Ограничиваем проверки - не чаще раза в 10 секунд
      if (now - lastFocusCheck.current < 10000) {
        return;
      }
      lastFocusCheck.current = now;
      
      console.log('🔍 [SessionWatcher] Фокус на вкладке - защита через API interceptor активна');
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
}; 