import type { Booking, ServiceType } from '@/types/booking';

// Расширенные типы для функций сотрудников
export interface ClientSearchResult {
    id: string;
    name: string;
    phone: string;
    lastBookingDate?: string;
    totalBookings: number;
    isVIP: boolean;
    comments?: string;
}

export interface ClientHistory {
    bookings: Array<{
        id: string;
        date: string;
        serviceType: ServiceType;
        inventoryUsed: string;
        totalCost: number;
        comment?: string;
    }>;
    totalSpent: number;
    favoriteService: ServiceType;
    averageBookingInterval: number; // дней между бронированиями
}

export interface EmployeePricing {
    boardPrice: number;
    boardWithSeatPrice: number;
    raftPrice: number;
    deposit: number;
    discounts: {
        vip: number;      // % скидка для VIP клиентов
        repeat: number;   // % скидка для постоянных клиентов
        group: number;    // % скидка для групп
    };
}

export interface BookingConflict {
    conflictType: 'time_overlap' | 'inventory_shortage' | 'weather_warning';
    severity: 'warning' | 'error';
    message: string;
    affectedBooking?: Pick<Booking, 'id' | 'clientName' | 'plannedStartTime'>;
    suggestedAlternatives?: Array<{
        time: string;
        availableInventory: number;
    }>;
}

export interface EmployeeFormState extends Omit<Booking, 'id' | 'status' | 'actualStartTime' | 'timeReturnedByClient' | 'boardIds'> {
    id?: string;
    plannedDate: string;        // YYYY-MM-DD
    plannedTime: string;        // HH:mm
    durationRentDays: number;   // для аренды в днях
    
    // Дополнительные поля для сотрудников
    selectedClient?: ClientSearchResult;
    estimatedCost: number;
    depositAmount: number;
    appliedDiscount: number;
    employeeNotes?: string;
    isVIPClient: boolean;
    hasSpecialRequirements: boolean;
}

export interface EmployeeFormValidation {
    conflicts: BookingConflict[];
    warnings: string[];
    suggestions: string[];
    isValid: boolean;
    canProceed: boolean;
}

export interface QuickTimeSlot {
    time: string;
    label: string;
    isAvailable: boolean;
    availableInventory: number;
}

export interface QuickComment {
    id: string;
    text: string;
    category: 'client_type' | 'special_needs' | 'equipment' | 'other';
}

// Типы для автокомплита клиентов
export interface ClientAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onClientSelect: (client: ClientSearchResult) => void;
    placeholder?: string;
    disabled?: boolean;
}

export interface PricingConfig {
    // Режим ценообразования
    pricingMode: 'hourly' | 'fixed' | 'hybrid';
    
    // Цены по типам инвентаря - гибкая система
    inventoryPricing: {
        [inventoryTypeId: number]: {
            // Почасовая цена
            hourlyRate: number;
            
            // Фиксированные цены для аренды
            fixedPrices: {
                rent: {
                    '24h': number;    // сутки
                    '48h': number;    // 2 суток
                    '72h': number;    // 3 суток
                    'week': number;   // неделя
                };
                // Фиксированная цена для сплава
                rafting: number;
            };
            
            // Залог за единицу
            deposit: number;
            
            // Применяется ли залог
            requireDeposit: boolean;
        };
    };
    
    // Скидки
    discounts: {
        enableDiscounts: boolean;
        rates: {
            vip: number;
            group: number;
            repeat: number;
        };
    };
}

export interface PricingDisplayProps {
    serviceType: ServiceType;
    // Новая система - выбранный инвентарь по типам
    selectedItems: Record<number, number>; // inventoryTypeId -> quantity
    durationInHours: number;
    discount?: number;
    isVIP?: boolean;
    pricingConfig?: PricingConfig;
    onConfigChange?: (config: PricingConfig) => void;
    showSettings?: boolean;
    
    // Устаревшие поля для обратной совместимости (deprecated)
    boardCount?: number;
    boardWithSeatCount?: number;
    raftCount?: number;
}

// Типы для быстрых действий сотрудников
export interface EmployeeAction {
    id: string;
    label: string;
    icon: string;
    action: () => void | Promise<void>;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
}

export interface EmployeeFormEnhancements {
    showClientHistory: boolean;
    enableQuickComments: boolean;
    showPricingCalculator: boolean;
    enableConflictDetection: boolean;
    showInventoryPreview: boolean;
    enableClientAutocomplete: boolean;
} 