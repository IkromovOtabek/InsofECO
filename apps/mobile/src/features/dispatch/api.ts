import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uuid } from '@/core/api';
import { orderKeys } from '../orders/api';

export interface BoardDelivery { id: string; sequence: number; status: string; plannedM3: string; plannedAt: string; slaBreached: boolean; order: { id: string; number: number; address: string; client: { name: string } }; driver: { user: { id: string; fullName: string | null; phone: string } } | null; vehicle: { id: string; plateNumber: string } | null }
export interface Board { deliveries: BoardDelivery[]; drivers: { userId: string; fullName: string | null; phone: string; activeDelivery: { id: string; status: string } | null }[]; vehicles: { id: string; plateNumber: string; capacityM3: string }[] }

export const useBoard = (date?: string) => useQuery({ queryKey: ['dispatch', 'board', date], queryFn: () => api<Board>('/dispatch/board', { query: { date } }), refetchInterval: 20_000 });

export function usePlan(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (capacityM3?: number) => api(`/dispatch/orders/${orderId}/plan`, { method: 'POST', body: { capacityM3 }, idempotencyKey: uuid() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: orderKeys.all }); void qc.invalidateQueries({ queryKey: ['dispatch'] }); },
  });
}

export function useAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { deliveryId: string; driverUserId: string; vehicleId: string }) => api(`/dispatch/deliveries/${v.deliveryId}/assign`, { method: 'POST', body: { driverUserId: v.driverUserId, vehicleId: v.vehicleId }, idempotencyKey: uuid() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: orderKeys.all }); void qc.invalidateQueries({ queryKey: ['dispatch'] }); },
  });
}
