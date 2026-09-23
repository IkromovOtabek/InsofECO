/** Insof ERP hooklari — mobil ilovadagi xodim bo'limlari uchun. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { erpAuth } from '@/core/erp';

export const useErpHome = () =>
  useQuery({ queryKey: ['erp', 'home'], queryFn: erpAuth.home, refetchInterval: 30_000 });

export const useErpList = (key: string, q?: string, filter?: string) =>
  useQuery({ queryKey: ['erp', 'list', key, q ?? '', filter ?? ''], queryFn: () => erpAuth.list(key, q, filter), enabled: !!key });

/**
 * Kartochka. Reys kartochkasi davriy yangilanadi — reys davomida "Yurilgan yo'l" raqami
 * o'sib boradi va haydovchi ham, logistika ham uni kutmasdan ko'radi. Boshqa kartochkalarda
 * bunga hojat yo'q (schyot yoki xodim ma'lumoti o'z-o'zidan o'zgarmaydi).
 */
export const useErpDetail = (key: string, id: string) =>
  useQuery({
    queryKey: ['erp', 'detail', key, id],
    queryFn: () => erpAuth.detail(key, id),
    enabled: !!key && !!id,
    refetchInterval: key === 'trips' ? 30_000 : false,
  });

export const useErpForm = (key: string) =>
  useQuery({ queryKey: ['erp', 'form', key], queryFn: () => erpAuth.form(key), enabled: !!key, staleTime: 0 });

/** Yangi hujjat ochish. Muvaffaqiyatda ro'yxat va ko'rsatkichlar yangilanadi. */
export function useErpCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; payload: Record<string, unknown> }) => erpAuth.create(v.key, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp'] }),
  });
}

/** Amal bajarilgach butun ERP keshi yangilanadi — ko'rsatkichlar ham darhol o'zgaradi. */
export function useErpAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { action: string; id: string; payload?: Record<string, unknown> }) => erpAuth.action(v.action, v.id, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp'] }),
  });
}
