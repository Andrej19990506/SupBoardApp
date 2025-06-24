// Утилита для отслеживания недавно обновленных бронирований
// Помогает избежать конфликтов между автоматическими и ручными обновлениями статусов

class BookingUpdateTracker {
    private recentUpdates = new Map<number, number>();
    private readonly UPDATE_COOLDOWN = 3 * 60 * 1000; // 3 минуты в миллисекундах

    /**
     * Помечает бронирование как недавно обновленное
     */
    markAsUpdated(bookingId: number): void {
        this.recentUpdates.set(bookingId, Date.now());
        console.log(`📝 Помечено как недавно обновленное: бронирование ${bookingId}`);
    }

    /**
     * Проверяет, было ли бронирование недавно обновлено
     */
    wasRecentlyUpdated(bookingId: number): boolean {
        const updateTime = this.recentUpdates.get(bookingId);
        if (!updateTime) {
            return false;
        }

        const timeSinceUpdate = Date.now() - updateTime;
        const isRecent = timeSinceUpdate < this.UPDATE_COOLDOWN;
        
        if (!isRecent) {
            // Если время истекло, удаляем запись
            this.recentUpdates.delete(bookingId);
        }

        return isRecent;
    }

    /**
     * Очищает информацию о недавних обновлениях для несуществующих бронирований
     */
    cleanup(existingBookingIds: number[]): void {
        const existingIds = new Set(existingBookingIds);
        
        // Используем Array.from для совместимости с TypeScript
        Array.from(this.recentUpdates.keys()).forEach(bookingId => {
            if (!existingIds.has(bookingId)) {
                this.recentUpdates.delete(bookingId);
            }
        });
    }

    /**
     * Получает время последнего обновления бронирования
     */
    getLastUpdateTime(bookingId: number): number | undefined {
        return this.recentUpdates.get(bookingId);
    }

    /**
     * Получает количество минут с последнего обновления
     */
    getMinutesSinceUpdate(bookingId: number): number | null {
        const updateTime = this.recentUpdates.get(bookingId);
        if (!updateTime) {
            return null;
        }

        return Math.floor((Date.now() - updateTime) / (60 * 1000));
    }
}

// Создаем глобальный экземпляр
export const bookingUpdateTracker = new BookingUpdateTracker();

export default bookingUpdateTracker; 