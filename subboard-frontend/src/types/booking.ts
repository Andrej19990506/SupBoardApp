export const BookingStatus = {
    BOOKED: 'booked',        // Забронировано (неподтвержденное)
    PENDING_CONFIRMATION: 'pending_confirmation', // Ожидает подтверждения (за час до начала)
    CONFIRMED: 'confirmed',  // Подтверждено (готово к выдаче)
    IN_USE: 'in_use',        // Саб забрали, идет отсчет времени аренды/сплава
    COMPLETED: 'completed',  // Аренда/сплав завершена, саб снова доступен
    CANCELLED: 'cancelled',  // Отменено
    NO_SHOW: 'no_show',      // Не явился (клиент не пришел)
    RESCHEDULED: 'rescheduled' // Перенесено на другое время
} as const;

export const ServiceType = {
    RENT: 'аренда',
    RAFTING: 'сплав'
} as const;

export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];
export type ServiceType = typeof ServiceType[keyof typeof ServiceType];

export const PREPARATION_DURATION_HOURS = 1; // Длительность подготовки в часах

export type InventoryType = 'board' | 'board_with_seat' | 'raft';

export interface Booking {
    id: string;
    clientName: string;
    phone: string;
    
    serviceType: ServiceType;
    /**
     * @deprecated Используйте selectedItems или boardIds
     */
    boardCount: number; // обычные доски без кресла
    /**
     * @deprecated Используйте selectedItems или boardIds
     */
    boardWithSeatCount?: number; // доски с креслом
    /**
     * @deprecated Используйте selectedItems или boardIds
     */
    raftCount?: number; // плоты
    /**
     * Новая система инвентаря: typeId -> количество
     */
    selectedItems?: Record<number, number>;
    /**
     * Массив id досок, назначенных на эту бронь
     */
    boardIds: number[];
    // inventoryType: InventoryType; // больше не используется для логики, только для обратной совместимости
    
    // Плановые параметры, устанавливаемые при создании/редактировании брони
    plannedStartTime: string; // ISO datetime string (YYYY-MM-DDTHH:mm:ssZ)
    durationInHours: number;  // Длительность в часах (для RENT: N * 24, для RAFTING: 4)
    
    // Фактические временные метки этапов жизненного цикла брони
    actualStartTime?: string;   // ISO datetime string, когда саб фактически забрали (статус меняется на IN_USE)
    // Фактическое время окончания аренды/сплава (actualEndTime) будет вычисляться: actualStartTime + durationInHours

    timeReturnedByClient?: string; // ISO datetime string, когда клиент фактически вернул саб (статус меняется на PREPARING)
    // Время окончания подготовки (preparationEndTime) будет вычисляться: timeReturnedByClient + PREPARATION_DURATION_HOURS
    
    status: BookingStatus;
    comment?: string;
}

export interface BookingsState {
    bookings: { [date: string]: Booking[] }; // Ключ - дата в формате YYYY-MM-DD для группировки в календаре
    selectedDate: string | null; // YYYY-MM-DD
    isLoading: boolean;
    error: string | null;
}

export type BookingsMap = { [date: string]: Booking[] };

// Пейлоады для экшенов остаются прежними, но теперь они будут работать с новой структурой Booking
export interface CreateBookingPayload {
    // При создании ID генерируется на бэке или в момент диспатча, статус по умолчанию BOOKED
    booking: Omit<Booking, 'id' | 'status' | 'actualStartTime' | 'timeReturnedByClient'> & Partial<Pick<Booking, 'comment'>>;
}

export interface UpdateBookingPayload {
    booking: Partial<Booking> & Pick<Booking, 'id'>; // Для обновления можно передавать только измененные поля + обязательный ID
}

export interface DeleteBookingPayload {
    bookingId: string;
    // date нужен для удаления из конкретного дня в стейте bookings, если он все еще так структурирован
    // Если selectedDate используется для определения дня, то можно его использовать оттуда
    // Либо передавать plannedStartTime, чтобы найти бронь в соответствующем дне.
    // Пока оставим date, но это место для возможной ревизии в зависимости от логики в slice.
    date: string; 
}

export interface ReminderTemplate {
    id: string;
    name: string;
    content: string;
    isDefault?: boolean;
}

export interface ReminderSettings {
    enabled: boolean;
    timeBeforeInMinutes: number; // За сколько минут до начала отправлять
    templates: ReminderTemplate[];
}

export interface ReminderStatus {
    bookingId: string;
    sentAt: Date;
    template: string;
    success: boolean;
    error?: string;
}

export interface ReminderHistory {
    date: string; // YYYY-MM-DD
    sent: ReminderStatus[];
} 