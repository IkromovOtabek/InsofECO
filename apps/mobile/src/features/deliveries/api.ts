import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeliveryStatus } from '@insof/shared';
import { api, uuid } from '@/core/api';
import { outbox } from '@/core/outbox';
import { queryClient } from '@/core/query';

export interface Delivery {
  id: string; sequence: number; status: DeliveryStatus; plannedM3: string; loadedM3?: string | null; acceptedM3?: string | null; plannedAt: string; departedAt?: string | null; arrivedAt?: string | null; slaBreached: boolean;
  order: { id: string; number: number; address: string; lat: number; lng: number; plantOrgId: string; clientOrgId: string; needsPump: boolean; client: { name: string }; items: { gradeSnapshot: string; nameSnapshot: string }[] };
  driver: { user: { id: string; fullName: string | null; phone: string } } | null;
  vehicle: { plateNumber: string; capacityM3: string } | null;
  events: { id: string; from: DeliveryStatus | null; to: DeliveryStatus; at: string; byRole: string; note?: string | null }[];
}

export const deliveryKeys = { mine: (date?: string) => ['deliveries', 'mine', date] as const, one: (id: string) => ['deliveries', id] as const };

export const useMyDeliveries = (date?: string) => useQuery({ queryKey: deliveryKeys.mine(date), queryFn: () => api<Delivery[]>('/deliveries/mine', { query: { date } }), refetchInterval: 30_000 });
export const useDelivery = (id: string) => useQuery({ queryKey: deliveryKeys.one(id), queryFn: () => api<Delivery>(`/deliveries/${id}`), refetchInterval: 15_000 });

/**
 * Haydovchi holat o'tishi — optimistik + outbox. Internet bo'lmasa ham tugma darhol "ishlaydi".
 * Server rad etsa (409) — keyingi refetch haqiqiy holatni qaytaradi.
 */
export function useDriverTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { to: DeliveryStatus; location?: { lat: number; lng: number }; loadedM3?: number; note?: string; photoKey?: string }) => {
      outbox.enqueue(`/deliveries/${id}/transition`, { ...v, at: new Date().toISOString() });
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: deliveryKeys.one(id) });
      const prev = qc.getQueryData<Delivery>(deliveryKeys.one(id));
      if (prev) qc.setQueryData<Delivery>(deliveryKeys.one(id), { ...prev, status: v.to });
      qc.setQueriesData<Delivery[]>({ queryKey: ['deliveries', 'mine'] }, (list) => list?.map((d) => (d.id === id ? { ...d, status: v.to } : d)));
      return { prev };
    },
    onSettled: () => setTimeout(() => void qc.invalidateQueries({ queryKey: ['deliveries'] }), 1500),
  });
}

export function useSignDelivery(id: string) {
  return useMutation({
    mutationFn: (v: { signatureKey?: string; otpCode?: string; acceptedM3: number; note?: string }) => api<Delivery>(`/deliveries/${id}/sign${v.otpCode ? '/by-otp' : ''}`, { method: 'POST', body: v, idempotencyKey: uuid() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['deliveries'] }); void queryClient.invalidateQueries({ queryKey: ['orders'] }); },
  });
}

export const requestAcceptOtp = (id: string) => api<{ sentTo: string }>(`/deliveries/${id}/accept-otp/request`, { method: 'POST' });

export function useDispute(id: string) {
  return useMutation({
    mutationFn: (v: { reason: 'VOLUME' | 'QUALITY' | 'LATE' | 'OTHER'; comment?: string }) => api<Delivery>(`/deliveries/${id}/dispute`, { method: 'POST', body: { ...v, photoKeys: [] }, idempotencyKey: uuid() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['deliveries'] }),
  });
}
