import { useState, useEffect } from 'react';
import { inventoryApi } from '@/features/booking/services/inventoryApi';

/**
 * Хук для получения общего количества доступного инвентаря
 * Заменяет старую логику подсчета досок
 */
export const useInventoryTotal = () => {
    const [totalInventory, setTotalInventory] = useState<number>(15); // Дефолтное значение
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadInventoryTotal = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Загружаем статистику инвентаря
                const statsResponse = await inventoryApi.getInventoryStats();
                const stats = statsResponse.data;
                
                // Считаем общее количество доступного инвентаря
                const total = stats.available_items || 0;
                
                console.log('[useInventoryTotal] Loaded inventory stats:', {
                    total_items: stats.total_items,
                    available_items: stats.available_items,
                    in_use_items: stats.in_use_items,
                    calculated_total: total,
                    willSetTotalInventory: total > 0 ? total : 15
                });
                
                // Если нет инвентаря, используем дефолтное значение 15
                const finalTotal = total > 0 ? total : 15;
                console.log('[useInventoryTotal] Setting totalInventory to:', finalTotal);
                setTotalInventory(finalTotal);
                
            } catch (err) {
                console.error('[useInventoryTotal] Error loading inventory:', err);
                setError('Ошибка загрузки инвентаря');
                // При ошибке используем дефолтное значение
                setTotalInventory(15);
            } finally {
                setLoading(false);
            }
        };

        loadInventoryTotal();
    }, []);

    return {
        totalInventory,
        loading,
        error,
        refresh: () => {
            setLoading(true);
            // Можно добавить логику обновления
        }
    };
}; 