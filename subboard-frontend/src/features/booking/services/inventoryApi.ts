import api from '@/shared/services/api';

// Типы для новой системы инвентаря
export interface InventoryType {
    id: number;
    name: string;
    display_name: string;
    description?: string;
    icon_name?: string;
    color?: string;
    is_active: boolean;
    affects_availability: boolean;  // Влияет ли на занятость временных слотов
    board_equivalent: number;       // Сколько "досок" эквивалентно одной единице
    created_at: string;
    updated_at: string;
    items_count?: number;
    available_count?: number;
}

export interface InventoryItem {
    id: number;
    inventory_type_id: number;
    name?: string;
    status: string;
    current_booking_id?: string;
    serial_number?: string;
    purchase_date?: string;
    notes?: string;
    item_metadata?: any;
    last_service_end?: string;
    created_at: string;
    updated_at: string;
    inventory_type?: InventoryType;
}

export interface InventoryStats {
    total_types: number;
    total_items: number;
    available_items: number;
    in_use_items: number;
    servicing_items: number;
    repair_items: number;
    by_type: Record<string, {
        display_name: string;
        total: number;
        available: number;
        in_use: number;
        servicing: number;
        repair: number;
    }>;
}

export interface InventoryTypeCreate {
    name: string;
    display_name: string;
    description?: string;
    icon_name?: string;
    color?: string;
    is_active?: boolean;
    affects_availability?: boolean;
    board_equivalent?: number;
    settings?: any;
}

export interface InventoryTypeQuickCreate {
    name: string;
    display_name: string;
    description?: string;
    icon_name?: string;
    color?: string;
    affects_availability?: boolean;
    board_equivalent?: number;
    initial_quantity: number;
    settings?: any;
}

export interface InventoryTypeUpdate {
    name?: string;
    display_name?: string;
    description?: string;
    icon_name?: string;
    color?: string;
    is_active?: boolean;
    affects_availability?: boolean;
    board_equivalent?: number;
    settings?: any;
}

export interface InventoryItemCreate {
    inventory_type_id: number;
    name?: string;
    status?: string;
    serial_number?: string;
    purchase_date?: string;
    notes?: string;
    item_metadata?: any;
}

export interface InventoryItemUpdate {
    name?: string;
    status?: string;
    current_booking_id?: string;
    serial_number?: string;
    purchase_date?: string;
    notes?: string;
    item_metadata?: any;
}

export const inventoryApi = {
    // Типы инвентаря
    getInventoryTypes: (params?: {
        skip?: number;
        limit?: number;
        include_inactive?: boolean;
    }) => {
        const searchParams = new URLSearchParams();
        if (params?.skip !== undefined) searchParams.set('skip', params.skip.toString());
        if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
        if (params?.include_inactive !== undefined) searchParams.set('include_inactive', params.include_inactive.toString());
        
        const queryString = searchParams.toString();
        return api.get<InventoryType[]>(`/v1/inventory/types${queryString ? `?${queryString}` : ''}`);
    },

    getInventoryType: (typeId: number) => 
        api.get<InventoryType>(`/v1/inventory/types/${typeId}`),

    createInventoryType: (data: InventoryTypeCreate) =>
        api.post<InventoryType>('/v1/inventory/types', data),

    createInventoryTypeQuick: (data: InventoryTypeQuickCreate) =>
        api.post<InventoryType>('/v1/inventory/types/quick', data),

    updateInventoryType: (typeId: number, data: InventoryTypeUpdate) =>
        api.patch<InventoryType>(`/v1/inventory/types/${typeId}`, data),

    deleteInventoryType: (typeId: number) =>
        api.delete(`/v1/inventory/types/${typeId}`),

    // Единицы инвентаря
    getInventoryItems: (params?: {
        type_id?: number;
        status?: string;
    }) => {
        const searchParams = new URLSearchParams();
        if (params?.type_id !== undefined) searchParams.set('type_id', params.type_id.toString());
        if (params?.status !== undefined) searchParams.set('status', params.status);
        
        const queryString = searchParams.toString();
        return api.get<InventoryItem[]>(`/v1/inventory/items${queryString ? `?${queryString}` : ''}`);
    },

    getInventoryItem: (itemId: number) =>
        api.get<InventoryItem>(`/v1/inventory/items/${itemId}`),

    createInventoryItem: (data: InventoryItemCreate) =>
        api.post<InventoryItem>('/v1/inventory/items', data),

    updateInventoryItem: (itemId: number, data: InventoryItemUpdate) =>
        api.patch<InventoryItem>(`/v1/inventory/items/${itemId}`, data),

    deleteInventoryItem: (itemId: number) =>
        api.delete(`/v1/inventory/items/${itemId}`),

    // Массовые операции
    createMultipleItems: (typeId: number, params: {
        quantity: number;
        name_prefix?: string;
    }) => {
        const searchParams = new URLSearchParams();
        searchParams.set('quantity', params.quantity.toString());
        if (params.name_prefix) searchParams.set('name_prefix', params.name_prefix);
        
        return api.post<InventoryItem[]>(`/v1/inventory/items/bulk?type_id=${typeId}&${searchParams.toString()}`);
    },

    // Alias для удобства
    createInventoryItemsBulk: (typeId: number, quantity: number, namePrefix?: string) => {
        const searchParams = new URLSearchParams();
        searchParams.set('quantity', quantity.toString());
        if (namePrefix) searchParams.set('name_prefix', namePrefix);
        
        return api.post<InventoryItem[]>(`/v1/inventory/items/bulk?type_id=${typeId}&${searchParams.toString()}`);
    },

    // Статистика и служебные методы
    getInventoryStats: () =>
        api.get<InventoryStats>('/v1/inventory/stats'),

    getInventoryAvailability: () =>
        api.get<Record<string, number>>('/v1/inventory/availability'),
}; 