export const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const BOOKING_STATUSES = {
    BOOKED: 'booked',
    PAID: 'paid'
} as const;

export const SERVICE_TYPES = {
    RENT: 'аренда',
    RAFTING: 'сплав'
} as const;

export const INVENTORY_TYPES = [
    { value: 'board', label: 'Доска' },
    { value: 'board_with_seat', label: 'Доска с креслом' },
    { value: 'raft', label: 'Плот (2 доски + 2 кресла)' },
]; 