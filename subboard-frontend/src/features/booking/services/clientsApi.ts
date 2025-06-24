import api from '@/shared/services/api';
import type { ClientSearchResult } from '@features/booking/components/BookingForm/types';

export interface ClientCreateRequest {
    name: string;
    phone: string;
    email?: string;
    is_vip?: boolean;
    comments?: string;
}

export interface ClientResponse {
    id: number;
    name: string;
    phone: string;
    email?: string;
    is_vip: boolean;
    comments?: string;
    created_at: string;
    updated_at: string;
    last_booking_date?: string;
    total_bookings: number;
}

export const clientsApi = {
    // Поиск клиентов для автокомплита
    searchClients: async (query: string, limit: number = 10) => {
        const response = await api.get<any[]>(`/v1/customers/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        
        // Маппим snake_case в camelCase
        const mappedData: ClientSearchResult[] = response.data.map(client => ({
            id: client.id.toString(),
            name: client.name,
            phone: client.phone,
            isVIP: client.is_vip,
            totalBookings: client.total_bookings,
            lastBookingDate: client.last_booking_date,
            comments: client.comments
        }));
        
        return { ...response, data: mappedData };
    },
    
    // Создание нового клиента
    createClient: (client: ClientCreateRequest) =>
        api.post<ClientResponse>('/v1/customers', client),
    
    // Получение клиента по ID
    getClient: (id: number) =>
        api.get<ClientResponse>(`/v1/customers/${id}`),
    
    // Получение списка всех клиентов
    getClients: (skip: number = 0, limit: number = 100) =>
        api.get<ClientResponse[]>(`/v1/customers?skip=${skip}&limit=${limit}`),
    
    // Обновление клиента
    updateClient: (id: number, client: Partial<ClientCreateRequest>) =>
        api.patch<ClientResponse>(`/v1/customers/${id}`, client),
    
    // Удаление клиента
    deleteClient: (id: number) =>
        api.delete(`/v1/customers/${id}`)
}; 