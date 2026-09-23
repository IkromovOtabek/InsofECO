import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateOrderInput, OrderStatus } from '@insof/shared';
import { api, uuid } from '@/core/api';

export interface OrderItem { id: string; gradeSnapshot: string; nameSnapshot: string; volumeM3: string; unitPriceSnapshot: string }
export interface DeliveryLite { id: string; sequence: number; status: string; plannedM3: string; plannedAt: string; slaBreached: boolean; driver?: { user: { fullName: string | null; phone: string } } | null; vehicle?: { plateNumber: string } | null }
export interface Order {
  id: string; number: number; status: OrderStatus; address: string; lat: number; lng: number; scheduledAt: string; intervalMinutes: number; needsPump: boolean; note?: string | null;
  totalAmount: string; totalVolumeM3: string; deliveryFee: string; plantOrgId: string; clientOrgId: string;
  items: OrderItem[]; client: { id: string; name: string }; plant: { id: string; name: string }; site?: { id: string; name: string } | null; deliveries?: DeliveryLite[];
  credit?: { debt: number; limit: number | null; exceeded: boolean };
}
export interface Mix { id: string; grade: string; name: string; slump?: string | null; unitPrice: string }

export const orderKeys = { all: ['orders'] as const, list: (f: Record<string, unknown>) => ['orders', 'list', f] as const, one: (id: string) => ['orders', id] as const };

export const useOrders = (filter: { status?: string; date?: string } = {}) =>
  useQuery({ queryKey: orderKeys.list(filter), queryFn: () => api<{ items: Order[]; nextCursor: string | null }>('/orders', { query: filter }) });

export const useOrder = (id: string) => useQuery({ queryKey: orderKeys.one(id), queryFn: () => api<Order>(`/orders/${id}`), refetchInterval: 15_000 });

export const usePlants = () => useQuery({ queryKey: ['plants'], queryFn: () => api<{ id: string; name: string; address?: string }[]>('/organizations/plants') });
export const useMixes = (plantOrgId?: string) => useQuery({ queryKey: ['mixes', plantOrgId], queryFn: () => api<Mix[]>('/catalog/mixes', { query: { plantOrgId } }), enabled: !!plantOrgId });

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const created = await api<Order>('/orders', { method: 'POST', body: input, idempotencyKey: uuid() });
      return api<Order>(`/orders/${created.id}/submit`, { method: 'POST', idempotencyKey: uuid() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useOrderAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: 'confirm' | 'reject' | 'cancel'; body?: unknown }) => api<Order>(`/orders/${id}/${action}`, { method: 'POST', body: body ?? {}, idempotencyKey: uuid() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
