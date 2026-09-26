/** Insof ERP hooklari — mobil ilovadagi xodim bo'limlari uchun. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { erpAuth, type ErpTripRoute } from '@/core/erp';

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

/**
 * Marshrut ekrani.
 *
 * Yo'l mashinaning hozirgi joyidan quriladi, shuning uchun joylashuvni beruvchi funksiya
 * uziladi (`ref` dan o'qiydi): har GPS nuqtasida so'rov qayta tuzilsa, OSRM'ga daqiqada
 * o'nlab murojaat ketardi. 90 soniyada bir yangilanadi.
 *
 * Chiziq KESHDA saqlanadi. Server uni har javobda qaytarmaydi (17 KB geometriya bekorga
 * yurmasin), shuning uchun "qaytarmadim" degan javob kelganda avvalgisini o'rnida
 * qoldiramiz. Aks holda ekrandan chiqib qaytilganda kesh chiziqsiz javobni ko'rsatib,
 * xaritada yo'l umuman chizilmay qolardi.
 */
export const useErpTripRoute = (
  id: string,
  pos: () => { lat: number; lng: number } | null,
  /** `true` — yo'lni qayta qurish kerak (yo'ldan chiqib ketilgan yoki hali chiziq yo'q). */
  wantNewLine: () => boolean,
) => {
  const qc = useQueryClient();
  const key = ['erp', 'trip-route', id];
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const prev = qc.getQueryData<ErpTripRoute>(key);
      const keep = !wantNewLine() && !!prev?.line.length;
      const next = await erpAuth.tripRoute(id, pos() ?? undefined, keep);
      if (next.lineIncluded || !prev?.line.length) return next;
      // Server chiziqni qayta qurmadi — avvalgisi bilan to'ldiramiz
      return { ...next, lineIncluded: true, line: prev.line, routeMeters: prev.routeMeters, routeSeconds: prev.routeSeconds, routeSource: prev.routeSource };
    },
    enabled: !!id,
    refetchInterval: 90_000,
  });
};

/**
 * Bildirishnomalar. Yarim daqiqada bir yangilanadi: push kelmagan bo'lsa ham
 * (ruxsat berilmagan, telefon o'chiq edi) xodim ro'yxatda ko'radi.
 */
export const useErpNotifications = () =>
  useQuery({ queryKey: ['erp', 'notifications'], queryFn: erpAuth.notifications, refetchInterval: 30_000 });

/** Ro'yxat ochilganda hammasi o'qilgan deb belgilanadi. */
export function useErpReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => erpAuth.readNotifications(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp', 'notifications'] }),
  });
}

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
